import { ActivityType } from "discord.js";

/////////////////////////////////////////////////
// INTERFACES GROUPING THE CONFIGURABLE VALUES //
/////////////////////////////////////////////////

interface ShallowEnv {
    DISCORD_BOT_TOKEN: string;
    
    PREFIX: string;
    DRAFT_CHANNEL_NAME: string;
    EMOJI: string;
    ERROR_OUTPUT: string;
    
    DEBUG: boolean;
    log: (msg: string) => void;
}

interface EnvClientOptions {
    BOT_ACTIVITY: string;
    BOT_ACTIVITY_TYPE?: ActivityType;

    /**
     * Number of messages PER CHANNEL to retain. Default message cache size is 200.
     */
    MESSAGE_CACHE_SIZE: number;
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

const DefaultShallowEnvDefaults = {
    /* NO DISCORD_BOT_TOKEN - SEE ENV.TS FOR INFORMATION */

    PREFIX: "!",
    DRAFT_CHANNEL_NAME: "draft-announcements",
    EMOJI: "🌟",
    ERROR_OUTPUT: "%s (If this doesn't make sense, please inform an admin)",

    DEBUG: false,
    log: console.log
};

const DefaultEnvClientOptionsDefaults: EnvClientOptions = {
    BOT_ACTIVITY: `Magic; %PREFIX%help for help`,
    BOT_ACTIVITY_TYPE: "PLAYING",
    MESSAGE_CACHE_SIZE: 50
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

/////////////////
// THE EXPORTS //
/////////////////

type ENV = ShallowEnv & EnvClientOptions & EnvSessionOptions;
export default ENV;

export const DEFAULTS = {...DefaultShallowEnvDefaults, ...DefaultEnvClientOptionsDefaults, ...DefaultEnvSessionOptionDefaults};
