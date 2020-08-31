import Session, {SessionId, when} from "./Session";
import DraftUser from "./DraftUser";
import { User, Message, TextChannel, Client, Guild, GuildChannel } from "discord.js";
import { ENV } from "../env";
import { CronJob } from "cron";

export type DraftUserId = string;

export interface UserResolver {
    (draftUserId: DraftUserId): DraftUser | null;
}

export interface SessionResolver {
    (sessionId: SessionId): Session;
}

export default class DraftServer {
    private sessions: {[messageId: string]: Session} = {};
    private users: {[userId: string]: DraftUser} = {};
    
    private announcementChannel: TextChannel;

    readonly userResolver: UserResolver = (draftUserId: DraftUserId) => this.getDraftUserById(draftUserId);
    readonly sessionResolver: SessionResolver = (sessionId: SessionId) => this.getSession(sessionId);

    private readonly EMOJI: string;

    private schedulers: CronJob[];

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

        this.schedulers = [];
    }

    async createSession(draftUser: DraftUser, when?: when) {
        // Close out any prior Sessions
        if (draftUser.createdSessionId) {
            await this.closeSession(draftUser);
        }

        // First send the message that will be monitored
        const message = await this.announcementChannel.send("Creating session...");

        let overrideName: string = "";
        if (draftUser.isBot()) overrideName = "Scheduled Draft";

        // Then build the actual Session object
        const session = new Session(draftUser.getUserId(), message, this.userResolver, overrideName);

        // Add the when if it was specified
        if (when) session.setWhen(when);

        // Persist the Session object
        draftUser.createdSessionId = session.sessionId;
        this.sessions[session.sessionId] = session;

        // Add the creator to their Session
        if (!draftUser.isBot()) session.addPlayer(draftUser);

        // Update and react to indicate we're ready to go
        await session.updateMessage();
        await message.react(this.EMOJI);
    }

    async startSession(draftUser: DraftUser) {
        await this.terminate(draftUser, true);
    }

    async closeSession(draftUser: DraftUser) {
        await this.terminate(draftUser);
    }

    private async terminate(draftUser: DraftUser, started: boolean = false) {
        if (!draftUser.createdSessionId) {
            throw "You don't have any session to terminate";
        }

        const session = this.getSessionFromDraftUser(draftUser);

        await session.terminate(started);
        draftUser.createdSessionId = null;

        this.sessions[session.sessionId] = null;
    }

    getSessionFromMessage(message: Message): Session | null {
        return this.getSession(message.id);
    }

    getSessionFromDraftUser(draftUser: DraftUser): Session | null {
        return this.getSession(draftUser.createdSessionId);
    }

    getSession(sessionId: SessionId): Session | null | undefined {
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

    addScheduler(scheduler: CronJob) {
        this.schedulers.push(scheduler);
    }
}