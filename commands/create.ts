import Command from './types/Command';

export default class CreateCommand implements Command {
    execute() {
        console.log("Executing CreateCommand");
    }

    fail() {
        console.log("CreateCommand FAILED ;)");
    }
}