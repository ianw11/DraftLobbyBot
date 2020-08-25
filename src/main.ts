import ENV from './core/EnvBase';
import {Client, Message, MessageReaction, User, Guild, PartialUser} from 'discord.js';
import Commands from './commands';
import DraftServer from './models/DraftServer';
import Session from './models/Session';
import DraftUser from './models/DraftUser';
import Context, { ContextProps } from './commands/types/Context';

//
// To set your Discord Bot Token, take a look at env.ts for an explanation (and get ready to make an env.json)
//

// Join Link: https://discord.com/api/oauth2/authorize?client_id={YOUR_CLIENT_ID}&scope=bot&permissions=133200

const SERVERS: {[guildId: string]: DraftServer} = {};

///////////////////////////////////////////
// Helper Methods for the Discord client //
///////////////////////////////////////////

async function outputError(e: Error, user: User | PartialUser, env: ENV) {
    console.log(e);
    await (await user.createDM()).send(env.ERROR_OUTPUT.replace("%s", e.message))
}

function getDraftServer(guild: Guild, env: ENV): DraftServer {
    let server = SERVERS[guild.id];
    if (!server) {
        server = new DraftServer(guild, env);
        SERVERS[guild.id] = server;
    }
    return server;
}

function getServerAndSession(reaction: MessageReaction, env: ENV): [DraftServer, Session|null] {
    const {message} = reaction;

    const {guild} = message;
    if (!guild) {
        throw new Error("Error with Discord - Guild not included in Message");
    }

    const draftServer = getDraftServer(guild, env);

    const session = draftServer.getSessionFromMessage(message);

    return session ? [draftServer, session] : [draftServer, null];
}

function onMessage(client: Client, env: ENV) {
    const {DEBUG, PREFIX, log} = env;

    return async (message: Message) => {
        const {author, content} = message;

        // Perform initial filtering checks
        if (author.bot) return;
        if (DEBUG && content === 'dc') {
            log("Bye bye");
            client.destroy(); // Ends the Node process too
            return;
        }
        if (message.channel.type == 'dm') {
            await message.channel.send("Sorry, I don't respond in DMs. Give me a command from a server");
            return;
        }
        if (content.length === 0 || content[0] !== PREFIX) return;

        try {
            // Parse out the desired command
            const split = content.split(' ');
            let commandStr = split.shift();
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
                const draftServer = getDraftServer(guild, env);

                // Build the props for the Context
                const props: ContextProps = {
                    env: env,
                    client: client,
                    draftServer: draftServer,
                    user: author,
                    parameters: split,
                    message: message
                }

                // Finally execute
                await command.execute(new Context(props));
            } else {
                log(`Invalid command: ${commandStr}`);
            }
        } catch (e) {
            await outputError(e, author, env);
        }
    }
}

type ReactionCallback = (p1: DraftUser, p2: Session) => Promise<void>;
type CurriedReactionCallback = (r: MessageReaction, u: User | PartialUser) => Promise<void>;
function onReaction(env: ENV, callback: ReactionCallback): CurriedReactionCallback {
    return async (reaction: MessageReaction, rawUser: User | PartialUser) => {
        if (rawUser.bot) return;

        try {
            const [draftServer, session] = getServerAndSession(reaction, env);

            if (session) {
                const draftUser = draftServer.getDraftUser(rawUser);
                await callback(draftUser, session);
            }
        } catch (e) {
            await outputError(e, rawUser, env);
        }
    }
}

////////////////////
// DISCORD CLIENT //
////////////////////

export default function main(env: ENV): void {
    const {DISCORD_BOT_TOKEN} = env;
    const client = new Client();

    client.once('ready', async () => {
        env.log("Logged in successfully");
    });

    client.on('message', onMessage(client, env));
    client.on('messageReactionAdd', onReaction(env, async (draftUser, session) => await session.addPlayer(draftUser)));
    client.on('messageReactionRemove', onReaction(env, async (draftUser, session) => await session.removePlayer(draftUser)));

    // Yes, this is THE login call
    client.login(DISCORD_BOT_TOKEN);
}
