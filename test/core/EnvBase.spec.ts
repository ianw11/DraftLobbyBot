import { expect } from '../chaiAsync.spec';
import { replaceStringWithEnv } from '../../src/core/EnvBase';
import { mockEnv } from '../setup.spec';

describe('test EnvBase', () => {
    it('modifies the line', () => {

        const input = `Send %PREFIX%help to see help`;
        const output = replaceStringWithEnv(input, mockEnv);

        expect(output).to.equal(`Send ${mockEnv.PREFIX}help to see help`);
    });
    it('does not modify the line', () => {
        const input = '65% complete';
        const output = replaceStringWithEnv(input, mockEnv);
        expect(output).to.equal(input);
    });
    it('modifies the correct parts', () => {
        const input = '%PREFIX% 65% %PREFIX% %65%';
        const expectedOutput = `${mockEnv.PREFIX} 65% ${mockEnv.PREFIX} %65%`;

        const output = replaceStringWithEnv(input, mockEnv);
        expect(output).to.equal(expectedOutput);
    });
    it('modifies the correct parts', () => {
        const input = '%65% %PREFIX% 65%';
        const expectedOutput = `%65% ${mockEnv.PREFIX} 65%`;

        const output = replaceStringWithEnv(input, mockEnv);
        expect(output).to.equal(expectedOutput);
    });
    it('modifies the correct parts', () => {
        const input = 'These are normal words%PREFIX%';
        const expectedOutput = `These are normal words${mockEnv.PREFIX}`;

        expect(replaceStringWithEnv(input, mockEnv)).to.equal(expectedOutput);
    });
    it('does not modify empty strings', () => {
        expect(replaceStringWithEnv('', mockEnv)).to.equal('');
    });
});