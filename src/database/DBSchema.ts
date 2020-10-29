
type DBSchema = {
    Users: Array<UserPersistentData>;
};

export default DBSchema;



/*
export interface GuildDBSchema {
    guildId: string;
    announcementChannelId: string;

    Sessions: Record<string, SessionDBSchema>;
    Users: Record<string, UserPersistentData>;
}

export interface SessionDBSchema {
    sessionId: string;
}
*/

export interface UserPersistentData {
    userId: string;

    joinedSessionIds: Array<string>;
    waitlistedSessionIds: Array<string>;

    createdSessionId?: string;
}
