import DraftUser from "../DraftUser";
import Session from "../Session";
import { Guild, GuildChannel, GuildMember, Message, TextChannel, User } from 'discord.js';
import { DBDriver } from "../../database/DBDriver";
import { ENV } from "../../env/env";
import { DraftUserId, ServerId, SessionId } from "./BaseTypes";
import { ISessionView } from "../../database/SessionDBSchema";

export class DiscordResolver {
    readonly guild;
    announcementChannel?: TextChannel;
    readonly env;

    constructor(guild: Guild, env: ENV) {
        this.guild = guild;
        this.announcementChannel = this.findAnnouncementChannel(env);
        this.env = env;
    }

    resolveGuildMemberFromTag(userTag: string): GuildMember | undefined {
        let member: GuildMember | undefined;
        this.guild.members.cache.each(cacheMember => {
            if (!member && cacheMember.user.tag === userTag) {
                member = cacheMember;
            }
        });
        return member;
    }

    fetchGuildMember(userId: string): Promise<GuildMember> {
        return this.guild.members.fetch(userId);
    }

    resolveGuildMember(userId: string): GuildMember | null {
        return this.guild.members.resolve(userId);
    }

    resolveUser(userId: string): User | undefined {
        return this.resolveGuildMember(userId)?.user;
    }

    async resolveUserAsync(userId: string): Promise<User> {
        return (await this.fetchGuildMember(userId)).user;
    }

    async resolveMessageInAnnouncementChannel(messageId: string): Promise<Message | undefined> {
        if (!this.announcementChannel) {
            throw new Error("Text Channel not attached - unable to resolveMessage.  If the server just came online, maybe try one more time in 10-15 seconds");
        }
        return await this.resolveMessage(this.announcementChannel.id, messageId);
    }

    async resolveMessage(channelId: string, messageId: string): Promise<Message | undefined> {
        const guildChannel: GuildChannel | null = this.guild.channels.resolve(channelId);
        if (!guildChannel || guildChannel.type !== 'text') {
            return undefined;
        }
        const channel = guildChannel as TextChannel;
        
        // First attempt to read from the locally cached messages
        const message = channel.messages.resolve(messageId);
        if (message) {
            return message;
        }

        // If not local, attempt to fetch from discord
        const messages = await channel.messages.fetch({
            around: messageId,
            limit: 1
        });
        return messages.get(messageId);
    }

    private createChannel(channelName: string): Promise<TextChannel> {
        return this.guild.channels.create(channelName);
    }

    private findAnnouncementChannel(env: ENV): TextChannel | undefined {
        const {channels, name: guildName} = this.guild;
        const {DRAFT_CHANNEL_NAME, log} = env;

        let announcementChannel;
        channels.cache.each((channel: GuildChannel) => {
            const {name: channelName, type} = channel;

            if (type !== 'text') {
                return;
            }

            if (channelName === DRAFT_CHANNEL_NAME) {
                announcementChannel = channel as TextChannel;
            }
        });

        if (!announcementChannel) {
            log(`Creating announcement channel for ${guildName}`);
            this.createChannel(DRAFT_CHANNEL_NAME).then((channel) => {
                this.announcementChannel = channel
            });
        }
        return announcementChannel;
    }
}

export class Resolver {

    readonly discordResolver;
    readonly env: ENV;
    readonly dbDriver: DBDriver;

    private readonly serverId: ServerId;

    // Priority Queue
    private readonly sessionViewPriorityQueue: ISessionView[] = [];
    private readonly PRIORITY_QUEUE_SIZE = 5;

    constructor(discordResolver: DiscordResolver, dbDriver: DBDriver) {
        this.discordResolver = discordResolver;
        this.env = discordResolver.env;
        this.dbDriver = dbDriver;

        this.serverId = discordResolver.guild.id;
    }

    resolveUser(userId: DraftUserId): DraftUser {
        return new DraftUser(this.dbDriver.getOrCreateUserView(this.serverId, userId), this);
    }

    resolveSession(sessionId: SessionId): Session {
        return new Session(this.getSessionViewFromPriorityQueue(sessionId), this);
    }

    private getSessionViewFromPriorityQueue(sessionId: SessionId): ISessionView {
        const sessionViewNdx = this.sessionViewPriorityQueue.findIndex(sessView => sessView.sessionId === sessionId);

        let sessionView;
        // See if this Session already exists in the cache. If so, remove it
        if (sessionViewNdx !== -1) {
            sessionView = this.sessionViewPriorityQueue.splice(sessionViewNdx, 1)[0];
        }
        // If not in the cache, create a new one
        if (!sessionView) {
            sessionView = this.dbDriver.getSessionView(this.serverId, sessionId);
        }

        // Add to the "most recently used" position
        this.sessionViewPriorityQueue.push(sessionView);
        
        // If we've broken capacity, remove from the "least recently used" position
        while (this.sessionViewPriorityQueue.length > this.PRIORITY_QUEUE_SIZE) {
            this.sessionViewPriorityQueue.shift();
        }

        return sessionView;
    }
}
