
export function removeFromArray(value: string, arr: string[]) {
    const ndx = arr.indexOf(value);
    if (ndx !== -1) {
        arr.splice(ndx);
    }
}