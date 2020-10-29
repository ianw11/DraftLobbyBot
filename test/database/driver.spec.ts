import { expect } from "chai";
import {getUser, writeUser} from "../../src/database/driver";
import setup, { MocksInterface } from '../setup.spec';

let mocks: MocksInterface;
beforeEach(() => {
    mocks = setup();
});

describe("can read and write from db", () => {
    it("should write and then read", async () => {
        const user = mocks.userGenerator();
        const userId = user.getUserId();
        
        writeUser(user);
        let dbUser = getUser(userId);

        expect(dbUser).to.not.be.undefined;
        expect(dbUser.userId).eq(userId);
        expect(dbUser.createdSessionId).to.be.undefined;


        const mockCreatedSessionId = "MOCK_CREATED_SESSION_ID";
        await user.addedToSession(mocks.mockSession);
        user.setCreatedSessionId(mockCreatedSessionId);
        writeUser(user);
        dbUser = getUser(userId);
        console.log(dbUser);

        expect(dbUser).to.not.be.undefined;
        expect(dbUser.userId).eq(userId);
        expect(dbUser.createdSessionId).eq(mockCreatedSessionId);
    })
})