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
import TemplateCommand from './templates';

const Mapping: Record<string, Command> = {
    'list': ListCommand.singleton,
    'new': CreateCommand.singleton,
    'create': CreateCommand.singleton,
    'info': InfoCommand.singleton,
    'delete': DeleteCommand.singleton,
    'start': StartCommand.singleton,
    'edit': EditSessionCommand.singleton,
    'help': HelpCommand.singleton,
    'broadcast': BroadcastCommand.singleton,
    'template': TemplateCommand.singleton,
    'templates': TemplateCommand.singleton,

    /* Add more Commands above this line (no reason other than it's easier to remember the comma) */
    'debug': DebugCommand.singleton
};

export default Mapping;