import { SessionParameters } from "../models/types/SessionTypes";
import { ActivityType } from "discord.js";
import { replaceFromDict } from "../Utils";

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
    DEFAULT_SESSION_CAPACITY: number;
    DEFAULT_SESSION_DESCRIPTION: string,
    DEFAULT_SESSION_FIRE_WHEN_FULL: boolean;
    FALLBACK_SESSION_URL: string;
}

////////////////////
// DEFAULT VALUES //
////////////////////

const DefaultShallowEnv = {
    /* NO DISCORD_BOT_TOKEN - SEE ENV.TS FOR INFORMATION */

    PREFIX: "!",
    DRAFT_CHANNEL_NAME: "draft-announcements",
    EMOJI: "🌟",
    ERROR_OUTPUT: "%s (If this doesn't make sense, please inform an admin)",

    DEBUG: false,
    log: console.log
};

const DefaultEnvClientOptions: EnvClientOptions = {
    BOT_ACTIVITY: `Magic; %PREFIX%help for help`,
    BOT_ACTIVITY_TYPE: "PLAYING",
    MESSAGE_CACHE_SIZE: 50
};

const DefaultEnvSessionOptions: EnvSessionOptions = {
    DEFAULT_SESSION_NAME: "Scheduled Draft",
    DEFAULT_SESSION_CAPACITY: 8,
    DEFAULT_SESSION_DESCRIPTION: "<NO DESCRIPTION PROVIDED>",
    DEFAULT_SESSION_FIRE_WHEN_FULL: false,
    FALLBACK_SESSION_URL: "https://mtgadraft.herokuapp.com/?session=%HRI%" /* Additional parameter: HRI */
};

/////////////////
// THE EXPORTS //
/////////////////

type ENV = ShallowEnv & EnvClientOptions & EnvSessionOptions;
export default ENV;

export const DEFAULTS = {...DefaultShallowEnv, ...DefaultEnvClientOptions, ...DefaultEnvSessionOptions};

export const buildSessionParameters = (env: ENV): SessionParameters => {
    return {
        name: env.DEFAULT_SESSION_NAME,
        sessionCapacity: env.DEFAULT_SESSION_CAPACITY,
        description: env.DEFAULT_SESSION_DESCRIPTION,
        fireWhenFull: env.DEFAULT_SESSION_FIRE_WHEN_FULL
    };
}

/**
 * Allows strings defined in 
 * 
 * @param str The string with possible ENV values
 * @param env The current ENV
 * 
 * @returns A new string with substituted values
 */
export const replaceStringWithEnv = (str: string, env: ENV): string => {
    const entries = Object.entries(env).reduce((accumulator, current) => {
        const [key, value] = current;
        if (typeof value === 'string') {
            accumulator[key.toUpperCase()] = value;
        }
        return accumulator;
    }, {} as Record<string, string>);

    return replaceFromDict(str, "%", entries);
}
