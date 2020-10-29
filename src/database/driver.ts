import * as low from 'lowdb';
import * as FileSync from 'lowdb/adapters/FileSync';
import DraftUser from '../models/DraftUser';
import DBSchema, { UserPersistentData } from './DBSchema';

const adapter = new FileSync('data/lowdb_database.json');
const db: low.LowdbSync<DBSchema> = low(adapter);

db.defaults({Users: []}).write();

export function writeUser(user: DraftUser): void {
    const userId = user.getUserId();
    const dbObj: UserPersistentData = { userId: userId, createdSessionId: user.getCreatedSessionId(), joinedSessionIds: user.joinedSessions, waitlistedSessionIds: user.waitlistedSessions };

    const users = db.get("Users");

    const existingUser = users.find({userId: userId});

    if (existingUser.value()) {
        existingUser.assign(dbObj).write();
    } else {
        users.push(dbObj).write();
    }
}

export function getUser(userId: string): UserPersistentData {
    return db.get("Users").find({userId: userId}).value();
}
