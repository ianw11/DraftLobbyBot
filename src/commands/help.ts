import Commands from '.'; // Load all other commands
import Command from "./types/Command";
import Context from "./types/Context";

export default class HelpCommand implements Command {
    private message = '';
    private followup = '';

    async execute(context: Context): Promise<void> {
        if (!this.message) {
            this.message = this.buildMessage(context);
        }
        if (!this.followup) {
            this.followup = this.buildFollowup();
        }

        await context.draftUser.sendDM(this.message);
        await context.draftUser.sendDM(this.followup);
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

        return msg;
    }

    private buildFollowup() {
        const msg = [];

        msg.push("As a reminder, I require dates in the format: `mm dd hh:mm` and the hour is in 24-hour format.");
        msg.push("For example, `edit date 8 22 17:30` means Aug 22 at 5:30pm");
        msg.push("Yes I realize it's a hassle, thank you for putting up with it");

        return msg.join("\n");
    }
}