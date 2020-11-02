import { ENV } from '../env/env';
import { DraftUserId, SessionId } from '../models/types/BaseTypes';
import { buildSessionParams, ISessionView, SessionConstructorParameter, SessionDBSchema } from './SessionDBSchema';
import { IUserView, UserDBSchema } from './UserDBSchema';

export interface DBDriver {
    getOrCreateUserView(userId: DraftUserId): IUserView;
    deleteUserFromDatabase(userId: DraftUserId): void;
    createSession(sessionId: SessionId, env: ENV, params?: SessionConstructorParameter): ISessionView;
    getSessionView(sessionId: SessionId): ISessionView;
    deleteSessionFromDatabase(sessionId: SessionId): void;
}



export abstract class DBDriverBase {
    buildUserFromScratch(userId: DraftUserId): UserDBSchema {
        return {userId: userId, joinedSessionIds: [], waitlistedSessionIds: []};
    }

    buildSessionFromTemplate(sessionId: SessionId, env: ENV, params?: SessionConstructorParameter): SessionDBSchema {
        let ownerId = undefined;
        if (params) {
            ownerId = params.ownerId;
        }

        return {
            sessionId: sessionId,
            ownerId: ownerId,
            joinedPlayerIds: [],
            waitlistedPlayerIds: [],
            sessionClosed: false,
            sessionParameters: buildSessionParams(env, params)
        };
    }
}
