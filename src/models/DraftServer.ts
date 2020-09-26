import ENV from '../env/EnvBase';
import {DraftUserId, UserResolver, SessionResolver, DiscordUserResolver} from "./types/DraftServerTypes";
import Session, {SessionId, SessionParameters} from "./Session";
import DraftUser from "./DraftUser";
import { User, Message, TextChannel, Guild, GuildChannel, PartialUser } from "discord.js";

export {
    DraftUserId,
    UserResolver,
    SessionResolver,
    DiscordUserResolver
};

export default class DraftServer {
    private readonly guild: Guild;
    private readonly env: ENV;

    private announcementChannel?: TextChannel;

    private readonly sessions: Record<SessionId, Session|undefined> = {};
    private readonly users: Record<DraftUserId, DraftUser> = {};

    readonly userResolver: UserResolver = {resolve: (draftUserId: DraftUserId) => this.getDraftUserById(draftUserId)};
    readonly sessionResolver: SessionResolver = {resolve: (sessionId: SessionId) => this.getSession(sessionId)};
    readonly discordUserResolver: DiscordUserResolver = {resolve: (userId: string) => this.guild.member(userId)?.user }

    constructor (guild: Guild, env: ENV) {
        this.guild = guild;
        this.env = env;

        this.findOrCreateAnnouncementChannel();
    }

    ////////////////////////////////
    // SESSION MANAGEMENT METHODS //
    ////////////////////////////////

    async createSession(draftUser: DraftUser, parameters?: Partial<SessionParameters>): Promise<void> {
        if (!this.announcementChannel) {
            throw new Error("Cannot create a session - announcement channel was not set up.  Bot might require a restart");
        }
        // Close out any prior Sessions
        if (draftUser.getCreatedSessionId()) {
            await this.closeSession(draftUser);
        }

        // First build the actual Session object
        const session = new Session(this.userResolver, this.env, {...(parameters||{}), ownerId: draftUser.getUserId()});
        const [sessionId, message] = await session.resetMessage(this.announcementChannel);
        
        // Persist the Session object
        this.sessions[sessionId] = session;
        
        // Add the creator to their Session
        draftUser.setCreatedSessionId(sessionId);
        await session.addPlayer(draftUser);

        // Update and react to indicate we're ready to go
        await message.react(this.env.EMOJI);
    }

    async startSession(draftUser: DraftUser): Promise<void> {
        await this.terminateSession(draftUser, true);
    }

    async closeSession(draftUser: DraftUser): Promise<void> {
        await this.terminateSession(draftUser);
    }

    private async terminateSession(draftUser: DraftUser, started = false) {
        if (!draftUser.getCreatedSessionId()) {
            throw new Error("You don't have any session to terminate");
        }

        const session = this.getSessionFromDraftUser(draftUser);

        if (session) {
            await session.terminate(started);
            if (session.sessionId) {
                this.sessions[session.sessionId] = undefined;
            }
        }
        
        draftUser.setCreatedSessionId(null);
    }

    ////////////////////////
    // PUBLIC GET METHODS //
    ////////////////////////

    get serverId(): string {
        return this.guild.id;
    }

    getSessionFromMessage(message: Message): Session | undefined {
        if (!this.announcementChannel) {
            throw new Error("Bot was not properly set up with an announcement channel - probably requires a restart");
        }
        if (message.channel.id !== this.announcementChannel.id) {
            return;
        }
        return this.getSession(message.id);
    }

    getSessionFromDraftUser(draftUser: DraftUser): Session | undefined {
        const sessionId = draftUser.getCreatedSessionId();
        if (!sessionId) {
            return;
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

    //////////////////////
    // INTERNAL METHODS //
    //////////////////////

    private findOrCreateAnnouncementChannel() {
        const {channels, name: guildName} = this.guild;
        const {DRAFT_CHANNEL_NAME, log} = this.env;

        channels.cache.each((channel: GuildChannel) => {
            const {name: channelName, type} = channel;

            if (type !== 'text') {
                return;
            }

            if (channelName === DRAFT_CHANNEL_NAME) {
                this.announcementChannel = channel as TextChannel;
            }
        });

        if (this.announcementChannel) {
            log(`${guildName} already has a channel`);
        } else {
            log(`Creating announcement channel for ${guildName}`);
            this.guild.channels.create(DRAFT_CHANNEL_NAME).then((channel) => {
                this.announcementChannel = channel
            });
        }
    }
}