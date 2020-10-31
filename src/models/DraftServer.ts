import ENV from '../env/EnvBase';
import {DataResolver} from "./types/ResolverTypes";
import Session from "./Session";
import DraftUser from "./DraftUser";
import { Message } from "discord.js";
import { SessionInjectedParameters, SessionParametersWithSugar } from '../database/SessionDBSchema';
import { SessionId } from './types/BaseTypes';

export default class DraftServer {

    private readonly env: ENV;
    readonly dataResolver: DataResolver;
    
    constructor (env: ENV, dataResolver: DataResolver) {
        this.env = env;
        this.dataResolver = dataResolver;
    }

    ////////////////////////////////
    // SESSION MANAGEMENT METHODS //
    ////////////////////////////////

    async createSession(draftUser: DraftUser, parameters?: Partial<SessionParametersWithSugar>): Promise<void> {
        if (!this.dataResolver.discordResolver.announcementChannel) {
            throw new Error("Cannot create a session - announcement channel was not set up.  Bot might require a restart");
        }
        // Close out any prior Sessions
        if (draftUser.getCreatedSessionId()) {
            await this.closeSession(draftUser);
        }

        // Send a temporary message to get the id and build a Session with it
        const message = await this.dataResolver.discordResolver.announcementChannel.send("Setting up session...");
        const sessionId: SessionId = message.id;

        const injectedParameters: SessionInjectedParameters = {
            ownerId: draftUser.getUserId()
        }
        this.dataResolver.dbDriver.createSession(sessionId, this.env, {...(parameters||{}), ...injectedParameters});
        const session = this.dataResolver.resolveSession(sessionId);
        
        // Add the creator to their Session
        draftUser.setCreatedSessionId(sessionId);
        await session.addPlayer(draftUser);

        // Update and react to indicate we're ready to go
        await message.react(this.env.EMOJI);
    }

    get serverId(): string {
        return this.dataResolver.discordResolver.guild.id;
    }

    async startSession(draftUser: DraftUser): Promise<void> {
        await this.terminateSession(draftUser, true);
    }

    async closeSession(draftUser: DraftUser): Promise<void> {
        await this.terminateSession(draftUser);
    }

    private async terminateSession(draftUser: DraftUser, started = false) {
        if (!draftUser.getCreatedSessionId()) {
            throw new Error("You don't have any session to terminate");
        }

        const session = this.getSessionFromDraftUser(draftUser);

        if (session) {
            await session.terminate(started);
            if (session.sessionId) {
                this.dataResolver.dbDriver.deleteSessionFromDatabase(session.sessionId);
            }
        }
        
        draftUser.setCreatedSessionId(undefined);
    }

    ////////////////////////
    // PUBLIC GET METHODS //
    ////////////////////////

    getSessionFromMessage(message: Message): Session | undefined {
        // We want to verify that we can ONLY resolve messages from the announcement channel.
        
        // To do this, we first compare the message's channel's id to the id of the saved
        // announcement channel.  However, to do so we need to have already hooked up to
        // the announcement channel so this is still flaky.

        if (!this.dataResolver.discordResolver.announcementChannel) {
            throw new Error("Bot was not properly set up with an announcement channel - probably requires a restart");
        }
        if (message.channel.id !== this.dataResolver.discordResolver.announcementChannel.id) {
            return;
        }

        return this.dataResolver.resolveSession(message.id);
    }

    getSessionFromDraftUser(draftUser: DraftUser): Session | undefined {
        const sessionId = draftUser.getCreatedSessionId();
        if (!sessionId) {
            return;
        }
        return this.dataResolver.resolveSession(sessionId);
    }
}