import Session, {SessionId} from "./Session";
import DraftUser from "./DraftUser";
import { User, Message, TextChannel, Guild, GuildChannel } from "discord.js";
import env from "../env";

export type DraftUserId = string;

// For both of these Resolvers, a name ('resolve') is given because the
// current testing framework doesn't support mocking types
// or an interface that's just a function

export interface UserResolver {
    resolve (draftUserId: DraftUserId): DraftUser;
}

export interface SessionResolver {
    resolve (sessionId: SessionId): Session;
}

export default class DraftServer {
    private sessions: {[messageId: string]: Session | undefined} = {};
    private users: {[userId: string]: DraftUser} = {};
    
    private announcementChannel: TextChannel | null = null;

    readonly userResolver: UserResolver = {resolve: (draftUserId: DraftUserId) => this.getDraftUserById(draftUserId)};
    readonly sessionResolver: SessionResolver = {resolve: (sessionId: SessionId) => this.getSession(sessionId)};

    private readonly EMOJI: string;

    constructor (guild: Guild) {
        this.EMOJI = env.EMOJI;

        const {channels, name: guildName, id: guildId} = guild;

        let announcementChannel = null;
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
        if (!this.announcementChannel) {
            return;
        }
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

        if (session) {
            await session.terminate(started);
            this.sessions[session.sessionId] = undefined;
        }
        
        draftUser.setCreatedSessionId(null);
    }

    getSessionFromMessage(message: Message): Session | undefined {
        return this.getSession(message.id);
    }

    getSessionFromDraftUser(draftUser: DraftUser): Session | undefined {
        const sessionId = draftUser.getCreatedSessionId();
        if (!sessionId) {
            return undefined;
        }
        return this.getSession(sessionId);
    }

    getSession(sessionId: SessionId): Session {
        const session = this.sessions[sessionId];
        if (session) {
            return session;
        }
        throw "Could not find Session for the provided SessionId";
    }

    getDraftUser(user: User): DraftUser {
        let draftUser = this.getDraftUserById(user.id, false);
        if (!draftUser) {
            draftUser = new DraftUser(user, this.sessionResolver);
            this.users[user.id] = draftUser;
        }
        return draftUser;
    }

    getDraftUserById(draftUserId: DraftUserId, shouldThrow = true): DraftUser {
        const user = this.users[draftUserId];
        if (user || !shouldThrow) {
            return user;
        }
        throw "Could not find DraftUser for the provided DraftUserId";
    }
}