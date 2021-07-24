import Substitute, { SubstituteOf, Arg } from "@fluffy-spoon/substitute";
import DraftServer from "../src/models/DraftServer";
import { DMChannel, User, Message, TextChannel, Guild, GuildMember, Snowflake } from "discord.js";
import DraftUser from "../src/models/DraftUser";
import Context from "../src/commands/models/Context";
import { IUserView } from "../src/database/UserDBSchema";
import { InMemoryUserView } from "../src/database/inmemory/InMemoryUserView";
import { Resolver, DiscordResolver } from "../src/models/types/ResolverTypes";
import { ISessionView, SessionConstructorParameter, SessionDBSchema, SessionParametersWithSugar } from "../src/database/SessionDBSchema";
import { DraftUserId } from "../src/models/types/BaseTypes";
import { DBDriver } from "../src/database/DBDriver";
import { buildMockAnnouncementChannel, buildMockDiscordResolver, buildMockDiscordUser, buildMockGuild, buildMockMessage, buildMockServer, buildMockSession, buildMockUserView, generateBasicUser, generateCustomUser, getExistingMockSession, getExistingMockUser, mockConstants, mockEnv, MocksConstants, resetLogLines, TESTSession } from "./TestHelpers.spec";
import { Dependencies } from "../src/models/Dependencies";
import SessionTemplateCache from "../src/models/SessionTemplateCache";

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
    mockSession: TESTSession,
    mockUserView: IUserView,
    mockDraftUser: SubstituteOf<DraftUser>,
    mockResolver: SubstituteOf<Resolver>,
    mockDiscordResolver: SubstituteOf<DiscordResolver>,
    mockDBDriver: SubstituteOf<DBDriver>,
    mockAnnouncementChannel: SubstituteOf<TextChannel>,
    mockDiscordUser: SubstituteOf<User>,
    mockDmChannel: SubstituteOf<DMChannel>,
    mockMessage: SubstituteOf<Message>,
    mockGuild: SubstituteOf<Guild>,
    mockGuildMembers: SubstituteOf<GuildMember>[],
    userGenerator: () => SubstituteOf<DraftUser>,
    createMockUserView: () => IUserView,
    mockSessionDBSchema: SessionDBSchema,
    mockServer: SubstituteOf<DraftServer>,
    mockSessionCreationTemplate: SubstituteOf<SessionParametersWithSugar>
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

export type MockContextArgs = {
    draftUser?: SubstituteOf<DraftUser>;
    server?: SubstituteOf<DraftServer>;
};
export function buildContext(parameters = "", additionalParams?: MockContextArgs): Context {
    const mocks = setup();

    const context = Substitute.for<Context>();
    context.env.returns(mockEnv);
    context.draftServer.returns(additionalParams?.server ?? mocks.mockServer),
    context.parameters.returns(parameters === '' ? [] : parameters.split(" "));
    context.draftUser.returns(additionalParams?.draftUser ?? mocks.mockDraftUser);
    context.resolver.returns(mocks.mockResolver);
    return context;
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

    const {DISCORD_SERVER_ID, SESSION_ID, DISCORD_USER_ID, USERNAME, NICKNAME, TAG, SESSION_CREATION_TEMPLATE_NAME} = mockConstants;

    const mockDBDriver = Substitute.for<DBDriver>();
    mockDBDriver.getSessionView(Arg.all()).mimicks((serverId, sessionId) =>  {
        const view = Substitute.for<ISessionView>();
        view.serverId.returns(serverId);
        view.sessionId.returns(sessionId);
        return view;
    });

    const mockMessage = buildMockMessage(SESSION_ID);
    const mockAnnouncementChannel = buildMockAnnouncementChannel({announcementMessage: mockMessage});
    mockMessage.channel.returns(mockAnnouncementChannel);

    const mockResolver = Substitute.for<Resolver>();
    mockResolver.env.returns(mockEnv);
    mockResolver.resolveUser(Arg.any()).mimicks((userId: DraftUserId) => getExistingMockUser(userId));
    mockResolver.resolveSession(Arg.any()).mimicks((sessionId) => getExistingMockSession(sessionId));
    mockResolver.discordResolver.returns(buildMockDiscordResolver(mockMessage, mockAnnouncementChannel));
    mockResolver.dbDriver.returns(mockDBDriver);


    const [mockSession, mockSessionParameters] = buildMockSession({}, {overrideSessionId: SESSION_ID, resolver: mockResolver});

    const mockServer = buildMockServer({session: mockSession, resolver: mockResolver});

    const [mockGuild, mockGuildMembers] = buildMockGuild({channel: mockAnnouncementChannel, message: mockMessage});

    const mockSessionCreationTemplate = Substitute.for<SessionParametersWithSugar>();

    const mockCache = Substitute.for<SessionTemplateCache>();
    mockCache.getTemplate(SESSION_CREATION_TEMPLATE_NAME, Arg.any()).returns(mockSessionCreationTemplate);


    // "Dependency Injection" :^)
    Dependencies.sessionTemplateCache = mockCache;
 
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
        mockGuild,
        mockGuildMembers,

        mockResolver,
        mockDiscordResolver: Substitute.for<DiscordResolver>(),
        mockDBDriver,

        createMockUserView: buildMockUserView,

        mockServer,

        mockSessionCreationTemplate,

        mockSessionDBSchema: {
            serverId: "MOCK_DB_SERVER_ID" as Snowflake,
            sessionId: "MOCK_DB_SESSION_ID" as Snowflake,
            ownerId: "MOCK_DB_OWNER_ID" as Snowflake,
            joinedPlayerIds: [],
            waitlistedPlayerIds: [],
            sessionClosed: false,
            sessionParameters: mockSessionParameters
        }
    };

    const {mockDiscordUser, mockDmChannel} = mocks;
    // Attach the output DM channel to the Discord User
    mockDiscordUser.createDM().resolves(mockDmChannel);

    const frozen = Object.freeze(mocks);
    builtMocks = frozen;
    return frozen;
}
