export function removeFromArray(value: string, arr: string[]): boolean {
    let ndx;
    let removed = false;
    while (-1 !== (ndx = arr.indexOf(value))) {
        arr.splice(ndx, 1);
        removed = true;
    }
    return removed;
}

export function parseDate(parameters: string[]): Date | null {
    const now = new Date();
    let date: Date | null = null;
    if (parameters.length === 1) {
        if (parameters[0].toLocaleLowerCase() === 'clear') {
            // No-op
        } else {
            // This expects a perfectly formatted string
            date = new Date(parameters[0]);
        }
    } else if (parameters.length === 3) {
        // This expects: [mm dd hh:mm]
        // example: 8 22 17:30

        const monthNum = Number.parseInt(parameters[0]);
        const year = `${now.getFullYear() + (monthNum < now.getMonth() ? 1 : 0)}`;
        const month = parameters[0].padStart(2, '0');
        const day = parameters[1].padStart(2, '0');
        
        const timeSplit = parameters[2].split(":");
        const hour = timeSplit[0].padStart(2, '0');
        const minute = timeSplit[1].padStart(2, '0');
        const seconds = "00";

        const dateStr = `${year}-${month}-${day}T${hour}:${minute}:${seconds}`;
        date = new Date(dateStr);
    }

    return date;
}
