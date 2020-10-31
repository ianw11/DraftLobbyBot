
import { DraftUserId, SessionId } from "../../models/types/BaseTypes";
import { ISessionView, SessionDBSchema, SessionParametersDB, SessionParametersWithSugar } from "../SessionDBSchema";
import { LowDbViewBase, ObjectChain } from "./LowdbViewBase";


export class LowdbSessionView extends LowDbViewBase<SessionDBSchema> implements ISessionView {
    constructor(cursor: ObjectChain<SessionDBSchema>) {
        super(cursor);
    }

    addToConfirmed(id: DraftUserId): void {
        const arr = this.cursor.get('joinedPlayerIds');
        if (arr.includes(id).value()) {
            return;
        }
        arr.push(id).write();
    }
    removeFromConfirmed(id: DraftUserId): void {
        this.cursor.get('joinedPlayerIds').pull(id).write();
    }
    getNumConfirmed(): number {
        return this.joinedPlayerIds.length;
    }

    addToWaitlist(id: DraftUserId): void {
        const arr = this.cursor.get('waitlistedPlayerIds');
        if (arr.includes(id).value()) {
            return;
        }
        arr.push(id).write();
    }
    removeFromWaitlist(id: DraftUserId): void {
        this.cursor.get('waitlistedPlayerIds').pull(id).write();
    }
    upgradedFromWaitlist(id: DraftUserId): void {
        this.removeFromWaitlist(id);
        this.addToConfirmed(id);
    }
    getNumWaitlisted(): number {
        return this.waitlistedPlayerIds.length;
    }

    get sessionId(): SessionId {
        return this.getString('sessionId');
    }

    get ownerId(): DraftUserId | undefined {
        const id = this.getString("ownerId");
        return id === "" ? undefined : id;
    }
    set ownerId(id: DraftUserId | undefined) {
        this.assign({ownerId: id});
    }

    get joinedPlayerIds(): DraftUserId[] {
        return this.cursor.get("joinedPlayerIds").value();
    }
    set joinedPlayerIds(ids: DraftUserId[]) {
        this.cursor.assign({joinedPlayerIds: ids}).write();
    }

    get waitlistedPlayerIds(): DraftUserId[] {
        return this.cursor.get("waitlistedPlayerIds").value();
    }
    set waitlistedPlayerIds(ids: DraftUserId[]) {
        this.cursor.assign({waitlistedPlayerIds: ids}).write();
    }

    get sessionParameters(): SessionParametersWithSugar {
        return new SessionParametersPersistentData(this.cursor.get('sessionParameters'));
    }
    set sessionParameters(params: SessionParametersWithSugar) {
        this.cursor.assign({sessionParameters: params}).write();
    }

    get sessionClosed(): boolean {
        return this.getBoolean("sessionClosed");
    }
    set sessionClosed(closed: boolean) {
        this.assign({sessionClosed: closed});
    }
}

class SessionParametersPersistentData extends LowDbViewBase<SessionParametersDB> implements SessionParametersWithSugar {

    constructor(cursor: ObjectChain<SessionParametersDB>) {
        super(cursor);
    }

    get name(): string {
        return this.getString('name');
    }
    set name(name: string) {
        this.assign({name: name});
    }

    get unownedSessionName(): string {
        return this.getString('unownedSessionName');
    }
    set unownedSessionName(name: string) {
        this.assign({unownedSessionName: name});
    }

    get sessionCapacity(): number {
        return this.getNumber('sessionCapacity');
    }
    set sessionCapacity(capacity: number) {
        this.assign({sessionCapacity: capacity});
    }

    get description(): string {
        return this.getString('description');
    }
    set description(description: string) {
        this.assign({description: description});
    }

    get fireWhenFull(): boolean {
        return this.getBoolean('fireWhenFull');
    }
    set fireWhenFull(fire: boolean) {
        this.assign({fireWhenFull: fire});
    }

    get sessionConfirmMessage(): string {
        return this.getString('sessionConfirmMessage');
    }
    set sessionConfirmMessage(message: string) {
        this.assign({sessionConfirmMessage: message});
    }

    get sessionWaitlistMessage(): string {
        return this.getString('sessionWaitlistMessage');
    }
    set sessionWaitlistMessage(message: string) {
        this.assign({sessionWaitlistMessage: message});
    }

    get sessionCancelMessage(): string {
        return this.getString('sessionCancelMessage');
    }
    set sessionCancelMessage(message: string) {
        this.assign({sessionCancelMessage: message});
    }

    get templateUrl(): string {
        return this.getString('templateUrl');
    }
    set templateUrl(url: string) {
        this.assign({templateUrl: url});
    }

    get dateStr(): string | undefined {
        return this.getString('dateStr');
    }
    set dateStr(str: string | undefined) {
        this.assign({dateStr: str});
    }

    get date(): Date | undefined {
        const dateStr = this.dateStr;
        return dateStr ? new Date(dateStr) : undefined;
    }
    set date(date: Date | undefined) {
        this.dateStr = date ? date.toISOString() : undefined;
    }

    get _generatedUrl(): string {
        return this.getString('_generatedUrl');
    }
    set _generatedUrl(url: string) {
        this.assign({_generatedUrl: url});
    }

    get _generatedName(): string {
        return this.getString('_generatedName');
    }
    set _generatedName(name: string) {
        this.assign({_generatedName: name});
    }
}
