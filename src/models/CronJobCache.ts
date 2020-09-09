import {CronJob, job} from 'cron';
import DraftServer from './DraftServer';
import { Guild } from 'discord.js';
import { SessionParameters } from './Session';
import moment = require("moment-timezone");


class CronEntry {
    cronTask = "";
    sessionTime = "";
}

type CronJobFile = Record<string, CronEntry[]>;

let ServerCronJobs: CronJobFile = {};


try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    ServerCronJobs = require('../../config/cronjobs.json') as CronJobFile;
} catch (e) {
    console.log("Could not find config/cronjobs.json - starting server without scheduling");
}

export default class CronJobCache {
    static readonly singleton = new CronJobCache();

    private constructor() { // No-op
    }

    getCronJobs(guild: Guild, server: DraftServer): CronJob[] {

        const cron_entries_for_guild: CronEntry[] = ServerCronJobs[guild.id];
        if (!cron_entries_for_guild) return [];
        return cron_entries_for_guild.map(entry => job(
            entry.cronTask, 
            () => {
                const scheduledWhen: Partial<SessionParameters> = {
                    description: "Scheduled Draft",
                    fireWhenFull: false,
                    date: new Date(`${new Date().toDateString()} ${entry.sessionTime}`)
                }
                server.createSession(undefined,scheduledWhen);
            },
            null,
            true, 
            moment.tz.guess())
        );
    }
}