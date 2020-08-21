import Context from "./Context";

export default interface Command {
    execute(context: Context): Promise<void>;
}
