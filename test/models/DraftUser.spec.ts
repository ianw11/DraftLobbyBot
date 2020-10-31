import {assert, expect} from 'chai';
import { IUserView } from '../../src/database/UserDBSchema';
import DraftUser from '../../src/models/DraftUser';
import setup, { MocksInterface, MocksConstants, mockConstants } from '../setup.spec';

// I actually liked mockito better than substitute,
// watch this link in case they ever merge the fix
// https://github.com/NagRock/ts-mockito/pull/194


const constants: MocksConstants = mockConstants;

// The mocks get reset every test
let mocks: MocksInterface;

// The user we're testing in this file - reset every test
let user: DraftUser;
let userData: IUserView;

beforeEach(() => {
    mocks = setup();
    userData = mocks.mockUserView;
    user = new DraftUser(userData, mocks.mockDataResolver);
});
afterEach(() => {
    // None for now...
});


describe('Basic User Tests (Probably canaries in the coal mine)', () => {
    it('should know its id', () => {
        expect(user.getUserId()).to.equal(constants.DISCORD_USER_ID);
    });

    it('should know its username', () => {
        expect(user.getDisplayName()).to.equal(constants.USERNAME);
    });
    it('sends a DM successfully', async () => {
        const message = "WORDS";
        await user.sendDM(message);
        assert(mocks.mockDmChannel.received(1).send(message));
    });
});

describe('session lifecycle', () => {
    it('can get added to a session', async () => {
        const {mockSession, mockDmChannel, mockSessionParameters} = mocks;
        await user.addedToSession(mockSession);

        assert(mockDmChannel.received(1).send(`You're confirmed for ${mockSessionParameters.name}`));
        expect(userData.joinedSessionIds).contains(mockSession.sessionId);
        expect(userData.joinedSessionIds.length).eq(1);
    });

    it('can get removed from a session', async () => {
        const {mockSession, mockDmChannel, mockSessionParameters} = mocks;
        await user.addedToSession(mockSession);

        await user.removedFromSession(mockSession);

        assert(mockDmChannel.received(1).send(`You've been removed from ${mockSessionParameters.name}`));
        expect(userData.joinedSessionIds.length).eq(0);
    });

    it('can get waitlisted', async () => {
        const {mockSession, mockDmChannel, mockSessionParameters} = mocks;
        await user.addedToWaitlist(mockSession);

        assert(mockDmChannel.received(1).send(`You've been waitlisted for ${mockSessionParameters.name}.  You're in position: ${constants.NUM_IN_WAITLIST}`));
        expect(userData.waitlistedSessionIds).contains(mockSession.sessionId);
        expect(userData.waitlistedSessionIds.length).eq(1);
    });

    it('can get removed from the waitlist', async () => {
        const {mockSession, mockDmChannel, mockSessionParameters} = mocks;
        await user.addedToWaitlist(mockSession);

        await user.removedFromWaitlist(mockSession);

        assert(mockDmChannel.received(1).send(`You've been removed from the waitlist for ${mockSessionParameters.name}`));
        expect(userData.waitlistedSessionIds.length).eq(0);
        expect(userData.joinedSessionIds.length).eq(0);
    });

    it('can get upgraded from the waitlist', async () => {
        const {mockSession, mockDmChannel, mockSessionParameters} = mocks;
        await user.addedToWaitlist(mockSession);
        
        await user.upgradedFromWaitlist(mockSession);

        assert(mockDmChannel.received(1).send(`You've been upgraded from the waitlist for ${mockSessionParameters.name}`));
        expect(userData.waitlistedSessionIds.length).eq(0);
        expect(userData.joinedSessionIds.length).eq(1);
        expect(userData.joinedSessionIds).contains(mockSession.sessionId);
    });

    it('can get cancelled on after join', async () => {
        const {mockSession, mockDmChannel, mockSessionParameters} = mocks;
        await user.addedToSession(mockSession);

        await user.sessionClosed(mockSession, false);

        assert(mockDmChannel.received(1).send(mockSessionParameters.sessionCancelMessage));
        expect(userData.waitlistedSessionIds.length).eq(0);
        expect(userData.joinedSessionIds.length).eq(0);
    });

    it('can get cancelled on after waitlist', async () => {
        const {mockSession, mockDmChannel, mockSessionParameters} = mocks;
        await user.addedToWaitlist(mockSession);

        await user.sessionClosed(mockSession, false);

        assert(mockDmChannel.received(1).send(mockSessionParameters.sessionCancelMessage));
        expect(userData.waitlistedSessionIds.length).eq(0);
        expect(userData.joinedSessionIds.length).eq(0);
    });

    it('can start because successfully joined', async () => {
        const {mockSession, mockDmChannel, mockSessionParameters} = mocks;
        await user.addedToSession(mockSession);

        await user.sessionClosed(mockSession, true);

        assert(mockDmChannel.received(1).send(mockSessionParameters.sessionConfirmMessage));
        expect(userData.waitlistedSessionIds.length).eq(0)
        expect(userData.joinedSessionIds.length).eq(0);
    });

    it('missed the start because on waitlist', async () => {
        const {mockSession, mockDmChannel, mockSessionParameters} = mocks;
        await user.addedToWaitlist(mockSession);

        await user.sessionClosed(mockSession, true);

        assert(mockDmChannel.received(1).send(mockSessionParameters.sessionWaitlistMessage));
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
