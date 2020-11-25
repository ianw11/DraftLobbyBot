import { Message, User } from "discord.js";
import DraftServer from "../../models/DraftServer";
import ENV from "../../env/EnvBase";
import DraftUser from "../../models/DraftUser";
import { Resolver } from "../../models/types/ResolverTypes";

export interface ContextProps {
    env: ENV,
    draftServer: DraftServer,
    user: User,
    parameters: string[],
    message?: Message
}

export default class Context {
    readonly env: ENV;
    readonly draftServer: DraftServer;
    readonly parameters: string[];

    readonly message?: Message;

    private readonly user: User;

    constructor(props: ContextProps) {
        const {env, draftServer, parameters, user, message} = props;
        this.env = env;
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