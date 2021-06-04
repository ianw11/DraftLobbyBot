import Substitute, { SubstituteOf, Arg } from "@fluffy-spoon/substitute";
import DraftServer from "../src/models/DraftServer";
import { DMChannel, User, Message, TextChannel, GuildMember } from "discord.js";
import DraftUser from "../src/models/DraftUser";
import ENV, { DEFAULTS, ShallowEnvRequiredFields } from "../src/env/EnvBase";
import Context from "../src/commands/models/Context";
import { IUserView } from "../src/database/UserDBSchema";
import { InMemoryUserView } from "../src/database/inmemory/InMemoryUserView";
import { Resolver, DiscordResolver } from "../src/models/types/ResolverTypes";
import { SessionConstructorParameter, SessionDBSchema, SessionParametersDB } from "../src/database/SessionDBSchema";
import Session from "../src/models/Session";
import { DraftUserId, SessionId } from "../src/models/types/BaseTypes";

/*
WARNING: THAR BE DRAGONS IN THIS FILE

It's super long and dense and there's a beforeEach() hiding in the weeds
and it even shows off what a generator function is.

The main thing to be aware of is setup() returns a MocksInterface and
this can be used in your tests to pre-fill mock data

This also exports a MocksConstants with hardcoded values that can be used
to help with validation. They are both exported a la carte and as a part
of the larger MocksInterface
*/

/////////////////////////
// TYPES AND CONSTANTS //
/////////////////////////

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

export interface MocksInterface {
    mockConstants: MocksConstants,
    mockSessionParameters: SessionConstructorParameter,
    mockSession: SubstituteOf<Session>,
    mockUserView: IUserView,
    mockDraftUser: DraftUser,
    mockResolver: SubstituteOf<Resolver>,
    mockAnnouncementChannel: SubstituteOf<TextChannel>,
    mockDiscordUser: SubstituteOf<User>,
    mockDmChannel: SubstituteOf<DMChannel>,
    mockMessage: SubstituteOf<Message>,
    userGenerator: () => SubstituteOf<DraftUser>,
    createMockUserView: () => IUserView,
    mockSessionDBSchema: SessionDBSchema
}

const INJECTED_PARAMS: ShallowEnvRequiredFields = {
    DISCORD_BOT_TOKEN: "MOCK DISCORD BOT TOKEN"
};

// The ENV object made available to tests

export const mockEnv: ENV = {...DEFAULTS, ...INJECTED_PARAMS, ...{log: (msg) => {
    logLines.push(msg);
    console.log(`[MOCKENV] [${logLines.length}] ${msg}`);
}}};

////////////////////
// TEST LIFECYCLE //
////////////////////

// These should be reset every single test
let builtMocks: MocksInterface;
let generatedUsers: {[key: string]: SubstituteOf<DraftUser>} = {};
let generatedDiscordUsers: {[key: string]: SubstituteOf<User>} = {};
let generatedGuildMembers: {[key: string]: SubstituteOf<GuildMember>} = {};
let logLines: string[] = [];

export {logLines};

// Execute before every test
beforeEach(() => {
    builtMocks = null;
    generatedUsers = {};
    generatedDiscordUsers = {};
    generatedGuildMembers = {};
    logLines = [];
});

///////////////////////////////////////////////////
// METHODS TO BUILD BOILERPLATE/TEMPLATE OBJECTS //
///////////////////////////////////////////////////

function buildUserView(_id?: string, nickname?: string): IUserView {
    const id = _id || `USER_VIEW_MOCK_${idGenerator.next().value}`;
    const {DISCORD_SERVER_ID, USERNAME} = mockConstants;
    buildMockDiscordUser(id, USERNAME, nickname);
    return new InMemoryUserView(DISCORD_SERVER_ID, id);
}

