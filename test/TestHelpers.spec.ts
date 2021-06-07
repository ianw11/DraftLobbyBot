import Substitute, { Arg, SubstituteOf } from "@fluffy-spoon/substitute";
import { ChannelLogsQueryOptions, Collection, Guild, GuildChannel, GuildChannelManager, GuildMember, GuildMemberManager, Message, MessageManager, TextChannel, User, VoiceChannel } from "discord.js";
import { InMemoryUserView } from "../src/database/inmemory/InMemoryUserView";
import { ReadonlySessionView, SessionConstructorParameter, SessionParametersDB } from "../src/database/SessionDBSchema";
import { IUserView } from "../src/database/UserDBSchema";
import ENV, { DEFAULTS, ShallowEnvRequiredFields } from "../src/env/EnvBase";
import DraftUser from "../src/models/DraftUser";
import Session from "../src/models/Session";
import { DraftUserId, SessionId } from "../src/models/types/BaseTypes";
import { DiscordResolver, Resolver } from "../src/models/types/ResolverTypes";

export interface MocksConstants {
    DISCORD_SERVER_ID: string,
    DISCORD_USER_ID: string,
    USERNAME: string,
    NICKNAME: string,
    TAG: string,
    SESSION_ID: string,
    NUM_CONFIRMED: number,
    NUM_IN_WAITLIST: number,
    MOCK_HEROKU_SESSION_ID: string
}
// Export the constants
export const mockConstants: MocksConstants = {
    DISCORD_SERVER_ID: 'TEST SERVER ID',
    DISCORD_USER_ID: 'TEST DISCORD USER ID',
    USERNAME: 'TEST USERNAME',
    NICKNAME: 'TEST NICKNAME',
    TAG: 'TEST#0000',
    SESSION_ID: 'TEST SESSION ID',
    NUM_CONFIRMED: 5,
    NUM_IN_WAITLIST: 3,
    MOCK_HEROKU_SESSION_ID: "MOCK_HEROKU_SESSION_ID"
}

// The ENV object made available to tests

let logLines: string[] = [];
const INJECTED_PARAMS: ShallowEnvRequiredFields = {
    DISCORD_BOT_TOKEN: "MOCK DISCORD BOT TOKEN"
};
function mockLog() {
    return (msg: string): void => {
        logLines.push(msg);
        console.log(`[MOCKENV] [${logLines.length}] ${msg}]`);
    };
}

export const mockEnv: ENV = {...DEFAULTS, ...INJECTED_PARAMS, ...{log: mockLog()}};

export function getLogLines(): string[] {
    return logLines;
}

export function resetLogLines(): void {
    logLines = [];
}


//////////////////////////////////////////////////////
// From here on, it's the madness of creating mocks //
//////////////////////////////////////////////////////


const generatedUsers: {[key: string]: SubstituteOf<DraftUser>} = {};
const generatedDiscordUsers: {[key: string]: SubstituteOf<User>} = {};
const generatedGuildMembers: {[key: string]: SubstituteOf<GuildMember>} = {};
const generatedSessions: {[key: string]: SubstituteOf<Session>} = {};

/* Originally included in beforeEach(), this probably shouldn't have to be turned on anymore.
export function resetMocks(): void {
    generatedUsers = {};
    generatedDiscordUsers = {};
    generatedGuildMembers = {}
    generatedSessions = {};
    resetLogLines();
}
*/

// Returns an infinite number of always-increasing numbers
const idGenerator: Generator<number> = (function* () {
    let id = 0;
    while (true) {
        yield id++;
    }
})();

/*
This is a generator function (identified as "function*") that will make
an unlimited amount of DraftUsers with always-increasing ids.
*/
function* uniqueUserGenerator(_userId?: DraftUserId, name?: string, nickname?: string): Generator<SubstituteOf<DraftUser>> {
    while (true) {
        const draftUser: SubstituteOf<DraftUser> = Substitute.for<DraftUser>();
        const id = idGenerator.next().value;
        const userId = _userId ? _userId : `ID_BULK_USER_${id}`;
        draftUser.getUserId().returns(userId);
        const username = name ? name : `BULK_USER_${id}`;
        draftUser.getDisplayName().returns(username);
        draftUser.getDisplayNameAsync().resolves(username);

        // Apparently Substitute doesn't mock properties, so we must explicitly do that here

        let createdSessionId: SessionId;
        draftUser.setCreatedSessionId(Arg.any()).mimicks((newId) => createdSessionId = newId);
        draftUser.getCreatedSessionId().mimicks(() => createdSessionId);

        // Finally if we create a user we'd better also create a backing Discord User
        buildMockDiscordUser(userId, username, nickname);

        yield draftUser;
    }
}

