import { ENV } from "../env/env";
import { DraftUserId, ServerId, SessionId } from "../models/types/BaseTypes";

function buildDefaultSessionParameters(env: ENV): TemplateAndDBSessionParameters {
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

export function buildSessionParams(env: ENV, params?: SessionConstructorParameter): SessionParametersWithSugar {
    return {
        ...buildDefaultSessionParameters(env),
        ...(params || {})
    };
}

/*
    This interface is what defines the database
*/
export interface SessionDBSchema {
    readonly serverId: ServerId;
    readonly sessionId: SessionId;

    ownerId?: DraftUserId;

    joinedPlayerIds: DraftUserId[];
    waitlistedPlayerIds: DraftUserId[];

    sessionParameters: SessionParametersDB; // Defined in the next section

    sessionClosed: boolean;
}

/////////////////////////////////////////
// DATABASE SCHEMA CHILDREN INTERFACES //
/////////////////////////////////////////

/*
    This interface exists in the database (as a child object), but it can also be generated from ENV (config files) and
    is thus exposed so ENV can work with it.
*/
export interface TemplateAndDBSessionParameters {
    name: string;
    unownedSessionName: string;
    sessionCapacity: number;
    description: string;
    fireWhenFull: boolean; // Or should we wait for the Session owner to run the StartCommand

    sessionConfirmMessage: string;
    sessionWaitlistMessage: string;
    sessionCancelMessage: string;
    templateUrl: string;

    dateStr?: string; // A string representation of the date is stored in the DB - further down we extend this interface with an actual Date object
}

/*
    This interface ALSO exists in the database and is an extension of TemplateSessionParameters and act _like_ parameters...
    BUT the interface is not exposed/exported (is private to this file) so it can't be overridden by ENV/config files
*/
interface GeneratedSessionParameters {
    _generatedUrl?: string;
}

/*
    This interface is the complete bundle that gets attached to the overall DB Schema and defines all available DB fields.
    It includes the public, config-powered properties as well as the private properties.
*/
export type SessionParametersDB = TemplateAndDBSessionParameters & GeneratedSessionParameters;


/////////////////////////
// BEYOND THE DATABASE //
/////////////////////////

/*
    We add a single field and override the DBSchema so we can work with Date objects directly.
    This would be a good place to add other such types - that can stored in the DB as a string but
    can be constructed to something more complex.
*/
export type SessionParametersWithSugar = SessionParametersDB & {
    date?: Date // The lack of this field indicates the Session intends to start immediately - aka probably an ad-hoc event
};

/*
    This is the interface that defines the available convenience methods associated with the DB Schema
*/
export interface ISessionView extends SessionDBSchema {
    sessionParameters: SessionParametersWithSugar; // Overriding so we can define more complex types than what is stored in the DB

    addToConfirmed(id: DraftUserId): void;
    removeFromConfirmed(id: DraftUserId): void;
    getNumConfirmed(): number;
    addToWaitlist(id: DraftUserId): void;
    removeFromWaitlist(id: DraftUserId): void;
    upgradedFromWaitlist(id: DraftUserId): void;
    getNumWaitlisted(): number;
}

export class ReadonlySessionView implements ISessionView {
    readonly schema;
    constructor(schema: SessionDBSchema) {
        this.schema = schema;
    }
    addToConfirmed(): void {
        throw new Error('READ-ONLY');
    }
    removeFromConfirmed(): void {
        throw new Error('READ-ONLY');
    }
    getNumConfirmed(): number {
        throw new Error('READ-ONLY');
    }
    addToWaitlist(): void {
        throw new Error('READ-ONLY');
    }
    removeFromWaitlist(): void {
        throw new Error('READ-ONLY');
    }
    upgradedFromWaitlist(): void {
        throw new Error('READ-ONLY');
    }
    getNumWaitlisted(): number {
        throw new Error('READ-ONLY');
    }
    get serverId(): string {
        return this.schema.serverId;
    }
    get sessionId(): string {
        return this.schema.sessionId;
    }
    get sessionParameters(): SessionParametersWithSugar {
        return this.schema.sessionParameters;
    }
    get joinedPlayerIds(): string[] {
        return this.schema.joinedPlayerIds;
    }
    get waitlistedPlayerIds(): string[] {
        return this.schema.waitlistedPlayerIds;
    }
    get sessionClosed(): boolean {
        return this.schema.sessionClosed;
    }
    get ownerId(): string|undefined {
        return this.schema.ownerId;
    }
}

/*
    This type is used to allow for additional parameters to be injected to templates when
    constructing a Session.  For now, we only inject the user id of the user who
    runs the start command (marking them as owner of the Session).
*/
export type SessionInjectedParameters = {
    ownerId: string
}
export type SessionConstructorParameter = Partial<SessionParametersWithSugar> & Partial<SessionInjectedParameters>;

// TODO: Come back to this later

// export type SessionTrigger = 'owner' | 'capacity' | 'date' | 'rolling';
// export type DisseminationStrategy = '' | 'fill' | 'fill_disband' | 'split';
