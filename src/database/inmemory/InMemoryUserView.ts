import { DraftUserId, ServerId, SessionId } from "../../models/types/BaseTypes";
import { removeFromArray } from "../../Utils";
import { IUserView } from "../UserDBSchema";

export class InMemoryUserView implements IUserView {
    readonly serverId;
    readonly userId;

    joinedSessionIds: SessionId[] = [];
    waitlistedSessionIds: SessionId[] = [];

    createdSessionId?: SessionId;

    constructor(serverId: ServerId, userId: DraftUserId) {
        this.serverId = serverId;
        this.userId = userId;
    }

    addedToSession(sessionId: SessionId): void {
        this.joinedSessionIds.push(sessionId);
    }
    removedFromSession(sessionId: SessionId): void {
        removeFromArray(sessionId, this.joinedSessionIds);
    }
    upgradedFromWaitlist(sessionId: SessionId): void {
        this.removedFromWaitlist(sessionId);
        this.addedToSession(sessionId);
    }
    addedToWaitlist(sessionId: SessionId): void {
        this.waitlistedSessionIds.push(sessionId);
    }
    removedFromWaitlist(sessionId: SessionId): boolean {
        return removeFromArray(sessionId, this.waitlistedSessionIds);
    }
    sessionClosed(sessionId: SessionId): boolean {
        this.removedFromSession(sessionId);
        return this.removedFromWaitlist(sessionId);
    }
}