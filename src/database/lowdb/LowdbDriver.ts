import * as low from 'lowdb';
import * as FileSync from 'lowdb/adapters/FileSync';
import { LowdbUserView } from './LowdbUserView';
import { LowdbSessionView } from './LowdbSessionView';
import { DBDriver, DBDriverBase } from '../DBDriver';
import { IUserView, UserDBSchema } from '../UserDBSchema';
import { ISessionView, SessionDBSchema, SessionConstructorParameter } from '../SessionDBSchema';
import { ENV } from '../../env/env';
import { DraftUserId, ServerId, SessionId } from '../../models/types/BaseTypes';

type DBSchema = {
    Sessions: Array<SessionDBSchema>;
    Users: Array<UserDBSchema>;
};
type LowDB = low.LowdbSync<DBSchema>;

export class LowdbDriver extends DBDriverBase implements DBDriver {
    
    db: LowDB;

    constructor() {
        super();

        const adapter = new FileSync('data/lowdb_database.json');
        this.db = low(adapter);

        // Initialize the database with defaults
        this.db.defaults({
            Sessions: [],
            Users: []
        }).write();
    }

    getOrCreateUserView(serverId: ServerId, userId: DraftUserId): IUserView {
        const users = this.db.get("Users");
        const cursor = users.find({userId: userId, serverId: serverId});
        if (!cursor.value()) {
            users.push(this.buildUserFromScratch(serverId, userId)).write();
        }
    
        return new LowdbUserView(cursor);
    }

    deleteUserFromDatabase(serverId: ServerId, userId: DraftUserId): void {
        this.db.get("Users").remove({userId: userId, serverId: serverId}).write();
    }

    createSession(serverId: ServerId, sessionId: SessionId, env: ENV, params?: SessionConstructorParameter): ISessionView {
        const sessions = this.db.get("Sessions");
        const cursor = sessions.find({sessionId: sessionId});
        if (cursor.value()) {
            throw new Error("Session with provided id already exists!");
        }
    
        sessions.push(this.buildSessionFromTemplate(serverId, sessionId, env, params)).write();
    
        return new LowdbSessionView(cursor);
    }

    getSessionView(serverId: ServerId, sessionId: SessionId): ISessionView {
        const sessions = this.db.get("Sessions");
        const cursor = sessions.find({sessionId: sessionId, serverId: serverId});
    
        if (!cursor.value()) {
            throw new Error("Could not find session with provided id");
        }
    
        return new LowdbSessionView(cursor);
    }

    deleteSessionFromDatabase(serverId: ServerId, sessionId: SessionId): void {
        this.db.get("Sessions").remove({sessionId: sessionId, serverId: serverId}).write();
    }
}