import Command from './types/Command';

export default class ListCommand implements Command {
    execute() {
        console.log('Executing list command');
    }
};
