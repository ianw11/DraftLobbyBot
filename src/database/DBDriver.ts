import { ENV } from '../env/env';
import { DraftUserId, ServerId, SessionId } from '../models/types/BaseTypes';
import { buildSessionParams, ISessionView, SessionConstructorParameter, SessionDBSchema } from './SessionDBSchema';
import { IUserView, UserDBSchema } from './UserDBSchema';

export interface DBDriver {
    getOrCreateUserView(serverId: ServerId, userId: DraftUserId): IUserView;
    getAllUsersFromServer(serverId: ServerId): IUserView[];
    deleteUserFromDatabase(serverId: ServerId, userId: DraftUserId): void;

    createSession(serverId: ServerId, sessionId: SessionId, env: ENV, params?: SessionConstructorParameter): ISessionView;
    getSessionView(serverId: ServerId, sessionId: SessionId): ISessionView;
    deleteSessionFromDatabase(serverId: ServerId, sessionId: SessionId): void;
    getAllSessions(): ISessionView[];
}

export abstract class DBDriverBase implements DBDriver {
    ////////////////////
    // DBDriver stubs //
    ////////////////////
    
    abstract getOrCreateUserView(serverId: ServerId, userId: DraftUserId): IUserView;
    abstract getAllUsersFromServer(serverId: ServerId): IUserView[];
    abstract deleteUserFromDatabase(serverId: ServerId, userId: DraftUserId): void;

    abstract createSession(serverId: ServerId, sessionId: SessionId, env: ENV, params?: SessionConstructorParameter): ISessionView;
    abstract getSessionView(serverId: ServerId, sessionId: SessionId): ISessionView;
    abstract deleteSessionFromDatabase(serverId: ServerId, sessionId: SessionId): void;
    abstract getAllSessions(): ISessionView[];

    ////////////////////
    // Shared Methods //
    ////////////////////

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
