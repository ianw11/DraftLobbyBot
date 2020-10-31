import { buildDefaultSessionParameters, ENV } from '../env/env';
import { DraftUserId, SessionId } from '../models/types/BaseTypes';
import { ISessionView, SessionConstructorParameter, SessionDBSchema, SessionParametersWithSugar } from './SessionDBSchema';
import { IUserView, UserDBSchema } from './UserDBSchema';

export interface DBDriver {
    getUserView(userId: DraftUserId): IUserView;
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
        console.log(`owner id: ${ownerId}`);
    
        const sessionParams: SessionParametersWithSugar = {
            ...buildDefaultSessionParameters(env),
            ...(params || {})
        };

        return {sessionId: sessionId, ownerId: ownerId, joinedPlayerIds: [], waitlistedPlayerIds: [], sessionClosed: false, sessionParameters: sessionParams};
    }
}
