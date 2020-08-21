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
    usage(invocation): string {
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

        this.message = msg;
    }
}