import { ENV, replaceStringWithEnv } from './env/env';
import {Client, Message, MessageReaction, User, Guild, PartialUser, ClientOptions, PresenceData} from 'discord.js';
import Commands from './commands';
import DraftServer from './models/DraftServer';
import Session from './models/Session';
import DraftUser from './models/DraftUser';
import Context, { ContextProps } from './commands/models/Context';
import { Resolver, DiscordResolver } from './models/types/ResolverTypes';
import { LowdbDriver } from './database/lowdb/LowdbDriver';
import { DBDriver } from './database/DBDriver';
import { InMemoryDriver } from './database/inmemory/InMemoryDriver';
import { ServerId } from './models/types/BaseTypes';
import { ExpressDriver } from './express/ExpressDriver';
import { ISessionView } from './database/SessionDBSchema';

//
// To set your Discord Bot Token, take a look at ./env/env.ts for an explanation (hint: make an env.json)
//

// Join Link: https://discord.com/api/oauth2/authorize?client_id={YOUR_CLIENT_ID}&scope=bot&permissions=133200

const SERVER_CACHE: Record<ServerId, DraftServer> = {};

////////////////
// DATA LAYER //
////////////////

function getDraftServer(guild: Guild, env: ENV, dbDriver: DBDriver): DraftServer {
    const serverId = guild.id;
    let server = SERVER_CACHE[serverId];
    if (!server) {
        const resolver = new Resolver(new DiscordResolver(guild, env), dbDriver);
        server = new DraftServer(env, resolver);
        SERVER_CACHE[serverId] = server;
    }
    return server;
}

function getServerAndSession(reaction: MessageReaction, env: ENV, dbDriver: DBDriver): [DraftServer, Session?] {
    const {message} = reaction;

    const {guild} = message;
    if (!guild) {
        throw new Error("Error with Discord - Guild not included in Message");
    }

    const draftServer = getDraftServer(guild, env, dbDriver);
    const session = draftServer.getSessionFromMessage(message);

    return [draftServer, session];
}

///////////////////////////////////////////
// Helper Methods for the Discord client //
///////////////////////////////////////////

async function outputError(e: Error, user: User | PartialUser, env: ENV) {
    console.log(e);
    await (await user.createDM()).send(env.ERROR_OUTPUT.replace("%s", e.message))
}

function onMessage(env: ENV, dbDriver: DBDriver, killSwitch: ()=>void) {
    const {DEBUG, PREFIX, log} = env;

    return async (message: Message) => {
        const {author, content} = message;

        // Perform initial filtering checks
        if (author.bot) return;
        if (DEBUG && content === 'dc') {
            killSwitch();
            return;
        }
        if (message.channel.type == 'dm') {
            await message.channel.send("Sorry, I don't respond in DMs. Give me a command from a server");
            return;
        }
        if (content.length === 0 || content[0] !== PREFIX) return;

        try {
            // Parse out the desired command
            const params = content.split(' ');
            let commandStr = params.shift();
            if (!commandStr) {
                return;
            }
            commandStr = commandStr.slice(PREFIX.length).trim();
            const command = Commands[commandStr];

            if (command) {
                // If a command exists, build the Context for it and execute

                const {guild, author} = message;
                if (!guild) {
                    throw new Error("Error with Discord.js - guild not included in message");
                }
                const draftServer = getDraftServer(guild, env, dbDriver);

                // Build the props for the Context
                const props: ContextProps = {
                    env: env,
                    draftServer: draftServer,
                    user: author,
                    parameters: params,
                    message: message
                }

                // Finally execute
                const start = Date.now();
                await command.execute(new Context(props));
                const end = Date.now();
                await message.react('✔️');

                const duration = end - start;
                log(`Command '${commandStr}' took ${duration} millis, aka ${duration/1000} seconds`)
            } else {
                log(`Invalid command: ${commandStr}`);
            }
        } catch (e) {
            await outputError(e, author, env);
            await message.react('❌');
        }
    }
}

type ReactionCallback = (p1: DraftUser, p2: Session) => Promise<void>;
type CurriedReactionCallback = (r: MessageReaction, u: User | PartialUser) => Promise<void>;
function onReaction(env: ENV, dbDriver: DBDriver, callback: ReactionCallback): CurriedReactionCallback {
    return async (reaction: MessageReaction, rawUser: User | PartialUser) => {
        if (rawUser.bot) return;

        try {
            const [draftServer, session] = getServerAndSession(reaction, env, dbDriver);

            if (session) {
                const draftUser = draftServer.resolver.resolveUser(rawUser.id);
                await callback(draftUser, session);
            }
        } catch (e) {
            await outputError(e, rawUser, env);
        }
    }
}

