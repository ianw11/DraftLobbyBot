import Command from "./types/Command";
import Context from "./types/Context";

export default class StartCommand implements Command {
    async execute(context: Context) {
        await context.draftServer.startSession(context.draftUser);
    }
}