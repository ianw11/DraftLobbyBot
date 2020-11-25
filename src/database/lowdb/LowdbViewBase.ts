import { ObjectChain, CollectionChain } from "lodash";

export { ObjectChain, CollectionChain };

export class LowDbViewBase<T> {
    protected readonly cursor: ObjectChain<T>;
    constructor (cursor: ObjectChain<T>) {
        this.cursor = cursor;
    }

    assign(val: Partial<T>): void {
        this.cursor.assign(val).write();
    }

    getString<TKey extends keyof T>(name: TKey): string {
        const value = this.cursor.get<TKey>(name).value();
        if (!value) {
            return "";
        }
        return value as string;
    }

    getBoolean<TKey extends keyof T>(name: TKey): boolean {
        const value = this.cursor.get<TKey>(name).value();
        if (typeof value === 'boolean') {
            return value;
        }
        throw new Error(`Cannot coerce value ${name} into boolean`);
    }

    getNumber<TKey extends keyof T>(name: TKey): number {
        const value = this.cursor.get<TKey>(name).value();
        if (typeof value === 'number') {
            return value;
        }
        throw new Error(`Cannot coerce value ${name} into number`);
    }
}