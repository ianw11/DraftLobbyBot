import Command from "./models/Command";
import Context from "./models/Context";

export default class InfoCommand implements Command {
    async execute(context: Context): Promise<void> {
        await context.draftUser.printOwnedSessionInfo();
    }

    help(): string {
        return "Sends you the information of the session you've created";
    }
}