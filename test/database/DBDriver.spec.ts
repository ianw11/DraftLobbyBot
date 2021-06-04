import { DBDriverBase } from "../../src/database/DBDriver";
import { LowdbDriver } from "../../src/database/lowdb/LowdbDriver";
import { InMemoryDriver } from "../../src/database/inmemory/InMemoryDriver";
import { expect } from "../chaiAsync.spec";
import setup, { mockEnv } from "../setup.spec";

describe("Test DBDriver", () => {

    [
        new InMemoryDriver(),
        new LowdbDriver(mockEnv)
    ].forEach((driver: DBDriverBase) => {
        it("should build a session from template without parameters", () => {
            const serverId = "SERVER_ID";
            const sessionId = "SESSION_ID";
            
            const session = driver.buildSessionFromTemplate(serverId, sessionId, mockEnv);

            expect(session.serverId).equals(serverId);
            expect(session.sessionId).equals(sessionId);
            expect(session.ownerId).to.be.undefined;
            expect(session.joinedPlayerIds).to.deep.equal([]);
            expect(session.waitlistedPlayerIds).to.deep.equal([]);
            expect(session.sessionClosed).to.equal(false);
        });

        it("should build a session from template with parameters", () => {
            const serverId = "SERVER_ID";
            const sessionId = "SESSION_ID";

            const params = setup().mockSessionParameters;
            
            const session = driver.buildSessionFromTemplate(serverId, sessionId, mockEnv, params);

            expect(session.serverId).equals(serverId);
            expect(session.sessionId).equals(sessionId);
            expect(session.ownerId).to.equal(params.ownerId);
            expect(session.joinedPlayerIds).to.deep.equal([]);
            expect(session.waitlistedPlayerIds).to.deep.equal([]);
            expect(session.sessionClosed).to.equal(false);

            expect(session.sessionParameters).to.deep.equal(params);
        });
    });
});