import * as Discord from 'discord.js';
const client = new Discord.Client();
const DISCORD_BOT_TOKEN = 'NzQ1ODc3Nzg1NjExODYyMDU2.Xz4K0Q.zRA2rEUyavBsVRyBu8PBr_qkvpc';
// Join Link: https://discord.com/api/oauth2/authorize?client_id=745877785611862056&scope=bot&permissions=133120

const PREFIX = "!";

import Commands from './commands';

client.once('ready', () => {
    console.log("Logged in successfully");
});

client.on('message', async (message: Discord.Message) => {
    if (message.content === 'dc') {
        client.destroy();
        return;
    }
    if (message.author.bot) return;

    if (message.content[0] !== PREFIX) {
        return;
    }

    const commandStr = message.content.slice(PREFIX.length).trim();

    const command = Commands[commandStr];
    if (command) {
        command.execute();
    }
});

client.login(DISCORD_BOT_TOKEN);

console.log("Started server.ts");
