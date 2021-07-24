import { DraftUserId, ServerId, SessionId } from "../../models/types/BaseTypes";
import { IUserView, UserDBSchema } from "../UserDBSchema";
import { LowDbViewBase, ObjectChain } from "./LowdbViewBase";

export class LowdbUserView extends LowDbViewBase<UserDBSchema> implements IUserView {
    
    constructor(cursor: ObjectChain<UserDBSchema>) {
        super(cursor);
    }

    get serverId(): ServerId {
        return this.getSnowflake('serverId');
    }

    get userId(): DraftUserId {
        return this.getSnowflake('userId');
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
        const sessionId = this.getSnowflake('createdSessionId');
        return sessionId === "" ? undefined : sessionId;
    }
    set createdSessionId(newId: SessionId | undefined) {
        this.cursor.assign({createdSessionId: newId}).write();
    }

    sessionClosed(sessionId: SessionId): boolean {
        this.removedFromSession(sessionId);
        return this.removedFromWaitlist(sessionId);
    }
}