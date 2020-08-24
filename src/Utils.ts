export function removeFromArray(value: string, arr: string[]): boolean {
    let ndx;
    let removed = false;
    while (-1 !== (ndx = arr.indexOf(value))) {
        arr.splice(ndx, 1);
        removed = true;
    }
    return removed;
}
