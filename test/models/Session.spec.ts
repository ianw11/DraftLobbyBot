import {expect, assert} from "../chaiAsync.spec";
import setup, { MocksInterface, mockConstants, mockEnv } from "../setup.spec";
import Session, { SessionConstructorParameter } from "../../src/models/Session";
import { Arg, SubstituteOf } from "@fluffy-spoon/substitute";
import DraftUser from "../../src/models/DraftUser";

/*
Could use testing:
- Sessions with/without owner user id
- Adding/removing users
 */

let mocks: MocksInterface;

let session: Session;

function resetSession(sessionParameters: Partial<SessionConstructorParameter>) {
    session = new Session(mocks.mockMessage, mocks.userResolver, mockEnv, sessionParameters);
}

beforeEach(() => {
    mocks = setup();
    resetSession(mocks.mockSessionParameters);
})

describe("Basic Session Checks", () => {
    it('has default parameters', () => {
        const {USERNAME, DISCORD_USER_ID} = mockConstants;
        const {url} = mocks.mockSessionParameters;

        const date = new Date();
        resetSession({ownerId: DISCORD_USER_ID, date: date, url: url});
        
        expect(session.getName()).to.equal(`${USERNAME}'s Draft`);
        expect(session.getFireWhenFull()).to.equal(mockEnv.DEFAULT_SESSION_FIRE_WHEN_FULL);
        expect(session.getSessionCapacity()).to.equal(mockEnv.DEFAULT_SESSION_CAPACITY);
        expect(session.getDescription()).to.equal(mockEnv.DEFAULT_SESSION_DESCRIPTION);
        expect(session.getDate()).to.deep.equal(date);
        expect(session.getUrl()).equals(url);
    });

    it('can update parameters', async () => {
        const {mockSessionParameters, mockMessage} = mocks;

        const NAME = "NEW NAME";
        await session.setName(NAME);
        expect(session.getName()).to.equal(NAME);

        const URL = "NEW URL";
        session.setUrl(URL);
        expect(session.getUrl()).to.equal(URL);

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
        mockMessage.received(5).edit(Arg.any());
    });

    it('cannot set invalid parameters', () => {
        const {mockMessage, mockSessionParameters} = mocks;
        const {sessionCapacity} = mockSessionParameters;

        expect(session.setSessionCapacity(0)).be.rejected;
        expect(session.getSessionCapacity()).to.equal(sessionCapacity);

        expect(session.setSessionCapacity(-5)).be.rejected;
        expect(session.getSessionCapacity()).to.equal(sessionCapacity);

        mockMessage.received(0).edit(Arg.all());
    });

    it('performs a string replacement', () => {
        session.setUrl('https://fakedomain.fake/?session=%HRI%');

        assert(session.getUrl().startsWith('https://fakedomain.fake/?session='));
        expect(session.getUrl().indexOf('%HRI%')).equals(-1);
    });
});

describe('queue and waitlist checking', () => {
    it('can accept 100 users', () => {
        const {userGenerator, mockSessionParameters} = mocks;
        const {sessionCapacity} = mockSessionParameters;

        session.setFireWhenFull(false);

        for (let i = 0; i < 100; ++i) {
            session.addPlayer(userGenerator());
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
        expect(() => session.addPlayer(userGenerator())).to.throw;

        users.forEach((user) => {
            user.received(1).addedToSession(session);
            user.received(1).sessionClosed(session, true);
        });
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
});
