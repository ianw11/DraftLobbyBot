import { ENV } from "../../env/env";
import { DraftUserId, SessionId } from "../../models/types/BaseTypes";
import { DBDriver, DBDriverBase } from "../DBDriver";
import { ISessionView, SessionConstructorParameter } from "../SessionDBSchema";
import { IUserView } from "../UserDBSchema";
import { InMemorySessionView } from "./InMemorySessionView";
import { InMemoryUserView } from "./InMemoryUserView";

export class InMemoryDriver extends DBDriverBase implements DBDriver {
    private readonly userViews: Record<DraftUserId, IUserView | undefined> = {};
    private readonly sessionViews: Record<SessionId, ISessionView | undefined> = {};

    getUserView(userId: DraftUserId): IUserView {
        let view = this.userViews[userId];
        if (!view) {
            view = new InMemoryUserView(userId);
            this.userViews[userId] = view;
        }
        return view;
    }

    deleteUserFromDatabase(userId: DraftUserId): void {
        this.userViews[userId] = undefined;
    }

    createSession(sessionId: SessionId, env: ENV, params?: SessionConstructorParameter): ISessionView {
        const view = new InMemorySessionView(sessionId, this.buildSessionParams(env, params), params?.ownerId);
        this.sessionViews[sessionId] = view;
        return view;
    }

    getSessionView(sessionId: SessionId): ISessionView {
        const view = this.sessionViews[sessionId];
        if (!view) throw new Error("Session not created");
        return view;
    }

    deleteSessionFromDatabase(sessionId: SessionId): void {
        this.sessionViews[sessionId] = undefined;
    }
}