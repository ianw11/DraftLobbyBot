import { testCommand } from "./models/Command.spec";
import _BroadcastCommand from "../../src/commands/broadcast";
import setup, { buildContext, MocksInterface } from "../setup.spec";
import { expect } from "../chaiAsync.spec";
import { Arg } from "@fluffy-spoon/substitute";

const BroadcastCommand = _BroadcastCommand.singleton;

describe('Test Broadcast Command', () => {
    let mocks: MocksInterface;
    beforeEach(() => {
        mocks = setup();
    });

    testCommand(BroadcastCommand);

    it('broadcasts correctly', async () => {
        const context = buildContext('normal broadcast message');

        await BroadcastCommand.execute(context);
        mocks.mockSession.received(1).broadcast('normal broadcast message', false);
    });
    it('broadcasts to all correctly', async () => {
        const context = buildContext('all normal broadcast message');

        await BroadcastCommand.execute(context);
        mocks.mockSession.received(1).broadcast('normal broadcast message', true);
    });

    it('will not broadcast if it cannot find the session (eg user has no session)', async () => {
        const context = buildContext('this should not fire', { draftUser: mocks.userGenerator() });

        await expect(BroadcastCommand.execute(context)).eventually.rejectedWith("Unable to broadcast - you don't have an open Session");
        mocks.mockSession.received(0).broadcast(Arg.all());
    });

    it('will not broadcast if no text is provided', async () => {
        const context = buildContext('');

        await expect(BroadcastCommand.execute(context)).eventually.rejectedWith('Unable to broadcast - empty message');
        mocks.mockSession.received(0).broadcast(Arg.all());
    });

    it("will not broadcast if only the 'all' flag is provided", async () => {
        const context = buildContext('all');

        await expect(BroadcastCommand.execute(context)).eventually.rejectedWith('Unable to broadcast to all - empty message');
        mocks.mockSession.received(0).broadcast(Arg.all());
    });
});