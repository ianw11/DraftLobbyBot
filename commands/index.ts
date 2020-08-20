import Command from './types/Command';

interface CommandMap {
    [index: string]: Command;
}

import List from './list';
import Create from './create';

const Mapping: CommandMap = {
    'list': new List(),
    'create': new Create()
};

export default Mapping;