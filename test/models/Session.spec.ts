import * as chai from "chai";
import * as chaiAsPromised from 'chai-as-promised';
chai.use(chaiAsPromised);
const {assert, expect} = chai;
import setup, { MocksInterface, mockConstants } from "../setup.spec";
import Session, {DEFAULT_PARAMS} from "../../src/models/Session";
import { Arg } from "@fluffy-spoon/substitute";

const constants = mockConstants;

let mocks: MocksInterface;

let session: Session;

beforeEach(() => {
    mocks = setup();
    session = new Session(constants.DISCORD_USER_ID, mocks.mockMessage, mocks.userResolver, mocks.mockSessionParameters);
})

describe("Basic Session Checks", () => {
    it('has default parameters', () => {
        session = new Session(constants.DISCORD_USER_ID, mocks.mockMessage, mocks.userResolver);
        const {USERNAME} = constants;
        
        expect(session.getName()).to.equal(`${USERNAME}'s Draft`);
        assert(session.getUrl().startsWith(`https://mtgadraft.herokuapp.com/?session=`));
        expect(session.getFireWhenFull()).to.equal(DEFAULT_PARAMS.fireWhenFull);
        expect(session.getMaxNumPlayers()).to.equal(DEFAULT_PARAMS.maxNumPlayers);
        expect(session.getDescription()).to.equal(DEFAULT_PARAMS.description);
        expect(session.getDate()).to.equal(DEFAULT_PARAMS.date);
    });
    it('can update parameters', async () => {
        const {mockSessionParameters, mockMessage} = mocks;

        const NAME = "NEW NAME";
        await session.setName(NAME);
        expect(session.getName()).to.equal(NAME);

        const URL = "NEW URL";
        await session.setUrl(URL);
        expect(session.getUrl()).to.equal(URL);

        const DESCRIPTION = "NEW DESCRIPTION";
        await session.setDescription(DESCRIPTION);
        expect(session.getDescription()).to.equal(DESCRIPTION);

        const FIRE_WHEN_FULL = !mockSessionParameters.fireWhenFull;
        await session.setFireWhenFull(FIRE_WHEN_FULL);
        expect(session.getFireWhenFull()).to.equal(FIRE_WHEN_FULL);

        const MAX_PLAYERS = 2;
        await session.setMaxNumPlayers(MAX_PLAYERS);
        expect(session.getMaxNumPlayers()).to.equal(MAX_PLAYERS);

        const date = new Date();
        await session.setDate(date);
        expect(session.getDate()).to.deep.equal(date);

        // Setting url does not update the message
        mockMessage.received(5).edit(Arg.any('string'));
    });

    it('cannot set invalid parameters', async () => {
        const {mockMessage} = mocks;
        const {maxNumPlayers} = DEFAULT_PARAMS;

        expect(session.setMaxNumPlayers(0)).be.rejected;
        expect(session.getMaxNumPlayers()).to.equal(maxNumPlayers);

        expect(session.setMaxNumPlayers(-5)).be.rejected;
        expect(session.getMaxNumPlayers()).to.equal(maxNumPlayers);

        mockMessage.received(0).edit(Arg.any('string'));
    });
});