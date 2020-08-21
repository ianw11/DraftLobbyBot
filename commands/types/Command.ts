import Context from "./Context";

export default interface Command {
    execute(context: Context): Promise<void>;
    help?(): string;
    usage?(command: string): string;
    usageExample?(command: string): string;
    exclude?: boolean;
}
