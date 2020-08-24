import {removeFromArray} from '../src/Utils';
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