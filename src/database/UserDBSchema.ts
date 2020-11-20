import { DraftUserId, ServerId, SessionId } from "../models/types/BaseTypes";

export interface UserDBSchema {
    readonly serverId: ServerId;
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
