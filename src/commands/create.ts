import Command from './models/Command';
import Context from './models/Context';
import { parseDate } from '../Utils';
import { SessionParametersWithSugar } from '../database/SessionDBSchema';
import { Dependencies } from '../models/Dependencies';


export default class CreateCommand implements Command {
    static readonly singleton = new CreateCommand();

    async execute(context: Context): Promise<void> {
        await context.draftServer.createSession(context.draftUser, this.findTemplate(context));
    }

    private findTemplate(context: Context): Partial<SessionParametersWithSugar> | undefined {
        if (context.parameters.length === 0) {
            // No template - use defaults
            return;
        }

        const templateName = context.parameters.shift() as string;

        const sessionTemplate = Dependencies.sessionTemplateCache.getTemplate(context.draftServer.serverId, templateName);
        if (!sessionTemplate) {
            throw new Error(`Could not find a template named ${templateName}`);
        }

        if (context.parameters.length > 0) {
            sessionTemplate.date = parseDate(context.parameters);
        }
        return sessionTemplate;
    }

    help(): string {
        return "Creates a new Session (and deletes your existing active Session).  Optionally accepts a template name (if your server has any templates set up)";
    }

    usage(invocation: string): string {
        return `${invocation}  - OR -  ${invocation} <templateName>  - OR -  ${invocation} <templateName> <date>`;
    }

    usageExample(invocation: string): string {
        return `${invocation} MyTemplateName`;
    }
}