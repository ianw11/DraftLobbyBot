import { Client } from 'discord.js';
import express, { Request, Response } from 'express';
import { Server } from 'http';
import { Commands } from '../commands';
import Context from '../commands/models/Context';
import { ENV } from '../env/env';
import DraftServer from '../models/DraftServer';
import { ServerId } from '../models/types/BaseTypes';

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
    
        const app = express();
    
        app.get('/', async (req, res) => {
            res.status(200).send("This is a-ok");
        });

        app.get('*', this.handleRequest.bind(this));
        app.post('*', this.handleRequest.bind(this));
    
        this.server = app.listen(6942);
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

    private async createContext(serverId: ServerId, userId: string, params: string[]): Promise<Context> {
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
            const command = Commands[commandStr];

            if (!command) {
                res.status(404).send();
                return;
            }

            const args = req.body ? req.body.split(' ') : [];

            const serverId: string|undefined = req.query.serverId as string|undefined;
            const userId: string|undefined = req.query.userId as string|undefined;

            if (!serverId) {
                res.status(400).send('serverId is required');
                return;
            }
            if (!userId) {
                res.status(400).send('userId is required');
                return;
            }

            const context = await this.createContext(serverId, userId, args);

            await command.execute(context);
            res.status(200).send("Success");
        } catch (e) {
            res.status(500).send(e.message);
        }
    }
}
