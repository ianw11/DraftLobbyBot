import { ENV, replaceStringWithEnv } from './env/env';
import {Message, MessageReaction, User, Guild, PartialUser, ClientOptions, PresenceData, Client, PartialMessageReaction, Awaited, Interaction} from 'discord.js';
import Commands from './commands';
import DraftServer from './models/DraftServer';
import Session from './models/Session';
import DraftUser from './models/DraftUser';
import Context, { ContextProps } from './commands/models/Context';
import { Resolver, DiscordResolver } from './models/types/ResolverTypes';
import { LowdbDriver } from './database/lowdb/LowdbDriver';
import { DBDriver } from './database/DBDriver';
import { InMemoryDriver } from './database/inmemory/InMemoryDriver';
import { ExpressDriver } from './express/ExpressDriver';
import { ISessionView } from './database/SessionDBSchema';
import { asyncForEach } from './Utils';
import { getGuild } from './models/discord/DiscordClientUtils';
import { ServerId } from './models/types/BaseTypes';

//
// To set your Discord Bot Token, take a look at ./env/env.ts for an explanation (hint: make an env.json)
//

// Join Link: https://discord.com/api/oauth2/authorize?client_id={YOUR_CLIENT_ID}&scope=bot%20applications.commands&permissions=2147616848
// Permissions: Manage Channels, Send Messages, Mention Everyone, Add Reactions, Use Slash Commands

const SERVER_CACHE: Record<string, DraftServer> = {};

////////////////
// DATA LAYER //
////////////////

async function preloadGuildData(env: ENV, dbDriver: DBDriver, client: Client) {
    // The first thing we do is go through and preload the guilds, messages, and users that
    // exist in the database.
    // We MUST preload guilds and sessions (so we are actually even watching those messages in the first place)
    // and preloading users 

    let numErrors = 0;
    let successful = 0;
    let additionalGuilds = 0;
    const kickedFromServerIds: {[key: string]: boolean} = {};
    await asyncForEach(dbDriver.getAllSessions(), async (sessionView: ISessionView) => {
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
    });

    // Report the results

    env.log(`Preloaded ${successful} sessions.${numErrors > 0 ? ` There were ${numErrors} discrepancies/issues but they have been resolved.` : ''}`);
    if (additionalGuilds !== 0) {
        env.log(`${additionalGuilds} guilds added to cache.  New total: ${client.guilds.cache.size}`);
    }
}

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

function getServerAndSession(reaction: MessageReaction | PartialMessageReaction, env: ENV, dbDriver: DBDriver): [DraftServer, Session?] {
    const {message} = reaction;

    const {guild} = message;
    if (!guild) {
        throw new Error("Error with Discord - Guild not included in Message");
    }

    const draftServer = getDraftServer(guild, env, dbDriver);
    const session = draftServer.getSessionFromMessage(message);

    return [draftServer, session];
}

async function createSlashCommandInteractions(client: Client, env: ENV, guildId: ServerId) {

    // commands.set() is better for a bulk update (like at application launch)
    //  it will also replace all previous commands
    // commands.create() can be used to singly deploy or live-update a command
    try {
        //await client.application?.commands.set([]);
        await client.application?.commands.set([
            {
                name: `help`,
                description: `this is description for help command`,
                options: [
                    {
                        name: `command`,
                        description: `the command option for help is not required`,
                        type: 'STRING',
                        required: false,
                    }
                ]
            },
            {
                name: `session`,
                description: `sub command grouping folder for sessions`,
                options: [
                    {
                        name: `create`,
                        description: `create a session`,
                        type: 'SUB_COMMAND',
                        options: [
                            {
                                name: `template`,
                                description: `the name of the template to use`,
                                type: 'STRING',
                                required: false,
                                choices: [
                                    {
                                        name: `default`,
                                        value: `default`
                                    },
                                    {
                                        name: `winston`,
                                        value: `winston`
                                    }
                                ]
                            }
                        ]
                    },
                    {
                        name: `cancel`,
                        description: `close a session`,
                        type: 'SUB_COMMAND_GROUP',
                        options: [
                            {
                                name: `all`,
                                description: `closes ALL sessions`,
                                type: 'SUB_COMMAND'
                            },
                            {
                                name: `single`,
                                description: `closes a single session`,
                                type: 'SUB_COMMAND',
                                options: [
                                    {
                                        name: `id`,
                                        description: `session id to close`,
                                        type: `BOOLEAN`,
                                        required: false
                                    }
                                ]
                            }
                        ]
                    }
                ]
            }
        ]);
        env.log(`Set the global commands for guild id ${guildId}`);
    } catch (e) {
        console.error("Error thrown when setting global interaction commands!");
        console.error(e);
    }
}

