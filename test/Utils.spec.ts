import {removeFromArray, parseDate, asyncForEach, curryReplaceFromDict} from '../src/Utils';
import { expect } from 'chai';

describe('test removeFromArray', () => {
    it('removes the element', () => {
        const arr = ['a'];
        const removed = removeFromArray('a', arr);
        expect(removed).eq(true);
        expect(arr.length).equals(0);
    });

    it('removes nothing', () => {
        const arr = ['b'];
        const removed = removeFromArray('a', arr);
        expect(removed).eq(false);
        expect(arr.length).equals(1);
        expect(arr[0]).equals('b');
    });

    it('cannot remove anything', () => {
        const arr = [];
        const removed = removeFromArray('a', arr);
        expect(removed).eq(false);
        expect(arr.length).equals(0);
    });

    it('removes only the element', () => {
        const arr = ['b', 'c', 'a', 'd', 'e'];
        const removed = removeFromArray('a', arr);
        expect(removed).eq(true);
        expect(arr).deep.equals(['b', 'c', 'd', 'e']);
    });

    it('removes all copies', () => {
        const arr = ['a', 'a', 'b', 'a'];
        const removed = removeFromArray('a', arr);
        expect(removed).eq(true);
        expect(arr).deep.equals(['b']);
    });
});

describe.skip('test parsing date', () => {
    it('parses a fully formatted date', () => {
        const dateString = '2011-10-10T14:48:00.000+09:00';
        const expectedDate = Date.parse(dateString);

        const date = parseDate([dateString]);

        expect(date).to.deep.equal(expectedDate);
    });
});

describe('test replaceFromDict', () => {
    const curriedReplaceFromDict = curryReplaceFromDict("%");
    const dict = {YES: "yes"};

    it('replaces from dict', () => {
        const inputStr = "This should be yes: %YES%";

        const outputStr = curriedReplaceFromDict(inputStr, dict);

        expect(outputStr).equals("This should be yes: yes");
    });
    it('does not replace anything', () => {
        const str = "Do not replace me";
        expect(curriedReplaceFromDict(str, dict)).equals(str);
    });
    it('does not substitute if the dict is missing an entry', () => {
        const str = "Cannot find %NO%";
        expect(curriedReplaceFromDict(str, dict)).equals(str);
    });
    it('replaces from the start of the string', () => {
        const inputStr = "%YES% is yes";
        const expectedStr = "yes is yes";

        expect(curriedReplaceFromDict(inputStr, dict)).equals(expectedStr);
    });
    it('replaces from the end of the string', () => {
        const inputStr = "yes is %YES%";
        const expectedStr = "yes is yes";

        expect(curriedReplaceFromDict(inputStr, dict)).equals(expectedStr);
    });
    it('replaces all instances', () => {
        const inputStr = "%YES% is %YES%";
        const expectedStr = "yes is yes";

        expect(curriedReplaceFromDict(inputStr, dict)).equals(expectedStr);
    });
    it('ignores the delimiter if not an escape', () => {
        const str = "This % st%rin%g h%as %% many %";
        expect(curriedReplaceFromDict(str, dict)).equals(str);
    });
    it('only has the escape', () => {
        const inputStr = "%YES%";
        const expectedStr = "yes";

        expect(curriedReplaceFromDict(inputStr, dict)).equals(expectedStr);
    });
});

describe('test asyncForEach (this could take up to 2 seconds)', () => {
    const expected = [1, 2, 3, 4, 5, 6, 7, 8, 9];

    it('Executes in order and returns properly', async () => {
        const outerArr = [];
        const callback = async (elem: number) => new Promise<void>((res) => {
            setTimeout(() => {
                outerArr.push(elem);
                res();
            }, elem);
        });

        await asyncForEach(expected, callback);

        expect(outerArr).deep.equals(expected);
    });
    it('Executes in order on a regular function', async () => {
        const outerArr = [];
        const callback = (elem: number) => { outerArr.push(elem) };

        await asyncForEach(expected, callback);

        expect(outerArr).deep.equals(expected);
    });
});
