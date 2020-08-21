//import * as Discord from 'discord.js';
import {Client, Message, MessageReaction, User, Guild, GuildChannel, TextChannel} from 'discord.js';
const client = new Client();
const DISCORD_BOT_TOKEN = 'NzQ1ODc3Nzg1NjExODYyMDU2.Xz4K0Q.Iyqs9UycYcYpVXLGtvcjwH2j0bs';
// Join Link: https://discord.com/api/oauth2/authorize?client_id=745877785611862056&scope=bot&permissions=133200

const PREFIX = "$";
const DRAFT_CHANNEL_NAME = 'draft-announcements';

import Commands from './commands';
import DraftServer from './models/DraftServer';
import Context from './commands/types/Context';
import Session from './models/Session';
import DraftUser from './models/DraftUser';

const SERVERS: {[guildId: string]: DraftServer} = {};

client.once('ready', async () => {
    console.log("Logged in successfully");

    setupDraftServers();
});

client.on('message', async (message: Message) => {
    const {author, content} = message;

    // Perform initial filtering checks
    if (author.bot) return;
    if (content === 'dc') {
        client.destroy();
        return;
    }
    if (content[0] !== PREFIX) return;

    // Parse out the desired command
    const commandStr = content.slice(PREFIX.length).trim();
    const command = Commands[commandStr];

    if (command) {
        const {guild, author} = message;
        const context = new Context(client, getDraftServer(guild), author);
        try {
            await command.execute(context);
        } catch (e) {
            await (await author.createDM()).send(`ERROR: ${e}`);
        }
    } else {
        console.log(`Invalid command: ${commandStr}`);
    }
});

client.on('messageReactionAdd', async (reaction: MessageReaction, user: User) => {
    if (user.bot) return;

    const [draftServer, session] = getServerAndSession(reaction);

    if (session) {
        const draftUser = draftServer.getDraftUser(user);
        try {
            await session.addPlayer(draftUser);
        } catch (e) {
            await draftUser.sendDM(`ERROR: ${e}`);
        }
    }
});

client.on('messageReactionRemove', async (reaction: MessageReaction, user: User) => {
    if (user.bot) return;

    const [draftServer, session] = getServerAndSession(reaction);

    if (session) {
        const draftUser = draftServer.getDraftUser(user);

        try {
            await session.removePlayer(draftUser, (id)=>draftServer.getDraftUserById(id));
        } catch (e) {
            await draftUser.sendDM(`ERROR: ${e}`);
        }
    }
});

client.login(DISCORD_BOT_TOKEN);
console.log("Started server.ts, logging in");

function setupDraftServers() {
    client.guilds.cache.each(async (guild: Guild) => {
        const {channels, name: guildName, id: guildId} = guild;

        let announcementChannel: TextChannel = null;
        channels.cache.each((channel: GuildChannel) => {
            const {name: channelName, type} = channel;

            console.log(`Guild ${guildName} has channel of type ${type} named '${channelName}'`);
            if (type !== 'text') {
                return;
            }

            if (channelName === DRAFT_CHANNEL_NAME) {
                announcementChannel = channel as TextChannel;
            }
        });

        if (announcementChannel) {
            console.log(`${guildName} already has a channel`);
        } else {
            console.log(`Creating announcement channel for ${guildName}`);
            announcementChannel = await guild.channels.create(DRAFT_CHANNEL_NAME);
        }

        SERVERS[guildId] = new DraftServer(announcementChannel);
    });
}

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
