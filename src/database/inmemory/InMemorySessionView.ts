import { DraftUserId, SessionId } from "../../models/types/BaseTypes";
import { removeFromArray } from "../../Utils";
import { ISessionView, SessionParametersWithSugar } from "../SessionDBSchema";

export class InMemorySessionView implements ISessionView {
    joinedPlayerIds: string[] = [];
    waitlistedPlayerIds: string[] = [];
    sessionClosed = false;

    sessionParameters: SessionParametersWithSugar;
    sessionId: string;
    ownerId?: DraftUserId;

    constructor(sessionId: SessionId, params: SessionParametersWithSugar, ownerId?: DraftUserId) {
        this.sessionId = sessionId;
        this.ownerId = ownerId;
        this.sessionParameters = params;
    }

    addToConfirmed(id: DraftUserId): void {
        this.joinedPlayerIds.push(id);
    }
    removeFromConfirmed(id: DraftUserId): void {
        removeFromArray(id, this.joinedPlayerIds);
    }
    getNumConfirmed(): number {
        return this.joinedPlayerIds.length;
    }
    addToWaitlist(id: DraftUserId): void {
        this.waitlistedPlayerIds.push(id);
    }
    removeFromWaitlist(id: DraftUserId): void {
        removeFromArray(id, this.waitlistedPlayerIds);
    }
    upgradedFromWaitlist(id: DraftUserId): void {
        this.removeFromWaitlist(id);
        this.addToConfirmed(id);
    }
    getNumWaitlisted(): number {
        return this.waitlistedPlayerIds.length;
    }
}
