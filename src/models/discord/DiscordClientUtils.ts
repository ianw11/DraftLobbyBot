import { Client, Guild, GuildMember } from "discord.js";
import { DraftUserId, ServerId } from "../types/BaseTypes";

export function getGuildMemberSync(guild: Guild, draftUserId: DraftUserId): GuildMember | null {
    return guild.members.resolve(draftUserId);
}

export async function getGuildMember(guild: Guild, draftUserId: DraftUserId): Promise<GuildMember> {
    let member = getGuildMemberSync(guild, draftUserId);
    if (!member) {
        member = await guild.members.fetch(draftUserId);
    }
    return member;
}

export function getGuildSync(client: Client, guildId: ServerId): Guild | null {
    return client.guilds.resolve(guildId);
}

export async function getGuild(client: Client, guildId: ServerId): Promise<Guild> {
    let guild = getGuildSync(client, guildId);
    if (!guild) {
        guild = await client.guilds.fetch(guildId);
    }
    return guild;
}
