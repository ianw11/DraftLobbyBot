import Command from './types/Command';
import Context from './types/Context';

export default class ListCommand implements Command {
    async execute(context: Context) {
        await context.draftUser.listSessions(context.sessionResolver);
    }
};
