import Command from "./types/Command";
import Context from "./types/Context";

export default class BroadcastCommand implements Command {
    async execute(context: Context): Promise<void> {
        const session = context.draftServer.getSessionFromDraftUser(context.draftUser);
        if (!session) {
            throw new Error("Unable to broadcast - you don't have an open Session");
        }
        const {parameters} = context;
        if (parameters.length === 0) {
            throw new Error("Unable to broadcast - empty message");
        }

        const includeWaitlist = parameters[0].toLowerCase() === 'all';
        if (includeWaitlist) {
            parameters.shift();
            if (parameters.length === 0) {
                throw new Error("Unable to broadcast to all - empty message");
            }
        }

        await session.broadcast(parameters.join(' '), includeWaitlist);
    }

    help(): string {
        return "Sends a message to everybody who's joined. Optionally includes the waitlist if 'all' is included";
    }

    usage(invocation: string): string {
        return `${invocation} [all] <any message you want>`;
    }
}
