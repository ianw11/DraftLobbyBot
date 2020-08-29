import Command from './models/Command';
import ListCommand from './list';
import CreateCommand from './create';
import InfoCommand from './info';
import DeleteCommand from './delete';
import StartCommand from './start';
import DebugCommand from './debug';
import EditSessionCommand from './editSession';
import HelpCommand from './help';
import BroadcastCommand from './broadcast';

interface CommandMap {
    [i: string]: Command;
}

const Mapping: CommandMap = {
    'list': new ListCommand(),
    'create': new CreateCommand(),
    'info': new InfoCommand(),
    'delete': new DeleteCommand(),
    'start': new StartCommand(),
    'edit': new EditSessionCommand(),
    'help': new HelpCommand(),
    'broadcast': new BroadcastCommand(),

    /* Add more Commands above this line (no reason other than it's easier to remember the comma) */
    'debug': new DebugCommand()
};

export default Mapping;