function persistUser(draftUser: SubstituteOf<DraftUser>): SubstituteOf<DraftUser> {
    const userId = draftUser.getUserId();
    generatedUsers[userId] = draftUser;
    return draftUser;
}

// We then take the user generator function and create 2 generators (one with overrides)
const basicUserGenerator = uniqueUserGenerator();
const customUserGenerator = uniqueUserGenerator(mockConstants.DISCORD_USER_ID, mockConstants.USERNAME, mockConstants.NICKNAME);

// The generators are then wrapped in a persistance function and made available to test runners
export const generateBasicUser = (): SubstituteOf<DraftUser> => persistUser(basicUserGenerator.next().value as SubstituteOf<DraftUser>);
export const generateCustomUser = (): SubstituteOf<DraftUser> => persistUser(customUserGenerator.next().value as SubstituteOf<DraftUser>);

export function getExistingMockUser(id: DraftUserId): SubstituteOf<DraftUser> | undefined {
    return generatedUsers[id];
}

export function buildMockDiscordUser(id: string, username: string, nickname?: string, tag?: string, bot?: boolean): SubstituteOf<User> {
    const user = Substitute.for<User>();
    user.id.returns(id);
    user.username.returns(username);
    user.tag.returns(tag ? tag : `${username}#0000`);
    user.bot.returns(bot || false);

    generatedDiscordUsers[id] = user;

    // If we make a Discord User we will want to ALSO make sure there is a corresponding Discord Guild Member
    buildMockDiscordGuildMember(id, {nickname, tag, attachedUser: user});

    return user;
}

export type MockDiscordGuildMemberParams = {
    attachedUser?: SubstituteOf<User>;
    nickname?: string;
    tag?: string;
};
export function buildMockDiscordGuildMember(id: string, params: MockDiscordGuildMemberParams = {}): SubstituteOf<GuildMember> {
    const member = Substitute.for<GuildMember>();
    member.id.returns(id);
    member.nickname.returns(params.nickname);

    if (params.attachedUser) {
        member.user.returns(params.attachedUser);
    } else {
        const mockUser: SubstituteOf<User> = Substitute.for<User>();
        member.user.returns(mockUser);
        mockUser.tag.returns(params.tag ?? "");
    }

    generatedGuildMembers[id] = member;

    return member;
}


export function turnMockDiscordUserIntoBot(id: string): SubstituteOf<User> {
    const oldUser = generatedDiscordUsers[id];
    if (!oldUser) {
        throw new Error(`Id ${id} doesn't exist in generatedDiscordUsers`);
    }
    const oldGuildMember = generatedGuildMembers[id];

    return buildMockDiscordUser(oldUser.id, oldUser.username, oldGuildMember.nickname, oldUser.tag, true);
}



export function buildMockUserView(_id?: string, nickname?: string): IUserView {
    const id = _id || `USER_VIEW_MOCK_${idGenerator.next().value}`;
    const {DISCORD_SERVER_ID, USERNAME} = mockConstants;
    buildMockDiscordUser(id, USERNAME, nickname);
    return new InMemoryUserView(DISCORD_SERVER_ID, id);
}

export function buildMockDiscordResolver(mockMessage: SubstituteOf<Message>, announcementChannel?: TextChannel): DiscordResolver {
    const resolver = Substitute.for<DiscordResolver>();

    resolver.resolveUser(Arg.any('string')).mimicks(id => generatedDiscordUsers[id]);
    resolver.resolveUserAsync(Arg.any()).mimicks(async id => generatedDiscordUsers[id]);
    resolver.resolveGuildMember(Arg.any()).mimicks(id => generatedGuildMembers[id]);
    resolver.resolveGuildMemberFromTag(Arg.any()).mimicks(id => generatedGuildMembers[id]);
    resolver.resolveMessageInAnnouncementChannel(Arg.any()).mimicks(async sessionId => sessionId === mockConstants.SESSION_ID ? mockMessage: undefined);
    resolver.resolveMessage(Arg.any(), Arg.any()).resolves(mockMessage);
    resolver.fetchGuildMember(Arg.any()).mimicks(async id => generatedGuildMembers[id]);
    const mockGuild = Substitute.for<Guild>();
    resolver.guild.returns(mockGuild);
    mockGuild.id.returns(mockConstants.DISCORD_SERVER_ID);

    resolver.announcementChannel.returns(announcementChannel);

    return resolver;
}