function buildMockDiscordUser(id: string, username: string, nickname?: string, tag?: string, bot?: boolean): SubstituteOf<User> {
    const user = Substitute.for<User>();
    user.id.returns(id);
    user.username.returns(username);
    user.tag.returns(tag ? tag : `${username}#0000`);
    user.bot.returns(bot || false);

    generatedDiscordUsers[id] = user;

    // If we make a Discord User we will want to ALSO make sure there is a corresponding Discord Guild Member
    buildMockDiscordGuildMember(id, nickname)

    return user;
}

function buildMockDiscordGuildMember(id: string, nickname?: string): SubstituteOf<GuildMember> {
    const member = Substitute.for<GuildMember>();
    member.id.returns(id);
    member.nickname.returns(nickname);

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

// This method is also exported!
export function buildContext(parameters: string[] = ["NO_PARAMS"]): Context {
    // Because this is exported, there's a chance the mocks haven't yet been built
    const mocks = builtMocks ?? setup();

    const draftServer = Substitute.for<DraftServer>();
    draftServer.resolver.returns(mocks.mockResolver);

    const message = Substitute.for<Message>();

    return new Context({
        env: mockEnv,
        draftServer: draftServer,
        user: mocks.mockDiscordUser,
        parameters: parameters,
        message: message});
}

///////////////////////
// GENERATOR MADNESS //
///////////////////////

function* _idGenerator(): Generator<number> {
    let id = 0;
    while (true) {
        yield id++;
    }
}
const idGenerator = _idGenerator();

/*
This is a generator function (identified as "function*") that will make
an unlimited amount of DraftUsers with always increasing ids.
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
const generateBasicUser = () => persistUser(basicUserGenerator.next().value as SubstituteOf<DraftUser>);
const generateCustomUser = () => persistUser(customUserGenerator.next().value as SubstituteOf<DraftUser>);

///////////////////////////////////
// THE MAIN METHOD WE CARE ABOUT //
///////////////////////////////////

export default function setup(): MocksInterface {
    if (builtMocks) {
        return builtMocks;
    }

    const {DISCORD_SERVER_ID, SESSION_ID, NUM_CONFIRMED, NUM_IN_WAITLIST, DISCORD_USER_ID, USERNAME, NICKNAME, TAG} = mockConstants;

    const mockResolver = Substitute.for<Resolver>();

    const mockSessionParameters: SessionConstructorParameter & SessionParametersDB = {
        name: 'MOCK SESSION',
        unownedSessionName: 'MOCK UNOWNED SESSION NAME',
        description: 'MOCK SESSION DESCRIPTION',
        fireWhenFull: false,
        sessionCapacity: 8,
        templateUrl: 'MOCK SESSION URL',
        ownerId: DISCORD_USER_ID,

        sessionConfirmMessage: 'MOCK CONFIRM MESSAGE',
        sessionWaitlistMessage: 'MOCK WAITLIST MESSAGE',
        sessionCancelMessage: 'MOCK CANCEL MESSAGE'
    };

    // Try to pre-fill this object as much as possible
    const mocks: MocksInterface = {
        // First export the convenience attributes
        mockConstants: mockConstants,
        userGenerator: () => generateBasicUser(),

        // Then prep the Session
        mockSessionParameters,
        mockSession: Substitute.for<Session>(),

        mockUserView: new InMemoryUserView(DISCORD_SERVER_ID, DISCORD_USER_ID),

        // A simple mock to get started
        mockDraftUser: generateCustomUser(),
        // Set up the mock for Discord User object backing our DraftUser
        mockDiscordUser: buildMockDiscordUser(DISCORD_USER_ID, USERNAME, NICKNAME, TAG),

        mockAnnouncementChannel: Substitute.for<TextChannel>(),

        // Set up the mock for the output channel (super helpful for validation)
        mockDmChannel: Substitute.for<DMChannel>(),

        // The message used to announce a draft
        mockMessage: Substitute.for<Message>(),

        mockResolver: mockResolver,

        createMockUserView: () => buildUserView(),

        mockSessionDBSchema: {
            serverId: "MOCK_DB_SERVER_ID",
            sessionId: "MOCK_DB_SESSION_ID",
            ownerId: "MOCK_DB_OWNER_ID",
            joinedPlayerIds: [],
            waitlistedPlayerIds: [],
            sessionClosed: false,
            sessionParameters: mockSessionParameters
        }
    };

    // With the main mocks done, hook up the overrides...

    // Finish out the Session object (pull it out and override everything)
    const {mockSession} = mocks;
    mockSession.sessionId.returns(SESSION_ID);
    mockSession.getNameAsync().mimicks(async () => mockSessionParameters.name);
    mockSession.setName(Arg.any()).mimicks(async name => { mockSessionParameters.name = name; });
    mockSession.getDescription().mimicks(() => mockSessionParameters.description);
    mockSession.setDescription(Arg.any()).mimicks(async description => { mockSessionParameters.description = description; });
    mockSession.setDate(Arg.any()).mimicks(async (date) => { mockSessionParameters.date = date; });
    mockSession.getFireWhenFull().mimicks(() => mockSessionParameters.fireWhenFull);
    mockSession.setFireWhenFull(Arg.any()).mimicks(async fire => { mockSessionParameters.fireWhenFull = fire; });
    mockSession.getSessionCapacity().mimicks(() => mockSessionParameters.sessionCapacity);
    mockSession.setSessionCapacity(Arg.any()).mimicks(async capacity => { mockSessionParameters.sessionCapacity = capacity; });
    mockSession.getNumConfirmed().returns(NUM_CONFIRMED);
    mockSession.getNumWaitlisted().returns(NUM_IN_WAITLIST);
    mockSession.getConfirmedMessage().resolves(mockSessionParameters.sessionConfirmMessage);
    mockSession.getWaitlistMessage().resolves(mockSessionParameters.sessionWaitlistMessage);
    mockSession.getCancelledMessage().resolves(mockSessionParameters.sessionCancelMessage);
    mockSession.setTemplateUrl(Arg.any()).mimicks(url => { mockSessionParameters.templateUrl = url; });
    mockSession.getWaitlistIndexOf(Arg.any()).mimicks(userId => userId === DISCORD_USER_ID ? 0 : 3);
    mockSession.toSimpleString().resolves("SIMPLE STRING");


    mockResolver.env.returns(mockEnv);
    mockResolver.resolveUser(Arg.any()).mimicks((userId: DraftUserId) => generatedUsers[userId]);
    mockResolver.resolveSession(Arg.any()).mimicks((sessionId: SessionId) => sessionId === SESSION_ID ? mockSession : null);

    const mockDiscordResolver = Substitute.for<DiscordResolver>();
    mockResolver.discordResolver.returns(mockDiscordResolver);
    mockDiscordResolver.resolveUser(Arg.any()).mimicks(id => generatedDiscordUsers[id]);
    mockDiscordResolver.resolveUserAsync(Arg.any()).mimicks(async id => generatedDiscordUsers[id]);
    mockDiscordResolver.resolveGuildMember(Arg.any()).mimicks(id => generatedGuildMembers[id]);
    mockDiscordResolver.resolveGuildMemberFromTag(Arg.any()).mimicks(id => generatedGuildMembers[id]);
    mockDiscordResolver.resolveMessageInAnnouncementChannel(Arg.any()).mimicks(async sessionId => sessionId === SESSION_ID ? mocks.mockMessage: undefined);
    mockDiscordResolver.resolveMessage(Arg.any(), Arg.any()).resolves(mocks.mockMessage);
    mockDiscordResolver.fetchGuildMember(Arg.any()).mimicks(async id => generatedGuildMembers[id]);

    
    // Attach the output DM channel to the Discord User
    mocks.mockDiscordUser.createDM().resolves(mocks.mockDmChannel);

    // Attach the message to the announcement channel
    mocks.mockAnnouncementChannel.send(Arg.any()).resolves(mocks.mockMessage);
    //mocks.mockAnnouncementChannel.send(Arg.is(arg => typeof arg === 'string')).resolves(mocks.mockMessage);

    const frozen = Object.freeze(mocks);
    builtMocks = frozen;
    return frozen;
}
