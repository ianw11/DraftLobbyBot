import { Client } from 'discord.js';
import express, { Request, Response } from 'express';
import { Server } from 'http';
import { getCommand } from '../commands';
import Context from '../commands/models/Context';
import { ENV } from '../env/env';
import DraftServer from '../models/DraftServer';
import { DraftUserId, ServerId } from '../models/types/BaseTypes';

export type ServerResolver = (serverId: ServerId) => Promise<DraftServer>;

export class ExpressDriver {
    server: Server | undefined;

    private readonly client: Client;
    private readonly env: ENV;
    private readonly serverResolver: ServerResolver;

    constructor(client: Client, env: ENV, serverResolver: ServerResolver) {
        this.client = client;
        this.env = env;
        this.serverResolver = serverResolver;
    }

    startServer(): void {
        if (this.server) {
            return;
        }

        const { PORT, ENABLED } = this.env.EXPRESS;

        if (!ENABLED) {
            this.env.log("ENV says Express is disabled - not creating server");
            return;
        }
    
        const app = express();
    
        app.get('/', async (req, res) => {
            res.status(200).send("DraftLobbyBot is a-ok");
        });

        app.get('*', this.handleRequest.bind(this));
        app.post('*', this.handleRequest.bind(this));
    
        this.server = app.listen(PORT);
        this.env.log(`Express listening on port ${PORT}`);
    }

    stopServer(): void {
        if (!this.server) {
            return;
        }
    
        this.server.close((err?: Error) => {
            if (err) {
                console.log(err.message);
                console.log(err);
            }
    
            this.server = undefined;
        });
    }

    private async createContext(serverId: ServerId, userId: DraftUserId, params: string[]): Promise<Context> {
        let user = this.client.users.resolve(userId);
        if (!user) {
            user = await this.client.users.fetch(userId);
        }

        const draftServer = await this.serverResolver(serverId);

        return new Context({
            env: this.env,
            draftServer: draftServer,
            user: user,
            parameters: params
        });
    }

    private async handleRequest(req: Request, res: Response): Promise<void> {
        try {
            const commandStr = req.path.split('/')[1];
            const command = getCommand(commandStr);
            if (!command) {
                res.status(404).send();
                return;
            }

            const args = req.body ? req.body.split(' ') : [];

            const serverId = req.query.serverId as ServerId|undefined;
            const userId = req.query.userId as DraftUserId|undefined;

            if (!serverId) {
                res.status(400).send('serverId is required');
                return;
            }
            if (!userId) {
                res.status(400).send('userId is required');
                return;
            }

            const context = await this.createContext(serverId, userId, args);

            // Finally execute the command
            await command.execute(context);
            res.status(200).send("Success");
        } catch (e) {
            if (e instanceof Error) {
                res.status(500).send(e.message);
                this.env.log(e);
            }
        }
    }
}
