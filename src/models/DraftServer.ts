import ENV from '../core/EnvBase';
import {DraftUserId, UserResolver, SessionResolver, DiscordUserResolver} from "../types/DraftServerTypes";
import Session, {SessionId} from "./Session";
import DraftUser from "./DraftUser";
import { User, Message, TextChannel, Guild, GuildChannel, PartialUser } from "discord.js";

export {
    DraftUserId,
    UserResolver,
    SessionResolver,
    DiscordUserResolver
};

export default class DraftServer {
    private readonly env: ENV;

    private sessions: {[messageId: string]: Session | undefined} = {};
    private users: {[userId: string]: DraftUser} = {};
    
    private announcementChannel: TextChannel | null = null;

    readonly userResolver: UserResolver = {resolve: (draftUserId: DraftUserId) => this.getDraftUserById(draftUserId)};
    readonly sessionResolver: SessionResolver = {resolve: (sessionId: SessionId) => this.getSession(sessionId)};
    readonly discordUserResolver: DiscordUserResolver;

    constructor (guild: Guild, env: ENV) {
        this.env = env;

        this.discordUserResolver = {resolve: (userId: string) => guild.member(userId)?.user };
        const {channels, name: guildName} = guild;

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

    async createSession(draftUser: DraftUser, date?: Date): Promise<void> {
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
        const session = new Session(message, this.userResolver, this.env, {date: date, ownerId: draftUser.getUserId()});
        
        // Persist the Session object
        this.sessions[session.sessionId] = session;
        draftUser.setCreatedSessionId(session.sessionId);
        
        // Add the creator to their Session
        await session.addPlayer(draftUser);

        // Update and react to indicate we're ready to go
        await message.react(this.env.EMOJI);
    }

    async startSession(draftUser: DraftUser): Promise<void> {
        await this.terminate(draftUser, true);
    }

    async closeSession(draftUser: DraftUser): Promise<void> {
        await this.terminate(draftUser);
    }

    private async terminate(draftUser: DraftUser, started = false) {
        if (!draftUser.getCreatedSessionId()) {
            throw new Error("You don't have any session to terminate");
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
        throw new Error("Could not find Session for the provided SessionId");
    }

    getDraftUser(user: User | PartialUser): DraftUser {
        let draftUser = this.getDraftUserById(user.id, false);
        if (!draftUser) {
            draftUser = new DraftUser(user.id, this.discordUserResolver, this.sessionResolver);
            this.users[user.id] = draftUser;
        }
        return draftUser;
    }

    getDraftUserById(draftUserId: DraftUserId, shouldThrow = true): DraftUser {
        const user = this.users[draftUserId];
        if (user || !shouldThrow) {
            return user;
        }
        throw new Error("Could not find DraftUser for the provided DraftUserId");
    }
}