import Command from './types/Command';
import Context from './types/Context';

export default class ListCommand implements Command {
    async execute(context: Context): Promise<void> {
        await context.draftUser.listSessions();
    }

    help(): string {
        return "DMs you all the sessions you've signed up for";
    }
}
