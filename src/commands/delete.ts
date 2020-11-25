import Command from "./models/Command";
import Context from "./models/Context";

export default class DeleteCommand implements Command {
    static readonly singleton = new DeleteCommand();

    async execute(context: Context): Promise<void> {
        await context.draftServer.closeSessionOwnedByUser(context.draftUser);
    }

    help(): string {
        return "Deletes any session you've already created.";
    }
}