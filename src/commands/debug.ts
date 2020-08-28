import Command from "./types/Command";
import Context from "./types/Context";

export default class DebugCommand implements Command {
    exclude = true;

    async execute(context: Context): Promise<void> {
        const sessionId = context.draftUser.getCreatedSessionId();
        if (!sessionId) {
            return;
        }
        const session = context.sessionResolver.resolve(sessionId);
        if (!session) {
            return;
        }

        session.broadcast(context.parameters.join(' '));
    }
}

/*

Sending emojis is ok, but emojis some users post might not be in the pool of what the bot can post.
await context.message.channel.send('<:nike_emoji:558072768478838797>');
That line is valid since the bot is a part of my debug server (where the emoji is uploaded to)
but arbitrary emojis won't work.

*/