export type MockGuildParams = {
    channel: SubstituteOf<TextChannel>;
    message: SubstituteOf<Message>;
    includedMember?: SubstituteOf<User>;

    forceFetch?: boolean;
    announcementChannelMissingFromCache?: boolean;
    resolveNonTextChannel?: 'voice'|'none';
};
export function buildMockGuild(params: MockGuildParams): [SubstituteOf<Guild>, SubstituteOf<GuildMember>[]] {
    const guild = Substitute.for<Guild>();

    const mockGuildMembers: SubstituteOf<GuildMember>[] = [];
    for (let i = 0; i < 5; ++i) {
        const suffix = idGenerator.next().value;
        const mockGuildMember = buildMockDiscordGuildMember(`ID_BULK_GUILD_MEMBER_${suffix}`, {
            nickname: `NICKNAME_${suffix}`,
            tag: (i === 0) ? mockConstants.TAG : ''
        });
        mockGuildMembers.push(mockGuildMember);
    }
    if (params.includedMember) {
        mockGuildMembers.push(generatedGuildMembers[params.includedMember.id]);
    }

    const mockGuildMemberCollection = Substitute.for<Collection<string, GuildMember>>();
    mockGuildMemberCollection.each(Arg.any()).mimicks(callback => {
        mockGuildMembers.forEach(cacheMember => {
            callback(cacheMember, "GUILDMEMBERKEY", mockGuildMemberCollection);
        });

        return mockGuildMemberCollection;
    });

    const mockGuildMemberManager = Substitute.for<GuildMemberManager>();
    mockGuildMemberManager.cache.returns(mockGuildMemberCollection);
    mockGuildMemberManager.fetch(Arg.any('string')).mimicks(async userId => {
        return mockGuildMembers.find(member => member.id === userId);
    });
    mockGuildMemberManager.resolve(Arg.any('string')).mimicks(userId => {
        return mockGuildMembers.find(member => member.id === userId);
    });


    const mockGuildChannelCollection = Substitute.for<Collection<string, GuildChannel>>();
    mockGuildChannelCollection.each(Arg.any()).mimicks(callback => {
        callback(buildMockAnnouncementChannel({ announcementMessage: buildMockMessage('NEVER_USE_THIS'), channelName: "ILLEGAL CHANNEL NAME" }), "NEVER_USE_THIS", mockGuildChannelCollection);
        callback(Substitute.for<VoiceChannel>(), "NEVER_USE_THIS", mockGuildChannelCollection);
        if (!params.announcementChannelMissingFromCache) {
            callback(params.channel, "CHANNELKEY", mockGuildChannelCollection);
        }
        return mockGuildChannelCollection;
    });
    
    const mockGuildChannels = Substitute.for<GuildChannelManager>();
    mockGuildChannels.resolve(Arg.any('string')).mimicks(() => {
        if (params.resolveNonTextChannel === 'voice') {
            const voiceChannel = Substitute.for<VoiceChannel>();
            voiceChannel.type.returns('voice');
            return voiceChannel;
        } else if (params.resolveNonTextChannel === 'none') {
            return;
        }
        if (!params.announcementChannelMissingFromCache) {
            return params.channel;
        }
    });
    mockGuildChannels.cache.returns(mockGuildChannelCollection);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    mockGuildChannels.create(Arg.any('string')).mimicks((_name: string) => {
        return new Promise(res => {
            res(params.channel);
        });
    });


    const mockGuildMessages = Substitute.for<MessageManager>();
    mockGuildMessages.resolve(Arg.any('string')).mimicks(() => {
        if (!params.forceFetch) {
            return params.message;
        }
    });
    mockGuildMessages.fetch(Arg.is<ChannelLogsQueryOptions>(() => true)).mimicks(async (options?: ChannelLogsQueryOptions): Promise<Collection<string, Message>> => {
        const collection = Substitute.for<Collection<string, Message>>();
        collection.get(Arg.is(id => id === options.around)).returns(params.message);
        return collection;
    });


    guild.members.returns(mockGuildMemberManager);
    guild.channels.returns(mockGuildChannels);

    return [guild, mockGuildMembers];
}

export function buildMockMessage(messageId: SessionId): SubstituteOf<Message> {
    const message = Substitute.for<Message>();

    message.id.returns(messageId);
    message.react(Arg.any('string')).resolves(undefined);

    // You need to attach the channel yourself.

    return message;
}

export type mockAnnouncementChannelParams = {
    forceFetch?: boolean;
    announcementMessage: SubstituteOf<Message>;
    channelName?: string;
}
export function buildMockAnnouncementChannel(params: mockAnnouncementChannelParams): SubstituteOf<TextChannel> {
    const channel = Substitute.for<TextChannel>();

    // For some odd reason, we now HAVE to define 'undefined' as a parameter
    channel.send(Arg.any('string'), Arg.any('undefined')).resolves(params.announcementMessage);
    channel.name.returns(params.channelName ?? mockEnv.DRAFT_CHANNEL_NAME);
    channel.type.returns('text');
    channel.id.returns('ANNOUNCEMENT_CHANNEL_ID');

    const messageManager = Substitute.for<MessageManager>();
    channel.messages.returns(messageManager);
    messageManager.resolve(Arg.any('string')).mimicks(() => {
        if (!params.forceFetch) {
            return params.announcementMessage;
        }
    });
    const messageCollection = Substitute.for<Collection<string, Message>>();
    messageManager.fetch(Arg.is<ChannelLogsQueryOptions>((x)=>x.around === params.announcementMessage.id)).resolves(messageCollection);
    messageCollection.get(Arg.any('string')).returns(params.announcementMessage);

    return channel;
}

