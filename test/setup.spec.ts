import Substitute, { SubstituteOf, Arg } from "@fluffy-spoon/substitute";
import DraftServer from "../src/models/DraftServer";
import { DMChannel, User, Message, Client, TextChannel } from "discord.js";
import DraftUser from "../src/models/DraftUser";
import ENV, {DEFAULTS} from "../src/env/EnvBase";
import Context from "../src/commands/models/Context";
import { IUserView } from "../src/database/UserDBSchema";
import { InMemoryUserView } from "../src/database/inmemory/InMemoryUserView";
import { DataResolver, DiscordResolver } from "../src/models/types/ResolverTypes";
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
    DISCORD_USER_ID: string,
    USERNAME: string,
    SESSION_ID: string,
    NUM_CONFIRMED: number,
    NUM_IN_WAITLIST: number,
    MOCK_HEROKU_SESSION_ID: string
}
// Export the constants
export const mockConstants: MocksConstants = {
    DISCORD_USER_ID: 'TEST DISCORD USER ID',
    USERNAME: 'TEST USERNAME',
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
    mockDataResolver: DataResolver,
    mockAnnouncementChannel: SubstituteOf<TextChannel>,
    mockDiscordUser: SubstituteOf<User>,
    mockDmChannel: SubstituteOf<DMChannel>,
    mockMessage: SubstituteOf<Message>,
    userGenerator: () => SubstituteOf<DraftUser>
}

export const mockEnv: ENV = {...DEFAULTS, ...{
    DISCORD_BOT_TOKEN: "MOCK DISCORD BOT TOKEN"
}};

////////////////////
// TEST LIFECYCLE //
////////////////////

// These should be reset every single test
let builtMocks: MocksInterface;
let generatedUsers = {};
let generatedDiscordUsers = {};

// Execute before every test
beforeEach(() => {
    builtMocks = null;
    generatedUsers = {};
    generatedDiscordUsers = {};
});

///////////////////////////////////////////////////
// METHODS TO BUILD BOILERPLATE/TEMPLATE OBJECTS //
///////////////////////////////////////////////////

function buildMockDiscordUser(id: string, username: string): SubstituteOf<User> {
    const user = Substitute.for<User>();
    user.id.returns(id);
    user.username.returns(username);

    generatedDiscordUsers[id] = user;
    return user;
}

// This method is also exported!
export function buildContext(parameters: string[] = ["NO_PARAMS"]): Context {
    const client = Substitute.for<Client>();
    const draftServer = Substitute.for<DraftServer>();
    const message = Substitute.for<Message>();
    return new Context({
        env: mockEnv,
        client: client,
        draftServer: draftServer,
        user: builtMocks.mockDiscordUser,
        parameters: parameters,
        message: message});
}

///////////////////////
// GENERATOR MADNESS //
///////////////////////

/*
This is a generator function (identified as "function*") that will make
an unlimited amount of DraftUsers with always increasing ids.
*/
function* uniqueUserGenerator(userId?: DraftUserId, name?: string): Generator<SubstituteOf<DraftUser>> {
    let id = 0;
    while (true) {
        const draftUser: SubstituteOf<DraftUser> = Substitute.for<DraftUser>();
        draftUser.getUserId().returns(userId ? userId : `ID_BULK_USER_${id}`);
        draftUser.getDisplayName().returns(name ? name : `BULK_USER_${id}`);

        // Apparently Substitute doesn't mock properties, so we must explicitly do that here

        let createdSessionId;
        draftUser.setCreatedSessionId(Arg.any()).mimicks((newId) => createdSessionId = newId);
        draftUser.getCreatedSessionId().mimicks(() => createdSessionId);

        ++id;
        yield draftUser;
    }
}

function persistUser(draftUser: SubstituteOf<DraftUser>): SubstituteOf<DraftUser> {
    const userId = draftUser.getUserId();

    // Build a backing discord user
    buildMockDiscordUser(userId, `DISCORD_USER_${userId}`);

    generatedUsers[userId] = draftUser;
    return draftUser;
}

// We then take the user generator function and create 2 generators (one with overrides)
const basicUserGenerator = uniqueUserGenerator();
const customUserGenerator = uniqueUserGenerator(mockConstants.DISCORD_USER_ID, mockConstants.USERNAME);
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

    const {SESSION_ID, NUM_CONFIRMED, NUM_IN_WAITLIST, DISCORD_USER_ID, USERNAME} = mockConstants;

    const mockDataResolver = Substitute.for<DataResolver>();

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

        mockUserView: new InMemoryUserView(DISCORD_USER_ID),

        // A simple mock to get started
        mockDraftUser: generateCustomUser(),
        // Set up the mock for Discord User object backing our DraftUser
        mockDiscordUser: buildMockDiscordUser(DISCORD_USER_ID, USERNAME),

        mockAnnouncementChannel: Substitute.for<TextChannel>(),

        // Set up the mock for the output channel (super helpful for validation)
        mockDmChannel: Substitute.for<DMChannel>(),

        // The message used to announce a draft
        mockMessage: Substitute.for<Message>(),

        mockDataResolver: mockDataResolver
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


    mockDataResolver.env.returns(mockEnv);
    mockDataResolver.resolveUser(Arg.any()).mimicks((userId: DraftUserId) => generatedUsers[userId]);
    mockDataResolver.resolveSession(Arg.any()).mimicks((sessionId: SessionId) => sessionId === SESSION_ID ? mockSession : null);

    const mockDiscordResolver = Substitute.for<DiscordResolver>();
    mockDataResolver.discordResolver.returns(mockDiscordResolver);
    mockDiscordResolver.resolveUser(Arg.any()).returns(mocks.mockDiscordUser);
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
