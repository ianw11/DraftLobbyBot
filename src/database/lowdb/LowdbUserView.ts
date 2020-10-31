import { DraftUserId, SessionId } from "../../models/types/BaseTypes";
import { IUserView, UserDBSchema } from "../UserDBSchema";
import { ObjectChain } from "./LowdbViewBase";

export class LowdbUserView implements IUserView {

    private readonly cursor;
    
    constructor(cursor: ObjectChain<UserDBSchema>) {
        this.cursor = cursor;
    }

    get userId(): DraftUserId {
        return this.cursor.get('userId').value();
    }
    /* No setter for userId - it's readonly */

    get joinedSessionIds(): SessionId[] {
        return this.cursor.get('joinedSessionIds').value();
    }
    set joinedSessionIds(newIds: SessionId[]) {
        this.cursor.assign({joinedSessionIds: newIds}).write();
    }

    addedToSession(sessionId: SessionId): void {
        const arrayCursor = this.cursor.get('joinedSessionIds');
        if (arrayCursor.indexOf(sessionId).value() === -1) {
            arrayCursor.push(sessionId).write();
        }
    }
    removedFromSession(sessionId: SessionId): void {
        this.cursor.get('joinedSessionIds').pull(sessionId).write();
    }

    get waitlistedSessionIds(): SessionId[] {
        return this.cursor.get('waitlistedSessionIds').value();
    }
    set waitlistedSessionIds(newIds: SessionId[]) {
        this.cursor.assign({waitlistedSessionIds: newIds}).write();
    }

    upgradedFromWaitlist(sessionId: SessionId): void {
        this.removedFromWaitlist(sessionId);
        this.addedToSession(sessionId);
    }
    addedToWaitlist(sessionId: SessionId): void {
        const arrayCursor = this.cursor.get('waitlistedSessionIds');
        if (arrayCursor.indexOf(sessionId).value() === -1) {
            arrayCursor.push(sessionId).write();
        }
    }
    removedFromWaitlist(sessionId: SessionId): boolean {
        const arrayCursor = this.cursor.get('waitlistedSessionIds');
        const beforeLength = arrayCursor.value().length;
        arrayCursor.pull(sessionId).write();
        return arrayCursor.value().length !== beforeLength;
    }

    get createdSessionId(): SessionId | undefined {
        return this.cursor.get('createdSessionId').value();
    }
    set createdSessionId(newId: SessionId | undefined) {
        this.cursor.assign({createdSessionId: newId}).write();
    }

    sessionClosed(sessionId: SessionId): boolean {
        this.removedFromSession(sessionId);
        return this.removedFromWaitlist(sessionId);
    }
}