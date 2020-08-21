import Command from './types/Command';
import Context from './types/Context';

export default class CreateCommand implements Command {
    async execute(context: Context) {
        await context.draftServer.createSession(context.draftUser);
    }

    help() {
        return "Creates a new Session (and deletes your existing active Session)";
    }
}