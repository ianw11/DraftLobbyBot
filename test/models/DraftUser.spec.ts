import {assert, expect} from 'chai';
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

beforeEach(() => {
    mocks = setup();
    user = new DraftUser(constants.DISCORD_USER_ID, mocks.discordUserResolver, mocks.sessionResolver);
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
        assert(user.joinedSessions.includes(mockSession.sessionId));
        assert(user.joinedSessions.length === 1);
    });

    it('can get removed from a session', async () => {
        const {mockSession, mockDmChannel, mockSessionParameters} = mocks;
        await user.addedToSession(mockSession);

        await user.removedFromSession(mockSession);

        assert(mockDmChannel.received(1).send(`You've been removed from ${mockSessionParameters.name}`));
        assert(user.joinedSessions.length === 0);
    });

    it('can get waitlisted', async () => {
        const {mockSession, mockDmChannel, mockSessionParameters} = mocks;
        await user.addedToWaitlist(mockSession);

        assert(mockDmChannel.received(1).send(`You've been waitlisted for ${mockSessionParameters.name}.  You're in position: ${constants.NUM_IN_WAITLIST}`));
        assert(user.waitlistedSessions.includes(mockSession.sessionId));
        assert(user.waitlistedSessions.length === 1);
    });

    it('can get removed from the waitlist', async () => {
        const {mockSession, mockDmChannel, mockSessionParameters} = mocks;
        await user.addedToWaitlist(mockSession);

        await user.removedFromWaitlist(mockSession);

        assert(mockDmChannel.received(1).send(`You've been removed from the waitlist for ${mockSessionParameters.name}`));
        assert(user.waitlistedSessions.length === 0);
        assert(user.joinedSessions.length === 0);
    });

    it('can get upgraded from the waitlist', async () => {
        const {mockSession, mockDmChannel, mockSessionParameters} = mocks;
        await user.addedToWaitlist(mockSession);
        
        await user.upgradedFromWaitlist(mockSession);

        assert(mockDmChannel.received(1).send(`You've been upgraded from the waitlist for ${mockSessionParameters.name}`));
        assert(user.waitlistedSessions.length === 0);
        assert(user.joinedSessions.length === 1);
        assert(user.joinedSessions.includes(mockSession.sessionId));
    });

    it('can get cancelled on after join', async () => {
        const {mockSession, mockDmChannel, mockSessionParameters} = mocks;
        await user.addedToSession(mockSession);

        await user.sessionClosed(mockSession, false);

        assert(mockDmChannel.received(1).send(mockSessionParameters.sessionCancelMessage));
        assert(user.waitlistedSessions.length === 0);
        assert(user.joinedSessions.length === 0);
    });

    it('can get cancelled on after waitlist', async () => {
        const {mockSession, mockDmChannel, mockSessionParameters} = mocks;
        await user.addedToWaitlist(mockSession);

        await user.sessionClosed(mockSession, false);

        assert(mockDmChannel.received(1).send(mockSessionParameters.sessionCancelMessage));
        assert(user.waitlistedSessions.length === 0);
        assert(user.joinedSessions.length === 0);
    });

    it('can start because successfully joined', async () => {
        const {mockSession, mockDmChannel, mockSessionParameters} = mocks;
        await user.addedToSession(mockSession);

        await user.sessionClosed(mockSession, true);

        assert(mockDmChannel.received(1).send(mockSessionParameters.sessionConfirmMessage));
        assert(user.waitlistedSessions.length === 0);
        assert(user.joinedSessions.length === 0);
    });

    it('missed the start because on waitlist', async () => {
        const {mockSession, mockDmChannel, mockSessionParameters} = mocks;
        await user.addedToWaitlist(mockSession);

        await user.sessionClosed(mockSession, true);

        assert(mockDmChannel.received(1).send(mockSessionParameters.sessionWaitlistMessage));
        assert(user.waitlistedSessions.length === 0);
        assert(user.joinedSessions.length === 0);
    });
});

describe('Test managing sessions', () => {
    it('can receive a new session', () => {
        user.setCreatedSessionId(constants.SESSION_ID);
        assert(user.getCreatedSessionId() === constants.SESSION_ID);
    });
});
