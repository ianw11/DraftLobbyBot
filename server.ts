import env from './env';
import {Client, Message, MessageReaction, User, Guild} from 'discord.js';
import Commands from './commands';
import DraftServer from './models/DraftServer';
import Session from './models/Session';
import DraftUser from './models/DraftUser';
import Context from './commands/types/Context';

//
// To set your Discord Bot Token, take a look at env.ts for an explanation (and get ready to make an env.json)
//

// Join Link: https://discord.com/api/oauth2/authorize?client_id={YOUR_CLIENT_ID}&scope=bot&permissions=133200

const SERVERS: {[guildId: string]: DraftServer} = {};

///////////////////////////////////////////
// Helper Methods for the Discord client //
///////////////////////////////////////////

function getDraftServer(guild: Guild) {
    return SERVERS[guild.id];
}

function getServerAndSession(reaction: MessageReaction): [DraftServer, Session] {
    const {message} = reaction;
    const {guild} = message;

    const draftServer = getDraftServer(guild);
    const session = draftServer.getSessionFromMessage(message);

    return [draftServer, session];
}

async function onCommand(message: Message) {
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
    if (content[0] !== PREFIX) return;

    // Parse out the desired command
    const split = content.split(' ');
    const commandStr = split.shift().slice(PREFIX.length).trim();
    const command = Commands[commandStr];

    if (command) {
        const {guild, author} = message;
        const context = new Context(env, client, getDraftServer(guild), author, split, message);
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

type ReactionCallback = (p1: DraftUser, p2: Session, p3: DraftServer) => Promise<void>;
type CurriedReactionCallback = (r: MessageReaction, u: User) => Promise<void>;
function onReaction(callback: ReactionCallback): CurriedReactionCallback {
    return async (reaction: MessageReaction, user: User) => {
        if (user.bot) return;

        const [draftServer, session] = getServerAndSession(reaction);

        if (session) {
            const draftUser = draftServer.getDraftUser(user);

            try {
                await callback(draftUser, session, draftServer);
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

const {PREFIX, DISCORD_BOT_TOKEN} = env;
const client = new Client();

client.once('ready', async () => {
    env.log("Logged in successfully");

    // Setup the DraftServers
    client.guilds.cache.each(async (guild: Guild) => {
        SERVERS[guild.id] = new DraftServer(guild, env);
    });
});

client.on('message', onCommand);
client.on('messageReactionAdd', onReaction(async (draftUser, session) => await session.addPlayer(draftUser)));
client.on('messageReactionRemove', onReaction(async (draftUser, session) => await session.removePlayer(draftUser)));

// Yes, this is THE login call
client.login(DISCORD_BOT_TOKEN);
