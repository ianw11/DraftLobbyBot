import { ActivityType } from "discord.js";

type DatabaseDriver = 'inmemory' | 'lowdb';

/////////////////////////////////////////////////
// INTERFACES GROUPING THE CONFIGURABLE VALUES //
/////////////////////////////////////////////////

interface DatabaseFields {
    DB_DRIVER: DatabaseDriver;

    LOW_DB_FILE: string;
}

interface ExpressFields {
    ENABLED: boolean;
    PORT: number;
}

interface ShallowEnvDefaultable {
    PREFIX: string;
    DRAFT_CHANNEL_NAME: string;
    EMOJI: string;
    ERROR_OUTPUT: string;

    DATABASE: DatabaseFields;

    EXPRESS: ExpressFields;
    
    DEBUG: boolean;
    log: (msg: string | Error) => void;
}

// These MUST be defined in env.json for the bot to work
// Exported for testing purposes - shouldn't be referenced otherwise
export interface ShallowEnvRequiredFields {
    DISCORD_BOT_TOKEN: string;
    DISCORD_APP_ID: string;
}

interface EnvClientOptions {
    BOT_ACTIVITY: string;
    BOT_ACTIVITY_TYPE?: ActivityType;
    MESSAGE_CACHE_LIFETIME_SECONDS: number;
    MESSAGE_CACHE_SWEEP_INTERVAL: number;
}

interface EnvSessionOptions {
    DEFAULT_SESSION_NAME: string;
    DEFAULT_UNOWNED_SESSION_NAME: string;
    DEFAULT_SESSION_CAPACITY: number;
    DEFAULT_SESSION_DESCRIPTION: string,
    DEFAULT_SESSION_FIRE_WHEN_FULL: boolean;

    DEFAULT_SESSION_CONFIRM_MESSAGE: string;
    DEFAULT_SESSION_WAITLIST_MESSAGE: string;
    DEFAULT_SESSION_CANCELLED_MESSAGE: string;
    DEFAULT_TEMPLATE_URL: string;
}

////////////////////
// DEFAULT VALUES //
////////////////////

const DefaultShallowEnvDefaults: ShallowEnvDefaultable = {
    /* NO DISCORD_BOT_TOKEN - SEE ENV.TS FOR INFORMATION */

    PREFIX: "!",
    DRAFT_CHANNEL_NAME: "draft-announcements",
    EMOJI: "🌟",
    ERROR_OUTPUT: "%s (If this doesn't make sense, please inform an admin)",

    DATABASE: {
        DB_DRIVER: 'lowdb',
        LOW_DB_FILE: 'data/lowdb_database.json'
    },

    EXPRESS: {
        ENABLED: false,
        PORT: 6942
    },

    DEBUG: false,
    log: console.log
};

const DefaultEnvClientOptionsDefaults: EnvClientOptions = {
    BOT_ACTIVITY: `Magic; %PREFIX%help for help`,
    BOT_ACTIVITY_TYPE: "PLAYING",
    MESSAGE_CACHE_LIFETIME_SECONDS: 300,
    MESSAGE_CACHE_SWEEP_INTERVAL: 120
};

const DefaultEnvSessionOptionDefaults: EnvSessionOptions = {
    DEFAULT_SESSION_NAME: "%NAME%'s Session",
    DEFAULT_UNOWNED_SESSION_NAME: "New Session",
    DEFAULT_SESSION_CAPACITY: 8,
    DEFAULT_SESSION_DESCRIPTION: "<NO DESCRIPTION PROVIDED>",
    DEFAULT_SESSION_FIRE_WHEN_FULL: false,
    // FALLBACK_SESSION_URL: "https://mtgadraft.herokuapp.com/?session=%HRI%", /* Additional parameter: HRI */
    
    DEFAULT_SESSION_CONFIRM_MESSAGE: "%NAME% has started",
    DEFAULT_SESSION_WAITLIST_MESSAGE: "%NAME% has started, but you were on the waitlist",
    DEFAULT_SESSION_CANCELLED_MESSAGE: "%NAME% has been cancelled",
    DEFAULT_TEMPLATE_URL: "<NO_URL>"
};

type ShallowEnv = ShallowEnvDefaultable & ShallowEnvRequiredFields;

/////////////////
// THE EXPORTS //
/////////////////

type ENV = ShallowEnv & EnvClientOptions & EnvSessionOptions;
export default ENV;
export {ENV};

export const DEFAULTS = {...DefaultShallowEnvDefaults, ...DefaultEnvClientOptionsDefaults, ...DefaultEnvSessionOptionDefaults};
