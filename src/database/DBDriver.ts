import { ENV } from '../env/env';
import { DraftUserId, ServerId, SessionId } from '../models/types/BaseTypes';
import { buildSessionParams, ISessionView, SessionConstructorParameter, SessionDBSchema } from './SessionDBSchema';
import { IUserView, UserDBSchema } from './UserDBSchema';

export interface DBDriver {
    getOrCreateUserView(serverId: ServerId, userId: DraftUserId): IUserView;
    deleteUserFromDatabase(serverId: ServerId, userId: DraftUserId): void;
    createSession(serverId: ServerId, sessionId: SessionId, env: ENV, params?: SessionConstructorParameter): ISessionView;
    getSessionView(serverId: ServerId,sessionId: SessionId): ISessionView;
    deleteSessionFromDatabase(serverId: ServerId, sessionId: SessionId): void;
}



export abstract class DBDriverBase {
    buildUserFromScratch(serverId: ServerId, userId: DraftUserId): UserDBSchema {
        return {serverId: serverId, userId: userId, joinedSessionIds: [], waitlistedSessionIds: []};
    }

    buildSessionFromTemplate(serverId: ServerId, sessionId: SessionId, env: ENV, params?: SessionConstructorParameter): SessionDBSchema {
        let ownerId = undefined;
        if (params) {
            ownerId = params.ownerId;
        }

        return {
            serverId: serverId,
            sessionId: sessionId,
            ownerId: ownerId,
            joinedPlayerIds: [],
            waitlistedPlayerIds: [],
            sessionClosed: false,
            sessionParameters: buildSessionParams(env, params)
        };
    }
}
