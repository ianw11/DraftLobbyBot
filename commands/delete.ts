import Command from "./types/Command";
import Context from "./types/Context";

export default class DeleteCommand implements Command {
    async execute(context: Context) {
        await context.draftServer.closeSession(context.draftUser);
    }
}