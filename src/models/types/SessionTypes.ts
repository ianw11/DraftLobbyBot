export type SessionId = string;

export interface TemplateSessionParameters {
    name: string;
    unownedSessionName: string;
    sessionCapacity: number;
    description: string;
    fireWhenFull: boolean; // Or should we wait for the Session owner to run the StartCommand

    sessionConfirmMessage: string;
    sessionWaitlistMessage: string;
    sessionCancelMessage: string;
    templateUrl: string;

    date? : Date; // The lack of this field indicates the Session intends to start immediately - aka probably an ad-hoc event
}

interface GeneratedSessionParameters {
    _generatedUrl?: string;
    _generatedName?: string;
}

export type SessionParameters = TemplateSessionParameters & GeneratedSessionParameters;

export type SessionConstructorParameter = Partial<SessionParameters> & {
    ownerId?: string
};

// TODO: Come back to this later

// export type SessionTrigger = 'owner' | 'capacity' | 'date' | 'rolling';
// export type DisseminationStrategy = '' | 'fill' | 'fill_disband' | 'split';


