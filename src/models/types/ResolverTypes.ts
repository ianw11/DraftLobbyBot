import DraftUser from "../DraftUser";
import Session from "../Session";
import { Channel, Guild, GuildChannel, Message, TextChannel, User } from 'discord.js';
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

    resolveUser(userId: string): User | undefined {
        return this.guild.members.resolve(userId)?.user;
    }

    resolveMessageInAnnouncementChannel(messageId: string): Message | null {
        if (!this.announcementChannel) {
            throw new Error("Text Channel not attached - unable to resolveMessage");
        }
        return this.resolveMessage(this.announcementChannel.id, messageId);
    }

    resolveMessage(channelId: string, messageId: string): Message | null {
        const channel = this.guild.channels.resolve(channelId);
        if (!channel || channel.type !== 'text') {
            return null;
        }
        return (channel as TextChannel).messages.resolve(messageId);
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
        return new DraftUser(this.dbDriver.getUserView(userId), this.discordResolver, this);
    }

    resolveSession(sessionId: SessionId): Session {
        return new Session(this, this.env, this.dbDriver.getSessionView(sessionId));
    }
}
