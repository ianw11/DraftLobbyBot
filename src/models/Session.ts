import { Message } from "discord.js";
import DraftUser from "./DraftUser";
import { removeFromArray } from "../Utils";
import { UserResolver, DraftUserId } from "./DraftServer";

// eslint-disable-next-line @typescript-eslint/no-var-requires
const hri = require("human-readable-ids").hri; // JS Library

export type SessionId = string;

export interface SessionParameters {
    name: string;
    sessionCapacity: number;
    description: string;
    date?: Date; // The lack of this field indicates the Session intends to start immediately - aka probably an ad-hoc draft
    fireWhenFull: boolean; // Or should we wait for the Session owner to run the StartCommand
    url: string;
}

export const DEFAULT_PARAMS: SessionParameters = Object.freeze({
    name: '',
    url: '',
    sessionCapacity: 8,
    description: "<NO DESCRIPTION PROVIDED>",
    fireWhenFull: true
});

export type SessionConstructorParameter = SessionParameters & {ownerId?: string};

export default class Session {
    // Maintained only so the owner can't leave the draft instead of deleting it
    private readonly ownerId?: DraftUserId;

    private readonly message: Message;
    readonly sessionId: SessionId;

    private readonly userResolver: UserResolver;

    private readonly joinedPlayers: DraftUserId[] = [];
    private readonly waitlistedPlayers: DraftUserId[] = [];

    private readonly params: SessionParameters;
    private sessionClosed = false;

    constructor (message: Message, userResolver: UserResolver, params?: Partial<SessionConstructorParameter>) {
        this.message = message;
        this.sessionId = message.id;

        this.userResolver = userResolver;

        if (params) {
            this.ownerId = params.ownerId;
        }

        const defaultName = this.ownerId ? `${this.userResolver.resolve(this.ownerId).getDisplayName()}'s Draft` : `Server scheduled draft`;

        this.params = {
            ...DEFAULT_PARAMS,
            ...{
                name: defaultName,
                url: `https://mtgadraft.herokuapp.com/?session=${hri.random()}`
            },
            ...(params || {})
        };
    }

    // These two methods would be good candidates as getter methods
    // but the Substitute mocking testing framework doesn't allow
    // for getter methods to be easily mocked.

    getNumConfirmed(): number {
        return this.joinedPlayers.length;
    }
    getNumWaitlisted(): number {
        return this.waitlistedPlayers.length;
    }
    
    getWaitlistIndexOf(draftUserId: DraftUserId): number {
        return this.waitlistedPlayers.indexOf(draftUserId);
    }

    async setName(name: string): Promise<void> {
        this.params.name = name;
        await this.updateMessage();
    }
    getName(): string {
        return this.params.name;
    }

    setUrl(url: string): void {
        this.params.url = url;
    }
    getUrl(): string {
        return this.params.url;
    }

    async setSessionCapacity(sessionCapacity: number): Promise<void> {
        if (sessionCapacity < 1)  {
            throw new Error("Minimum allowed number of players is 1");
        }
        if (sessionCapacity < this.getNumConfirmed()) {
            throw new Error(`There are ${this.getNumConfirmed()} people already confirmed - some of them will need to leave before I can lower to ${sessionCapacity}`);
        }

        this.params.sessionCapacity = sessionCapacity;
        await this.updateMessage();
        await this.fireIfAble();
    }
    getSessionCapacity(): number {
        return this.params.sessionCapacity;
    }

    async setDescription(description: string): Promise<void> {
        this.params.description = description;
        await this.updateMessage();
    }
    getDescription(): string {
        return this.params.description;
    }

    async setDate(date?: Date): Promise<void> {
        this.params.date = date;
        await this.updateMessage();
    }
    getDate(): Date | undefined {
        return this.params.date;
    }

    async setFireWhenFull(fire: boolean): Promise<void> {
        this.params.fireWhenFull = fire;
        await this.updateMessage();
    }
    getFireWhenFull(): boolean {
        return this.params.fireWhenFull;
    }


    canAddPlayers() : boolean {
        return !this.sessionClosed && this.getNumConfirmed() < this.params.sessionCapacity;
    }

