import Command from "./types/Command";
import Context from "./types/Context";

export default class EditSessionCommand implements Command {
    async execute(context: Context) {
        if (!context.draftUser.createdSessionId) {
            throw "Unable to modify session - you haven't created one yet";
        }

        const session = context.sessionResolver(context.draftUser.createdSessionId);

        if (context.parameters.length < 2) {
            throw "Editing a session is done `edit <attribute> <value>` for example: `edit name My Cool Draft`.  For more information ask me for help from a server"
        }

        const field = context.parameters.shift();
        const value = context.parameters.join(' ');
        switch (field.toLocaleLowerCase()) {
            // When updating this switch statement, be sure to also
            // update the help text in the help() method down below!!
            case 'name':
                session.setName(value);
                break;
            case 'max':
            case 'num':
            case 'players':
                session.setMaxNumPlayers(Number.parseInt(value));
                session.fireIfAble();
                break;
            case 'd':
            case 'description':
                session.setDescription(value);
                break;
            case 'date':
                session.setDate(value);
                break;
            case 'time':
                session.setTime(value);
                break;
            case 'asap':
                session.setAsap(value.toLocaleLowerCase() === 'true');
                break;
            default:
                break;
        }

        await session.updateMessage();
    }

    help() {
        return 'Edit attributes of your draft session.  Current attributes include: `name, max/num/players, d/description, date, time`';
    }

    usage(command) {
        return `${command} <attribute> <new value>`;
    }

    usageExample(command) {
        return `${command} d This is my new decription`;
    }
}