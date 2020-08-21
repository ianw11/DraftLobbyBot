import Command from './types/Command';

interface CommandMap {
    [i: string]: Command;
}

import ListCommand from './list';
import CreateCommand from './create';
import InfoCommand from './info';
import DeleteCommand from './delete';
import StartCommand from './start';

const Mapping: CommandMap = {
    'list': new ListCommand(),
    'create': new CreateCommand(),
    'info': new InfoCommand(),
    'delete': new DeleteCommand(),
    'start': new StartCommand()
};

export default Mapping;