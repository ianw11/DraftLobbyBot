import Context from "./Context";

type StringParameter = {
    name: string;
    type: 'STRING';
    value: string;
};
type BooleanParameter = {
    name: string;
    type: 'BOOLEAN';
    value: boolean;
}

type Parameter = StringParameter | BooleanParameter;

export default interface Command {
    execute(context: Context): Promise<void>;
    help?(): string;
    usage?(invocation: string): string;
    usageExample?(invocation: string): string;
    exclude?: boolean;
}
