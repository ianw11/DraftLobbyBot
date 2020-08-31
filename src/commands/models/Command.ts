import Context from "./Context";

export default interface Command {
    execute(context: Context): Promise<void>;
    help?(): string;
    usage?(invocation: string): string;
    usageExample?(invocation: string): string;
    exclude?: boolean;
}
