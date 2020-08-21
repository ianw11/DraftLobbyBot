import { Message, TextChannel } from "discord.js";
import DraftUser from "./DraftUser";
import { removeFromArray } from "../Utils";
import { UserResolver, DraftUserId } from "./DraftServer";

export type SessionId = string;

export default class Session {
    readonly ownerId: string;

    private readonly message: Message;
    readonly sessionId: SessionId;

    private readonly userResolver: UserResolver;

    private readonly joinedPlayers: DraftUserId[] = [];
    private readonly waitlistedPlayers: DraftUserId[] = [];

    // Session metadata
    name: string = "Unnamed Draft";
    maxNumPlayers: number = 8;
    description: string = "No Description Available";
    when: {
        date?: string;
        time?: string;
        asap: boolean;
    } = {
        date: null,
        time: null,
        asap: true
    };

    constructor (ownerId: string, message: Message, userResolver: UserResolver) {
        this.ownerId = ownerId;

        this.message = message;
        this.sessionId = message.id;

        this.userResolver = userResolver;
    }

    async updateMessage() {
        await this.message.edit(`${this.toString(true)}\n\nTap the reaction below to register and again to unregister`);
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
        return this.getNumConfirmed() < this.maxNumPlayers;
    }


    setName(name: string) {
        this.name = name;
    }
    setMaxNumPlayers(maxNumPlayers: number) {
        this.maxNumPlayers = maxNumPlayers;
    }
    setDescription(description: string) {
        this.description = description;
    }
    setDate(date: string) {
        this.when.date = date;
        this.when.asap = false;
    }
    setTime(time: string) {
        this.when.time = time;
        this.when.asap = false;
    }
    setAsap(asap: boolean) {
        this.when.asap = asap;
        if (asap) {
            this.when.date = null;
            this.when.time = null;
        }
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

        this.upgradePlayer();
    }

    async upgradePlayer() {
        while (this.canAddPlayers() && this.waitlistedPlayers.length > 0) {
            const upgradedPlayerId = this.waitlistedPlayers.shift();
            const upgradedPlayer = this.userResolver(upgradedPlayerId);

            this.joinedPlayers.push(upgradedPlayerId);
            upgradedPlayer.upgradedFromWaitlist(this);
        }
    }


    async terminate(started: boolean = false) {
        const callback = (draftUserId: DraftUserId) => {
            const draftUser = this.userResolver(draftUserId);
            draftUser.sessionClosed(this, started);
        };
        this.joinedPlayers.forEach(callback);
        this.waitlistedPlayers.forEach(callback);

        await this.message.delete();
    }

    toString(multiline = false): string {
        const date = this.when.date ? this.when.date : '';
        const time = this.when.time ? this.when.time : '';
        const when = this.when.asap ? 'Fires when full (asap)' : date + ' at ' + time;
        
        const linebreak = multiline ? '\n' : '';

        return `**${this.name}** ${linebreak} _${when}_ ${multiline ? linebreak : '-- ['}Max Players: ${this.maxNumPlayers} ${multiline ? linebreak : '|'} ${this.description}${multiline ? '' : ']'}`;
    }
}