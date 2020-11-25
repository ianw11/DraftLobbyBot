import Command from "./models/Command";
import Context from "./models/Context";

export default class StartCommand implements Command {
    static readonly singleton = new StartCommand();
    
    async execute(context: Context): Promise<void> {
        await context.draftServer.startSessionOwnedByUser(context.draftUser);
    }

    help(): string {
        return `Starts the session`;
    }
}