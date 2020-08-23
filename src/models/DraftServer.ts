import Session, {SessionId} from "./Session";
import DraftUser from "./DraftUser";
import { User, Message, TextChannel, Client, Guild, GuildChannel } from "discord.js";
import { ENV } from "../env";

export type DraftUserId = string;

// For both of these Resolvers, a name ('resolve') is given because the
// current testing framework doesn't support mocking types
// or an interface that's just a function

export interface UserResolver {
    resolve (draftUserId: DraftUserId): DraftUser | null;
}

export interface SessionResolver {
    resolve (sessionId: SessionId): Session | null;
}

export default class DraftServer {
    private sessions: {[messageId: string]: Session} = {};
    private users: {[userId: string]: DraftUser} = {};
    
    private announcementChannel: TextChannel;

    readonly userResolver: UserResolver = {resolve: (draftUserId: DraftUserId) => this.getDraftUserById(draftUserId)};
    readonly sessionResolver: SessionResolver = {resolve: (sessionId: SessionId) => this.getSession(sessionId)};

    private readonly EMOJI: string;

    constructor (guild: Guild, env: ENV) {
        this.EMOJI = env.EMOJI;

        const {channels, name: guildName, id: guildId} = guild;

        let announcementChannel: TextChannel = null;
        channels.cache.each((channel: GuildChannel) => {
            const {name: channelName, type} = channel;

            if (type !== 'text') {
                return;
            }

            if (channelName === env.DRAFT_CHANNEL_NAME) {
                announcementChannel = channel as TextChannel;
            }
        });

        if (announcementChannel) {
            env.log(`${guildName} already has a channel`);
            this.announcementChannel = announcementChannel;
        } else {
            env.log(`Creating announcement channel for ${guildName}`);
            guild.channels.create(env.DRAFT_CHANNEL_NAME).then((channel) => {
                this.announcementChannel = channel
            });
        }
    }

    async createSession(draftUser: DraftUser, date?: Date) {
        // Close out any prior Sessions
        if (draftUser.getCreatedSessionId()) {
            await this.closeSession(draftUser);
        }

        // First send the message that will be monitored
        const message = await this.announcementChannel.send("Creating session...");

        // Then build the actual Session object
        const session = new Session(draftUser.getUserId(), message, this.userResolver, {date: date});
        
        // Persist the Session object
        this.sessions[session.sessionId] = session;
        draftUser.setCreatedSessionId(session.sessionId);
        
        // Add the creator to their Session
        await session.addPlayer(draftUser);

        // Update and react to indicate we're ready to go
        await message.react(this.EMOJI);
    }

    async startSession(draftUser: DraftUser) {
        await this.terminate(draftUser, true);
    }

    async closeSession(draftUser: DraftUser) {
        await this.terminate(draftUser);
    }

    private async terminate(draftUser: DraftUser, started: boolean = false) {
        if (!draftUser.getCreatedSessionId()) {
            throw "You don't have any session to terminate";
        }

        const session = this.getSessionFromDraftUser(draftUser);

        await session.terminate(started);
        draftUser.setCreatedSessionId(null);

        this.sessions[session.sessionId] = null;
    }

    getSessionFromMessage(message: Message): Session | null {
        return this.getSession(message.id);
    }

    getSessionFromDraftUser(draftUser: DraftUser): Session | null {
        return this.getSession(draftUser.getCreatedSessionId());
    }

    getSession(sessionId?: SessionId): Session | null | undefined {
        if (!sessionId) {
            return null;
        }
        return this.sessions[sessionId];
    }

    getDraftUser(user: User): DraftUser {
        let draftUser = this.getDraftUserById(user.id);
        if (!draftUser) {
            draftUser = new DraftUser(user, this.sessionResolver);
            this.users[user.id] = draftUser;
        }
        return draftUser;
    }

    getDraftUserById(draftUserId: DraftUserId): DraftUser | null {
        return this.users[draftUserId];
    }
}