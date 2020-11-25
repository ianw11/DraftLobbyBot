import low from 'lowdb';
import FileSync from 'lowdb/adapters/FileSync';
import { LowdbUserView } from './LowdbUserView';
import { LowdbSessionView } from './LowdbSessionView';
import { DBDriver, DBDriverBase } from '../DBDriver';
import { IUserView, UserDBSchema } from '../UserDBSchema';
import { ISessionView, SessionDBSchema, SessionConstructorParameter, ReadonlySessionView } from '../SessionDBSchema';
import { ENV } from '../../env/env';
import { DraftUserId, ServerId, SessionId } from '../../models/types/BaseTypes';

type DBSchema = {
    Sessions: Array<SessionDBSchema>;
    Users: Array<UserDBSchema>;
};
type LowDB = low.LowdbSync<DBSchema>;

export class LowdbDriver extends DBDriverBase implements DBDriver {
    
    db: LowDB;

    constructor(env: ENV) {
        super();

        if (!env.DATABASE.LOW_DB_FILE) {
            throw new Error("Low db file wasn't defined");
        }
        const adapter = new FileSync(env.DATABASE.LOW_DB_FILE);
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

    getAllUsersFromServer(serverId: ServerId): IUserView[] {
        const users = this.db.get("Users");
        return users.filter({serverId: serverId}).map((userDbSchema: UserDBSchema) => {
            return new LowdbUserView(users.find({serverId: serverId, userId: userDbSchema.userId}));
        }).value();
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

    getAllSessions(): ReadonlySessionView[] {
        const sessions: ReadonlySessionView[] = [];
        
        const sessionChain = this.db.get('Sessions');
        sessionChain.value().forEach((value) => {
            sessions.push(new ReadonlySessionView(value));
        });

        return sessions;
    }
}