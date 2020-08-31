const fs = require('fs');
import {CronJob, job} from 'cron';
import env from './env';
import {Client, Message, MessageReaction, User, Guild} from 'discord.js';
import Commands from './commands';
import DraftServer from './models/DraftServer';
import Session, { when } from './models/Session';
import DraftUser from './models/DraftUser';
import Context from './commands/types/Context';

class CronEntry {
    cronTask: string;
    sessionTime: string
}

// Join Link: https://discord.com/api/oauth2/authorize?client_id=745877785611862056&scope=bot&permissions=133200

const SERVERS: {[guildId: string]: DraftServer} = {};

let rawdata = fs.readFileSync('cronjobs.json');
let cronjobs = JSON.parse(rawdata);

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
    env.log(String(client.user.bot));

    // Setup the DraftServers
    client.guilds.cache.each(async (guild: Guild) => {
        let guildServer: DraftServer = new DraftServer(guild, env);
        SERVERS[guild.id] = guildServer;
        let cron_entry_for_guild: CronEntry = cronjobs[guild.id];
        if (cron_entry_for_guild != null) {
            let scheduler: CronJob = job(cron_entry_for_guild.cronTask, function() {
                let me: DraftUser = guildServer.getDraftUser(client.user);
                let scheduledWhen: when = {
                    asap: false,
                    date: new Date().toDateString(),
                    time: cron_entry_for_guild.sessionTime
                }
                guildServer.createSession(me,scheduledWhen);
              }, null, true, 'America/Chicago');
            guildServer.addScheduler(scheduler);
            scheduler.start();
        } 
    });
});

client.on('message', onCommand);
client.on('messageReactionAdd', onReaction(async (draftUser, session) => await session.addPlayer(draftUser)));
client.on('messageReactionRemove', onReaction(async (draftUser, session) => await session.removePlayer(draftUser)));

// Yes, this is THE login call
client.login(DISCORD_BOT_TOKEN);
