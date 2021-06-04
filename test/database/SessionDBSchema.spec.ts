import { ReadonlySessionView } from "../../src/database/SessionDBSchema";
import { expect } from "../chaiAsync.spec";
import setup, { MocksInterface } from "../setup.spec";

describe("Test ReadonlySessionView", () => {
    let mocks: MocksInterface;
    beforeEach(() => {
        mocks = setup();
    });

    it("should return proper parameter values", () => {
        const view = new ReadonlySessionView(mocks.mockSessionDBSchema);

        expect(view.serverId).to.equal(mocks.mockSessionDBSchema.serverId);
        expect(view.sessionId).to.equal(mocks.mockSessionDBSchema.sessionId);
        expect(view.sessionParameters).to.deep.equal(mocks.mockSessionParameters);
        expect(view.joinedPlayerIds).to.deep.equal(mocks.mockSessionDBSchema.joinedPlayerIds);
        expect(view.waitlistedPlayerIds).to.deep.equal(mocks.mockSessionDBSchema.waitlistedPlayerIds);
        expect(view.sessionClosed).to.equal(mocks.mockSessionDBSchema.sessionClosed);
        expect(view.ownerId).to.equal(mocks.mockSessionDBSchema.ownerId);
    });

    it("should throw when calling anything", () => {
        const view = new ReadonlySessionView(mocks.mockSessionDBSchema);

        expect(() => view.addToConfirmed()).to.throw("READ-ONLY");
        expect(() => view.removeFromConfirmed()).to.throw("READ-ONLY");
        expect(() => view.addToWaitlist()).to.throw("READ-ONLY");
        expect(() => view.removeFromWaitlist()).to.throw("READ-ONLY");
        expect(() => view.upgradedFromWaitlist()).to.throw("READ-ONLY");

        // These are fine because they're getters
        expect(view.getNumConfirmed()).to.equal(0);
        expect(view.getNumWaitlisted()).to.equal(0);
    });
});