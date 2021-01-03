import {removeFromArray, parseDate, asyncForEach, curryReplaceFromDictWithDelimiter, fillPodsFirst, evenlySplitPods} from '../src/Utils';
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

describe('test parsing date', () => {
    it('parses a fully formatted date', () => {
        const dateString = '2011-10-10T14:48:00.000+09:00';
        const expectedDate = new Date(dateString);

        const date = parseDate([dateString]);

        expect(date).to.deep.equal(expectedDate);
        expect(date.getTime()).equals(expectedDate.getTime());
    });

    it('parses just a time', () => {
        const timeString = "20:30";
        const today = new Date();

        const date = parseDate([timeString]);

        expect(date.getHours()).equals(20);
        expect(date.getMinutes()).equals(30);

        expect(date.getDay()).equals(today.getDay());
        expect(date.getMonth()).equals(today.getMonth());
    });

    it('fails to parse a bad time', () => {
        const badTimeString = "5:";

        expect(parseDate([badTimeString])).to.throw;
    });

    it('parses a full user date string', () => {
        const userInput = "8 22 17:30";

        const date = parseDate([userInput]);

        expect(date.getMonth()).equals(8 - 1); // -1 because _apparently_ months are 0-indexed
        expect(date.getDate()).equals(22);
        expect(date.getHours()).equals(17);
        expect(date.getMinutes()).equals(30);
    });
});

