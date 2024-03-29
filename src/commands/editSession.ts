import Command from "./models/Command";
import Context from "./models/Context";
import { parseDate } from "../Utils";

export default class EditSessionCommand implements Command {
    static readonly singleton = new EditSessionCommand();

    async execute(context: Context): Promise<void> {
        const sessionId = context.draftUser.getCreatedSessionId();
        if (!sessionId) {
            throw new Error("Unable to modify session - you haven't created one yet");
        }

        const session = context.resolver.resolveSession(sessionId);
        if (!session) {
            throw new Error("SessionId found but resolver failed to find the Session");
        }

        if (context.parameters.length < 2) {
            throw new Error("Editing a session is done `edit <attribute> <value>` for example: `edit name My Cool Draft`.  For more information ask me for help from a server");
        }

        const field = context.parameters.shift() as string;

        const value = context.parameters.join(' ');
        const valueLower = value.toLocaleLowerCase();
        switch (field.toLocaleLowerCase()) {
            // When updating this switch statement, be sure to also
            // update the help text in the help() method down below!!
            case 'name':
                await session.setName(value);
                break;
            case 'max':
            case 'num':
            case 'players':
            case 'capacity':
                await session.setSessionCapacity(Number.parseInt(value));
                break;
            case 'd':
            case 'description':
                await session.setDescription(value);
                break;
            case 'date':
                await session.setDate(parseDate(context.parameters));
                break;
            case 'fire':
            case 'full':
                await session.setFireWhenFull(valueLower === 'true');
                break;
            case 'url':
                session.setTemplateUrl(value);
                break;
            default:
                throw new Error("Hmm, I don't know what to edit or update");
        }
    }

    help(): string {
        return 'Edit attributes of your draft session.  Current attributes include: `name, capacity/max/num/players, d/description, date, fire/full, url`.  Use "clear" for date to set the draft to fire when full.';
    }

    usage(invocation: string): string {
        return `${invocation} <attribute> <new value>`;
    }

    usageExample(invocation: string): string {
        return `${invocation} d This is my new decription`;
    }
}