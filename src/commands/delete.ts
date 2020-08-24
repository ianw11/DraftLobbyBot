import Command from "./types/Command";
import Context from "./types/Context";

export default class DeleteCommand implements Command {
    async execute(context: Context): Promise<void> {
        await context.draftServer.closeSession(context.draftUser);
    }

    help(): string {
        return "Deletes any session you've already created.";
    }
}