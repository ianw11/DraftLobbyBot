import env from './env';
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
const {PREFIX} = env;

///////////////////////////////////////////
// Helper Methods for the Discord client //
///////////////////////////////////////////

function getDraftServer(guild: Guild): DraftServer {
    let server = SERVERS[guild.id];
    if (!server) {
        server = new DraftServer(guild);
        SERVERS[guild.id] = server;
    }
    return server;
}

function getServerAndSession(reaction: MessageReaction): [DraftServer, Session|null] {
    const {message} = reaction;

    const {guild} = message;
    if (!guild) {
        throw "Error with Discord - Guild not included in Message";
    }

    const draftServer = getDraftServer(guild);

    const session = draftServer.getSessionFromMessage(message);

    return session ? [draftServer, session] : [draftServer, null];
}

function onMessage(client: Client) {
    return async (message: Message) => {
        const {author, content} = message;

        // Perform initial filtering checks
        if (author.bot) return;
        if (env.DEBUG && content === 'dc') {
            env.log("Bye bye");
            client.destroy(); // Ends the Node process too
            return;
        }
        if (message.channel.type == 'dm') {
            await message.channel.send("Sorry, I don't respond in DMs. Give me a command from a server");
            return;
        }
        if (content.length === 0 || content[0] !== PREFIX) return;

        // Parse out the desired command
        const split = content.split(' ');
        let commandStr = split.shift();
        if (!commandStr) {
            return;
        }
        commandStr = commandStr.slice(PREFIX.length).trim();
        const command = Commands[commandStr];

        if (command) {
            const {guild, author} = message;
            if (!guild) {
                throw "Error with Discord.js - guild not included in message"
            }
            const draftServer = getDraftServer(guild);

            const props: ContextProps = {
                env: env,
                client: client,
                draftServer: draftServer,
                user: author,
                parameters: split,
                message: message
            }
            const context = new Context(props);

            try {
                await command.execute(context);
            } catch (e) {
                console.log(e);
                await (await author.createDM()).send(`ERROR: ${e}`);
            }
        } else {
            env.log(`Invalid command: ${commandStr}`);
        }
    }
}

type ReactionCallback = (p1: DraftUser, p2: Session) => Promise<void>;
type CurriedReactionCallback = (r: MessageReaction, u: User | PartialUser) => Promise<void>;
function onReaction(callback: ReactionCallback): CurriedReactionCallback {
    return async (reaction: MessageReaction, rawUser: User | PartialUser) => {
        if (rawUser.bot) return;

        const [draftServer, session] = getServerAndSession(reaction);

        if (session) {
            const draftUser = draftServer.getDraftUser(rawUser);

            try {
                await callback(draftUser, session);
            } catch (e) {
                console.log(e);
                await draftUser.sendDM(`ERROR: ${e}`);
            }
        }
    }
}

////////////////////
// DISCORD CLIENT //
////////////////////

export default function main() {
    const {DISCORD_BOT_TOKEN} = env;
    const client = new Client();

    client.once('ready', async () => {
        env.log("Logged in successfully");
    });

    client.on('message', onMessage(client));
    client.on('messageReactionAdd', onReaction(async (draftUser, session) => await session.addPlayer(draftUser)));
    client.on('messageReactionRemove', onReaction(async (draftUser, session) => await session.removePlayer(draftUser)));

    // Yes, this is THE login call
    client.login(DISCORD_BOT_TOKEN);
}
