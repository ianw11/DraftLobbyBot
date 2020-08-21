import Command from "./types/Command";
import Context from "./types/Context";

export default class InfoCommand implements Command {
    async execute(context: Context) {
        if (!context.draftUser.ownsSession) {
            await context.draftUser.sendDM("Cannot send info - you haven't created a draft session");
            return;
        }

        const session = context.draftServer.getSession(context.draftUser.ownsSession);

        const msg = `${session.name} has ${session.getNumConfirmed()} confirmed and ${session.getNumWaitlisted()} waitlisted.`;

        await context.draftUser.sendDM(msg);
    }
}