import Commands from '.'; // Load all other commands
import Command from "./models/Command";
import Context from "./models/Context";
import { MessageEmbed, EmbedFieldData } from 'discord.js';

export default class HelpCommand implements Command {
    static readonly singleton = new HelpCommand();

    private embed: MessageEmbed | null = null;
    private followup = '';

    async execute(context: Context): Promise<void> {
        if (!this.embed) {
            this.embed = this.buildEmbed(context);
        }
        if (!this.followup) {
            this.followup = this.buildFollowup();
        }

        await context.draftUser.sendEmbedDM(this.embed);
        await context.draftUser.sendDM(this.followup);
    }
    help(): string {
        return 'Displays this message';
    }
    usage(invocation: string): string {
        return invocation;
    }

    private buildEmbed(context: Context): MessageEmbed {
        const alreadyUsedCommands: string[] = [];
        const fields: EmbedFieldData[] = [];
        Object.keys(Commands).sort().forEach((key) => {
            const command = Commands[key];

            if (command.exclude) {
                return;
            }

            const invocation = `${context.env.PREFIX}${key}`;

            const duplicateKey = alreadyUsedCommands.reduce((output, previousKey) => {
                if (output) {
                    return output;
                }
                if (command === Commands[previousKey]) {
                    return previousKey;
                }
                return output;
            }, '');

            if (duplicateKey) {
                fields.push({
                    name: invocation,
                    value: `DUPLICATE - see **${context.env.PREFIX}${duplicateKey}**`
                })
                return;
            }
            alreadyUsedCommands.push(key);

            const field = this.buildField(invocation, command);
            if (field) {
                fields.push(field);
            }
        });

        return new MessageEmbed()
            .setTitle('COMMAND REFERENCE - For more help, see: https://github.com/ianw11/DraftLobbyBot#looking-for-game---the-discord-bot')
            .addFields(fields);
    }

    private buildField(invocation: string, command: Command): EmbedFieldData | null {
        const value = `${command.help ? `[DESCRIPTION] ${command.help()}\n` : ''}${command.usage ? `[USAGE] \`${command.usage(invocation)}\`\n` : ''}${command.usageExample ? `[USAGE EXAMPLE] \`${command.usageExample(invocation)}\`` : ''}`;

        return {
            name: invocation,
            value: value === '' ? "<No Help Provided>" : value
        }
    }

    private buildFollowup() {
        const msg = [];

        msg.push("As a reminder, I require dates in the format: `mm dd hh:mm` and the hour is in 24-hour format.");
        msg.push("For example, `edit date 8 22 17:30` means Aug 22 at 5:30pm");
        msg.push("Yes I realize it's a hassle, thank you for putting up with it for the time being before we think of something better");

        return msg.join("\n");
    }
}