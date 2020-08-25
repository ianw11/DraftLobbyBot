import { SessionParameters } from "../types/SessionTypes";

export default interface ENV {
    DISCORD_BOT_TOKEN: string;
    
    PREFIX: string;
    DRAFT_CHANNEL_NAME: string;
    EMOJI: string;
    ERROR_OUTPUT: string;
    
    DEFAULT_SESSION_NAME: string;
    DEFAULT_SESSION_CAPACITY: number;
    DEFAULT_SESSION_DESCRIPTION: string,
    DEFAULT_SESSION_FIRE_WHEN_FULL: boolean;
    
    DEBUG: boolean;
    log: (msg: string) => void;
}

export const DEFAULTS = {
    PREFIX: "!",
    DRAFT_CHANNEL_NAME: "draft-announcements",
    EMOJI: "🌟",
    ERROR_OUTPUT: "%s (If this doesn't make sense, please inform an admin)",

    DEFAULT_SESSION_NAME: "Scheduled Draft",
    DEFAULT_SESSION_CAPACITY: 8,
    DEFAULT_SESSION_DESCRIPTION: "<NO DESCRIPTION PROVIDED>",
    DEFAULT_SESSION_FIRE_WHEN_FULL: true,
    
    DEBUG: false,
    log: console.log
};

export const buildSessionParameters = (env: ENV): SessionParameters => {
    return {
        name: env.DEFAULT_SESSION_NAME,
        sessionCapacity: env.DEFAULT_SESSION_CAPACITY,
        description: env.DEFAULT_SESSION_DESCRIPTION,
        fireWhenFull: env.DEFAULT_SESSION_FIRE_WHEN_FULL
    };
}
