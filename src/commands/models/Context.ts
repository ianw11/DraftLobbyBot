import { Client, User, Message } from "discord.js";
import DraftServer from "../../models/DraftServer";
import ENV from "../../env/EnvBase";
import DraftUser from "../../models/DraftUser";
import { Resolver } from "../../models/types/ResolverTypes";

export interface ContextProps {
    env: ENV,
    client: Client,
    draftServer: DraftServer,
    user: User,
    parameters: string[],
    message?: Message
}

export default class Context {
    readonly env: ENV;
    readonly client: Client;
    readonly draftServer: DraftServer;
    readonly parameters: string[];
    
    readonly message?: Message; // Likely only to be used for debug purposes

    private readonly user: User;

    constructor(props: ContextProps) {
        const {env, client, draftServer, parameters, message, user} = props;
        this.env = env;
        this.client = client;
        this.draftServer = draftServer;
        this.parameters = parameters;

        this.message = message;

        this.user = user;
    }

    get draftUser(): DraftUser {
        return this.resolver.resolveUser(this.user.id);
    }

    get resolver(): Resolver {
        return this.draftServer.resolver;
    }
}