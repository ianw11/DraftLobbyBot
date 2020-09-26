export function removeFromArray(value: string, arr: string[]): boolean {
    let ndx;
    let removed = false;
    while (-1 !== (ndx = arr.indexOf(value))) {
        arr.splice(ndx, 1);
        removed = true;
    }
    return removed;
}

export function parseDate(parameters: string[]): Date | undefined {
    const now = new Date();
    let date: Date | undefined;
    if (parameters.length === 1) {
        const singleParameter = parameters[0];
        if (singleParameter.toLocaleLowerCase() === 'clear') {
            // No-op
        } else if (singleParameter.length <= 5) {
            const split = singleParameter.split(":");
            if (split.length !== 2) {
                throw new Error("I can't understand the time you gave me");
            }
            date = new Date();
            date.setHours(parseInt(split[0]));
            date.setMinutes(parseInt(split[1]));
        } else {
            // This expects a perfectly formatted string
            date = new Date(singleParameter);
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

export function replaceFromDict(inputStr: string, delimiter: string, dict: Record<string, string>): string {
    let withinDelimiter = true;
    const reducer = (accumulator: string, current: string): string => {
        withinDelimiter = !withinDelimiter;

        if (withinDelimiter) {
            if (dict[current]) {
                return `${accumulator}${dict[current]}`;
            }
            // We found a normal word, don't perform a replacement and put the delimiter back in
            withinDelimiter = false;
            return `${accumulator}${delimiter}${current}`;
        }

        return `${accumulator}${current}`;
    };

    return inputStr.split(delimiter).reduce(reducer, '');
}

export function curryReplaceFromDict(delimiter: string) {
    return (inputStr: string, dict: Record<string, string>): string => replaceFromDict(inputStr, delimiter, dict);
}

export async function asyncForEach<T>(arr: T[], callback: (elem: T, index?: number, array?: T[])=> void | Promise<void>): Promise<void> {
    await Promise.all(arr.map(callback));
}

/**
 * This method accepts the number of items (players) that need to be broken out into pods where pods are filled up as much as possible.
 * 
 * This is desirable if a full pod is most desirable.
 * 
 * @param quantity Number of items to split out
 * @param podSize The desired pod size of each pod
 * @param includeStragglers Include up to one additional pod consisting of the users who can't fill another pod
 */
export function fillPodsFirst(quantity: number, podSize: number, includeStragglers = true): number[] {
    const output = [];
    while (quantity >= podSize) {
        output.push(podSize);
        quantity -= podSize;
    }
    if (quantity > 0 && includeStragglers) {
        output.push(quantity);
    }
    return output;
}

/**
 * This method accepts the number of items (players) that need to be broken out into pods where pods are filled up as evenly as possible.
 * 
 * This is desirable if getting as many to be in as full of pods as possible, but without most of the pods being completely full is desirable.
 * 
 * @param quantity Number of items to split out
 * @param podSize The desired pod size of each pod
 */
export function evenlySplitPods(quantity: number, podSize: number): number[] {
    const output = [];

    /*
    The inner Math.ceil(quantity/podSize) determines the number of pods we will need _at that iteration_.
    If quantity is 16 and podSize is 8, it will result in ceil(2) == 2.
    If quantity is 17-23 and podSize is 8, it will ceil() to 3.
    
    Once we know how many pods are required, it determines how many people fit into one of those pods.
    It pods that number and decrements from the overall quantity. Then it repeats.

    This loop also functions the same as iterating through an array over and over, taking 1 from
    quantity and incrementing the array value ([0, 0] -> [1, 0] -> [1, 1] -> [2, 1] -> ...) but
    only requires Math.ceil(quantity/podSize) iterations instead of ${quantity} interations with
    correspondingly fewer array reads/writes.
    */

    while (quantity > 0) {
        podSize = Math.ceil(quantity / Math.ceil(quantity / podSize));
        output.push(podSize);
        quantity -= podSize;
    }

    return output;
}
