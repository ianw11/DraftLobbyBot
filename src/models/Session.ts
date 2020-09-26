import {SessionParameters, SessionId, SessionConstructorParameter, TemplateSessionParameters} from './types/SessionTypes';
import {ENV, buildDefaultSessionParameters} from '../env/env';
import { Message, MessageEmbed, EmbedFieldData, TextChannel } from "discord.js";
import DraftUser from "./DraftUser";
import { removeFromArray, replaceFromDict, asyncForEach } from "../Utils";
import { UserResolver, DraftUserId } from "./types/DraftServerTypes";

// eslint-disable-next-line @typescript-eslint/no-var-requires
const hri = require("human-readable-ids").hri; // JS Library

export {
    SessionId,
    TemplateSessionParameters,
    SessionParameters,
    SessionConstructorParameter
};

export default class Session {
    // Maintained only so the owner can't leave the draft instead of deleting it
    private readonly ownerId?: DraftUserId;

    private message?: Message;
    private _sessionId?: SessionId;
    private readonly env: ENV;

    private readonly userResolver: UserResolver;

    private readonly joinedPlayers: DraftUserId[] = [];
    private readonly waitlistedPlayers: DraftUserId[] = [];

    private readonly params: SessionParameters;
    private sessionClosed = false;

    constructor (userResolver: UserResolver, env: ENV, params?: SessionConstructorParameter) {
        this.env = env;

        this.userResolver = userResolver;

        if (params) {
            this.ownerId = params.ownerId;
        }

        this.params = {
            ...buildDefaultSessionParameters(this.env),
            ...(params || {})
        };
    }

    async resetMessage(channel: TextChannel): Promise<[SessionId, Message]> {
        this.message = await channel.send(this.getEmbed());

        this._sessionId = this.message.id;

        return [this._sessionId, this.message];
    }

    /////////////////////////
    // GETTERS AND SETTERS //
    /////////////////////////

    get sessionId(): SessionId {
        if (!this._sessionId) {
            throw new Error("Session requires Message reset");
        }
        return this._sessionId;
    }
    set sessionId(sessionId: SessionId) {
        throw new Error("Session Id can only be set via resetMessage()");
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
        this.params._generatedName = undefined;
        await this.updateMessage();
    }
    getName(): string {
        if (!this.params._generatedName) {
            if (this.ownerId && this.params.name) {
                const name = this.userResolver.resolve(this.ownerId).getDisplayName();
                this.params._generatedName = replaceFromDict(this.params.name, "%", {
                    USER: name,
                    NAME: name
                });
            } else {
                this.params._generatedName = this.params.unownedSessionName;
            }
        }
        return this.params._generatedName;
    }

    setTemplateUrl(templateUrl?: string): void {
        this.params.templateUrl = templateUrl || "<NO URL>";
    }

    private getUrl(regenerate = false): string {
        if (regenerate || !this.params._generatedUrl) {
            this.params._generatedUrl = replaceFromDict(this.params.templateUrl, '%', {HRI: hri.random()});
        }
        return this.params._generatedUrl;
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

        // If the session started noramally, pod the users
        /*
        await asyncForEach(fillPodsFirst(this.joinedPlayers.length, 8, true), async (count) => {
            const url = this.getUrl(true);
            const pod = {
                url: url,
                confirmMessage: this.getConfirmedMessage({URL: url})
            };

            for (let i = 0; i < count; ++i) {
                const playerId = this.joinedPlayers.shift() as string;
                const user = this.userResolver.resolve(playerId);
                await user.sessionClosed(this, pod);
            }
        });
        */

        // Notify both joined and waitlisted that this Session is closed
        const callback = async (draftUserId: DraftUserId) => await this.userResolver.resolve(draftUserId).sessionClosed(this, started);
        await asyncForEach(this.joinedPlayers, callback);
        await asyncForEach(this.waitlistedPlayers, callback);

        // Clean up the announcement channel a bit
        if (this.message) {
            await this.message.delete();
        }
    }

    private async updateMessage() {
        if (this.message) {
            await this.message.edit('', this.getEmbed());
        }
    }

    ///////////////////////////////
    // Output Formatting Methods //
    ///////////////////////////////

    getConfirmedMessage(overrides?: Record<string, string>): string {
        return this.replaceMessage(this.params.sessionConfirmMessage, overrides);
    }

    getWaitlistMessage(): string {
        return this.replaceMessage(this.params.sessionWaitlistMessage);
    }

    getCancelledMessage(): string {
        return this.replaceMessage(this.params.sessionCancelMessage);
    }

    private replaceMessage(msg: string, overrides = {}): string {
        return replaceFromDict(msg, "%", {...{NAME: this.getName(), URL: this.getUrl()}, ...overrides});
    }

    /////////////////////////
    // CONVENIENCE METHODS //
    /////////////////////////

    async broadcast(message: string, includeWaitlist = false): Promise<void> {
        const sessionName = this.getName();
        let intro = `EVENT ${sessionName}`;
        if (this.ownerId) {
            const owner = this.userResolver.resolve(this.ownerId);
            intro = `${owner.getDisplayName()} (${sessionName})`
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
        const {date, description} = this.params;
        return `**${this.getName()}** ${date ? `- starts at ${date.toString()} ` : ''} || ${description}`;
    }

    getEmbed(provideOwnerInformation?: boolean): MessageEmbed {
        const {description, sessionCapacity, fireWhenFull, date} = this.params;
        const numJoined = this.getNumConfirmed();
        const numWaitlisted = this.getNumWaitlisted();


        const fields: EmbedFieldData[] = [
            {
                name: "When",
                value: date ? date.toString() : 'Ad-hoc event - Join now!'
            },
            {
                name: "Attendance",
                value: `Number joined: ${numJoined}\nCapacity: ${sessionCapacity}\n${fireWhenFull ? "Draft will launch when capacity is reached" : `Waitlisted: ${numWaitlisted}`}`
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
            .setTitle(this.getName())
            // .setAuthor("Your friendly neighborhood Draft Bot")
            .setDescription(description)
            .addFields(fields);
    }
}
