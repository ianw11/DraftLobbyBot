import ENV, {DEFAULTS} from './EnvBase';
const ENV_JSON_FILE_LOCATION = '../../config/env.json'; // Edit this if needed

let ENV_JSON = { DISCORD_BOT_TOKEN: "NO_BOT_TOKEN_PROVIDED" };
try {
    ENV_JSON = require(ENV_JSON_FILE_LOCATION);
    if (!ENV_JSON.DISCORD_BOT_TOKEN) {
        throw new Error("config/env.json MUST define DISCORD_BOT_TOKEN - ensure the field is defined");
    }
} catch (e) {
    throw new Error("Could not find config/env.json - make sure this file exists");
}


const OVERRIDES = {
    log: (msg: string) => { if (env.DEBUG) console.log(`[ENV] ${msg}`); }
}

/**
 * ENV defines the "env.json" file that needs to be generated and placed
 * here or wherever ENV_JSON_FILE_LOCATION (above) refers to.
 * The ENV interface specifies the fields required to satisfy the app.
 * 
 * The json file is then loaded and placed in the exported value 'env'.
 * 
 * Defaults for the appnare provided in the base class, with the main exclusion
 * being DISCORD_BOT_TOKEN which needs to be replaced with your own and definitely kept safe.
 * (env.json is already in .gitignore, I suggest that location)
 * 
 * You also have the choice to override DEBUG which turns on additional logging and functionality
 */

const env: ENV = {...DEFAULTS, ...ENV_JSON, ...OVERRIDES};
export default env;
