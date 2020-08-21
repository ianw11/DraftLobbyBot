import { Message, TextChannel } from "discord.js";
import DraftUser from "./DraftUser";
import { removeFromArray } from "../Utils";
import { UserResolver, DraftUserId } from "./DraftServer";


export type SessionId = string;

export default class Session {
    readonly ownerId: string;

    private message: Message;
    sessionId: SessionId;

    private joinedPlayers: DraftUserId[] = [];
    private waitlistedPlayers: DraftUserId[] = [];

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

    constructor (ownerId: string) {
        this.ownerId = ownerId;
    }

    getNumConfirmed() {
        return this.joinedPlayers.length;
    }
    getNumWaitlisted() {
        return this.waitlistedPlayers.length;
    }

    canAddPlayers() : boolean {
        return this.getNumConfirmed() < this.maxNumPlayers;
    }

    setMessage(message: Message) {
        this.message = message;
        this.sessionId = message.id;
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

    toString(): string {
        return `**${this.name}** _${this.when.asap ? 'Fires when full (asap)' : this.when.date + ' at ' + this.when.time}_ -- [Max Players: ${this.maxNumPlayers} || ${this.description}]`;
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

    async removePlayer(draftUser: DraftUser, resolver: UserResolver) {
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

        this.upgradePlayer(resolver);
    }

    async upgradePlayer(resolver: UserResolver) {
        while (this.canAddPlayers() && this.waitlistedPlayers.length > 0) {
            const upgradedPlayerId = this.waitlistedPlayers.shift();
            const upgradedPlayer = resolver(upgradedPlayerId);

            this.joinedPlayers.push(upgradedPlayerId);
            upgradedPlayer.upgradedFromWaitlist(this);
        }
    }

    async terminate(resolver: UserResolver, announcementChannel: TextChannel, started: boolean = false) {
        const users: DraftUser[] = [];
        const callback = (draftUserId) => {
            const draftUser = resolver(draftUserId);
            users.push(draftUser);
            draftUser.sessionClosed(this, started);
        };
        this.joinedPlayers.forEach(callback);
        this.waitlistedPlayers.forEach(callback);

        if (started) {
        } else {
            //await this.message.edit('DRAFT CANCELLED');
        }

        await this.message.delete()
    }
}