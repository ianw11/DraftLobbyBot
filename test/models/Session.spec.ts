import {expect, assert} from "../chaiAsync.spec";
import setup, { MocksInterface } from "../setup.spec";
import Session from "../../src/models/Session";
import { Arg, SubstituteOf } from "@fluffy-spoon/substitute";
import DraftUser from "../../src/models/DraftUser";
import { SessionParametersWithSugar, buildSessionParams, SessionConstructorParameter } from "../../src/database/SessionDBSchema";
import { InMemorySessionView } from "../../src/database/inmemory/InMemorySessionView";
import { getLogLines, mockConstants, mockEnv, turnMockDiscordUserIntoBot } from "../TestHelpers.spec";

/*
Could use testing:
- Sessions with/without owner user id
- Adding/removing users
 */

describe("Test Session", () => {

    let mocks: MocksInterface;
    let session: Session;

    beforeEach(() => {
        mocks = setup();
        resetSession();
    });

    function resetSession(overrideSessionParameters?: Partial<SessionConstructorParameter>, overrideSessionId?: string, unowned?: boolean) {
        const sessionParams: SessionParametersWithSugar = buildSessionParams(mockEnv, {...mocks.mockSessionParameters, ...(overrideSessionParameters || {})});
        session = new Session(new InMemorySessionView(mockConstants.DISCORD_SERVER_ID, overrideSessionId ?? mockConstants.SESSION_ID, sessionParams, unowned ? undefined : (overrideSessionParameters?.ownerId || mockConstants.DISCORD_USER_ID)), mocks.mockResolver);
        if (unowned) {
            mocks.mockDraftUser.setCreatedSessionId();
        } else {
            mocks.mockDraftUser.setCreatedSessionId(session.sessionId);
        }
    }

    describe("Basic Session Checks", () => {
        it('has default parameters', async () => {
            const {USERNAME, DISCORD_USER_ID} = mockConstants;
            const {templateUrl, sessionWaitlistMessage} = mocks.mockSessionParameters;

            const overrideConfirmMessageBase = "CONFIRM MESSAGE -> ";
            const overrideConfirmMessage = `${overrideConfirmMessageBase}%URL%`;
            const overrideCancelMessage = "CANCEL";

            const date = new Date();
            resetSession({ownerId: DISCORD_USER_ID, description: mockEnv.DEFAULT_SESSION_DESCRIPTION, date: date, name: "%NAME%'s Draft", sessionConfirmMessage: overrideConfirmMessage, sessionCancelMessage: overrideCancelMessage});
            
            expect(session.ownerId).equal(DISCORD_USER_ID);
            expect(await session.getNameAsync()).to.equal(`${USERNAME}'s Draft`);
            expect(session.getFireWhenFull()).to.equal(mockEnv.DEFAULT_SESSION_FIRE_WHEN_FULL);
            expect(session.getSessionCapacity()).to.equal(mockEnv.DEFAULT_SESSION_CAPACITY);
            expect(session.getDescription()).to.equal(mockEnv.DEFAULT_SESSION_DESCRIPTION);
            expect(session.getDate()).to.deep.equal(date);
            expect(await session.getConfirmedMessage()).equals(`${overrideConfirmMessageBase}${templateUrl}`);
            expect(await session.getWaitlistMessage()).equals(sessionWaitlistMessage);
            expect(await session.getCancelledMessage()).equals(overrideCancelMessage);
        });

        it('can update parameters', async () => {
            const {mockSessionParameters, mockMessage} = mocks;

            resetSession({sessionConfirmMessage: "CONFIRM %URL%"});

            const NAME = "NEW NAME";
            await session.setName(NAME);
            expect(await session.getNameAsync()).to.equal(NAME);

            const URL = "NEW URL";
            session.setTemplateUrl(URL);
            expect(await session.getConfirmedMessage()).equals(`CONFIRM ${URL}`);
            session.setTemplateUrl();
            await expect(session.getConfirmedMessage({}, true)).to.eventually.equal('CONFIRM <NO URL>');

            const DESCRIPTION = "NEW DESCRIPTION";
            await session.setDescription(DESCRIPTION);
            expect(session.getDescription()).to.equal(DESCRIPTION);

            const FIRE_WHEN_FULL = !mockSessionParameters.fireWhenFull;
            await session.setFireWhenFull(FIRE_WHEN_FULL);
            expect(session.getFireWhenFull()).to.equal(FIRE_WHEN_FULL);

            const MAX_PLAYERS = 2;
            await session.setSessionCapacity(MAX_PLAYERS);
            expect(session.getSessionCapacity()).to.equal(MAX_PLAYERS);

            const date = new Date();
            await session.setDate(date);
            expect(session.getDate()).to.deep.equal(date);

            // Setting url does not update the message
            mockMessage.received(5).edit(Arg.any(), Arg.any());
        });

        it('cannot set invalid parameters', () => {
            const {mockMessage, mockSessionParameters} = mocks;
            const {sessionCapacity} = mockSessionParameters;
            const { SESSION_ID } = mockConstants;

            expect(() => { session.sessionId = "BAD_ID" }).to.throw("Session Id can only be set via resetMessage()");
            expect(session.sessionId).to.equal(SESSION_ID);

            expect(session.setSessionCapacity(0)).be.rejected;
            expect(session.getSessionCapacity()).to.equal(sessionCapacity);

            expect(session.setSessionCapacity(-5)).be.rejected;
            expect(session.getSessionCapacity()).to.equal(sessionCapacity);

            mockMessage.received(0).edit(Arg.all());
        });

        it('performs a string replacement', async () => {
            resetSession({sessionConfirmMessage: "%URL%"})
            session.setTemplateUrl('https://fakedomain.fake/?session=%HRI%');

            assert((await session.getConfirmedMessage()).startsWith('https://fakedomain.fake/?session='));
            expect((await session.getConfirmedMessage()).indexOf('%HRI%')).equals(-1);
        });

        it('returns a default name if session is unowned', async () => {
            const {mockSessionParameters} = mocks;
            resetSession({}, undefined, true);
            await expect(session.getNameAsync()).to.eventually.equal(mockSessionParameters.unownedSessionName);
        });

        it('produces a simple string', async () => {
            const str = await session.toSimpleString();
            expect(str).is.not.empty;

            resetSession({date: new Date()});

            const dateStr = await session.toSimpleString();
            expect(dateStr).is.not.empty;
        });

        it('builds a discord MessageEmbed (and fulfill coverage)', async () => {
            // Everything in here is just for coverage

            await session.addPlayer(mocks.mockDraftUser);

            await session.getEmbed(true);

            const {userGenerator, mockSessionParameters} = mocks;
            for (let i = 0; i < mockSessionParameters.sessionCapacity * 2; ++i) {
                session.addPlayer(userGenerator());
            }

            await session.getEmbed(true);
        });
    });

    describe('queue and waitlist checking', () => {
        it('can accept 100 users', async () => {
            const {userGenerator, mockSessionParameters} = mocks;
            const {sessionCapacity} = mockSessionParameters;

            session.setFireWhenFull(false);

            for (let i = 0; i < 100; ++i) {
                await session.addPlayer(userGenerator());
            }

            expect(session.getNumConfirmed()).to.eq(sessionCapacity);
            expect(session.getNumWaitlisted()).to.eq(100 - sessionCapacity);
        });

        it('will fire and not accept any more', async () => {
            const {userGenerator, mockSessionParameters} = mocks;

            await session.setFireWhenFull(true);

            const users: SubstituteOf<DraftUser>[] = [];
            for (let i = 0; i < mockSessionParameters.sessionCapacity; ++i) {
                const draftUser = userGenerator();
                await session.addPlayer(draftUser);
                users.push(draftUser);
            }

            expect(session.canAddPlayers()).to.eq(false);
            await expect(session.addPlayer(userGenerator())).rejectedWith("Can't join session - already closed");

            users.forEach((user) => {
                user.received(1).addedToSession(session);
                user.received(1).sessionClosed(session, true);
            });
        });

        it('will not let in the same person twice', async () => {
            const user = mocks.userGenerator();
            await session.addPlayer(user);
            await expect(session.addPlayer(user)).rejectedWith('User already joined');
        });

        it('will let in people from the waitlist when changing capacity', async () => {
            const {userGenerator, mockSessionParameters} = mocks;
            const {sessionCapacity} = mockSessionParameters;
            const newCapacity = sessionCapacity * 2;

            const users: SubstituteOf<DraftUser>[] = [];

            for (let i = 0; i < newCapacity; ++i) {
                const draftUser = userGenerator();
                users.push(draftUser);
                await session.addPlayer(draftUser);
            }

            expect(session.getNumWaitlisted()).to.equal(newCapacity - sessionCapacity);

            await session.setSessionCapacity(newCapacity);

            expect(session.getNumWaitlisted()).to.equal(0);
            expect(session.getNumConfirmed()).to.equal(newCapacity);
        });

        it('throws if trying to reduce capacity below confirmed count', async () => {
            const {userGenerator, mockSessionParameters} = mocks;
            for (let i = 0; i < mockSessionParameters.sessionCapacity; ++i) {
                await session.addPlayer(userGenerator());
            }
            const badCapacity = mockSessionParameters.sessionCapacity / 2;
            await expect(session.setSessionCapacity(badCapacity)).to.be.rejectedWith(`There are ${mockSessionParameters.sessionCapacity} people already confirmed - some of them will need to leave before I can lower to ${badCapacity}`);
        });

        it('computes the correct waitlist index', async () => {
            const {userGenerator, mockSessionParameters} = mocks;
            const targetUser = userGenerator();

            // Fill the session up
            for (let i = 0; i < mockSessionParameters.sessionCapacity; ++i) {
                await session.addPlayer(userGenerator());
            }

            // Add 2
            for (let i = 0; i < 2; ++i) {
                await session.addPlayer(userGenerator());
            }
            // Add the target (at index 2; position 3)
            await session.addPlayer(targetUser);
            // Add 3 more (total in queue: 6)
            for (let i = 0; i < 3; ++i) {
                await session.addPlayer(userGenerator());
            }

            expect(session.getWaitlistIndexOf(targetUser.getUserId())).to.equal(2);
        });

        it('returns -1 if a user is not in a session', async () => {
            const {userGenerator, mockSessionParameters} = mocks;

            expect(session.getWaitlistIndexOf(userGenerator().getUserId())).to.equal(-1);

            // Fill the session up
            for (let i = 0; i < mockSessionParameters.sessionCapacity; ++i) {
                await session.addPlayer(userGenerator());
            }

            for (let i = 0; i < 3; ++i) {
                await session.addPlayer(userGenerator());
            }

            expect(session.getWaitlistIndexOf(userGenerator().getUserId())).to.equal(-1);
        });

        it('can remove a player from the confirmed list', async () => {
            const user = mocks.userGenerator();
            await session.addPlayer(user);
            await session.removePlayer(user);
            expect(session.getNumConfirmed()).to.equal(0);
        });

        it('can remove a player from the waitlist', async () => {
            const {userGenerator, mockSessionParameters} = mocks;

            for (let i = 0; i < mockSessionParameters.sessionCapacity; ++i) {
                await session.addPlayer(userGenerator());
            }

            expect(session.getNumConfirmed()).equals(mockSessionParameters.sessionCapacity);
            expect(session.getNumWaitlisted()).equals(0);

            const targetUser = userGenerator();
            await session.addPlayer(targetUser);

            expect(session.getNumConfirmed()).equals(mockSessionParameters.sessionCapacity);
            expect(session.getNumWaitlisted()).equals(1);

            await session.removePlayer(targetUser);
            
            expect(session.getNumConfirmed()).equals(mockSessionParameters.sessionCapacity);
            expect(session.getNumWaitlisted()).equals(0);
        });

        it('will do nothing if a user that is not in a session leaves', async () => {
            const {userGenerator, mockSessionParameters} = mocks;

            for (let i = 0; i < mockSessionParameters.sessionCapacity * 2; ++i) {
                await session.addPlayer(userGenerator());
            }

            expect(session.getNumConfirmed()).equals(mockSessionParameters.sessionCapacity);
            expect(session.getNumWaitlisted()).equals(mockSessionParameters.sessionCapacity);

            const targetUser = userGenerator();
            await session.removePlayer(targetUser);

            expect(session.getNumConfirmed()).equals(mockSessionParameters.sessionCapacity);
            expect(session.getNumWaitlisted()).equals(mockSessionParameters.sessionCapacity);
        })

        it('can not remove the owner from a session', async () => {
            const owner = mocks.mockDraftUser;
            await session.addPlayer(owner);
            await expect(session.removePlayer(owner)).rejectedWith('Owner trying to leave - use `$delete` to delete session');
        });
    });

    describe('changing ownership', () => {
        it('can transfer ownership', async () => {
            const oldOwner = mocks.mockDraftUser;
            const newOwner = mocks.userGenerator();

            await session.addPlayer(oldOwner);
            await session.addPlayer(newOwner);

            await session.changeOwner(newOwner);

            expect(oldOwner.getCreatedSessionId()).to.be.undefined;
            expect(newOwner.getCreatedSessionId()).to.equal(session.sessionId);
            expect(session.ownerId).equals(newOwner.getUserId());
            
            await session.removePlayer(oldOwner);
        });

        it('will not change ownership to somebody not in the Session', async () => {
            const oldOwner = mocks.mockDraftUser;
            const newOwner = mocks.userGenerator();

            await session.addPlayer(oldOwner);

            await expect(session.changeOwner(newOwner)).rejectedWith(`Unable to change owner to somebody that hasn't joined the session - have ${newOwner.getDisplayName()} join first then retry`);

            expect(oldOwner.getCreatedSessionId()).to.equal(session.sessionId);
            expect(newOwner.getCreatedSessionId()).to.be.undefined;
            expect(session.ownerId).equals(oldOwner.getUserId());
        });

        it('will not let a user who owns a session gain ownership of another', async () => {
            const owner = mocks.mockDraftUser;
            await session.addPlayer(owner);

            await expect(session.changeOwner(owner)).rejectedWith(`Unable to transfer - ${owner.getDisplayName()} already has a Session`);
        });

        it('will not allow a bot to become owner', async () => {
            const bot = mocks.userGenerator();
            const botUserId = bot.getUserId();
            turnMockDiscordUserIntoBot(botUserId);

            await expect(session.changeOwner(bot)).rejectedWith(`Unable to transfer - ${bot.getDisplayName()} either cannot be resolved or is a bot`);
        });

        it('will allow going from no owner to having an owner', async () => {
            resetSession({}, undefined, true);
            await session.addPlayer(mocks.mockDraftUser);
            await session.changeOwner(mocks.mockDraftUser);

            expect(session.ownerId).equals(mocks.mockDraftUser.getUserId());
            expect(mocks.mockDraftUser.getCreatedSessionId()).equals(session.sessionId);
        });
    });

    describe('Session lifecycle', () => {
        it('cannot add users after the session terminates', async () => {
            await session.terminate();
            expect(session.canAddPlayers()).is.false;
            await expect(session.addPlayer(mocks.userGenerator())).rejected;
        });

        it('outputs if the desired channel is not present', async () => {
            resetSession({}, 'NON_DEFAULT_ID');
            await session.terminate();
            assert(getLogLines().includes('Unable to delete message - not found in channel'));
        });

        it('notifies all joined and waitlisted people', async () => {
            const allUsers: SubstituteOf<DraftUser>[] = [];
            for (let i = 0; i < mocks.mockSessionParameters.sessionCapacity * 2; ++i) {
                const user = mocks.userGenerator();
                allUsers.push(user);
                await session.addPlayer(user);
            }

            await session.terminate();

            allUsers.forEach(user => {
                user.received(1).sessionClosed(Arg.any(), Arg.any());
            });
        });
    });

});
