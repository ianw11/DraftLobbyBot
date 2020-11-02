import DraftUser from "../DraftUser";
import Session from "../Session";
import { Channel, Guild, GuildChannel, GuildMember, Message, TextChannel, User } from 'discord.js';
import { DBDriver } from "../../database/DBDriver";
import { ENV } from "../../env/env";
import { DraftUserId, SessionId } from "./BaseTypes";

export class DiscordResolver {
    readonly guild;
    announcementChannel /* : TextChannel */;
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

    resolveGuildMember(userId: string): GuildMember | null {
        return this.guild.members.resolve(userId);
    }

    resolveUser(userId: string): User | undefined {
        return this.resolveGuildMember(userId)?.user;
    }

    async resolveMessageInAnnouncementChannel(messageId: string): Promise<Message | undefined> {
        if (!this.announcementChannel) {
            throw new Error("Text Channel not attached - unable to resolveMessage");
        }
        return await this.resolveMessage(this.announcementChannel.id, messageId);
    }

    async resolveMessage(channelId: string, messageId: string): Promise<Message | undefined> {
        const channel = this.guild.channels.resolve(channelId);
        if (!channel || channel.type !== 'text') {
            return undefined;
        }
        
        // First attempt to read from the locally cached messages
        const message = (channel as TextChannel).messages.resolve(messageId);
        if (message) {
            return message;
        }

        // If not local, attempt to fetch from discord
        this.env.log("Cache miss - fetching message from Discord");
        const messages = await (channel as TextChannel).messages.fetch({
            around: messageId,
            limit: 1
        });
        return messages.get(messageId);
    }

    createChannel(channelName: string): Promise<Channel> {
        return this.guild.channels.create(channelName);
    }

    private findAnnouncementChannel(env: ENV): TextChannel | undefined {
        const guild = this.guild;
        const {channels, name: guildName} = guild;
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

        if (announcementChannel) {
            log(`${guildName} already has a channel`);
        } else {
            log(`Creating announcement channel for ${guildName}`);
            guild.channels.create(DRAFT_CHANNEL_NAME).then((channel) => {
                this.announcementChannel = channel
            });
        }
        return announcementChannel;
    }
}

export class DataResolver {

    readonly discordResolver;
    readonly env: ENV;

    readonly dbDriver: DBDriver;

    constructor(discordResolver: DiscordResolver, dbDriver: DBDriver) {
        this.discordResolver = discordResolver;
        this.env = discordResolver.env;
        this.dbDriver = dbDriver;
    }

    resolveUser(userId: DraftUserId): DraftUser {
        return new DraftUser(this.dbDriver.getOrCreateUserView(userId), this);
    }

    resolveSession(sessionId: SessionId): Session {
        return new Session(this.dbDriver.getSessionView(sessionId), this, this.env);
    }
}
