import Substitute, { Arg, SubstituteOf } from "@fluffy-spoon/substitute";
import { Snowflake, TextChannel } from "discord.js";
import DraftServer from "../../src/models/DraftServer";
import DraftUser from "../../src/models/DraftUser";
import { SessionId } from "../../src/models/types/BaseTypes";
import { expect } from "../chaiAsync.spec";
import setup, { MocksInterface } from "../setup.spec";
import { buildMockMessage, buildMockSession, mockConstants, mockEnv, TESTSession } from "../TestHelpers.spec";

describe('test DraftServer', () => {
    let mocks: MocksInterface;
    let server: DraftServer;
    beforeEach(() => {
        mocks = setup();
        server = new DraftServer(mockEnv, mocks.mockResolver);
    });

    describe('Session Creation', () => {
        let owner: SubstituteOf<DraftUser>;
        beforeEach(() => {
            owner = mocks.userGenerator();
        });

        it('creates a Session with no parameters and the user has no prior Session', async () => {
            expect(owner.getCreatedSessionId()).to.be.undefined;

            await server.createSession(owner);

            mocks.mockAnnouncementChannel.received(1).send('Setting up session...');

            // Checks the mocked call used to create a Session
            mocks.mockDBDriver.received(1).createSession(mockConstants.DISCORD_SERVER_ID, mockConstants.SESSION_ID, mockEnv, {ownerId: owner.getUserId()});

            expect(owner.getCreatedSessionId()).equals(mocks.mockSession.sessionId);
            
            mocks.mockSession.received(1).addPlayer(owner);
            mocks.mockMessage.received(1).react(mockEnv.EMOJI);
        });

        // This cannot work.  As of now, the mock makes the value "defined" and even if the
        // mock .return()s undefined, it's stil technically a value.
        it.skip('will not create a session without an announcement channel', async () => {
            // Force a regeneration so the announcement channel has nothing associated it
            // not even a mock of nothing because that's still something
            mocks = setup(true);

            mocks.mockDiscordResolver.announcementChannel.mimicks(undefined);

            await expect(server.createSession(owner)).rejectedWith('Cannot create a session - announcement channel was not set up.  Bot might require a restart');
        });

        it('will close any existing Sessions', async () => {
            const oldSession = buildMockSession({ownerId: owner.getUserId()})[0];
            owner.setCreatedSessionId(oldSession.sessionId);
            expect(oldSession.test_isSessionClosed()).equals(false);

            await server.createSession(owner);

            oldSession.received(1).terminate(false);
            expect(oldSession.test_isSessionClosed()).equals(true);
            owner.received(1).setCreatedSessionId(undefined);
        });

    });

    describe('Session Closing', () => {
        let owner: SubstituteOf<DraftUser>;
        let session: TESTSession;
        beforeEach(() => {
            owner = mocks.userGenerator();
            session = buildMockSession({ownerId: owner.getUserId()})[0];
            owner.setCreatedSessionId(session.sessionId);
        });

        it('closes the Session if the owner leaves the entire Server', async () => {
            // This is a placeholder until the underlying implementation is fixed
            await expect(server.sessionOwnerLeftServer(owner)).rejectedWith('Make sure you hook this up to actually listen for Discord kicks/bans.  Then uncomment this.');
        });

        it('owner can start a Session normally', async () => {
            await server.startSessionOwnedByUser(owner);

            expect(session.test_isSessionClosed()).equals(true);
            mocks.mockResolver.received(1).resolveSession(session.sessionId);
            mocks.mockDBDriver.received(1).deleteSessionFromDatabase(mockConstants.DISCORD_SERVER_ID, session.sessionId);
            expect(owner.getCreatedSessionId()).is.undefined;
        });

        it('will not allow a Session to be closed by its non-owner', async () => {
            owner.setCreatedSessionId(undefined);

            await expect(server.startSessionOwnedByUser(owner)).rejectedWith("You don't have any session to terminate");

            expect(session.test_isSessionClosed()).equals(false);
            mocks.mockDBDriver.received(0).deleteSessionFromDatabase(Arg.all());
        });

        it('will not allow a Session to be closed if somehow the data gets messed up', async () => {
            // Foribly break the link
            session = buildMockSession({ownerId: "FAKE_OWNER_ID" as Snowflake})[0];
            owner.setCreatedSessionId(session.sessionId);

            await expect(server.startSessionOwnedByUser(owner)).rejectedWith('createdSessionId for User does not match ownerId for Session');

            expect(session.test_isSessionClosed()).equals(false);
            mocks.mockDBDriver.received(0).deleteSessionFromDatabase(Arg.all());
            expect(owner.getCreatedSessionId()).equals(session.sessionId);
        });

        it('will not close a Session if the session cannot be resolved', async () => {
            const oldSessionId = owner.getCreatedSessionId();
            owner.setCreatedSessionId(oldSessionId + "FAKE" as Snowflake);

            expect(server.getSessionFromDraftUser(owner)).is.undefined;

            await server.startSessionOwnedByUser(owner);

            expect(owner.getCreatedSessionId()).is.undefined;
        });

        it('bot can start a Session normally', async () => {
            await server.startSession(session.sessionId);

            expect(session.test_isSessionClosed()).equals(true);
            mocks.mockResolver.received(1).resolveSession(session.sessionId);
            mocks.mockDBDriver.received(1).deleteSessionFromDatabase(mockConstants.DISCORD_SERVER_ID, session.sessionId);
            expect(owner.getCreatedSessionId()).is.undefined;
        });

        it('bot can close a Session normally', async () => {
            await server.closeSession(session.sessionId);

            expect(session.test_isSessionClosed()).equals(true);
            mocks.mockResolver.received(1).resolveSession(session.sessionId);
            mocks.mockDBDriver.received(1).deleteSessionFromDatabase(mockConstants.DISCORD_SERVER_ID, session.sessionId);
            expect(owner.getCreatedSessionId()).is.undefined;
        });

        it("bot can close an unowned Session normally", async () => {
            session = buildMockSession({}, {unownedSession: true})[0];

            await server.closeSession(session.sessionId);

            mocks.mockDBDriver.received(1).deleteSessionFromDatabase(mockConstants.DISCORD_SERVER_ID, session.sessionId);
        });
    });

    describe('Session helpers', () => {
        let owner: SubstituteOf<DraftUser>;
        let session: TESTSession;
        beforeEach(() => {
            owner = mocks.userGenerator();
            session = buildMockSession({ownerId: owner.getUserId()})[0];
            owner.setCreatedSessionId(session.sessionId);
        });

        it('will return an undefined Session with an empty/undefined input', () => {
            owner.setCreatedSessionId('' as SessionId);

            expect(server.getSessionFromDraftUser(owner)).is.undefined;
        });

        it('will get the session from the [announcement] message', () => {
            expect(server.getSessionFromMessage(mocks.mockMessage)).deep.equals(mocks.mockSession);
        });

        it.skip('will not succeed in getting the session from message if there is no announcement channel', () => {
            mocks.mockDiscordResolver.announcementChannel.returns(null);
            expect(server.getSessionFromMessage(mocks.mockMessage)).throws("Bot was not properly set up with an announcement channel - probably requires a restart");
        });

        it('will return undefined if the message is not from the announcement channel', () => {
            const mockChannel = Substitute.for<TextChannel>();
            mockChannel.id.returns("FAKE" as Snowflake)
            const message = buildMockMessage("MESSAGE_ID" as Snowflake);
            message.channel.returns(mockChannel);
            expect(server.getSessionFromMessage(message)).is.undefined;
        });
    });
});