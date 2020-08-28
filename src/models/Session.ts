import {SessionParameters, SessionId, SessionConstructorParameter} from './types/SessionTypes';
import ENV, {buildSessionParameters} from '../core/EnvBase';
import { Message, MessageEmbed, EmbedFieldData } from "discord.js";
import DraftUser from "./DraftUser";
import { removeFromArray, replaceFromDict, asyncForEach } from "../Utils";
import { UserResolver, DraftUserId } from "./types/DraftServerTypes";

// eslint-disable-next-line @typescript-eslint/no-var-requires
const hri = require("human-readable-ids").hri; // JS Library

export {
    SessionId,
    SessionParameters,
    SessionConstructorParameter
};

export default class Session {
    // Maintained only so the owner can't leave the draft instead of deleting it
    private readonly ownerId?: DraftUserId;

    private readonly message: Message;
    readonly sessionId: SessionId;
    private readonly env: ENV;

    private readonly userResolver: UserResolver;

    private readonly joinedPlayers: DraftUserId[] = [];
    private readonly waitlistedPlayers: DraftUserId[] = [];

    private readonly params: SessionParameters;
    private sessionClosed = false;

    constructor (message: Message, userResolver: UserResolver, env: ENV, params?: SessionConstructorParameter) {
        this.message = message;
        this.sessionId = message.id;
        this.env = env;

        this.userResolver = userResolver;

        if (params) {
            this.ownerId = params.ownerId;
        }

        const defaultName = this.ownerId ? `${this.userResolver.resolve(this.ownerId).getDisplayName()}'s Draft` : this.env.DEFAULT_SESSION_NAME;

        this.params = {
            ...buildSessionParameters(this.env),
            ...{
                name: defaultName
            },
            ...(params || {})
        };
    }

    /////////////////////////
    // GETTERS AND SETTERS //
    /////////////////////////

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

    setUrl(url?: string): void {
        if (url) {
            url = replaceFromDict(url, '%', {HRI: hri.random()});
        }
        this.params.url = url;
    }
    getUrl(): string {
        if (!this.params.url) {
            this.params.url = replaceFromDict(this.env.FALLBACK_SESSION_URL, '%', {HRI: hri.random()});
        }
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
        await this.upgradePlayer();
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


    ///////////////////////////////////
    // USER AND LIFECYCLE MANAGEMENT //
    ///////////////////////////////////

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
        const callback = async (draftUserId: DraftUserId) => await this.userResolver.resolve(draftUserId).sessionClosed(this, started);
        await asyncForEach(this.joinedPlayers, callback);
        await asyncForEach(this.waitlistedPlayers, callback);

        // Clean up the announcement channel a bit
        await this.message.delete();
    }

    private async updateMessage() {
        await this.message.edit('', this.getEmbed());
    }

    /////////////////////////
    // CONVENIENCE METHODS //
    /////////////////////////

    async broadcast(message: string, includeWaitlist = false): Promise<void> {
        let intro = `EVENT ${this.params.name}`;
        if (this.ownerId) {
            const owner = this.userResolver.resolve(this.ownerId);
            intro = `${owner.getDisplayName()} (${this.params.name})`
        }
        const callback = async (userId: DraftUserId) => {
            if (userId === this.ownerId) {
                return;
            }
            await this.userResolver.resolve(userId).sendDM(`\`[BROADCAST] ${intro}\`\n${message}`);
        };

        await asyncForEach(this.joinedPlayers, callback);
        if (includeWaitlist) {
            await asyncForEach(this.waitlistedPlayers, callback);
        }
    }

    toSimpleString(): string {
        const {name, date, description} = this.params;
        return `**${name}** ${date ? `- starts at ${date.toString()} ` : ''} || ${description}`;
    }

    getEmbed(provideOwnerInformation?: boolean): MessageEmbed {
        const {name, description, sessionCapacity, fireWhenFull, date} = this.params;
        const numJoined = this.getNumConfirmed();
        const numWaitlisted = this.getNumWaitlisted();


        const fields: EmbedFieldData[] = [
            {
                name: "When",
                value: date ? date.toString() : 'Ad-hoc event - Join now!'
            },
            {
                name: "Attendance",
                value: `Number joined: ${numJoined} <> Capacity: ${sessionCapacity} <> ${fireWhenFull ? "Draft will launch when capacity is reached" : `Waitlisted: ${numWaitlisted}`}`
            }
        ];

        if (provideOwnerInformation) {
            const reducer = (accumulator: string, current: DraftUserId) => `${accumulator}- ${this.userResolver.resolve(current).getDisplayName()}\n`;
            fields.push({
                name: "Currently Joined",
                value: this.joinedPlayers.reduce(reducer, '')
            });
            if (this.waitlistedPlayers.length > 0) {
                fields.push({
                    name: "Currently Waitlisted",
                    value: this.waitlistedPlayers.reduce(reducer, '')
                });
            }
        } else {
            fields.push({
                name: "How to join",
                value: `Simply react to this message using ${this.env.EMOJI} and I'll tell you if you're confirmed or just on the waitlist`
            });
        }

        return new MessageEmbed()
            .setColor(3447003)
            .setTitle(name)
            .setAuthor("Your friendly neighborhood Draft Bot")
            .setDescription(description)
            .addFields(fields);
    }
}
