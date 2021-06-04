import { Arg } from '@fluffy-spoon/substitute';
import {assert, expect} from 'chai';
import { MessageOptions } from 'discord.js';
import { IUserView } from '../../src/database/UserDBSchema';
import DraftUser from '../../src/models/DraftUser';
import setup, { MocksInterface, MocksConstants, mockConstants } from '../setup.spec';

// I actually liked mockito better than substitute,
// watch this link in case they ever merge the fix
// https://github.com/NagRock/ts-mockito/pull/194


const constants: MocksConstants = mockConstants;

describe("Test DraftUser", () => {

    // The mocks get reset every test
    let mocks: MocksInterface;

    // The user we're testing in this file - reset every test
    let user: DraftUser;
    let userData: IUserView;

    beforeEach(() => {
        mocks = setup();
        userData = mocks.mockUserView;
        user = new DraftUser(userData, mocks.mockResolver);
    });
    afterEach(() => {
        // None for now...
    });


    describe('Basic User Tests (Probably canaries in the coal mine)', () => {
        it('should know its id', () => {
            expect(user.getUserId()).to.equal(constants.DISCORD_USER_ID);
        });

        it('should know its username', () => {
            expect(user.getDisplayName()).to.equal(constants.NICKNAME);

            const noNicknameUser = new DraftUser(mocks.createMockUserView(), mocks.mockResolver);
            expect(noNicknameUser.getDisplayName()).to.equal(constants.USERNAME);
        });
        it('should know its username async', async () => {
            let nickname = await user.getDisplayNameAsync();
            expect(nickname).to.equal(constants.NICKNAME);

            const noNicknameUser = new DraftUser(mocks.createMockUserView(), mocks.mockResolver);
            nickname = await noNicknameUser.getDisplayNameAsync();
            expect(nickname).to.equal(constants.USERNAME);
        });

        it('sends a DM successfully', async () => {
            const message = "WORDS";
            await user.sendDM(message);
            assert(mocks.mockDmChannel.received(1).send(message, undefined));
        });
        it('does nothing with a null message', async () => {
            await user.sendDM(null);
            mocks.mockDmChannel.didNotReceive().send(Arg.any());
        });
    });

    describe('session lifecycle', () => {
        it('can get added to a session', async () => {
            const {mockSession, mockDmChannel, mockSessionParameters} = mocks;
            await user.addedToSession(mockSession);

            assert(mockDmChannel.received(1).send(`You're confirmed for ${mockSessionParameters.name}`, undefined));
            expect(userData.joinedSessionIds).contains(mockSession.sessionId);
            expect(userData.joinedSessionIds.length).eq(1);
        });

        it('can get removed from a session', async () => {
            const {mockSession, mockDmChannel, mockSessionParameters} = mocks;
            await user.addedToSession(mockSession);

            await user.removedFromSession(mockSession);

            assert(mockDmChannel.received(1).send(`You've been removed from ${mockSessionParameters.name}`, undefined));
            expect(userData.joinedSessionIds.length).eq(0);
        });

        it('can get waitlisted', async () => {
            const {mockSession, mockDmChannel, mockSessionParameters} = mocks;
            await user.addedToWaitlist(mockSession);

            assert(mockDmChannel.received(1).send(`You've been waitlisted for ${mockSessionParameters.name}.  You're in position: ${constants.NUM_IN_WAITLIST}`, undefined));
            expect(userData.waitlistedSessionIds).contains(mockSession.sessionId);
            expect(userData.waitlistedSessionIds.length).eq(1);
        });

        it('can get removed from the waitlist', async () => {
            const {mockSession, mockDmChannel, mockSessionParameters} = mocks;
            await user.addedToWaitlist(mockSession);

            await user.removedFromWaitlist(mockSession);

            assert(mockDmChannel.received(1).send(`You've been removed from the waitlist for ${mockSessionParameters.name}`, undefined));
            expect(userData.waitlistedSessionIds.length).eq(0);
            expect(userData.joinedSessionIds.length).eq(0);
        });

        it('can get upgraded from the waitlist', async () => {
            const {mockSession, mockDmChannel, mockSessionParameters} = mocks;
            await user.addedToWaitlist(mockSession);
            
            await user.upgradedFromWaitlist(mockSession);

            assert(mockDmChannel.received(1).send(`You've been upgraded from the waitlist for ${mockSessionParameters.name}`, undefined));
            expect(userData.waitlistedSessionIds.length).eq(0);
            expect(userData.joinedSessionIds.length).eq(1);
            expect(userData.joinedSessionIds).contains(mockSession.sessionId);
        });

        it('can get cancelled on after join', async () => {
            const {mockSession, mockDmChannel, mockSessionParameters} = mocks;
            await user.addedToSession(mockSession);

            await user.sessionClosed(mockSession, false);

            assert(mockDmChannel.received(1).send(mockSessionParameters.sessionCancelMessage, undefined));
            expect(userData.waitlistedSessionIds.length).eq(0);
            expect(userData.joinedSessionIds.length).eq(0);
        });

        it('can get cancelled on after waitlist', async () => {
            const {mockSession, mockDmChannel, mockSessionParameters} = mocks;
            await user.addedToWaitlist(mockSession);

            await user.sessionClosed(mockSession, false);

            assert(mockDmChannel.received(1).send(mockSessionParameters.sessionCancelMessage, undefined));
            expect(userData.waitlistedSessionIds.length).eq(0);
            expect(userData.joinedSessionIds.length).eq(0);
        });

        it('can start because successfully joined', async () => {
            const {mockSession, mockDmChannel, mockSessionParameters} = mocks;
            await user.addedToSession(mockSession);

            await user.sessionClosed(mockSession, true);

            assert(mockDmChannel.received(1).send(mockSessionParameters.sessionConfirmMessage, undefined));
            expect(userData.waitlistedSessionIds.length).eq(0)
            expect(userData.joinedSessionIds.length).eq(0);
        });

        it('missed the start because on waitlist', async () => {
            const {mockSession, mockDmChannel, mockSessionParameters} = mocks;
            await user.addedToWaitlist(mockSession);

            await user.sessionClosed(mockSession);

            assert(mockDmChannel.received(1).send(mockSessionParameters.sessionWaitlistMessage, undefined));
            expect(userData.waitlistedSessionIds.length).eq(0)
            expect(userData.joinedSessionIds.length).eq(0);
        });
    });

    describe('Test managing sessions', () => {
        it('can receive a new session', () => {
            user.setCreatedSessionId(constants.SESSION_ID);
            assert(user.getCreatedSessionId() === constants.SESSION_ID);
        });
    });

    describe('Test Informational Methods', () => {
        it('can list sessions via Discord Client', async () => {
            const {mockDmChannel} = mocks;

            await user.listSessions();
            mockDmChannel.received(1).send('\n**Sessions you are confirmed for:**\n', undefined);

            await user.addedToSession(mocks.mockSession);
            await user.addedToWaitlist(mocks.mockSession);
            await user.listSessions();
            mockDmChannel.received(1).send('\n**Sessions you are confirmed for:**\n- SIMPLE STRING\n**Sessions you are waitlisted for:**\n- SIMPLE STRING || You are in position 1 of 3\n', undefined);
        });

        it('can fail to print session info when no session is created', async () => {
            const {mockDmChannel, mockSession} = mocks;

            await user.printOwnedSessionInfo();
            mockDmChannel.received(1).send("Cannot send info - you haven't created a session", undefined);

            user.setCreatedSessionId(mockSession.sessionId);
            await user.printOwnedSessionInfo();
            // No idea what `MessageOptions & {split: true}` represents, but it compiles soooo
            mockDmChannel.received(1).send(Arg.is((msg): msg is MessageOptions & {split: true} => typeof msg === 'object' && 'embed' in msg));
        });
    });

});
