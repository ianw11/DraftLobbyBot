import Command from "../../../src/commands/models/Command";
import { expect } from "../../chaiAsync.spec";

export function testCommand(command: Command): void {
    const INVOCATION = 'INVOCATION';

    it('has help test', () => {
        expect(command.help).is.not.undefined;
        expect(command.help()).is.not.empty;
    });

    it('has usage text', () => {
        expect(command.usage).is.not.undefined;
        expect(command.usage(INVOCATION)).is.not.empty;
    });

    it('has usage example', () => {
        expect(command.usageExample).is.not.undefined;
        expect(command.usageExample(INVOCATION)).is.not.empty;
    });
}
