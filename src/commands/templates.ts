import Context from "./models/Context"
import Command from './models/Command';
import SessionTemplateCache from "../models/SessionTemplateCache";
import { MessageEmbed, EmbedFieldData } from "discord.js";

const cache = SessionTemplateCache.singleton;

export default class TemplateCommand implements Command {
    static readonly singleton = new TemplateCommand();

    async execute(context: Context): Promise<void> {
        const templates = cache.getTemplatesForServer(context.draftServer.serverId);

        const fields: EmbedFieldData[] = [];
        Object.keys(templates).sort().forEach((templateName) => {
            const template = templates[templateName] as Record<string, string|number|boolean>;
            if (!template) {
                throw new Error("We already confirmed this value exists");
            }
            let value = '';

            Object.keys(template).sort().forEach((templateValueName) => {
                value += `**${templateValueName}**: ${template[templateValueName]}\n`;
            });

            fields.push({
                name: templateName,
                value: value
            });
        });

        const embed = new MessageEmbed()
            .setTitle("Available Templates")
            .addFields(fields);

        await context.draftUser.sendEmbedDM(embed);
    }
}