import { ENV } from "../../env/env";
import { DraftUserId, ServerId, SessionId } from "../../models/types/BaseTypes";
import { DBDriver, DBDriverBase } from "../DBDriver";
import { buildSessionParams, ISessionView, SessionConstructorParameter } from "../SessionDBSchema";
import { IUserView } from "../UserDBSchema";
import { InMemorySessionView } from "./InMemorySessionView";
import { InMemoryUserView } from "./InMemoryUserView";

export class InMemoryDriver extends DBDriverBase implements DBDriver {
    private readonly serverUsers: Record<ServerId, Record<DraftUserId, IUserView | undefined>> = {};
    private readonly serverSessions: Record<ServerId, Record<SessionId, ISessionView | undefined>> = {};

    getOrCreateUserView(serverId: ServerId, userId: DraftUserId): IUserView {
        let server = this.serverUsers[serverId];
        if (!server) {
            this.serverUsers[serverId] = server = {};
        }

        let view = server[userId];
        if (!view) {
            view = new InMemoryUserView(serverId, userId);
            server[userId] = view;
        }
        return view;
    }

    deleteUserFromDatabase(serverId: ServerId, userId: DraftUserId): void {
        const server = this.serverUsers[serverId];
        if (server) {
            server[userId] = undefined;
        }
    }

    createSession(serverId: ServerId, sessionId: SessionId, env: ENV, params?: SessionConstructorParameter): ISessionView {
        const view = new InMemorySessionView(serverId, sessionId, buildSessionParams(env, params), params?.ownerId);

        let server = this.serverSessions[serverId];
        if (!server) {
            this.serverSessions[serverId] = server = {};
        }
        server[sessionId] = view;

        return view;
    }

    getSessionView(serverId: ServerId, sessionId: SessionId): ISessionView {
        let server = this.serverSessions[serverId];
        if (!server) {
            this.serverSessions[serverId] = server = {};
        }

        const view = server[sessionId];
        if (!view) throw new Error("Session not created");
        return view;
    }

    deleteSessionFromDatabase(serverId: ServerId, sessionId: SessionId): void {
        const server = this.serverSessions[serverId];
        if (server) {
            server[sessionId] = undefined;
        }
    }
}