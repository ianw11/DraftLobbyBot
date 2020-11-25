import { MessageEmbed, EmbedFieldData } from "discord.js";
import DraftUser from "./DraftUser";
import { replaceFromDict, asyncForEach } from "../Utils";
import { Resolver } from "./types/ResolverTypes";
import { ISessionView } from '../database/SessionDBSchema';
import { DraftUserId, SessionId } from './types/BaseTypes';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const hri = require("human-readable-ids").hri; // JS Library

export default class Session {
    private readonly data: ISessionView;
    private readonly resolver: Resolver;

    constructor (data: ISessionView, resolver: Resolver) {
        this.data = data;
        this.resolver = resolver;
    }

    /////////////////////////
    // GETTERS AND SETTERS //
    /////////////////////////

    get ownerId(): DraftUserId|undefined {
        return this.data.ownerId;
    }

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
        await this.updateMessage();
    }

    async getNameAsync(): Promise<string> {
        if (this.data.ownerId && this.data.sessionParameters.name) {
            const name = await this.resolver.resolveUser(this.data.ownerId).getDisplayNameAsync();
            return replaceFromDict(this.data.sessionParameters.name, "%", {
                USER: name,
                NAME: name
            });
        } else {
            return this.data.sessionParameters.unownedSessionName;
        }
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
            const upgradedPlayer = this.resolver.resolveUser(upgradedPlayerId);
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

    async changeOwner(newOwner: DraftUser): Promise<void> {
        const displayName = newOwner.getDisplayName();
        
        if (newOwner.getCreatedSessionId()) {
            throw new Error(`Unable to transfer - ${displayName} already has a Session`);
        }
        const newDiscordUser = this.resolver.discordResolver.resolveUser(newOwner.getUserId());
        if (!newDiscordUser || newDiscordUser.bot) {
            throw new Error(`Unable to transfer - ${displayName} either cannot be resolved or is a bot`);
        }
        const newOwnerId = newOwner.getUserId();

        const joinedUsers = this.data.joinedPlayerIds;
        if (!joinedUsers.includes(newOwnerId)) {
            throw new Error(`Unable to change owner to somebody that hasn't joined the session - have ${displayName} join first then retry`);
        }

        // Output message first so it retains the old user's name (for the broadcast title)
        await this.broadcast(`Session ownership has transferred to ${displayName}`, true);

        // Clear the existing owner
        if (this.data.ownerId) {
            this.resolver.resolveUser(this.data.ownerId).setCreatedSessionId();
        }
        // Set the new owner
        this.data.ownerId = newOwnerId;
        newOwner.setCreatedSessionId(this.data.sessionId);
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
        const callback = async (draftUserId: DraftUserId) => await this.resolver.resolveUser(draftUserId).sessionClosed(this, started);
        try {
            await asyncForEach(this.data.joinedPlayerIds, callback);
            await asyncForEach(this.data.waitlistedPlayerIds, callback);
        } finally {
            const message = await this.resolver.discordResolver.resolveMessageInAnnouncementChannel(this.sessionId);
            // Clean up the announcement channel a bit
            if (message) {
                await message.delete();
            } else {
                this.resolver.env.log("Unable to delete message - not found in channel");
            }
        }
    }

    private async updateMessage() {
        const message = await this.resolver.discordResolver.resolveMessageInAnnouncementChannel(this.sessionId);
        if (message) {
            await message.edit('', await this.getEmbed());
        }
    }

    ///////////////////////////////
    // Output Formatting Methods //
    ///////////////////////////////

    async getConfirmedMessage(overrides?: Record<string, string>): Promise<string> {
        return await this.replaceMessage(this.data.sessionParameters.sessionConfirmMessage, overrides);
    }

    async getWaitlistMessage(): Promise<string> {
        return await this.replaceMessage(this.data.sessionParameters.sessionWaitlistMessage);
    }

    async getCancelledMessage(): Promise<string> {
        return await this.replaceMessage(this.data.sessionParameters.sessionCancelMessage);
    }

    private async replaceMessage(msg: string, overrides = {}): Promise<string> {
        return replaceFromDict(msg, "%", {...{NAME: await this.getNameAsync(), URL: this.getUrl()}, ...overrides});
    }

    /////////////////////////
    // CONVENIENCE METHODS //
    /////////////////////////

    async broadcast(message: string, includeWaitlist = false): Promise<void> {
        const sessionName = await this.getNameAsync();
        let intro = `EVENT ${sessionName}`;
        if (this.data.ownerId) {
            const owner = this.resolver.resolveUser(this.data.ownerId);
            intro = `${owner.getDisplayName()} (${sessionName})`
        }
        const callback = async (userId: DraftUserId) => {
            if (userId === this.data.ownerId) {
                return;
            }
            await this.resolver.resolveUser(userId).sendDM(`\`[BROADCAST] ${intro}\`\n${message}`);
        };

        await asyncForEach(this.data.joinedPlayerIds, callback);
        if (includeWaitlist) {
            await asyncForEach(this.data.waitlistedPlayerIds, callback);
        }
    }

    async toSimpleString(): Promise<string> {
        const {description} = this.data.sessionParameters;
        const date = this.data.sessionParameters.date;
        return `**${await this.getNameAsync()}** ${date ? `- starts at ${date.toString()} ` : ''} || ${description}`;
    }

    async getEmbed(provideOwnerInformation?: boolean): Promise<MessageEmbed> {
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
            const reducer = (accumulator: string, current: DraftUserId) => `${accumulator}- ${this.resolver.resolveUser(current).getDisplayName()}\n`;
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
                value: `Simply react to this message using ${this.resolver.env.EMOJI} and I'll tell you if you're confirmed or just on the waitlist\nIf I don't respond when you react, send a message then try reacting again.`
            });
        }

        return new MessageEmbed()
            .setColor(3447003)
            .setTitle(await this.getNameAsync())
            // .setAuthor("Your friendly neighborhood Draft Bot")
            .setDescription(description)
            .addFields(fields);
    }
}
