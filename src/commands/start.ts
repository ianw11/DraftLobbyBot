import Command from "./types/Command";
import Context from "./types/Context";

export default class StartCommand implements Command {
    async execute(context: Context): Promise<void> {
        await context.draftServer.startSession(context.draftUser);
    }
}