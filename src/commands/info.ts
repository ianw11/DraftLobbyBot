import Command from "./types/Command";
import Context from "./types/Context";

export default class InfoCommand implements Command {
    async execute(context: Context) {
        await context.draftUser.printOwnedSessionInfo();
    }

    help() {
        return "Sends you the information of the session you've created";
    }
}