import { DataResolver } from "./types/ResolverTypes";
import Session from "./Session";
import { User, DMChannel, MessageEmbed } from "discord.js";
import { IUserView } from "../database/UserDBSchema";
import { DraftUserId, SessionId } from "./types/BaseTypes";

export default class DraftUser {
    private readonly data: IUserView;
    
    private readonly dataResolver: DataResolver;

    // Computed then cached for use in sendDM
    private dmChannel?: DMChannel = undefined;

    constructor(data: IUserView, dataResolver: DataResolver) {
        this.data = data;

        this.dataResolver = dataResolver;
    }

    private getDiscordUser(): User | undefined {
        return this.dataResolver.discordResolver.resolveUser(this.data.userId);
    }

    getUserId(): DraftUserId {
        return this.data.userId;
    }

    getDisplayName(): string {
        return this.getDiscordUser()?.username || "<UNABLE TO GET USERNAME FROM DISCORD>";
    }

    setCreatedSessionId(createdSessionId?: SessionId): void {
        this.data.createdSessionId = createdSessionId;
    }
    getCreatedSessionId(): SessionId | undefined {
        return this.data.createdSessionId;
    }

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

    async listSessions(): Promise<void> {
        let msg = "\n**Sessions you are confirmed for:**\n";

        const callback = (includePlace: boolean) => {
            return (sessionId: SessionId) => {
                const session = this.dataResolver.resolveSession(sessionId);

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
        const session = this.dataResolver.resolveSession(this.data.createdSessionId);

        await this.sendEmbedDM(session.getEmbed(true));
    }

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
        const user = this.getDiscordUser();
        if (!user) {
            throw new Error("Could not resolve Discord User in order to sendDM");
        }
        if (!this.dmChannel) {
            this.dmChannel = await user.createDM();
        }
        return this.dmChannel;
    }
}