import { User } from "discord.js";
import Session, {SessionId} from "./Session";
import {removeFromArray} from "../Utils";
import { DraftUserId, SessionResolver } from "./DraftServer";

export default class DraftUser {
    private readonly user: User;

    private createdSessionId: SessionId | null = null;
    joinedSessions: SessionId[] = [];
    waitlistedSessions: SessionId[] = [];

    private sessionResolver: SessionResolver;

    constructor(user: User, sessionResolver: SessionResolver) {
        this.user = user;
        this.sessionResolver = sessionResolver;
    }


    getUserId(): DraftUserId {
        return this.user.id;
    }

    getDisplayName(): string {
        return this.user.username;
    }

    async sendDM(message: string | null) {
        if (!message) {
            return;
        }
        await (await this.user.createDM()).send(message);
    }

    setCreatedSessionId(createdSessionId: SessionId | null) {
        this.createdSessionId = createdSessionId;
    }

    getCreatedSessionId(): SessionId | null {
        return this.createdSessionId;
    }

    setSessionResolver(sessionResolver: SessionResolver) {
        this.sessionResolver = sessionResolver;
    }

    async addedToSession(session: Session) {
        this.joinedSessions.push(session.sessionId);
        await this.sendDM(`You're confirmed for ${session.params.name}`);
    }

    async removedFromSession(session: Session) {
        removeFromArray(session.sessionId, this.joinedSessions);
        await this.sendDM(`You've been removed from ${session.params.name}`);
    }

    async upgradedFromWaitlist(session: Session) {
        removeFromArray(session.sessionId, this.waitlistedSessions);
        this.joinedSessions.push(session.sessionId);
        await this.sendDM(`You've been upgraded from the waitlist for ${session.params.name}`);
    }

    async addedToWaitlist(session: Session) {
        this.waitlistedSessions.push(session.sessionId);
        await this.sendDM(`You've been waitlisted for ${session.params.name}.  You're in position: ${session.getNumWaitlisted()}`);
    }

    async removedFromWaitlist(session: Session) {
        removeFromArray(session.sessionId, this.waitlistedSessions);
        await this.sendDM(`You've been removed from the waitlist for ${session.params.name}`);
    }

    async sessionClosed(session: Session, startedNormally: boolean = true) {
        removeFromArray(session.sessionId, this.joinedSessions);
        const waitlisted = removeFromArray(session.sessionId, this.waitlistedSessions);

        if (startedNormally) {
            if (waitlisted) {
                await this.sendDM(`${session.params.name} has started, but you were on the waitlist`);
            } else {
                await this.sendDM(`${session.params.name} has started. Draft url: ${session.params.url}`);
            }
        } else {
            await this.sendDM(`${session.params.name} has been cancelled`);
        }
    }

    async listSessions() {
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

    async printOwnedSessionInfo() {
        if (!this.createdSessionId) {
            await this.sendDM("Cannot send info - you haven't created a draft session");
            return;
        }
        const session = this.sessionResolver.resolve(this.createdSessionId);

        let msg = `You have a draft session\n`;
        msg += `${session.toString(true, true)}\n`;

        await this.sendDM(msg);
    }
}