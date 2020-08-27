export type SessionId = string;

export interface SessionParameters {
    name: string;
    sessionCapacity: number;
    description: string;
    date?: Date; // The lack of this field indicates the Session intends to start immediately - aka probably an ad-hoc draft
    fireWhenFull: boolean; // Or should we wait for the Session owner to run the StartCommand
    url?: string; // The lack of this field indicates we default to the heroku app url
}

export type SessionConstructorParameter = Partial<SessionParameters> & {ownerId?: string};
