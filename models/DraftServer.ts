import Session, {SessionId} from "./Session";
import DraftUser from "./DraftUser";
import { User, Message, TextChannel } from "discord.js";

const EMOJI = '☑️';

export type DraftUserId = string;

export interface UserResolver {
    (draftUserId: DraftUserId): DraftUser | null;
}

export default class DraftServer {
    sessions: {[messageId: string]: Session} = {};
    users: {[userId: string]: DraftUser} = {};
    
    readonly announcementChannel: TextChannel;

    constructor (announcementChannel: TextChannel) {
        this.announcementChannel = announcementChannel;
    }

    async createSession(draftUser: DraftUser): Promise<Session> {
        if (draftUser.ownsSession) {
            this.closeSession(draftUser);
            //this.terminateSession(this.sessions[draftUser.ownsSession]);
        }

        const session = new Session(draftUser.getUserId());

        const message = await this.announcementChannel.send("Created session <3");

        session.setMessage(message);
        draftUser.ownsSession = session.sessionId;
        this.sessions[session.sessionId] = session;

        await message.react(EMOJI);

        session.addPlayer(draftUser);

        return session;
    }

    async startSession(draftUser: DraftUser) {
        await this.terminate(draftUser, true);
    }

    async closeSession(draftUser: DraftUser) {
        await this.terminate(draftUser);
    }

    private async terminate(draftUser: DraftUser, started: boolean = false) {
        if (!draftUser.ownsSession) {
            throw "You don't have any session to terminate";
        }

        const session = this.getSessionFromDraftUser(draftUser);

        await session.terminate((draftUserId) => this.getDraftUserById(draftUserId), this.announcementChannel, started);
        draftUser.ownsSession = null;
    }

    getSessionFromMessage(message: Message): Session | null {
        return this.getSession(message.id);
    }

    getSessionFromDraftUser(draftUser: DraftUser): Session | null {
        return this.getSession(draftUser.ownsSession);
    }

    getSession(sessionId: SessionId): Session | null | undefined {
        if (!sessionId) {
            return null;
        }
        return this.sessions[sessionId];
    }

    getDraftUser(user: User): DraftUser {
        let draftUser = this.getDraftUserById(user.id);
        if (!draftUser) {
            draftUser = new DraftUser(user);
            this.users[user.id] = draftUser;
        }
        return draftUser;
    }

    getDraftUserById(draftUserId: DraftUserId): DraftUser | null {
        return this.users[draftUserId];
    }
}