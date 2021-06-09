import setup, { buildContext, MocksInterface } from "../setup.spec";
import { testCommand } from "./models/Command.spec";
import _CreateCommand from "../../src/commands/create";
import { expect } from "../chaiAsync.spec";
import { Arg } from "@fluffy-spoon/substitute";
import { mockConstants } from "../TestHelpers.spec";

describe('Create Command', () => {
    const {SESSION_CREATION_TEMPLATE_NAME} = mockConstants;
    let mocks: MocksInterface;
    beforeEach(() => {
        mocks = setup();
    });

    const CreateCommand = _CreateCommand.singleton;

    testCommand(CreateCommand);

    it('can create a default Session', async () => {
        const context = buildContext();
        await CreateCommand.execute(context);
        mocks.mockServer.received(1).createSession(mocks.mockDraftUser, undefined);
    });

    it.skip('will not create a Session with an unknown template name', async () => {
        const context = buildContext("unknown_template");
        await expect(CreateCommand.execute(context)).eventually.rejectedWith("Could not find a template named unknown_template");
    });

    it('will create a session with a mock template', async () => {
        const context = buildContext(SESSION_CREATION_TEMPLATE_NAME);
        await CreateCommand.execute(context);
        expect(mocks.mockServer.received(1).createSession(mocks.mockDraftUser, mocks.mockSessionCreationTemplate));
    });

    it('will create a session with a template and a date', async () => {
        const context = buildContext(`${SESSION_CREATION_TEMPLATE_NAME} 8:22`);
        await CreateCommand.execute(context);
        mocks.mockServer.received(1).createSession(mocks.mockDraftUser, Arg.is(template => {
            return template.date.getHours() === 8 &&
                    template.date.getMinutes() === 22;
        }));
    });
});