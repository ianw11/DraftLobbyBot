
import Command from "./models/Command";
import Context from "./models/Context";

export default class DebugCommand implements Command {
    static readonly singleton = new DebugCommand();

    exclude = true;

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    async execute(context: Context): Promise<void> {
        // session.broadcast(context.parameters.join(' '));
    }
}

/*

Sending emojis is ok, but emojis some users post might not be in the pool of what the bot can post.
await context.message.channel.send('<:nike_emoji:558072768478838797>');
That line is valid since the bot is a part of my debug server (where the emoji is uploaded to)
but arbitrary emojis won't work.

*/