
export function removeFromArray(value: string, arr: string[]): boolean {
    const ndx = arr.indexOf(value);
    if (ndx !== -1) {
        arr.splice(ndx);
        return true;
    }
    return false;
}