
import _EditSession from "../../src/commands/editSession";
import setup, { buildContext } from "../setup.spec";

const EditSession = new _EditSession();

describe('basic tests', () => {
    it('', () => {
        const context = buildContext();
        const {} = setup();

        EditSession.execute(context);
    });
});