describe('test replaceFromDict', () => {
    const curriedReplaceFromDict = curryReplaceFromDictWithDelimiter("%");
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

describe('test asyncForEach (this may take longer than other tests)', () => {
    const expected = [1, 2, 3, 4, 5, 6, 7, 8, 9];

    it('Executes in order and returns properly', async () => {
        const outerArr = [];
        const callback = async (elem: number) => new Promise<void>((res) => {
            setTimeout(() => {
                outerArr.push(elem);
                res();
            }, elem * 50);
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
    it('Executes all callbacks even if one rejects', async () => {
        const input = [0, 1, 2, 3, 4, 3];
        const expectedOutput = [1, 2, 4];
        const output = [];
        let rejectCount = 0;
        const callback = async (elem: number) => {
            if (elem === 0 || elem === 3) {
                ++rejectCount;
                throw new Error(`This should be thrown ${elem}`);
            } else {
                output.push(elem);
            }
        }

        /*
        This is an important test because it shows something interesting - we can safely rely
        on asyncForEach to fully execute each callback even if one throws and it will reject with
        only the first error.

        If this test fails it might signal an issue with the runtime/interpreter and/or how Promises are handled.
        */

        await expect(asyncForEach(input, callback)).is.rejectedWith('This should be thrown 0');
        expect(expectedOutput).deep.equals(output);
        expect(rejectCount).equals(3);
    });
});

describe('test fillPodsFirst', () => {
    it('should work for equal quantity and podSize', () => {
        expect(fillPodsFirst(8, 8)).deep.equals([8]);
    });

    it('should work for quantity = N*podSize', () => {
        expect(fillPodsFirst(16, 8)).deep.equals([8, 8]);
        expect(fillPodsFirst(40, 8)).deep.equals([8, 8, 8, 8, 8]);
    });

    it('should handle quantity < podSize', () => {
        expect(fillPodsFirst(7, 8)).deep.equals([7]);
        expect(fillPodsFirst(1, 8)).deep.equals([1]);
        expect(fillPodsFirst(0, 8)).deep.equals([]);
    });

    it('should handle uneven quantities', () => {
        expect(fillPodsFirst(13, 8)).deep.equals([8, 5]);
        expect(fillPodsFirst(15, 8)).deep.equals([8, 7]);
        expect(fillPodsFirst(17, 8)).deep.equals([8, 8, 1]);
        expect(fillPodsFirst(18, 8)).deep.equals([8, 8, 2]);
        expect(fillPodsFirst(19, 8)).deep.equals([8, 8, 3]);

        expect(fillPodsFirst(39, 8)).deep.equals([8, 8, 8, 8, 7]);
        expect(fillPodsFirst(41, 8)).deep.equals([8, 8, 8, 8, 8, 1]);
        expect(fillPodsFirst(43, 8)).deep.equals([8, 8, 8, 8, 8, 3]);
        expect(fillPodsFirst(44, 8)).deep.equals([8, 8, 8, 8, 8, 4]);
        expect(fillPodsFirst(45, 8)).deep.equals([8, 8, 8, 8, 8, 5]);
        expect(fillPodsFirst(46, 8)).deep.equals([8, 8, 8, 8, 8, 6]);
        expect(fillPodsFirst(47, 8)).deep.equals([8, 8, 8, 8, 8, 7]);
    });

    it('should handle disband waitlist', () => {
        expect(fillPodsFirst(7, 8, false)).deep.equals([]);
        expect(fillPodsFirst(1, 8, false)).deep.equals([]);
        expect(fillPodsFirst(0, 8, false)).deep.equals([]);
    });

    it('should handle uneven quantities, disbanding waitlist', () => {
        expect(fillPodsFirst(13, 8, false)).deep.equals([8]);
        expect(fillPodsFirst(15, 8, false)).deep.equals([8]);
        expect(fillPodsFirst(17, 8, false)).deep.equals([8, 8]);
        expect(fillPodsFirst(18, 8, false)).deep.equals([8, 8]);
        expect(fillPodsFirst(19, 8, false)).deep.equals([8, 8]);

        expect(fillPodsFirst(39, 8, false)).deep.equals([8, 8, 8, 8]);
        expect(fillPodsFirst(41, 8, false)).deep.equals([8, 8, 8, 8, 8]);
        expect(fillPodsFirst(43, 8, false)).deep.equals([8, 8, 8, 8, 8]);
        expect(fillPodsFirst(44, 8, false)).deep.equals([8, 8, 8, 8, 8]);
        expect(fillPodsFirst(45, 8, false)).deep.equals([8, 8, 8, 8, 8]);
        expect(fillPodsFirst(46, 8, false)).deep.equals([8, 8, 8, 8, 8]);
        expect(fillPodsFirst(47, 8, false)).deep.equals([8, 8, 8, 8, 8]);
    });
});

describe('test evenlySplitPods', () => {
    it('should work for equal quantity and podSize', () => {
        expect(evenlySplitPods(8, 8)).deep.equals([8]);
    });

    it('should work for quantity = N*podSize', () => {
        expect(evenlySplitPods(16, 8)).deep.equals([8, 8]);
        expect(evenlySplitPods(40, 8)).deep.equals([8, 8, 8, 8, 8]);
    });

    it('should handle quantity < podSize', () => {
        expect(evenlySplitPods(7, 8)).deep.equals([7]);
        expect(evenlySplitPods(1, 8)).deep.equals([1]);
        expect(evenlySplitPods(0, 8)).deep.equals([]);
    });

    it('should handle uneven quantities', () => {
        expect(evenlySplitPods(13, 8)).deep.equals([7, 6]);
        expect(evenlySplitPods(15, 8)).deep.equals([8, 7]);
        expect(evenlySplitPods(17, 8)).deep.equals([6, 6, 5]);
        expect(evenlySplitPods(18, 8)).deep.equals([6, 6, 6]);
        expect(evenlySplitPods(19, 8)).deep.equals([7, 6, 6]);

        expect(evenlySplitPods(39, 8)).deep.equals([8, 8, 8, 8, 7]);
        expect(evenlySplitPods(41, 8)).deep.equals([7, 7, 7, 7, 7, 6]);
        expect(evenlySplitPods(43, 8)).deep.equals([8, 7, 7, 7, 7, 7]);
        expect(evenlySplitPods(44, 8)).deep.equals([8, 8, 7, 7, 7, 7]);
        expect(evenlySplitPods(45, 8)).deep.equals([8, 8, 8, 7, 7, 7]);
        expect(evenlySplitPods(46, 8)).deep.equals([8, 8, 8, 8, 7, 7]);
        expect(evenlySplitPods(47, 8)).deep.equals([8, 8, 8, 8, 8, 7]);
    });
});
