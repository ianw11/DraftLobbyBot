import Command from "./types/Command";
import Context from "./types/Context";

export default class DebugCommand implements Command {
    exclude = true;

    async execute(context: Context) {
        console.log(context.parameters);
    }
}

/*

Sending emojis is ok, but emojis some users post might not be in the pool of what the bot can post.
await context.message.channel.send('<:nike_emoji:558072768478838797>');
That line is valid since the bot is a part of my debug server (where the emoji is uploaded to)
but arbitrary emojis won't work.

*/