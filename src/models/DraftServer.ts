import ENV from '../env/EnvBase';
import {Resolver} from "./types/ResolverTypes";
import Session from "./Session";
import DraftUser from "./DraftUser";
import { Message } from "discord.js";
import { SessionInjectedParameters, SessionParametersWithSugar } from '../database/SessionDBSchema';
import { ServerId, SessionId } from './types/BaseTypes';

export default class DraftServer {

    private readonly env: ENV;
    readonly resolver: Resolver;
    
    constructor (env: ENV, resolver: Resolver) {
        this.env = env;
        this.resolver = resolver;
    }

    ////////////////////////////////
    // SESSION MANAGEMENT METHODS //
    ////////////////////////////////

    async createSession(draftUser: DraftUser, parameters?: Partial<SessionParametersWithSugar>): Promise<void> {
        if (!this.resolver.discordResolver.announcementChannel) {
            throw new Error("Cannot create a session - announcement channel was not set up.  Bot might require a restart");
        }
        // Close out any prior Sessions
        if (draftUser.getCreatedSessionId()) {
            await this.closeSessionOwnedByUser(draftUser);
        }

        // Send a temporary message to get the id and build a Session with it
        const message = await this.resolver.discordResolver.announcementChannel.send("Setting up session...");
        const sessionId: SessionId = message.id;

        const injectedParameters: SessionInjectedParameters = {
            ownerId: draftUser.getUserId()
        }
        this.resolver.dbDriver.createSession(this.serverId, sessionId, this.env, {...(parameters||{}), ...injectedParameters});
        const session = this.resolver.resolveSession(sessionId);
        
        // Add the creator to their Session
        draftUser.setCreatedSessionId(sessionId);
        await session.addPlayer(draftUser);

        // Update and react to indicate we're ready to go
        await message.react(this.env.EMOJI);
    }

    get serverId(): ServerId {
        return this.resolver.discordResolver.guild.id;
    }

    async sessionOwnerLeftServer(sessionOwner: DraftUser): Promise<void> {
        await this.terminateSessionOwnedByUser(sessionOwner);
    }

    async startSessionOwnedByUser(sessionOwner: DraftUser): Promise<void> {
        await this.terminateSessionOwnedByUser(sessionOwner, true);
    }

    async closeSessionOwnedByUser(sessionOwner: DraftUser): Promise<void> {
        await this.terminateSessionOwnedByUser(sessionOwner);
    }

    async startSession(sessionId: SessionId): Promise<void> {
        await this.terminateSession(sessionId, true);
    }

    async closeSession(sessionId: SessionId): Promise<void> {
        await this.terminateSession(sessionId);
    }

    /*
      These two methods need to stay in sync. There are 2 ways to terminate Sessions and each
      step needs to be met:
      0. Ensure there is the proper authorization to terminate - if a user is provided ensure they are the owner
      1. Terminate session (this notifies all in queues)
      2. Remove the session from whatever database is attached
      3. If there is a session owner, unset their session
    */

    private async terminateSessionOwnedByUser(sessionOwner: DraftUser, started = false) {
        // 0
        if (!sessionOwner.getCreatedSessionId()) {
            throw new Error("You don't have any session to terminate");
        }

        const session = this.getSessionFromDraftUser(sessionOwner);

        if (session) {
            // 1
            await session.terminate(started);
            if (session.sessionId) {
                // 2
                this.resolver.dbDriver.deleteSessionFromDatabase(this.serverId, session.sessionId);
            }
        }
        
        // 3
        sessionOwner.setCreatedSessionId(undefined);
    }

    private async terminateSession(sessionId: SessionId, started = false): Promise<void> {
        const session = this.resolver.resolveSession(sessionId);
        // 1
        await session.terminate(started);
        
        // 3
        if (session.ownerId) {
            this.resolver.resolveUser(session.ownerId).setCreatedSessionId(undefined);
        }

        // We have to put the db deletion at the end because deleting from database implies we
        // no longer have access to the data. We need the ownerId before it's lost forever.
        // 2
        this.resolver.dbDriver.deleteSessionFromDatabase(this.serverId, session.sessionId);
    }

    ////////////////////////
    // PUBLIC GET METHODS //
    ////////////////////////

    getSessionFromMessage(message: Message): Session | undefined {
        // We want to verify that we can ONLY resolve messages from the announcement channel.
        
        // To do this, we first compare the message's channel's id to the id of the saved
        // announcement channel.  However, to do so we need to have already hooked up to
        // the announcement channel so this is still flaky.

        // TODO: DETERMINE IF THE ABOVE COMMENT STILL NEEDS TO APPLY

        /*
        const announcementChannel = this.resolver.discordResolver.announcementChannel;
        if (!announcementChannel) {
            throw new Error("Bot was not properly set up with an announcement channel - probably requires a restart");
        }
        if (message.channel.id !== announcementChannel.id) {
            return;
        }
        */

        return this.resolver.resolveSession(message.id);
    }

    getSessionFromDraftUser(draftUser: DraftUser): Session | undefined {
        const sessionId = draftUser.getCreatedSessionId();
        if (!sessionId) {
            return;
        }
        return this.resolver.resolveSession(sessionId);
    }
}