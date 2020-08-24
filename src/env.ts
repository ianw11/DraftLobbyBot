const ENV_JSON_FILE_LOCATION = '../env.json'; // Edit this if needed, though I don't recommend it

// eslint-disable-next-line @typescript-eslint/no-var-requires
const ENV_JSON = require(ENV_JSON_FILE_LOCATION);

/**
 * ENV defines the "env.json" file that needs to be generated and place in this directory.
 * The interface specifies the fields required to satisfy the app.
 * 
 * This file also defines the defaults for the app, with the main exclusion
 * being DISCORD_BOT_TOKEN which needs to be replaced with your own and definitely kept safe
 * (env.json is already in .gitignore, I suggest that location)
 */
export interface ENV {
    DISCORD_BOT_TOKEN: string;
    DRAFT_CHANNEL_NAME: string;
    PREFIX: string;
    EMOJI: string;
    
    DEBUG: boolean;

    log: (msg: string) => void;
}

const DEFAULTS: Partial<ENV> = {
    PREFIX: "!",
    DRAFT_CHANNEL_NAME: "draft-announcements",
    EMOJI: "🌟",
    
    DEBUG: false
};

const OVERRIDES: Partial<ENV> = {
    log: (msg) => { if (env.DEBUG) console.log(`[ENV] ${msg}`); }
}

const env: ENV = {...DEFAULTS, ...ENV_JSON, ...OVERRIDES};
export default env;
