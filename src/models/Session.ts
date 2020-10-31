import {ENV} from '../env/env';
import { MessageEmbed, EmbedFieldData } from "discord.js";
import DraftUser from "./DraftUser";
import { replaceFromDict, asyncForEach } from "../Utils";
import { DataResolver } from "./types/ResolverTypes";
import { ISessionView } from '../database/SessionDBSchema';
import { DraftUserId, SessionId } from './types/BaseTypes';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const hri = require("human-readable-ids").hri; // JS Library

export default class Session {
    private readonly env: ENV;
    private readonly dataResolver: DataResolver;
    private readonly data: ISessionView;

    constructor (dataResolver: DataResolver, env: ENV, data: ISessionView) {
        this.env = env;
        this.dataResolver = dataResolver;
        this.data = data;
    }

    /////////////////////////
    // GETTERS AND SETTERS //
    /////////////////////////

    get sessionId(): SessionId {
        if (!this.data.sessionId) {
            throw new Error("Session doesn't have session id");
        }
        return this.data.sessionId;
    }
    set sessionId(sessionId: SessionId) {
        throw new Error("Session Id can only be set via resetMessage()");
    }

    // These two methods would be good candidates as getter methods
    // but the Substitute mocking testing framework doesn't allow
    // for getter methods to be easily mocked.

    getNumConfirmed(): number {
        return this.data.joinedPlayerIds.length;
    }
    getNumWaitlisted(): number {
        return this.data.waitlistedPlayerIds.length;
    }
    
    getWaitlistIndexOf(draftUserId: DraftUserId): number {
        return this.data.waitlistedPlayerIds.indexOf(draftUserId);
    }

    async setName(name: string): Promise<void> {
        this.data.sessionParameters.name = name;
        this.data.sessionParameters._generatedName = undefined;
        await this.updateMessage();
    }
    getName(): string {
        if (!this.data.sessionParameters._generatedName) {
            if (this.data.ownerId && this.data.sessionParameters.name) {
                const name = this.dataResolver.resolveUser(this.data.ownerId).getDisplayName();
                this.data.sessionParameters._generatedName = replaceFromDict(this.data.sessionParameters.name, "%", {
                    USER: name,
                    NAME: name
                });
            } else {
                this.data.sessionParameters._generatedName = this.data.sessionParameters.unownedSessionName;
            }
        }
        return this.data.sessionParameters._generatedName;
    }

    setTemplateUrl(templateUrl?: string): void {
        this.data.sessionParameters.templateUrl = templateUrl || "<NO URL>";
    }

    private getUrl(regenerate = false): string {
        if (regenerate || !this.data.sessionParameters._generatedUrl) {
            this.data.sessionParameters._generatedUrl = replaceFromDict(this.data.sessionParameters.templateUrl, '%', {HRI: hri.random()});
        }
        return this.data.sessionParameters._generatedUrl;
    }

    async setSessionCapacity(sessionCapacity: number): Promise<void> {
        if (sessionCapacity < 1)  {
            throw new Error("Minimum allowed number of players is 1");
        }
        if (sessionCapacity < this.getNumConfirmed()) {
            throw new Error(`There are ${this.getNumConfirmed()} people already confirmed - some of them will need to leave before I can lower to ${sessionCapacity}`);
        }

        this.data.sessionParameters.sessionCapacity = sessionCapacity;
        await this.upgradePlayer();
        await this.fireIfAble();
    }
    getSessionCapacity(): number {
        return this.data.sessionParameters.sessionCapacity;
    }

    async setDescription(description: string): Promise<void> {
        this.data.sessionParameters.description = description;
        await this.updateMessage();
    }
    getDescription(): string {
        return this.data.sessionParameters.description;
    }

    async setDate(date?: Date): Promise<void> {
        this.data.sessionParameters.date = date;
        await this.updateMessage();
    }
    getDate(): Date | undefined {
        return this.data.sessionParameters.date;
    }

    async setFireWhenFull(fire: boolean): Promise<void> {
        this.data.sessionParameters.fireWhenFull = fire;
        await this.updateMessage();
    }
    getFireWhenFull(): boolean {
        return this.data.sessionParameters.fireWhenFull;
    }


    ///////////////////////////////////
    // USER AND LIFECYCLE MANAGEMENT //
    ///////////////////////////////////

    canAddPlayers() : boolean {
        return !this.data.sessionClosed && this.getNumConfirmed() < this.data.sessionParameters.sessionCapacity;
    }

    async addPlayer(draftUser: DraftUser): Promise<void> {
        if (this.data.sessionClosed) {
            throw new Error("Can't join session - already closed");
        }

        const userId = draftUser.getUserId();

        if (this.data.joinedPlayerIds.indexOf(userId) !== -1 || this.data.waitlistedPlayerIds.indexOf(userId) !== -1) {
            throw new Error("User already joined");
        }

        if (this.canAddPlayers()) {
            this.data.addToConfirmed(userId);
            draftUser.addedToSession(this);
        } else {
            this.data.addToWaitlist(userId);
            draftUser.addedToWaitlist(this);
        }

        await this.updateMessage();
        await this.fireIfAble();
    }

