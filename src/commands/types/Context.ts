import { Client, User, Message } from "discord.js";
import DraftServer, { UserResolver, SessionResolver } from "../../models/DraftServer";
import { ENV } from "../../env";
import DraftUser from "../../models/DraftUser";

export default class Context {
    readonly env: ENV;
    readonly client: Client;
    readonly draftServer: DraftServer;
    readonly parameters: string[];
    
    readonly message: Message; // Likely only to be used for debug purposes

    // Computed values
    readonly draftUser: DraftUser;
    readonly sessionResolver: SessionResolver;
    readonly userResolver: UserResolver;

    constructor(env: ENV, client: Client, draftServer: DraftServer, user: User, parameters: string[], message: Message) {
        this.env = env;
        this.client = client;
        this.draftServer = draftServer;
        this.parameters = parameters;
        this.message = message;
        
        this.draftUser = this.draftServer.getDraftUser(user);
        this.sessionResolver = draftServer.sessionResolver;
        this.userResolver = draftServer.userResolver;
    }
}