    async addPlayer(draftUser: DraftUser): Promise<void> {
        if (this.sessionClosed) {
            throw new Error("Can't join session - already closed");
        }

        const userId = draftUser.getUserId();

        if (this.joinedPlayers.indexOf(userId) !== -1 || this.waitlistedPlayers.indexOf(userId) !== -1) {
            throw new Error("User already joined");
        }

        if (this.canAddPlayers()) {
            this.joinedPlayers.push(userId);
            draftUser.addedToSession(this);
        } else {
            this.waitlistedPlayers.push(userId);
            draftUser.addedToWaitlist(this);
        }

        await this.updateMessage();
        await this.fireIfAble();
    }

    async removePlayer(draftUser: DraftUser): Promise<void> {
        const userId = draftUser.getUserId();

        if (userId === this.ownerId) {
            throw new Error("Owner trying to leave - use `$delete` to delete draft");
        }

        const joinedIndex = this.joinedPlayers.indexOf(userId);
        if (joinedIndex !== -1) {
            removeFromArray(userId, this.joinedPlayers);
            draftUser.removedFromSession(this);
        } else {
            const waitlistIndex = this.waitlistedPlayers.indexOf(userId);
            if (waitlistIndex !== -1) {
                removeFromArray(userId, this.waitlistedPlayers);
                draftUser.removedFromWaitlist(this);
            }
        }

        await this.updateMessage();
        await this.upgradePlayer();
    }

    private async upgradePlayer() {
        let upgradedPlayerId;
        while (this.canAddPlayers() && (upgradedPlayerId = this.waitlistedPlayers.shift())) {
            const upgradedPlayer = this.userResolver.resolve(upgradedPlayerId);
            this.joinedPlayers.push(upgradedPlayerId);
            await upgradedPlayer.upgradedFromWaitlist(this);
        }
        await this.updateMessage();
    }


    private async fireIfAble() {
        if (!this.params.fireWhenFull || this.canAddPlayers()) {
            return;
        }

        await this.terminate(true);
    }
    
    async terminate(started = false): Promise<void> {
        this.sessionClosed = true;

        // Notify both joined and waitlisted that this Session is closed
        const callback = (draftUserId: DraftUserId) => this.userResolver.resolve(draftUserId).sessionClosed(this, started);
        this.joinedPlayers.forEach(callback);
        this.waitlistedPlayers.forEach(callback);

        // Clean up the announcement channel a bit
        await this.message.delete();
    }

    private async updateMessage() {
        await this.message.edit(`${this.toString(true)}\n\nTap the reaction below to register and again to unregister`);
    }


    buildAttendanceString(provideOwnerInformation = false): string {
        const numJoined = this.joinedPlayers.length;
        const numWaitlisted = this.waitlistedPlayers.length;
        const {sessionCapacity, fireWhenFull} = this.params;
        let msg = `Number joined: ${numJoined} <> Capacity: ${sessionCapacity} <> ${fireWhenFull ? "Draft will launch when capacity is reached" : `Waitlisted: ${numWaitlisted}`}`;

        if (provideOwnerInformation) {
            msg += "\n**CURRENTLY JOINED**\n";
            this.joinedPlayers.forEach((draftUserId: DraftUserId) => {
                msg += `- ${this.userResolver.resolve(draftUserId).getDisplayName()}`;
            });
        }

        return msg;
    }

    /**
     * The  joined user listing will only be printed if both multiline and provideOwnerInformation is turned on
     */
    toString(multiline = false, provideOwnerInformation = false): string {
        const linebreak = multiline ? '\n' : '  ';
        const {name, date, description} = this.params;

        const when = date ? `Scheduled for: ___${date.toString()}___` : "Ad-hoc event - Join now!";
        
        return `**${name}**${linebreak}${when}${multiline ? linebreak : ' ['}${this.buildAttendanceString(multiline && provideOwnerInformation)}${multiline ? `${linebreak}#-#-#-#-#-#-#-#${linebreak}` : '] -- '}${description}`;
    }

    toOwnerString(includeWaitlist = false): string {
        const reducer = (accumulator: DraftUserId, current: string) => `${accumulator}\n- ${this.userResolver.resolve(current).getDisplayName()}`;
        const joinedUsernames = `\nJoined:${this.joinedPlayers.reduce(reducer, '')}`;
        const waitlistedUsernames = includeWaitlist ? `\nWaitlist:${this.waitlistedPlayers.reduce(reducer, '')}` : '';
        return `${this.buildAttendanceString()}${joinedUsernames}${waitlistedUsernames}`;
    }
}