export type TESTSession = SubstituteOf<Session> & {test_isSessionClosed?(): boolean};
export type AdditionalMockSessionOverrides = Partial<{
    overrideSessionId: string,
    resolver: Resolver,
    unownedSession: boolean
}>;
export function buildMockSession(overrideSessionParameters: Partial<SessionConstructorParameter & SessionParametersDB> = {}, additionalOverrides?: AdditionalMockSessionOverrides): [TESTSession, SessionConstructorParameter & SessionParametersDB] {
    const sessionParameters = {...{
        name: 'MOCK SESSION',
        unownedSessionName: 'MOCK UNOWNED SESSION NAME',
        description: 'MOCK SESSION DESCRIPTION',
        fireWhenFull: false,
        sessionCapacity: 8,
        templateUrl: 'MOCK SESSION URL',
        ownerId: additionalOverrides?.unownedSession ? '' : mockConstants.DISCORD_USER_ID,

        sessionConfirmMessage: 'MOCK CONFIRM MESSAGE',
        sessionWaitlistMessage: 'MOCK WAITLIST MESSAGE',
        sessionCancelMessage: 'MOCK CANCEL MESSAGE'
    }, ...overrideSessionParameters};

    const session = Substitute.for<TESTSession>();
    const sessionId = additionalOverrides?.overrideSessionId ?? `ID_BULK_SESSION_${idGenerator.next().value}`;

    let sessionClosed = false;

    session.sessionId.returns(sessionId);
    session.ownerId.mimicks(() => sessionParameters.ownerId);
    session.getNameAsync().mimicks(async () => sessionParameters.name);
    session.setName(Arg.any()).mimicks(async name => { sessionParameters.name = name; });
    session.getDescription().mimicks(() => sessionParameters.description);
    session.setDescription(Arg.any()).mimicks(async description => { sessionParameters.description = description; });
    session.setDate(Arg.any()).mimicks(async (date) => { sessionParameters.date = date; });
    session.getFireWhenFull().mimicks(() => sessionParameters.fireWhenFull);
    session.setFireWhenFull(Arg.any()).mimicks(async fire => { sessionParameters.fireWhenFull = fire; });
    session.getSessionCapacity().mimicks(() => sessionParameters.sessionCapacity);
    session.setSessionCapacity(Arg.any()).mimicks(async capacity => { sessionParameters.sessionCapacity = capacity; });
    session.getNumConfirmed().returns(mockConstants.NUM_CONFIRMED);
    session.getNumWaitlisted().returns(mockConstants.NUM_IN_WAITLIST);
    session.getConfirmedMessage().resolves(sessionParameters.sessionConfirmMessage);
    session.getWaitlistMessage().resolves(sessionParameters.sessionWaitlistMessage);
    session.getCancelledMessage().resolves(sessionParameters.sessionCancelMessage);
    session.setTemplateUrl(Arg.any()).mimicks(url => { sessionParameters.templateUrl = url; });
    session.getWaitlistIndexOf(Arg.any()).mimicks(userId => userId === mockConstants.DISCORD_USER_ID ? 0 : 3);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    session.terminate(Arg.any('boolean')).mimicks(async (_started?: boolean) => {
        sessionClosed = true;
    });

    // This probably isn't necessary but it's one way to 
    session.toSimpleString().mimicks(() => {
        const passthrough = new Session(new ReadonlySessionView({
            serverId: mockConstants.DISCORD_SERVER_ID,
            sessionId: sessionId,
            ownerId: sessionParameters.ownerId,
            joinedPlayerIds: [],
            waitlistedPlayerIds: [],
            sessionParameters: sessionParameters,
            sessionClosed
        }), additionalOverrides.resolver);

        return passthrough.toSimpleString();
    });

    generatedSessions[sessionId] = session;

    // Extend the object to include a helpful method (to view inner material)
    session.test_isSessionClosed().mimicks(() => sessionClosed);

    return [session, sessionParameters];
}

export function getExistingMockSession(sessionId: SessionId): SubstituteOf<Session> | undefined {
    return generatedSessions[sessionId];
}
