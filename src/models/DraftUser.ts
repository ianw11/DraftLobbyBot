import { Resolver } from "./types/ResolverTypes";
import Session from "./Session";
import { User, DMChannel, MessageEmbed, GuildMember } from "discord.js";
import { IUserView } from "../database/UserDBSchema";
import { DraftUserId, SessionId } from "./types/BaseTypes";

export default class DraftUser {
    private readonly data: IUserView;
    private readonly resolver: Resolver;

    // Computed then cached for use in sendDM
    private dmChannel?: DMChannel = undefined;

    constructor(data: IUserView, resolver: Resolver) {
        this.data = data;
        this.resolver = resolver;
    }

    getUserId(): DraftUserId {
        return this.data.userId;
    }

    getDisplayName(): string {
        let name = this.getDiscordGuildMember()?.nickname;
        if (!name) {
            name = this.getDiscordUser()?.username || "<UNABLE TO GET USERNAME FROM DISCORD>";
        }
        return name;
    }

    setCreatedSessionId(createdSessionId?: SessionId): void {
        this.data.createdSessionId = createdSessionId;
    }
    getCreatedSessionId(): SessionId | undefined {
        return this.data.createdSessionId;
    }

    //////////////////////////
    // Session Data Methods //
    //////////////////////////

    async addedToSession(session: Session): Promise<void> {
        this.data.addedToSession(session.sessionId);
        await this.sendDM(`You're confirmed for ${session.getName()}`);
    }

    async removedFromSession(session: Session): Promise<void> {
        this.data.removedFromSession(session.sessionId);
        await this.sendDM(`You've been removed from ${session.getName()}`);
    }

    async upgradedFromWaitlist(session: Session): Promise<void> {
        this.data.upgradedFromWaitlist(session.sessionId);
        await this.sendDM(`You've been upgraded from the waitlist for ${session.getName()}`);
    }

    async addedToWaitlist(session: Session): Promise<void> {
        this.data.addedToWaitlist(session.sessionId);
        await this.sendDM(`You've been waitlisted for ${session.getName()}.  You're in position: ${session.getNumWaitlisted()}`);
    }

    async removedFromWaitlist(session: Session): Promise<void> {
        this.data.removedFromWaitlist(session.sessionId)
        await this.sendDM(`You've been removed from the waitlist for ${session.getName()}`);
    }

    async sessionClosed(session: Session, startedNormally = true): Promise<void> {
        const waitlisted = this.data.sessionClosed(session.sessionId);

        if (startedNormally) {
            if (waitlisted) {
                await this.sendDM(session.getWaitlistMessage());
            } else {
                await this.sendDM(session.getConfirmedMessage());
            }
        } else {
            await this.sendDM(session.getCancelledMessage());
        }
    }

    //////////////////
    // Info Methods //
    //////////////////

    async listSessions(): Promise<void> {
        let msg = "\n**Sessions you are confirmed for:**\n";

        const callback = (includePlace: boolean) => {
            return (sessionId: SessionId) => {
                const session = this.resolver.resolveSession(sessionId);

                msg += `- ${session.toSimpleString()}`;
                if (includePlace) {
                    const position = session.getWaitlistIndexOf(this.getUserId()) + 1;
                    msg += ` || You are in position ${position} of ${session.getNumWaitlisted()}`;
                }
                msg += '\n';
            }
        };

        this.data.joinedSessionIds.forEach(callback(false));
        if (this.data.waitlistedSessionIds.length > 0) {
            msg += "**Sessions you are waitlisted for:**\n";
            this.data.waitlistedSessionIds.forEach(callback(true));
        }

        await this.sendDM(msg);
    }

    async printOwnedSessionInfo(): Promise<void> {
        if (!this.data.createdSessionId) {
            await this.sendDM("Cannot send info - you haven't created a session");
            return;
        }
        const session = this.resolver.resolveSession(this.data.createdSessionId);

        await this.sendEmbedDM(session.getEmbed(true));
    }

    ////////////////////
    // Helper methods //
    ////////////////////

    async sendDM(message: string | null): Promise<void> {
        if (!message) {
            return;
        }
        await (await this.getDmChannel()).send(message);
    }

    async sendEmbedDM(embed: MessageEmbed): Promise<void> {
        await (await this.getDmChannel()).send({embed: embed})
    }

    private async getDmChannel() {
        const user = await this.getDiscordUserAsync();
        if (!this.dmChannel) {
            this.dmChannel = await user.createDM();
        }
        return this.dmChannel;
    }

    private getDiscordUser(): User | undefined {
        return this.resolver.discordResolver.resolveUser(this.data.userId);
    }

    private getDiscordUserAsync(): Promise<User> {
        return this.resolver.discordResolver.resolveUserAsync(this.data.userId);
    }

    private getDiscordGuildMember(): GuildMember | null {
        return this.resolver.discordResolver.resolveGuildMember(this.data.userId);
    }
}