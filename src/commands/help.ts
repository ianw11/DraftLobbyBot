import env from "../env";
import Commands from '.'; // Load all other commands
import Command from "./types/Command";
import Context from "./types/Context";

export default class HelpCommand implements Command {
    private message: string;

    async execute(context: Context) {
        if (!this.message) {
            this.buildMessage(context);
        }

        await context.draftUser.sendDM(this.message);
    }
    help(): string {
        return 'Displays this message';
    }
    usage(invocation: string): string {
        return invocation;
    }

    private buildMessage(context: Context) {
        let msg = `Here are the commands I can understand:\n`;
        Object.keys(Commands).sort().forEach((key) => {
            const command = Commands[key];

            if (command.exclude) {
                return;
            }

            const invocation = `${context.env.PREFIX}${key}`;

            msg += `--> ${key}`;
            if (command.help) {
                msg += ` | ${command.help()}`;
            }
            if (command.usage) {
                msg += ` | Usage: \`${command.usage(invocation)}\``;
            }
            if (command.usageExample) {
                msg += ` | Usage Example: \`${command.usageExample(invocation)}\``;
            }
            msg += '\n';
        });

        msg += "\nAs a reminder, I require dates in the format: `mm dd hh:mm` (eg. 8 22 17:30 means Aug 22 at 5:30pm) and the hour is in 24-hour format.\nYes I realize it's a hassle, thank you for putting up with it";

        this.message = msg;
    }
}