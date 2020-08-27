import { DraftUserId, SessionResolver, DiscordUserResolver } from "./types/DraftServerTypes";
import Session, {SessionId} from "./Session";
import { User, DMChannel, MessageEmbed } from "discord.js";
import {removeFromArray} from "../Utils";

export default class DraftUser {
    private readonly userId: DraftUserId;
    private readonly discordUserResolver: DiscordUserResolver;

    private sessionResolver: SessionResolver;
    // Public for unit testing purposes
    joinedSessions: SessionId[] = [];
    waitlistedSessions: SessionId[] = [];

    // Remains null except for when there's an active Session
    private createdSessionId: SessionId | null = null;

    // Computed then cached for use in sendDM
    private dmChannel: DMChannel | null = null;

    constructor(userId: DraftUserId, discordUserResolver: DiscordUserResolver, sessionResolver: SessionResolver) {
        this.userId = userId;
        this.discordUserResolver = discordUserResolver;

        this.sessionResolver = sessionResolver;
    }

    private getDiscordUser(): User | undefined {
        return this.discordUserResolver.resolve(this.userId);
    }

    getUserId(): DraftUserId {
        return this.userId;
    }

    getDisplayName(): string {
        return this.getDiscordUser()?.username || "<UNABLE TO GET USERNAME FROM DISCORD>";
    }

    setCreatedSessionId(createdSessionId: SessionId | null): void {
        this.createdSessionId = createdSessionId;
    }
    getCreatedSessionId(): SessionId | null {
        return this.createdSessionId;
    }

    setSessionResolver(sessionResolver: SessionResolver): void {
        this.sessionResolver = sessionResolver;
    }

    async addedToSession(session: Session): Promise<void> {
        this.joinedSessions.push(session.sessionId);
        await this.sendDM(`You're confirmed for ${session.getName()}`);
    }

    async removedFromSession(session: Session): Promise<void> {
        removeFromArray(session.sessionId, this.joinedSessions);
        await this.sendDM(`You've been removed from ${session.getName()}`);
    }

    async upgradedFromWaitlist(session: Session): Promise<void> {
        removeFromArray(session.sessionId, this.waitlistedSessions);
        this.joinedSessions.push(session.sessionId);
        await this.sendDM(`You've been upgraded from the waitlist for ${session.getName()}`);
    }

    async addedToWaitlist(session: Session): Promise<void> {
        this.waitlistedSessions.push(session.sessionId);
        await this.sendDM(`You've been waitlisted for ${session.getName()}.  You're in position: ${session.getNumWaitlisted()}`);
    }

    async removedFromWaitlist(session: Session): Promise<void> {
        removeFromArray(session.sessionId, this.waitlistedSessions);
        await this.sendDM(`You've been removed from the waitlist for ${session.getName()}`);
    }

    async sessionClosed(session: Session, startedNormally = true): Promise<void> {
        removeFromArray(session.sessionId, this.joinedSessions);
        const waitlisted = removeFromArray(session.sessionId, this.waitlistedSessions);

        if (startedNormally) {
            if (waitlisted) {
                await this.sendDM(`${session.getName()} has started, but you were on the waitlist`);
            } else {
                await this.sendDM(`${session.getName()} has started. Draft url: ${session.getUrl()}`);
            }
        } else {
            await this.sendDM(`${session.getName()} has been cancelled`);
        }
    }

    async listSessions(): Promise<void> {
        let msg = "\n**Sessions you are confirmed for:**\n";

        const callback = (includePlace: boolean) => {
            return (sessionId: SessionId) => {
                const session = this.sessionResolver.resolve(sessionId);

                msg += `- ${session.toString()}`;
                if (includePlace) {
                    const position = session.getWaitlistIndexOf(this.getUserId()) + 1;
                    msg += ` || You are in position ${position} of ${session.getNumWaitlisted()}`;
                }
                msg += '\n';
            }
        };

        this.joinedSessions.forEach(callback(false));
        msg += "**Sessions you are waitlisted for:**\n";
        this.waitlistedSessions.forEach(callback(true));

        await this.sendDM(msg);
    }

    async printOwnedSessionInfo(): Promise<void> {
        if (!this.createdSessionId) {
            await this.sendDM("Cannot send info - you haven't created a draft session");
            return;
        }
        const session = this.sessionResolver.resolve(this.createdSessionId);

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