// The setup function that pre-loads Session data and turns on the Express server
function onReady(client: Client, env: ENV, dbDriver: DBDriver, expressDriver: ExpressDriver, provideKillSwitch: (killSwitch: ()=>void)=>void) {
    let killFlag = false;
    return async () => {
        env.log("Logged in successfully - BEGINNING SETUP");
        env.log(`${client.guilds.cache.array().length} guilds loaded`);

        // The first thing we do is go through and preload the guilds, messages, and users that
        // exist in the database.
        // We MUST preload guilds and sessions (so we are even watching those messages in the first place)
        // and preloading users 

        let numErrors = 0;
        let successful = 0;
        let additionalGuilds = 0;
        const kickedFromServerIds: {[key: string]: boolean} = {};
        await Promise.all(dbDriver.getAllSessions().map(async (sessionView: ISessionView) => {
            const { serverId, sessionId, ownerId } = sessionView;

            if (kickedFromServerIds[serverId]) {
                ++numErrors;
                // If we've already seen this server, all that needs
                // to happen is to remove it from the database
                dbDriver.deleteSessionFromDatabase(serverId, sessionId);
                return;
            }

            // If the bot has been kicked from a server OR
            // if we're unable to load the message we created OR
            // if there _should_ be an owner but maybe the owner left the server,
            // then just close the session (which deletes and notifies attendees).

            let guild = client.guilds.resolve(serverId);
            if (!guild) {
                try {
                    guild = await client.guilds.fetch(serverId);
                    ++additionalGuilds;
                } catch (e) {
                    ++numErrors;
                    // We were kicked from the server
                    kickedFromServerIds[serverId] = true;
                    dbDriver.deleteSessionFromDatabase(serverId, sessionId);

                    // Delete all other users from the database the first time this happens
                    dbDriver.getAllUsersFromServer(serverId).forEach((user) => {
                        dbDriver.deleteUserFromDatabase(serverId, user.userId);
                    });
                    return;
                }
            }

            const draftServer = getDraftServer(guild, env, dbDriver);

            if (ownerId) {
                try {
                    // Preload the owner
                    await guild.members.fetch(ownerId);

                    // Also preload their display name
                    // This is because if commands are executed via another input (ie Express)
                    // then the user may not have ever shown up to the client before.
                    // await draftServer.resolver.resolveUser(ownerId).getDisplayNameAsync();
                } catch (e) {
                    ++numErrors;
                    // The owner left the server
                    await draftServer.closeSession(sessionId);
                    return;
                }
            }

            const channel = draftServer.resolver.discordResolver.announcementChannel;
            if (channel) {
                try {
                    // Preload the message to watch
                    await channel.messages.fetch(sessionId);
                } catch (e) {
                    ++numErrors;
                    // The message was deleted
                    await draftServer.closeSession(sessionId);
                    return;
                }
            }

            ++successful;
        }));
        env.log(`Preloaded ${successful} sessions.${numErrors > 0 ? ` There were ${numErrors} discrepancies/issues but they have been resolved.` : ''}`);
        env.log(`${additionalGuilds} guilds added to cache.  New total: ${client.guilds.cache.array().length}`);

        if (!killFlag) {
            // Additional tasks that need to be started alongside the application lifecycle go here
            // Be sure to safely close everything using the killSwitch() below

            expressDriver.startServer();
        }

        provideKillSwitch(() => {
            env.log("Kill switch triggered, closing server");
            killFlag = true;
    
            // Anything that listens to a port/maintains a connection needs to be turned off
            expressDriver.stopServer();

            client.destroy(); // Kill the client last
            env.log("Cleanup complete. Bye bye!");
        });

        env.log("ALL SETUP COMPLETE - SERVER IS READY");
    }
}

////////////////////
// DISCORD CLIENT //
////////////////////

export default function main(env: ENV): void {
    const {DISCORD_BOT_TOKEN, BOT_ACTIVITY, BOT_ACTIVITY_TYPE, MESSAGE_CACHE_SIZE, DATABASE} = env;

    if (!DATABASE || !DATABASE.DB_DRIVER) {
        throw new Error("Missing DATABASE block - please update your env.json file to include one");
    }

    // Setup database
    let dbDriver: DBDriver;
    switch(DATABASE.DB_DRIVER) {
        case 'lowdb':
            dbDriver = new LowdbDriver(env);
            break;
        case 'inmemory':
            dbDriver = new InMemoryDriver();
            break;
        default:
            throw new Error("Database Driver required but none matched available values");
    }

    // Build Discord Client Parameters
    const presence: PresenceData = {
        status: 'online',
        afk: false,
        activity: BOT_ACTIVITY ? {
            type: BOT_ACTIVITY_TYPE || 'LISTENING',
            name: replaceStringWithEnv(BOT_ACTIVITY, env)
        } : { }
    };
    const DISCORD_CLIENT_OPTIONS: ClientOptions = {
        messageCacheMaxSize: MESSAGE_CACHE_SIZE,
        presence: presence
    };

    // Create Discord Client
    const client = new Client(DISCORD_CLIENT_OPTIONS);

    // Set up Express server by providing it with the Discord Client and a way to resolve DraftServers
    const expressServer = new ExpressDriver(client, env, async (serverId) => {
        let guild = client.guilds.resolve(serverId);
        if (!guild) {
            guild = await client.guilds.fetch(serverId);
        }
        return getDraftServer(guild, env, dbDriver);
    });

    let killSwitch: ()=>void = () => {
        throw new Error("KILL SWITCH WAS NOT HOOKED UP CORRECTLY");
    };

    // Attach listeners to Discord Client
    client.once('ready', onReady(client, env, dbDriver, expressServer, (ks) => {killSwitch = ks} ));
    client.on('message', onMessage(env, dbDriver, ()=>killSwitch()));
    client.on('messageReactionAdd', onReaction(env, dbDriver, async (draftUser, session) => await session.addPlayer(draftUser)));
    client.on('messageReactionRemove', onReaction(env, dbDriver, async (draftUser, session) => await session.removePlayer(draftUser)));

    if (DISCORD_BOT_TOKEN) {
        // Yes, this is THE login call
        client.login(DISCORD_BOT_TOKEN);
    } else {
        console.error("Unable to login - DISCORD_BOT_TOKEN was not properly set up");
    }
}
