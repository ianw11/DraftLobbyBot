import Command from './models/Command';
import Context from './models/Context';
import SessionTemplateCache from '../models/SessionTemplateCache';
import { SessionParameters } from '../models/Session';


export default class CreateCommand implements Command {
    static readonly singleton = new CreateCommand();

    async execute(context: Context): Promise<void> {
        await context.draftServer.createSession(context.draftUser, this.findTemplate(context));
    }

    private findTemplate(context: Context): Partial<SessionParameters> | undefined {
        if (context.parameters.length === 0) {
            return;
        }

        const templateName = context.parameters[0];

        const sessionTemplate = SessionTemplateCache.singleton.getTemplate(context.draftServer.serverId, templateName);
        if (!sessionTemplate) {
            throw new Error(`Could not find a template name ${templateName}`);
        }
        return sessionTemplate;
    }

    help(): string {
        return "Creates a new Session (and deletes your existing active Session).  Optionally accepts a template name (if your server has any templates set up)";
    }

    usage(invocation: string): string {
        return `${invocation}  - OR -  ${invocation} <templateName>`;
    }
}