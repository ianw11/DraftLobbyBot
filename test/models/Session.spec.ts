import * as chai from "chai";
import * as chaiAsPromised from 'chai-as-promised';
chai.use(chaiAsPromised);
const {assert, expect} = chai;
import setup, { MocksInterface, mockConstants } from "../setup.spec";
import Session, {DEFAULT_PARAMS} from "../../src/models/Session";
import { Arg, SubstituteOf } from "@fluffy-spoon/substitute";
import DraftUser from "../../src/models/DraftUser";

/*
Could use testing:
- Sessions with/without owner user id
- Adding/removing users
 */

const constants = mockConstants;

let mocks: MocksInterface;

let session: Session;

beforeEach(() => {
    mocks = setup();
    session = new Session(mocks.mockMessage, mocks.userResolver, mocks.mockSessionParameters);
})

describe("Basic Session Checks", () => {
    it('has default parameters', () => {
        const {USERNAME, DISCORD_USER_ID} = constants;
        session = new Session(mocks.mockMessage, mocks.userResolver, {ownerId: DISCORD_USER_ID});
        
        expect(session.getName()).to.equal(`${USERNAME}'s Draft`);
        assert(session.getUrl().startsWith(`https://mtgadraft.herokuapp.com/?session=`));
        expect(session.getFireWhenFull()).to.equal(DEFAULT_PARAMS.fireWhenFull);
        expect(session.getSessionCapacity()).to.equal(DEFAULT_PARAMS.sessionCapacity);
        expect(session.getDescription()).to.equal(DEFAULT_PARAMS.description);
        expect(session.getDate()).to.equal(DEFAULT_PARAMS.date);
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
        mockMessage.received(5).edit(Arg.any('string'));
    });

    it('cannot set invalid parameters', async () => {
        const {mockMessage, mockSessionParameters} = mocks;
        const {sessionCapacity} = mockSessionParameters;

        expect(session.setSessionCapacity(0)).be.rejected;
        expect(session.getSessionCapacity()).to.equal(sessionCapacity);

        expect(session.setSessionCapacity(-5)).be.rejected;
        expect(session.getSessionCapacity()).to.equal(sessionCapacity);

        mockMessage.received(0).edit(Arg.any('string'));
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
});
