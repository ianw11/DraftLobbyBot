import ENV, {DEFAULTS} from './src/core/EnvBase';
const ENV_JSON_FILE_LOCATION = './env.json'; // Edit this if needed

// eslint-disable-next-line @typescript-eslint/no-var-requires
const ENV_JSON = require(ENV_JSON_FILE_LOCATION);


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
