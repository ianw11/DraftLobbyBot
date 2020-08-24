import Substitute, { SubstituteOf } from "@fluffy-spoon/substitute";
import Session, { SessionParameters, SessionId } from "../src/models/Session";
import { SessionResolver, UserResolver, DraftUserId } from "../src/models/DraftServer";
import { DMChannel, User, Message } from "discord.js";
import DraftUser from "../src/models/DraftUser";

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
    mockSessionParameters: SessionParameters,
    mockSession: SubstituteOf<Session>,
    sessionResolver: SessionResolver,
    mockDraftUser: DraftUser,
    userResolver: UserResolver,
    mockDiscordUser: SubstituteOf<User>,
    mockDmChannel: SubstituteOf<DMChannel>,
    mockMessage: SubstituteOf<Message>
};

export default function setup(): MocksInterface {
    const {SESSION_ID, NUM_CONFIRMED, NUM_IN_WAITLIST, DISCORD_USER_ID, USERNAME} = mockConstants;

    const mocks: Partial<MocksInterface> = {};

    const mockSessionParameters: SessionParameters = {
        name: 'MOCK SESSION',
        description: 'MOCK SESSION DESCRIPTION',
        fireWhenFull: true,
        maxNumPlayers: 8,
        url: 'MOCK SESSION URL'
    };
    mocks.mockSessionParameters = mockSessionParameters;

    const mockSession: SubstituteOf<Session> = Substitute.for<Session>();
    mockSession.sessionId.returns(SESSION_ID);
    mockSession.getParameters().returns(mockSessionParameters);
    mockSession.getName().returns(mockSessionParameters.name);
    mockSession.getDescription().returns(mockSessionParameters.description);
    mockSession.getFireWhenFull().returns(mockSessionParameters.fireWhenFull);
    mockSession.getMaxNumPlayers().returns(mockSessionParameters.maxNumPlayers);
    mockSession.getUrl().returns(mockSessionParameters.url);
    mockSession.getNumConfirmed().returns(NUM_CONFIRMED);
    mockSession.getNumWaitlisted().returns(NUM_IN_WAITLIST);
    mocks.mockSession = mockSession;

    mocks.sessionResolver = {resolve: (sessionId: SessionId) => sessionId === SESSION_ID ? mockSession : null };

    const mockDraftUser: SubstituteOf<DraftUser> = Substitute.for<DraftUser>();
    mockDraftUser.getDisplayName().returns(USERNAME);
    /*
    mockDraftUser.addedToSession(Arg.any()).resolves();
    mockDraftUser.removedFromSession(Arg.any()).resolves();
    mockDraftUser.addedToWaitlist(Arg.any()).resolves();
    mockDraftUser.removedFromWaitlist(Arg.any()).resolves();
    mockDraftUser.upgradedFromWaitlist(Arg.any()).resolves();
    mockDraftUser.sessionClosed(Arg.any(), Arg.any()).resolves();
    mockDraftUser.listSessions().resolves();
    mockDraftUser.printOwnedSessionInfo().resolves();
    */
    mocks.mockDraftUser = mockDraftUser;

    mocks.userResolver = {resolve: (userId: DraftUserId) => userId === DISCORD_USER_ID ? mockDraftUser : null };

    // Set up the mock for Discord User object backing our DraftUser
    const mockDiscordUser: SubstituteOf<User> = Substitute.for<User>();
    mockDiscordUser.id.returns(DISCORD_USER_ID);
    mockDiscordUser.username.returns(USERNAME);
    mocks.mockDiscordUser = mockDiscordUser;

    // Set up the mock for the output channel (super helpful for validation)
    const mockDmChannel = Substitute.for<DMChannel>();
    mocks.mockDmChannel = mockDmChannel;
    // Attach the channel to the Discord User
    mockDiscordUser.createDM().resolves(mockDmChannel);

    const mockMessage = Substitute.for<Message>();
    mocks.mockMessage = mockMessage;

    return mocks as MocksInterface;
}