    async removePlayer(draftUser: DraftUser): Promise<void> {
        const userId = draftUser.getUserId();

        if (userId === this.data.ownerId) {
            throw new Error("Owner trying to leave - use `$delete` to delete session");
        }

        const joinedIndex = this.data.joinedPlayerIds.indexOf(userId);
        if (joinedIndex !== -1) {
            this.data.removeFromConfirmed(userId);
            draftUser.removedFromSession(this);
        } else {
            const waitlistIndex = this.data.waitlistedPlayerIds.indexOf(userId);
            if (waitlistIndex !== -1) {
                this.data.removeFromWaitlist(userId);
                draftUser.removedFromWaitlist(this);
            }
        }

        await this.updateMessage();
        await this.upgradePlayer();
    }

    private async upgradePlayer() {
        let upgradedPlayerId;

        const waitlist = this.data.waitlistedPlayerIds;
        const confirmed = this.data.joinedPlayerIds;
        while (this.canAddPlayers() && (upgradedPlayerId = waitlist.shift())) {
            const upgradedPlayer = this.dataResolver.resolveUser(upgradedPlayerId);
            confirmed.push(upgradedPlayerId);
            await upgradedPlayer.upgradedFromWaitlist(this);
        }
        this.data.waitlistedPlayerIds = waitlist;
        this.data.joinedPlayerIds = confirmed;
        await this.updateMessage();
    }


    private async fireIfAble() {
        if (!this.data.sessionParameters.fireWhenFull || this.canAddPlayers()) {
            return;
        }

        await this.terminate(true);
    }
    
    async terminate(started = false): Promise<void> {
        this.data.sessionClosed = true;

        // If the session started normally, pod the users
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
        const callback = async (draftUserId: DraftUserId) => await this.dataResolver.resolveUser(draftUserId).sessionClosed(this, started);
        await asyncForEach(this.data.joinedPlayerIds, callback);
        await asyncForEach(this.data.waitlistedPlayerIds, callback);

        const message = this.dataResolver.discordResolver.resolveMessageInAnnouncementChannel(this.sessionId);
        // Clean up the announcement channel a bit
        if (message) {
            await message.delete();
        }
    }

    private async updateMessage() {
        const message = this.dataResolver.discordResolver.resolveMessageInAnnouncementChannel(this.sessionId);
        if (message) {
            await message.edit('', this.getEmbed());
        }
    }

    ///////////////////////////////
    // Output Formatting Methods //
    ///////////////////////////////

    getConfirmedMessage(overrides?: Record<string, string>): string {
        return this.replaceMessage(this.data.sessionParameters.sessionConfirmMessage, overrides);
    }

    getWaitlistMessage(): string {
        return this.replaceMessage(this.data.sessionParameters.sessionWaitlistMessage);
    }

    getCancelledMessage(): string {
        return this.replaceMessage(this.data.sessionParameters.sessionCancelMessage);
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
        if (this.data.ownerId) {
            const owner = this.dataResolver.resolveUser(this.data.ownerId);
            intro = `${owner.getDisplayName()} (${sessionName})`
        }
        const callback = async (userId: DraftUserId) => {
            if (userId === this.data.ownerId) {
                return;
            }
            await this.dataResolver.resolveUser(userId).sendDM(`\`[BROADCAST] ${intro}\`\n${message}`);
        };

        await asyncForEach(this.data.joinedPlayerIds, callback);
        if (includeWaitlist) {
            await asyncForEach(this.data.waitlistedPlayerIds, callback);
        }
    }

    toSimpleString(): string {
        const {description} = this.data.sessionParameters;
        const date = this.data.sessionParameters.date;
        return `**${this.getName()}** ${date ? `- starts at ${date.toString()} ` : ''} || ${description}`;
    }

    getEmbed(provideOwnerInformation?: boolean): MessageEmbed {
        const {description, sessionCapacity, fireWhenFull} = this.data.sessionParameters;
        const date = this.data.sessionParameters.date;
        const numJoined = this.getNumConfirmed();
        const numWaitlisted = this.getNumWaitlisted();


        const fields: EmbedFieldData[] = [
            {
                name: "When",
                value: date ? date.toString() : 'Ad-hoc event - Join now!'
            },
            {
                name: "Attendance",
                value: `Number joined: ${numJoined}\nCapacity: ${sessionCapacity}\n${fireWhenFull ? "Session will launch when capacity is reached" : `Waitlisted: ${numWaitlisted}`}`
            }
        ];

        if (provideOwnerInformation) {
            const reducer = (accumulator: string, current: DraftUserId) => `${accumulator}- ${this.dataResolver.resolveUser(current).getDisplayName()}\n`;
            fields.push({
                name: "Currently Joined",
                value: this.data.joinedPlayerIds.reduce(reducer, '')
            });
            const waitlist = this.data.waitlistedPlayerIds;
            if (waitlist.length > 0) {
                fields.push({
                    name: "Currently Waitlisted",
                    value: waitlist.reduce(reducer, '')
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
