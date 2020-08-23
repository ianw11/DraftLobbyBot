import {assert, expect} from 'chai';
import {Substitute, Arg, SubstituteOf} from '@fluffy-spoon/substitute';
import DraftUser from '../../src/models/DraftUser';
import {User, DMChannel, Message} from 'discord.js';
import { SessionResolver } from '../../src/models/DraftServer';
import Session, { SessionParameters, SessionId } from '../../src/models/Session';

// I actually liked mockito better than substitute,
// watch this link in case they ever merge the fix
// https://github.com/NagRock/ts-mockito/pull/194

const ID = 'TEST ID';
const USERNAME = 'TEST USERNAME';
const SESSION_ID = 'TEST SESSION ID';
const NUM_CONFIRMED = 5;
const NUM_IN_WAITLIST = 3;

// Reset these every test case
let mocks: {
    mockProps: SessionParameters,
    mockSession: SubstituteOf<Session>,
    sessionResolver: SessionResolver,
    mockDiscordUser: SubstituteOf<User>,
    mockDmChannel: SubstituteOf<DMChannel>
};

// The user we're testing in this file
let user: DraftUser;

beforeEach(() => {
    const mockProps: SessionParameters = {
        name: 'MOCK SESSION',
        description: 'MOCK SESSION DESCRIPTION',
        fireWhenFull: true,
        maxNumPlayers: 8,
        url: 'MOCK SESSION URL'
    };

    const mockSession = Substitute.for<Session>();
    mockSession.sessionId.returns(SESSION_ID);
    mockSession.params.returns(mockProps);
    mockSession.getNumConfirmed().returns(NUM_CONFIRMED);
    mockSession.getNumWaitlisted().returns(NUM_IN_WAITLIST);

    const sessionResolver: SessionResolver = {resolve: (sessionId: SessionId) => sessionId === SESSION_ID ? mockSession : null };

    // Set up the mock for Discord User object backing our DraftUser
    const mockDiscordUser = Substitute.for<User>();
    mockDiscordUser.id.returns(ID);
    mockDiscordUser.username.returns(USERNAME);

    // Set up the mock for the output channel (super helpful for validation)
    const mockDmChannel = Substitute.for<DMChannel>();
    mockDmChannel.send(Arg.is).resolves(Substitute.for<Message>());
    // Attach the channel to the Discord User
    mockDiscordUser.createDM().resolves(mockDmChannel);

    // The user we're testing
    user = new DraftUser(mockDiscordUser, sessionResolver);

    mocks = {
        mockProps: mockProps,
        mockSession: mockSession,
        sessionResolver: sessionResolver,
        mockDiscordUser: mockDiscordUser,
        mockDmChannel: mockDmChannel
    };
});
afterEach(() => {
    // None for now...
});


describe('Basic User Tests (Probably canaries in the coal mine)', () => {
    it('should know its id', () => {
        expect(user.getUserId()).to.equal(ID);
    });

    it('should know its username', () => {
        expect(user.getDisplayName()).to.equal(USERNAME);
    });
    it('sends a DM successfully', async () => {
        const message = "WORDS";
        await user.sendDM(message);
        assert(mocks.mockDmChannel.received(1).send(message));
    });
});

describe('session lifecycle', () => {
    it('can get added to a session', async () => {
        const {mockSession, mockDmChannel, mockProps} = mocks;
        await user.addedToSession(mockSession);

        assert(mockDmChannel.received(1).send(`You're confirmed for ${mockProps.name}`));
        assert(user.joinedSessions.includes(mockSession.sessionId));
        assert(user.joinedSessions.length === 1);
    });

    it('can get removed from a session', async () => {
        const {mockSession, mockDmChannel, mockProps} = mocks;
        await user.addedToSession(mockSession);

        await user.removedFromSession(mockSession);

        assert(mockDmChannel.received(1).send(`You've been removed from ${mockProps.name}`));
        assert(user.joinedSessions.length === 0);
    });

    it('can get waitlisted', async () => {
        const {mockSession, mockDmChannel, mockProps} = mocks;
        await user.addedToWaitlist(mockSession);

        assert(mockDmChannel.received(1).send(`You've been waitlisted for ${mockProps.name}.  You're in position: ${NUM_IN_WAITLIST}`));
        assert(user.waitlistedSessions.includes(mockSession.sessionId));
        assert(user.waitlistedSessions.length === 1);
    });

    it('can get removed from the waitlist', async () => {
        const {mockSession, mockDmChannel, mockProps} = mocks;
        await user.addedToWaitlist(mockSession);

        await user.removedFromWaitlist(mockSession);

        assert(mockDmChannel.received(1).send(`You've been removed from the waitlist for ${mockProps.name}`));
        assert(user.waitlistedSessions.length === 0);
        assert(user.joinedSessions.length === 0);
    });

    it('can get upgraded from the waitlist', async () => {
        const {mockSession, mockDmChannel, mockProps} = mocks;
        await user.addedToWaitlist(mockSession);
        
        await user.upgradedFromWaitlist(mockSession);

        assert(mockDmChannel.received(1).send(`You've been upgraded from the waitlist for ${mockProps.name}`));
        assert(user.waitlistedSessions.length === 0);
        assert(user.joinedSessions.length === 1);
        assert(user.joinedSessions.includes(mockSession.sessionId));
    });

    it('can get cancelled on after join', async () => {
        const {mockSession, mockDmChannel, mockProps} = mocks;
        await user.addedToSession(mockSession);

        await user.sessionClosed(mockSession, false);

        assert(mockDmChannel.received(1).send(`${mockProps.name} has been cancelled`));
        assert(user.waitlistedSessions.length === 0);
        assert(user.joinedSessions.length === 0);
    });

    it('can get cancelled on after waitlist', async () => {
        const {mockSession, mockDmChannel, mockProps} = mocks;
        await user.addedToWaitlist(mockSession);

        await user.sessionClosed(mockSession, false);

        assert(mockDmChannel.received(1).send(`${mockProps.name} has been cancelled`));
        assert(user.waitlistedSessions.length === 0);
        assert(user.joinedSessions.length === 0);
    });

    it('can start because successfully joined', async () => {
        const {mockSession, mockDmChannel, mockProps} = mocks;
        await user.addedToSession(mockSession);

        await user.sessionClosed(mockSession, true);

        assert(mockDmChannel.received(1).send(`${mockProps.name} has started. Draft url: ${mockProps.url}`));
        assert(user.waitlistedSessions.length === 0);
        assert(user.joinedSessions.length === 0);
    });

    it('missed the start because on waitlist', async () => {
        const {mockSession, mockDmChannel, mockProps} = mocks;
        await user.addedToWaitlist(mockSession);

        await user.sessionClosed(mockSession, true);

        assert(mockDmChannel.received(1).send(`${mockProps.name} has started, but you were on the waitlist`));
        assert(user.waitlistedSessions.length === 0);
        assert(user.joinedSessions.length === 0);
    });
});

describe('Test managing sessions', () => {
    it('can receive a new session', () => {
        user.setCreatedSessionId(SESSION_ID);
        assert(user.getCreatedSessionId() === SESSION_ID);
    });
});
