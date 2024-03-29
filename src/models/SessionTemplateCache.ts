import {SessionParametersWithSugar} from "../database/SessionDBSchema";

type OptionalSessionParameter = Partial<SessionParametersWithSugar> | undefined;
type SessionParameterMap = Record<string, OptionalSessionParameter>;
type SessionParameterFile = Record<string, SessionParameterMap>;

let Templates: SessionParameterFile = {};
let CommonTemplate: SessionParameterMap = {};

const COMMON_TEMPLATE_NAME = "_common";

try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    Templates = require('../../../config/SessionTemplates.json') as SessionParameterFile;
    CommonTemplate = Templates[COMMON_TEMPLATE_NAME] || {};
} catch (e) {
    console.error("Could not find config/SessionTemplates.json - running without template support");
}

/**
 * The entire reason this class is a singleton is to make testing templates easier.
 * A middleman file is easier to mock rather than directly importing the template file.
 * It also has the benefit of funneling all requests through it.
 */
export default class SessionTemplateCache {
    static readonly singleton = new SessionTemplateCache();

    private constructor() { // No-op
    }

    getTemplate(serverId: string, templateName: string): Partial<SessionParametersWithSugar> | undefined {
        // Perform a check to see if we have an object for the provided serverId
        // Then if we do, check if it has the desired template.
        // If either doesn't exist, return whatever is in the CommonTemplate.

        const serverTemplates = Templates[serverId];
        if (serverTemplates) {
            const possibleTemplate = serverTemplates[templateName];
            if (possibleTemplate) {
                return possibleTemplate;
            }
        }

        return CommonTemplate[templateName];
    }

    getTemplatesForServer(serverId: string, includeCommon = true): Record<string, OptionalSessionParameter> {
        const output: Record<string, OptionalSessionParameter> = {};

        // Load the common templates first
        if (includeCommon && CommonTemplate) {
            Object.keys(CommonTemplate).forEach((commonKey) => {
                output[commonKey] = CommonTemplate[commonKey];
            });
        }

        // Override the common templates with server-specific templates
        const serverTemplates = Templates[serverId];
        if (serverTemplates) {
            Object.keys(serverTemplates).forEach((templateName) => {
                output[templateName] = serverTemplates[templateName];
            });
        }

        return output;
    }
}