///////////////////////////////////////////
// Helper Methods for the Discord client //
///////////////////////////////////////////

async function outputError(e: unknown, user: User | PartialUser, env: ENV) {
    if (e instanceof Error) {
        console.log(e);
        await (await user.createDM()).send(env.ERROR_OUTPUT.replace("%s", e.message));
    }
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
        if (message.channel.type == 'DM') {
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
type CurriedReactionCallback = (r: MessageReaction | PartialMessageReaction, u: User | PartialUser) => Promise<void>;
function onReaction(env: ENV, dbDriver: DBDriver, callback: ReactionCallback): CurriedReactionCallback {
    return async (reaction: MessageReaction | PartialMessageReaction, rawUser: User | PartialUser) => {
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

function onInteraction(env: ENV, dbDriver: DBDriver): ((interaction: Interaction) => Awaited<void>) {
    return async (interaction: Interaction) => {
        if(!interaction.isCommand()) {
            console.log(interaction);
            return;
        }

        const {command, commandId, commandName, guildId, options, type, user, version} = interaction;

        console.log(`Received interaction`, {commandId, commandName, guildId, options, type, version});

        await interaction.reply('ok');
    };
}

// The setup function that pre-loads Session data and turns on the Express server
function onReady(client: Client, env: ENV, dbDriver: DBDriver, expressDriver: ExpressDriver, provideKillSwitch: (killSwitch: ()=>void)=>void) {
    let killFlag = false;
    return async () => {
        env.log("Logged in successfully - BEGINNING SETUP");
        env.log(`${client.guilds.cache.size} guilds loaded. Validating Sessions vs available Guilds...`);

        await preloadGuildData(env, dbDriver, client);

        if (!killFlag) {
            // Additional tasks that need to be started alongside the application lifecycle go here
            // Be sure to safely close everything using the killSwitch() below
            await asyncForEach(client.guilds.cache.array(), async guild => {
                await createSlashCommandInteractions(client, env, guild.id);
            });

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
    const {DISCORD_BOT_TOKEN, DATABASE, BOT_ACTIVITY, BOT_ACTIVITY_TYPE, MESSAGE_CACHE_LIFETIME_SECONDS, MESSAGE_CACHE_SWEEP_INTERVAL} = env;

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
        activities: BOT_ACTIVITY ? [{
            type: BOT_ACTIVITY_TYPE || 'LISTENING',
            name: replaceStringWithEnv(BOT_ACTIVITY, env)
        }] : undefined
    };
    const DISCORD_CLIENT_OPTIONS: ClientOptions = {
        messageCacheLifetime: MESSAGE_CACHE_LIFETIME_SECONDS,
        messageSweepInterval: MESSAGE_CACHE_SWEEP_INTERVAL,
        presence: presence,
        intents: [
            'GUILDS',
            'GUILD_MESSAGES',
            'GUILD_MESSAGE_REACTIONS',
            'DIRECT_MESSAGES',
            'DIRECT_MESSAGE_REACTIONS'
        ]
    };
    
    // Create Discord Client
    const client = new Client(DISCORD_CLIENT_OPTIONS);

    // Set up Express server by providing it with the Discord Client and a way to resolve DraftServers
    const expressServer = new ExpressDriver(client, env, async (serverId) => {
        const guild = await getGuild(client, serverId);
        return getDraftServer(guild, env, dbDriver);
    });

    let killSwitch: ()=>void = () => {
        throw new Error("KILL SWITCH WAS NOT HOOKED UP CORRECTLY");
    };

    // Attach listeners to Discord Client
    client.once('ready', onReady(client, env, dbDriver, expressServer, (ks) => {killSwitch = ks} ));
    client.on('messageCreate', onMessage(env, dbDriver, ()=>killSwitch()));
    client.on('messageReactionAdd', onReaction(env, dbDriver, async (draftUser, session) => await session.addPlayer(draftUser)));
    client.on('messageReactionRemove', onReaction(env, dbDriver, async (draftUser, session) => await session.removePlayer(draftUser)));
    client.on('interactionCreate', onInteraction(env, dbDriver));
    //client.on('debug', (msg) => console.log(`[DISCORD DEBUG] ${msg}`));
    client.on('warn', (msg) => console.log(`[DISCORD WARN] ${msg}`));
    client.on('error', (err) => console.error(err));

    if (DISCORD_BOT_TOKEN) {
        // Yes, this is THE login call. If this is successful, it triggers onReady
        client.login(DISCORD_BOT_TOKEN)
            .catch((reason) => {
                console.error('FAILED TO LOGIN');
                console.error(reason);
            });
    } else {
        console.error("Unable to login - DISCORD_BOT_TOKEN was not properly set up");
        client.destroy();
    }
}
