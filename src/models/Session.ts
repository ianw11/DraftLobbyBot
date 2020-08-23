import { Message } from "discord.js";
import DraftUser from "./DraftUser";
import { removeFromArray } from "../Utils";
import { UserResolver, DraftUserId } from "./DraftServer";
const hri = require("human-readable-ids").hri; // JS Library

export type SessionId = string;

export interface SessionParameters {
    name: string;
    maxNumPlayers: number;
    description: string;
    date?: Date | null; // The lack of this field indicates the Session intends to start immediately - aka probably an ad-hoc draft
    fireWhenFull: boolean; // Or should we wait for the Session owner to run the StartCommand
    url: string;
}

export const DEFAULT_PARAMS: SessionParameters = Object.freeze({
    name: '',
    url: '',
    maxNumPlayers: 8,
    description: "<NO DESCRIPTION PROVIDED>",
    fireWhenFull: true
});

export default class Session {
    // Maintained only so the owner can't leave the draft instead of deleting it
    private readonly ownerId: DraftUserId;

    private readonly message: Message;
    readonly sessionId: SessionId;

    private readonly userResolver: UserResolver;

    private readonly joinedPlayers: DraftUserId[] = [];
    private readonly waitlistedPlayers: DraftUserId[] = [];

    private readonly params: SessionParameters;

    constructor (ownerId: DraftUserId, message: Message, userResolver: UserResolver, params?: Partial<SessionParameters>) {
        this.ownerId = ownerId;
        this.message = message;
        this.sessionId = message.id;

        this.userResolver = userResolver;

        this.params = {
            ...DEFAULT_PARAMS,
            ...{
                name: `${this.userResolver.resolve(ownerId).getDisplayName()}'s Draft`,
                url: `https://mtgadraft.herokuapp.com/?session=${hri.random()}`
            },
            ...(params || {})
        };
    }

    getParameters(): SessionParameters {
        return {...this.params};
    }

    async setName(name: string) {
        this.params.name = name;
        await this.updateMessage();
    }
    getName() {
        return this.params.name;
    }

    async setUrl(url: string) {
        this.params.url = url;
    }
    getUrl() {
        return this.params.url;
    }

    async setMaxNumPlayers(maxNumPlayers: number) {
        if (maxNumPlayers < 1)  {
            throw new Error("Minimum allowed number of players is 1");
        }
        if (maxNumPlayers < this.getNumConfirmed()) {
            throw `There are ${this.getNumConfirmed()} people already confirmed - some of them will need to leave before I can lower to ${maxNumPlayers}`;
        }

        this.params.maxNumPlayers = maxNumPlayers;
        await this.updateMessage();
        await this.fireIfAble();
    }
    getMaxNumPlayers() {
        return this.params.maxNumPlayers;
    }

    async setDescription(description: string) {
        this.params.description = description;
        await this.updateMessage();
    }
    getDescription() {
        return this.params.description;
    }

    async setDate(date: Date | null) {
        this.params.date = date;
        await this.updateMessage();
    }
    getDate() {
        return this.params.date;
    }

    async setFireWhenFull(fire: boolean) {
        this.params.fireWhenFull = fire;
        await this.updateMessage();
    }
    getFireWhenFull() {
        return this.params.fireWhenFull;
    }
    

    getNumConfirmed() {
        return this.joinedPlayers.length;
    }
    getNumWaitlisted() {
        return this.waitlistedPlayers.length;
    }

    getWaitlistIndexOf(draftUserId: DraftUserId): number {
        return this.waitlistedPlayers.indexOf(draftUserId);
    }


    canAddPlayers() : boolean {
        return this.getNumConfirmed() < this.params.maxNumPlayers;
    }

    async addPlayer(draftUser: DraftUser) {
        const userId = draftUser.getUserId();

        if (this.joinedPlayers.indexOf(userId) !== -1 || this.waitlistedPlayers.indexOf(userId) !== -1) {
            throw "User already joined";
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

    async removePlayer(draftUser: DraftUser) {
        const userId = draftUser.getUserId();

        if (userId === this.ownerId) {
            throw "Owner trying to leave - use `$delete` to delete draft";
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


    async terminate(started: boolean = false) {
        const callback = (draftUserId: DraftUserId) => this.userResolver.resolve(draftUserId).sessionClosed(this, started);
        this.joinedPlayers.forEach(callback);
        this.waitlistedPlayers.forEach(callback);

        await this.message.delete();
    }

    private async updateMessage() {
        await this.message.edit(`${this.toString(true)}\n\nTap the reaction below to register and again to unregister`);
    }

    private async fireIfAble() {
        if (!this.params.fireWhenFull || this.canAddPlayers()) {
            return;
        }

        await this.terminate(true);
    }

    buildAttendanceString() {
        const numJoined = this.joinedPlayers.length;
        const numWaitlisted = this.waitlistedPlayers.length;
        const {maxNumPlayers, fireWhenFull} = this.params;
        return `Number joined: ${numJoined} <> Capacity: ${maxNumPlayers} <> ${fireWhenFull ? "Draft will launch when capacity is reached" : `Waitlisted: ${numWaitlisted}`}`;
    }

    toString(multiline = false, provideOwnerInformation = false): string {
        const linebreak = multiline ? '\n' : '  ';
        const {name, date, description} = this.params;

        const when = date ? `Scheduled for: ___${date.toString()}___` : "Ad-hoc event - Join now!";
        
        return `**${name}**${linebreak}${when}${multiline ? linebreak : ' ['}${this.buildAttendanceString()}${multiline ? linebreak : '] -- '}${description}`;
    }

    toOwnerString(includeWaitlist = false) {
        const reducer = (accumulator: DraftUserId, current: string) => `${accumulator}\n- ${this.userResolver.resolve(current).getDisplayName()}`;
        const joinedUsernames = `\nJoined:${this.joinedPlayers.reduce(reducer, '')}`;
        const waitlistedUsernames = includeWaitlist ? `\nWaitlist:${this.waitlistedPlayers.reduce(reducer, '')}` : '';
        return `${this.buildAttendanceString()}${joinedUsernames}${waitlistedUsernames}`;
    }
}