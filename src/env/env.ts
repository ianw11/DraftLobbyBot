import { SessionParameters } from "../models/types/SessionTypes";
import { replaceFromDict } from "../Utils";

import ENV, {DEFAULTS} from './EnvBase';
const ENV_JSON_FILE_LOCATION = '../../config/env.json'; // Edit this if needed

let ENV_JSON = { DISCORD_BOT_TOKEN: "NO_BOT_TOKEN_PROVIDED" };
try {
    ENV_JSON = require(ENV_JSON_FILE_LOCATION);
    if (!ENV_JSON.DISCORD_BOT_TOKEN) {
        throw new Error("config/env.json MUST define DISCORD_BOT_TOKEN - ensure the field is defined");
    }
} catch (e) {
    // throw new Error("Could not find config/env.json - make sure this file exists");
    console.error("Could not find config/env.json - make sure this file exists");
    ENV_JSON.DISCORD_BOT_TOKEN = "";
}


const OVERRIDES = {
    log: (msg: string) => { if (env.DEBUG) console.log(`[ENV] ${msg}`); }
}

/**
 * ENV defines the "env.json" file that needs to be generated and placed
 * here or wherever ENV_JSON_FILE_LOCATION (above) refers to.
 * The ENV interface specifies the fields required to satisfy the app.
 * 
 * The json file is then loaded and placed in the default exported value 'env'.
 * 
 * Defaults for the app are provided in the base class, with the main exclusion
 * being DISCORD_BOT_TOKEN which needs to be replaced with your own and definitely kept safe.
 * (env.json is already in .gitignore, I suggest that location)
 * 
 * You also have the choice to override DEBUG which turns on additional logging and functionality
 */

const env: ENV = {...DEFAULTS, ...ENV_JSON, ...OVERRIDES};
export default env;

// Re-export the type so this file is the only required import
export {ENV};

export const buildDefaultSessionParameters = (env: ENV): SessionParameters => {
    return {
        name: env.DEFAULT_SESSION_NAME,
        unownedSessionName: env.DEFAULT_UNOWNED_SESSION_NAME,
        sessionCapacity: env.DEFAULT_SESSION_CAPACITY,
        description: env.DEFAULT_SESSION_DESCRIPTION,
        fireWhenFull: env.DEFAULT_SESSION_FIRE_WHEN_FULL,

        sessionConfirmMessage: env.DEFAULT_SESSION_CONFIRM_MESSAGE,
        sessionWaitlistMessage: env.DEFAULT_SESSION_WAITLIST_MESSAGE,
        sessionCancelMessage: env.DEFAULT_SESSION_CANCELLED_MESSAGE,
        templateUrl: env.DEFAULT_TEMPLATE_URL
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
