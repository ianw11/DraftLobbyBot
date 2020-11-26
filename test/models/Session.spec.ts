import {expect, assert} from "../chaiAsync.spec";
import setup, { MocksInterface, mockConstants, mockEnv } from "../setup.spec";
import Session from "../../src/models/Session";
import { Arg, SubstituteOf } from "@fluffy-spoon/substitute";
import DraftUser from "../../src/models/DraftUser";
import { SessionConstructorParameter, SessionParametersWithSugar, buildSessionParams } from "../../src/database/SessionDBSchema";
import { InMemorySessionView } from "../../src/database/inmemory/InMemorySessionView";

/*
Could use testing:
- Sessions with/without owner user id
- Adding/removing users
 */

let mocks: MocksInterface;
let session: Session;

beforeEach(() => {
    mocks = setup();
    resetSession();
});

function resetSession(overrideSessionParameters?: Partial<SessionConstructorParameter>) {
    const sessionParams: SessionParametersWithSugar = buildSessionParams(mockEnv, {...mocks.mockSessionParameters, ...(overrideSessionParameters || {})});
    session = new Session(new InMemorySessionView(mockConstants.DISCORD_SERVER_ID, mockConstants.SESSION_ID, sessionParams, mockConstants.DISCORD_USER_ID), mocks.mockResolver);
}

describe("Basic Session Checks", () => {
    it('has default parameters', async () => {
        const {USERNAME, DISCORD_USER_ID} = mockConstants;
        const {templateUrl, sessionWaitlistMessage} = mocks.mockSessionParameters;

        const overrideConfirmMessageBase = "CONFIRM ";
        const overrideConfirmMessage = `${overrideConfirmMessageBase}%URL%`;
        const overrideCancelMessage = "CANCEL";

        const date = new Date();
        resetSession({ownerId: DISCORD_USER_ID, description: mockEnv.DEFAULT_SESSION_DESCRIPTION, date: date, name: "%NAME%'s Draft", sessionConfirmMessage: overrideConfirmMessage, sessionCancelMessage: overrideCancelMessage});
        
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
