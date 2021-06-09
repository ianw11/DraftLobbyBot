import SessionTemplateCache from "./SessionTemplateCache";

export class Dependencies {
    static sessionTemplateCache: SessionTemplateCache = SessionTemplateCache.singleton;
    private static readonly _sessionTemplateCacheDefault: SessionTemplateCache = SessionTemplateCache.singleton;

    static resetSessionTemplateCache(): void {
        Dependencies.sessionTemplateCache = Dependencies._sessionTemplateCacheDefault;
    }
}
