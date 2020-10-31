import { removeFromArray } from "../Utils";
import { DraftUserId, SessionId } from "../models/types/BaseTypes";

export interface UserDBSchema {
    readonly userId: DraftUserId;

    readonly joinedSessionIds: Array<SessionId>;
    readonly waitlistedSessionIds: Array<SessionId>;

    createdSessionId?: SessionId;
}

export interface IUserView extends UserDBSchema {
    addedToSession(sessionId: SessionId): void;
    removedFromSession(sessionId: SessionId): void;
    upgradedFromWaitlist(sessionId: SessionId): void;
    addedToWaitlist(sessionId: SessionId): void;
    removedFromWaitlist(sessionId: SessionId): boolean;
    sessionClosed(sessionId: SessionId): boolean;
}

export class InMemoryUserPersistentData implements IUserView {
    readonly userId;

    joinedSessionIds: SessionId[] = [];
    waitlistedSessionIds: SessionId[] = [];

    createdSessionId?: SessionId;

    constructor(userId: DraftUserId) {
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
