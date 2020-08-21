import { User, DMChannel } from "discord.js";
import Session, {SessionId} from "./Session";
import {removeFromArray} from "../Utils";
import { DraftUserId } from "./DraftServer";

export interface SessionResolver {
    (sessionId: SessionId): Session;
}

export default class DraftUser {
    private readonly user: User;

    ownsSession?: SessionId;
    private joinedSessions: SessionId[] = [];
    private waitlistedSessions: SessionId[] = [];

    constructor(user: User) {
        this.user = user;
    }

    getUserId(): DraftUserId {
        return this.user.id;
    }

    async sendDM(message: string) {
        await (await this.user.createDM()).send(message);
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
            await this.sendDM(`Session ${session.name} has started`);
        } else {
            await this.sendDM(`Session ${session.name} has been cancelled`);
        }
    }

    async listSessions(resolver: SessionResolver) {
        let msg = "\n**Sessions you are confirmed for:**\n";

        const callback = (sessionId: SessionId) => {
            const session = resolver(sessionId);
            msg += `- ${session.toString()}\n`;
        };

        this.joinedSessions.forEach(callback);
        msg += "**Sessions you are waitlisted for:**\n";
        this.waitlistedSessions.forEach(callback);

        await this.sendDM(msg);
    }
}