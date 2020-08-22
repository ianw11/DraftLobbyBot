import { User } from "discord.js";
import Session, {SessionId} from "./Session";
import {removeFromArray} from "../Utils";
import { DraftUserId, SessionResolver } from "./DraftServer";

export default class DraftUser {
    private readonly user: User;

    createdSessionId?: SessionId;
    private joinedSessions: SessionId[] = [];
    private waitlistedSessions: SessionId[] = [];

    private readonly sessionResolver: SessionResolver;

    constructor(user: User, sessionResolver: SessionResolver) {
        this.user = user;
        this.sessionResolver = sessionResolver;
    }

    getUserId(): DraftUserId {
        return this.user.id;
    }

    getUserName(): string {
        return this.user.username;
    }

    isBot(): boolean {
        return this.user.bot;
    }

    async sendDM(message: string) {
        if (!this.user.bot) {
            await (await this.user.createDM()).send(message);
        }
    }

    async addedToSession(session: Session) {
        this.joinedSessions.push(session.sessionId);
        await this.sendDM(`You're confirmed for ${session.name}`);
    }

    async removedFromSession(session: Session) {
        removeFromArray(session.sessionId, this.joinedSessions);
        await this.sendDM(`You've been removed from ${session.name}`);
    }

    async upgradedFromWaitlist(session: Session) {
        removeFromArray(session.sessionId, this.waitlistedSessions);
        this.joinedSessions.push(session.sessionId);
        await this.sendDM(`You've been upgraded from the waitlist for ${session.name}`);
    }

    async addedToWaitlist(session: Session) {
        this.waitlistedSessions.push(session.sessionId);
        await this.sendDM(`You've been waitlisted for ${session.name}.  You're in position: ${session.getNumWaitlisted()}`);
    }

    async removedFromWaitlist(session: Session) {
        removeFromArray(session.sessionId, this.waitlistedSessions);
        await this.sendDM(`You've been removed from the waitlist for ${session.name}`);
    }

    async sessionClosed(session: Session, startedNormally: boolean = true) {
        removeFromArray(session.sessionId, this.joinedSessions);
        removeFromArray(session.sessionId, this.waitlistedSessions);

        if (startedNormally) {
            await this.sendDM(`Session ${session.name} has started. Draft will be held here: ${session.url}`);
        } else {
            await this.sendDM(`Session ${session.name} has been cancelled`);
        }
    }

    async listSessions() {
        let msg = "\n**Sessions you are confirmed for:**\n";

        const callback = (includePlace: boolean) => {
            return (sessionId: SessionId) => {
                const session = this.sessionResolver(sessionId);
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

        const session = this.sessionResolver(this.createdSessionId);

        let msg = `You have a draft session\n`;
        msg += `${session.toString()}\n`
        msg += `${session.getNumConfirmed()} confirmed and ${session.getNumWaitlisted()} waitlisted`;

        await this.sendDM(msg);
    }
}