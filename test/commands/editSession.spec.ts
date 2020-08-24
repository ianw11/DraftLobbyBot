
import _EditSession from "../../src/commands/editSession";
import { buildContext } from "../setup.spec";
import { expect } from "../chaiAsync";

const EditSession = new _EditSession();

describe('basic EditSession tests', () => {
    it('template test', async () => {
        const context = buildContext();

        expect(EditSession.execute(context)).to.be.rejected;
        expect(async () => await EditSession.execute(context)).to.throw;
    });
});
