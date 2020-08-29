import Command from "./models/Command";
import Context from "./models/Context";

export default class StartCommand implements Command {
    async execute(context: Context): Promise<void> {
        await context.draftServer.startSession(context.draftUser);
    }

    help(): string {
        return `Starts the session`;
    }
}