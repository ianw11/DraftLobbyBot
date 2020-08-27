import DraftUser from "../DraftUser";
import {SessionId} from "./SessionTypes";
import Session from "../Session";
import {User} from 'discord.js';

export type DraftUserId = string;

// For these Resolvers, a name ('resolve') is given because the
// current testing framework doesn't support mocking types
// or an interface that's just a function

export interface UserResolver {
    resolve (draftUserId: DraftUserId): DraftUser;
}

export interface SessionResolver {
    resolve (sessionId: SessionId): Session;
}

export interface DiscordUserResolver {
    resolve (userId: string): User | undefined;
}