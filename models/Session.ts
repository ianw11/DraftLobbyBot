import { Message, TextChannel } from "discord.js";
import DraftUser from "./DraftUser";
import { removeFromArray } from "../Utils";
import { UserResolver, DraftUserId } from "./DraftServer";
import { hri } from "human-readable-ids";

export type SessionId = string;

export interface SessionParameters {
    name: string;
    maxNumPlayers: number;
    description: string;
    date?: Date; // The lack of this field indicates the Session intends to start immediately - aka probably an ad-hoc draft
    fireWhenFull: boolean; // Or should we wait for the Session owner to run the StartCommand
    url: string;
}

const DEFAULT_PARAMS: SessionParameters = {
    name: '',
    url: '',
    maxNumPlayers: 8,
    description: "Generic Draft Lobby",
    fireWhenFull: false
};

export default class Session {
    // Maintained only so the owner can't leave the draft instead of deleting it
    private readonly ownerId: DraftUserId;

    private readonly message: Message;
    readonly sessionId: SessionId;

    private readonly userResolver: UserResolver;

    private readonly joinedPlayers: DraftUserId[] = [];
    private readonly waitlistedPlayers: DraftUserId[] = [];

    readonly params: SessionParameters;

    constructor (ownerId: DraftUserId, message: Message, userResolver: UserResolver, params?: Partial<SessionParameters>) {
        this.ownerId = ownerId;
        this.message = message;
        this.sessionId = message.id;

        this.params = {
            ...DEFAULT_PARAMS,
            ...{
                name: `${userResolver(ownerId).getDisplayName()}'s Draft`,
                url: `https://mtgadraft.herokuapp.com/?session=${hri.random()}`
            },
            ...(params || {})
        };

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
        return this.getNumConfirmed() < this.params.maxNumPlayers;
    }


    setName(name: string) {
        this.params.name = name;
    }
    async setMaxNumPlayers(maxNumPlayers: number) {
        if (maxNumPlayers < this.getNumConfirmed()) {
            throw `There are ${this.getNumConfirmed()} people already confirmed - some of them will need to leave before I can lower to ${maxNumPlayers}`;
        }
        
        this.params.maxNumPlayers = maxNumPlayers;
        await this.fireIfAble();
    }
    setDescription(description: string) {
        this.params.description = description;
    }
    setDate(date: Date) {
        this.params.date = date;
    }
    setFireWhenFull(fire: boolean) {
        this.params.fireWhenFull = fire;
    }
    setUrl(url: string) {
        this.params.url = url;
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

    private async fireIfAble() {
        if (!this.params.fireWhenFull || this.canAddPlayers()) {
            return;
        }

        await this.terminate(true);
    }

    buildAttendanceString() {
        const numJoined = this.joinedPlayers.length;
        const numWaitlisted = this.waitlistedPlayers.length;
        return `Number joined: ${numJoined} Capacity: ${this.params.maxNumPlayers} Waitlisted: ${numWaitlisted}`;
    }

    toString(multiline = false, provideOwnerInformation = false): string {
        const linebreak = multiline ? '\n' : '  ';
        const {name, date, description} = this.params;

        const when = date ? `Scheduled for: ${date.toString()}` : 'Fires when full (asap)';
        
        return `**${name}**${linebreak}_${when}_${multiline ? linebreak : ' ['}${this.buildAttendanceString()}${multiline ? linebreak : '] -- '}${description}`;
    }

    toOwnerString(includeWaitlist = false) {
        const reducer = (accumulator: DraftUserId, current: string) => `${accumulator}\n- ${this.userResolver(current).getDisplayName()}`;
        const joinedUsernames = `\nJoined:${this.joinedPlayers.reduce(reducer, '')}`;
        const waitlistedUsernames = includeWaitlist ? `\nWaitlist:${this.waitlistedPlayers.reduce(reducer, '')}` : '';
        return `${this.buildAttendanceString()}${joinedUsernames}${waitlistedUsernames}`;
    }
}