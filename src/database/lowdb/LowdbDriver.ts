import * as low from 'lowdb';
import * as FileSync from 'lowdb/adapters/FileSync';
import { LowdbUserView } from './LowdbUserView';
import { LowdbSessionView } from './LowdbSessionView';
import { DBDriver, DBDriverBase } from '../DBDriver';
import { IUserView, UserDBSchema } from '../UserDBSchema';
import { ISessionView, SessionDBSchema, SessionConstructorParameter } from '../SessionDBSchema';
import { ENV } from '../../env/env';
import { DraftUserId, SessionId } from '../../models/types/BaseTypes';

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

    getUserView(userId: DraftUserId): IUserView {
        const users = this.db.get("Users");
        const cursor = users.find({userId: userId});
        if (!cursor.value()) {
            users.push(this.buildUserFromScratch(userId)).write();
        }
    
        return new LowdbUserView(cursor);
    }

    deleteUserFromDatabase(userId: DraftUserId): void {
        this.db.get("Users").remove({userId: userId}).write();
    }

    createSession(sessionId: SessionId, env: ENV, params?: SessionConstructorParameter): ISessionView {
        const sessions = this.db.get("Sessions");
        const cursor = sessions.find({sessionId: sessionId});
        if (cursor.value()) {
            throw new Error("Session with provided id already exists!");
        }
    
        sessions.push(this.buildSessionFromTemplate(sessionId, env, params)).write();
    
        return new LowdbSessionView(cursor);
    }

    getSessionView(sessionId: SessionId): ISessionView {
        const sessions = this.db.get("Sessions");
        const cursor = sessions.find({sessionId: sessionId});
    
        if (!cursor.value()) {
            throw new Error("Could not find session with provided id");
        }
    
        return new LowdbSessionView(cursor);
    }

    deleteSessionFromDatabase(sessionId: SessionId): void {
        this.db.get("Sessions").remove({sessionId: sessionId}).write();
    }
}