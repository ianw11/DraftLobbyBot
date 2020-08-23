import Command from "./types/Command";
import Context from "./types/Context";
import { SessionId } from "../models/Session";

export default class EditSessionCommand implements Command {
    async execute(context: Context) {
        const sessionId = context.draftUser.getCreatedSessionId();
        if (!sessionId) {
            throw "Unable to modify session - you haven't created one yet";
        }

        const session = context.sessionResolver.resolve(sessionId);
        if (!session) {
            throw "SessionId found but resolver failed to find the Session";
        }

        if (context.parameters.length < 2) {
            throw "Editing a session is done `edit <attribute> <value>` for example: `edit name My Cool Draft`.  For more information ask me for help from a server"
        }

        const field = context.parameters.shift();
        if (!field) {
            throw "Missing: the field you want to edit.  Check the help command for more information";
        }
        const value = context.parameters.join(' ');
        const valueLower = value.toLocaleLowerCase();
        switch (field.toLocaleLowerCase()) {
            // When updating this switch statement, be sure to also
            // update the help text in the help() method down below!!
            case 'name':
                session.setName(value);
                break;
            case 'max':
            case 'num':
            case 'players':
            case 'capacity':
                session.setMaxNumPlayers(Number.parseInt(value));
                break;
            case 'd':
            case 'description':
                session.setDescription(value);
                break;
            case 'date':
                session.setDate(this.buildDate(context.parameters));
                break;
            case 'fire':
            case 'full':
                session.setFireWhenFull(valueLower === 'true');
                break;
            case 'url':
                session.setUrl(value);
                break;
            default:
                break;
        }
    }

    help() {
        return 'Edit attributes of your draft session.  Current attributes include: `name, capacity/max/num/players, d/description, date, fire/full, url`.  Use "clear" for date to set the draft to fire when full.';
    }

    usage(invocation: string) {
        return `${invocation} <attribute> <new value>`;
    }

    usageExample(invocation: string) {
        return `${invocation} d This is my new decription`;
    }

    buildDate(parameters: string[]): Date | null {
        const now = new Date();
        let date: Date | null = null;
        if (parameters.length === 1) {
            if (parameters[0].toLocaleLowerCase() === 'clear') {
                // No-op
            } else {
                // This expects a perfectly formatted string
                date = new Date(parameters[0]);
            }
        } else if (parameters.length === 3) {
            // This expects: [mm dd hh:mm]
            // example: 8 22 17:30

            const monthNum = Number.parseInt(parameters[0]);
            const year = `${now.getFullYear() + (monthNum < now.getMonth() ? 1 : 0)}`;
            const month = parameters[0].padStart(2, '0');
            const day = parameters[1].padStart(2, '0');
            
            const timeSplit = parameters[2].split(":");
            const hour = timeSplit[0].padStart(2, '0');
            const minute = timeSplit[1].padStart(2, '0');
            const seconds = "00";

            const dateStr = `${year}-${month}-${day}T${hour}:${minute}:${seconds}`;
            date = new Date(dateStr);
        }

        return date;
    }
}