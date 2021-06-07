import Substitute, { SubstituteOf, Arg } from "@fluffy-spoon/substitute";
import DraftServer from "../src/models/DraftServer";
import { DMChannel, User, Message, TextChannel } from "discord.js";
import DraftUser from "../src/models/DraftUser";
import Context from "../src/commands/models/Context";
import { IUserView } from "../src/database/UserDBSchema";
import { InMemoryUserView } from "../src/database/inmemory/InMemoryUserView";
import { Resolver, DiscordResolver } from "../src/models/types/ResolverTypes";
import { SessionConstructorParameter, SessionDBSchema } from "../src/database/SessionDBSchema";
import Session from "../src/models/Session";
import { DraftUserId } from "../src/models/types/BaseTypes";
import { DBDriver } from "../src/database/DBDriver";
import { buildDiscordResolver, buildMessage, buildMockDiscordUser, buildSession, buildUserView, generateBasicUser, generateCustomUser, getExistingSession, getExistingUser, mockConstants, mockEnv, MocksConstants, resetLogLines } from "./TestHelpers.spec";

/*
WARNING: THAR BE DRAGONS IN THIS FILE

It's super long and dense and there's a beforeEach() hiding in the weeds
and it even shows off what a generator function is.

The main thing to be aware of is setup() returns a MocksInterface and
this can be used in your tests to pre-fill mock data

This also exports a MocksConstants with hardcoded values that can be used
to help with validation. They are both exported a la carte and as a part
of the larger MocksInterface
Along the same lines, an ENV is also exported.

Other exports are:
- logLines == catches all lines passed to env.log
- buildContext() == builds a context (useful for testing Commands)
- turnMockDiscordUserIntoBot() == as the name suggests, this can be used to mark a user
    created by userGenerator() as (bot == true)
*/

/////////////////////////
// TYPES AND CONSTANTS //
/////////////////////////

export interface MocksInterface {
    mockConstants: MocksConstants,
    mockSessionParameters: SessionConstructorParameter,
    mockSession: SubstituteOf<Session>,
    mockUserView: IUserView,
    mockDraftUser: DraftUser,
    mockResolver: SubstituteOf<Resolver>,
    mockDiscordResolver: SubstituteOf<DiscordResolver>,
    mockDBDriver: SubstituteOf<DBDriver>,
    mockAnnouncementChannel: SubstituteOf<TextChannel>,
    mockDiscordUser: SubstituteOf<User>,
    mockDmChannel: SubstituteOf<DMChannel>,
    mockMessage: SubstituteOf<Message>,
    userGenerator: () => SubstituteOf<DraftUser>,
    createMockUserView: () => IUserView,
    mockSessionDBSchema: SessionDBSchema
}

////////////////////
// TEST LIFECYCLE //
////////////////////

// These should be reset every single test
let builtMocks: MocksInterface;

// Execute before every test
beforeEach(() => {
    builtMocks = null;
    resetLogLines();
});

export function buildContext(parameters: string[] = ["NO_PARAMS"]): Context {
    const mocks = setup();

    const draftServer = Substitute.for<DraftServer>();
    draftServer.resolver.returns(mocks.mockResolver);

    return new Context({
        env: mockEnv,
        draftServer: draftServer,
        user: mocks.mockDiscordUser,
        parameters: parameters});
}

///////////////////////////////////
// THE MAIN METHOD WE CARE ABOUT //
///////////////////////////////////

export default function setup(forceRegeneration = false): MocksInterface {
    // If we are not trying to force a regeneration of the data
    // AND we have already built an instance
    // then re-use the previous instance
    if (!forceRegeneration && builtMocks) {
        return builtMocks;
    }

    const {DISCORD_SERVER_ID, SESSION_ID, DISCORD_USER_ID, USERNAME, NICKNAME, TAG} = mockConstants;

    const mockResolver = Substitute.for<Resolver>();
    const [mockSession, mockSessionParameters] = buildSession({}, {overrideSessionId: SESSION_ID, resolver: mockResolver});

    const mockAnnouncementChannel = Substitute.for<TextChannel>();
    const mockMessage = buildMessage(SESSION_ID, mockAnnouncementChannel);
 
    // Try to pre-fill this object as much as possible
    const mocks: MocksInterface = {
        // First export the convenience attributes
        mockConstants: mockConstants,
        userGenerator: generateBasicUser,

        // Then prep the Session
        mockSessionParameters,
        mockSession,

        mockUserView: new InMemoryUserView(DISCORD_SERVER_ID, DISCORD_USER_ID),

        // A simple mock to get started
        mockDraftUser: generateCustomUser(),
        // Set up the mock for Discord User object backing our DraftUser
        mockDiscordUser: buildMockDiscordUser(DISCORD_USER_ID, USERNAME, NICKNAME, TAG),

        mockAnnouncementChannel,

        // Set up the mock for the output channel (super helpful for validation)
        mockDmChannel: Substitute.for<DMChannel>(),

        // The message used to announce a draft
        mockMessage,

        mockResolver,
        mockDiscordResolver: Substitute.for<DiscordResolver>(),
        mockDBDriver: Substitute.for<DBDriver>(),

        createMockUserView: buildUserView,

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

    const {mockDBDriver, mockDiscordUser, mockDmChannel} = mocks;
    
    // For some odd reason, we now HAVE to define 'undefined' as a parameter
    mockAnnouncementChannel.send(Arg.any('string'), Arg.any('undefined')).resolves(mockMessage);

    mockResolver.env.returns(mockEnv);
    mockResolver.resolveUser(Arg.any()).mimicks((userId: DraftUserId) => getExistingUser(userId));
    mockResolver.resolveSession(Arg.any('string')).mimicks((sessionId) => getExistingSession(sessionId));
    mockResolver.discordResolver.returns(buildDiscordResolver(mockMessage, mockAnnouncementChannel));
    // Setup the DB Driver
    mockResolver.dbDriver.returns(mockDBDriver);
    mockDBDriver.createSession(Arg.all()).returns(undefined);
    
    // Attach the output DM channel to the Discord User
    mockDiscordUser.createDM().resolves(mockDmChannel);

    const frozen = Object.freeze(mocks);
    builtMocks = frozen;
    return frozen;
}
