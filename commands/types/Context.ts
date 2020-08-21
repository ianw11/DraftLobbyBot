import { Client, User } from "discord.js";
import DraftServer, { UserResolver, DraftUserId } from "../../models/DraftServer";
import DraftUser, { SessionResolver } from "../../models/DraftUser";
import { SessionId } from "../../models/Session";

export default class Context {
    readonly client: Client;
    readonly draftServer: DraftServer;
    private readonly user: User;

    // Computed values
    readonly draftUser: DraftUser;
    readonly sessionResolver: SessionResolver;
    readonly userResolver: UserResolver;

    constructor(client: Client, draftServer: DraftServer, user: User) {
        this.client = client;
        this.draftServer = draftServer;
        this.user = user;
        
        this.draftUser = this.draftServer.getDraftUser(user);
        this.sessionResolver = (sessionId: SessionId) => this.draftServer.getSession(sessionId);
        this.userResolver = (draftUserId: DraftUserId) => this.draftServer.getDraftUserById(draftUserId);
    }
}