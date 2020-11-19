import { Message } from 'discord.js';
import Command from './models/Command';
import Context from './models/Context';

export class TransferOwnershipCommand implements Command {
    static readonly singleton = new TransferOwnershipCommand();

    async execute(context: Context): Promise<void> {
        // Ensure the user currently has a session to transfer
        const sessionId = context.draftUser.getCreatedSessionId();
        if (!sessionId) {
            throw new Error("You do not own any sessions");
        }
        const session = context.resolver.resolveSession(sessionId);

        // Try to find the new owner, first by checking @mentions then by checking the parameters to this command
        const newOwnerId = this.findUserIdFromMentions(context) ||
                            this.findUserIdFromCommandParameters(context);
        if (!newOwnerId) {
            throw new Error("Either @mention somebody or paste their Discord Tag (eg username#0000) or Discord User Id");
        }
        await session.changeOwner(context.resolver.resolveUser(newOwnerId));
    }

    private findUserIdFromMentions(context: Context): string | undefined {
        const mentionedMembers = (context.message as Message).mentions.members?.array();
        if (!mentionedMembers || mentionedMembers.length === 0) {
            return;
        }
        const mentionedGuildMember = mentionedMembers[0];
        return mentionedGuildMember.id;
    }

    private findUserIdFromCommandParameters(context: Context): string | undefined {
        if (context.parameters.length < 1) {
            return;
        }
        const input = context.parameters[0];

        // If the input is username#tag
        if (input.includes("#")) {
            return context.resolver.discordResolver.resolveGuildMemberFromTag(input)?.id;
        } else {
            // Otherwise we assume we got the user id
            return input;
        }
    }

    help(): string {
        return "Allows the session owner to transfer ownership to another person";
    }

    usage(invocation: string): string {
        return `${invocation} @mention OR ${invocation} username#0000 OR ${invocation} UserId`;
    }
}
