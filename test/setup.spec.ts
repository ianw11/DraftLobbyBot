import Substitute, { SubstituteOf, Arg } from "@fluffy-spoon/substitute";
import DraftServer from "../src/models/DraftServer";
import { DMChannel, User, Message, TextChannel, GuildMember } from "discord.js";
import DraftUser from "../src/models/DraftUser";
import ENV, { DEFAULTS, ShallowEnvRequiredFields } from "../src/env/EnvBase";
import Context from "../src/commands/models/Context";
import { IUserView } from "../src/database/UserDBSchema";
import { InMemoryUserView } from "../src/database/inmemory/InMemoryUserView";
import { Resolver, DiscordResolver } from "../src/models/types/ResolverTypes";
import { SessionConstructorParameter } from "../src/database/SessionDBSchema";
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
    mockResolver: Resolver,
    mockAnnouncementChannel: SubstituteOf<TextChannel>,
    mockDiscordUser: SubstituteOf<User>,
    mockDmChannel: SubstituteOf<DMChannel>,
    mockMessage: SubstituteOf<Message>,
    userGenerator: () => SubstituteOf<DraftUser>,
    createMockUserView: () => IUserView
}

const INJECTED_PARAMS: ShallowEnvRequiredFields = {
    DISCORD_BOT_TOKEN: "MOCK DISCORD BOT TOKEN"
};

// The ENV object made available to tests

export const mockEnv: ENV = {...DEFAULTS, ...INJECTED_PARAMS};

////////////////////
// TEST LIFECYCLE //
////////////////////

// These should be reset every single test
let builtMocks: MocksInterface;
let generatedUsers = {};
let generatedDiscordUsers = {};
let generatedGuildMembers = {};

// Execute before every test
beforeEach(() => {
    builtMocks = null;
    generatedUsers = {};
    generatedDiscordUsers = {};
    generatedGuildMembers = {};
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

function buildMockDiscordUser(id: string, username: string, nickname?: string, tag?: string): SubstituteOf<User> {
    const user = Substitute.for<User>();
    user.id.returns(id);
    user.username.returns(username);
    user.tag.returns(tag ? tag : `${username}#0000`);

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

// This method is also exported!
export function buildContext(parameters: string[] = ["NO_PARAMS"]): Context {
    const draftServer = Substitute.for<DraftServer>();
    const message = Substitute.for<Message>();
    return new Context({
        env: mockEnv,
        draftServer: draftServer,
        user: builtMocks.mockDiscordUser,
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
        const id = idGenerator.next();
        const userId = _userId ? _userId : `ID_BULK_USER_${id.value}`;
        draftUser.getUserId().returns(userId);
        const username = name ? name : `BULK_USER_${id}`;
        draftUser.getDisplayName().returns(username);

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

    // Try to pre-fill this object as much as possible
    const mocks: MocksInterface = {
        // First export the convenience attributes
        mockConstants: mockConstants,
        userGenerator: () => generateBasicUser(),

        // Then prep the Session
        mockSessionParameters: {
            name: 'MOCK SESSION',
            description: 'MOCK SESSION DESCRIPTION',
            fireWhenFull: false,
            sessionCapacity: 8,
            templateUrl: 'MOCK SESSION URL',
            ownerId: DISCORD_USER_ID,

            sessionConfirmMessage: 'MOCK CONFIRM MESSAGE',
            sessionWaitlistMessage: 'MOCK WAITLIST MESSAGE',
            sessionCancelMessage: 'MOCK CANCEL MESSAGE'
        },
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

        createMockUserView: () => buildUserView()
    };

    // With the main mocks done, hook up the overrides...

    // Finish out the Session object (pull it out and override everything)
    const {mockSession, mockSessionParameters} = mocks;
    mockSession.sessionId.returns(SESSION_ID);
    mockSession.getName().returns(mockSessionParameters.name);
    mockSession.getDescription().returns(mockSessionParameters.description);
    mockSession.getFireWhenFull().returns(mockSessionParameters.fireWhenFull);
    mockSession.getSessionCapacity().returns(mockSessionParameters.sessionCapacity);
    mockSession.getNumConfirmed().returns(NUM_CONFIRMED);
    mockSession.getNumWaitlisted().returns(NUM_IN_WAITLIST);
    mockSession.getConfirmedMessage().returns(mockSessionParameters.sessionConfirmMessage);
    mockSession.getWaitlistMessage().returns(mockSessionParameters.sessionWaitlistMessage);
    mockSession.getCancelledMessage().returns(mockSessionParameters.sessionCancelMessage);


    mockResolver.env.returns(mockEnv);
    mockResolver.resolveUser(Arg.any()).mimicks((userId: DraftUserId) => generatedUsers[userId]);
    mockResolver.resolveSession(Arg.any()).mimicks((sessionId: SessionId) => sessionId === SESSION_ID ? mockSession : null);

    const mockDiscordResolver = Substitute.for<DiscordResolver>();
    mockResolver.discordResolver.returns(mockDiscordResolver);
    mockDiscordResolver.resolveUser(Arg.any()).mimicks(id => generatedDiscordUsers[id]);
    mockDiscordResolver.resolveUserAsync(Arg.any()).mimicks(async id => generatedDiscordUsers[id]);
    mockDiscordResolver.resolveGuildMember(Arg.any()).mimicks(id => generatedGuildMembers[id]);
    mockDiscordResolver.resolveGuildMemberFromTag(Arg.any()).mimicks(id => generatedGuildMembers[id]);
    mockDiscordResolver.resolveMessageInAnnouncementChannel(Arg.any()).resolves(mocks.mockMessage);
    mockDiscordResolver.resolveMessage(Arg.any(), Arg.any()).resolves(mocks.mockMessage);

    
    // Attach the output DM channel to the Discord User
    mocks.mockDiscordUser.createDM().resolves(mocks.mockDmChannel);

    // Attach the message to the announcement channel
    mocks.mockAnnouncementChannel.send(Arg.any()).resolves(mocks.mockMessage);
    //mocks.mockAnnouncementChannel.send(Arg.is(arg => typeof arg === 'string')).resolves(mocks.mockMessage);

    const frozen = Object.freeze(mocks);
    builtMocks = frozen;
    return frozen;
}
