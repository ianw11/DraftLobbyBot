import _EditSession from "../../src/commands/editSession";
import setup, { buildContext, MocksInterface } from "../setup.spec";
import { expect } from "../chaiAsync.spec";
import { testCommand } from "./models/Command.spec";
import { mockConstants } from "../TestHelpers.spec";

const EditSession = new _EditSession();

describe('Test EditSession command', () => {
    let mocks: MocksInterface;
    beforeEach(() => {
        mocks = setup();
        mocks.mockDraftUser.setCreatedSessionId(mockConstants.SESSION_ID);
    });

    testCommand(EditSession);

    describe('bad initial parameters', () => {
        it('fails to resolve the session id', async () => {
            const context = buildContext();

            mocks.mockDraftUser.setCreatedSessionId(undefined);

            await expect(EditSession.execute(context)).rejectedWith("Unable to modify session - you haven't created one yet");
        });

        it('fails to resolve the session', async () => {
            const context = buildContext();

            mocks.mockDraftUser.setCreatedSessionId('INVALID_SESSION_ID');

            await expect(EditSession.execute(context)).rejectedWith('SessionId found but resolver failed to find the Session');
        });

        it('fails when too few parameters are provided', async () => {
            const context = buildContext();
            await expect(EditSession.execute(context)).rejectedWith("Editing a session is done `edit <attribute> <value>` for example: `edit name My Cool Draft`.  For more information ask me for help from a server");
        });
    });

    describe('test functionality', () => {
        it('properly sets the name of the session', async () => {
            const context = buildContext('name NEW_NAME');

            await EditSession.execute(context);

            await expect(mocks.mockSession.getNameAsync()).eventually.equals('NEW_NAME');
        });

        [
            'max',
            'num',
            'players',
            'capacity'
        ].forEach(field =>  {
            it('sets session capacity', async () => {
                const context = buildContext(`${field} 4`);
                await EditSession.execute(context);
                expect(mocks.mockSession.getSessionCapacity()).equals(4);
            });
        });

        [
            'd',
            'description'
        ].forEach(field => {
            it('properly updates the description', async () => {
                const newDescription = 'FANCY NEW DESCRIPTION';
                const context = buildContext(`${field} ${newDescription}`);
                await EditSession.execute(context);
                expect(mocks.mockSession.getDescription()).equals(newDescription);
            });
        });

        it('properly updates the date', async () => {
            const now = new Date();
            const context = buildContext('date 8:07');
            await EditSession.execute(context);
            
            const updatedDate = await mocks.mockSessionParameters.date;
            expect(updatedDate.getHours()).equals(8);
            expect(updatedDate.getMinutes()).equals(7);
            expect(updatedDate.getDate()).equals(now.getDate());
            expect(updatedDate.getMonth()).equals(now.getMonth());
        });

        it('fails to update the date if given bad parameters', async () => {
            const context = buildContext('date asdf');
            await expect(EditSession.execute(context)).rejectedWith("I can't understand the time you gave me");
        });

        [
            true,
            false
        ].forEach(fire => {
            [
                'fire',
                'full'
            ].forEach(field => {
                it('updates fireWhenFull', async () => {
                    const context = buildContext(`${field} ${fire}`);
                    await EditSession.execute(context);
                    expect(mocks.mockSessionParameters.fireWhenFull).equals(fire);
                });
            });
        });

        it('updates the template url', async () => {
            const context = buildContext('url newurl');
            await EditSession.execute(context);
            expect(mocks.mockSessionParameters.templateUrl).equals('newurl');
        });

        it('throws when given an unknown command', async () => {
            const context = buildContext('fake fakeparam');
            await expect(EditSession.execute(context)).rejectedWith("Hmm, I don't know what to edit or update");
        });
    });

});
