import { expect } from "chai";
import { IUserView } from "../../src/database/UserDBSchema";
import { LowdbDriver } from "../../src/database/lowdb/LowdbDriver";
import { DBDriver } from "../../src/database/DBDriver";
import { mockConstants, mockEnv } from "../TestHelpers.spec";
import { Snowflake } from "discord.js";


const { DISCORD_SERVER_ID, DISCORD_USER_ID } = mockConstants;

describe("can read and write from db", () => {
    let driver: DBDriver;
    let data: IUserView;

    beforeEach(() => {
        driver = new LowdbDriver(mockEnv);
        data = driver.getOrCreateUserView(DISCORD_SERVER_ID, DISCORD_USER_ID);
    });

    afterEach(() => {
        driver.deleteUserFromDatabase(DISCORD_SERVER_ID, DISCORD_USER_ID);
    });

    it("should write and then read", async () => {
        const mockCreatedSessionId = "MOCK_CREATED_SESSION_ID" as Snowflake;
        const mockCreatedSessionId2 = "MOCK_CREATED_SESSION_ID_2" as Snowflake;

        expect(data.userId).eq(DISCORD_USER_ID);

        expect(data.createdSessionId).is.undefined;
        data.createdSessionId = mockCreatedSessionId;
        expect(data.createdSessionId).eq(mockCreatedSessionId);
        data.createdSessionId = undefined;
        expect(data.createdSessionId).is.undefined;

        expect(data.joinedSessionIds).is.empty;
        data.removedFromSession(mockCreatedSessionId); // Make sure I can remove when it's not present
        data.addedToSession(mockCreatedSessionId);
        expect(data.joinedSessionIds).contains(mockCreatedSessionId);
        data.removedFromSession(mockCreatedSessionId);
        expect(data.joinedSessionIds).is.empty;

        expect(data.waitlistedSessionIds).is.empty;
        data.removedFromWaitlist(mockCreatedSessionId); // Make sure I can remove when it's not present
        data.addedToWaitlist(mockCreatedSessionId);
        expect(data.waitlistedSessionIds).contains(mockCreatedSessionId);
        data.removedFromWaitlist(mockCreatedSessionId);
        expect(data.waitlistedSessionIds).is.empty;
        data.addedToWaitlist(mockCreatedSessionId);
        data.upgradedFromWaitlist(mockCreatedSessionId);
        expect(data.waitlistedSessionIds).is.empty;
        expect(data.joinedSessionIds).contains(mockCreatedSessionId);
        data.removedFromSession(mockCreatedSessionId);
        expect(data.joinedSessionIds).is.empty;

        data.addedToSession(mockCreatedSessionId);
        data.addedToSession(mockCreatedSessionId2);
        data.removedFromSession(mockCreatedSessionId);
        expect(data.joinedSessionIds.length).eq(1);
        expect(data.joinedSessionIds).contains(mockCreatedSessionId2);
        data.removedFromSession(mockCreatedSessionId2);
    });

    it("should be a blank object again", () => {
        expect(data.joinedSessionIds.length).eq(0);
        expect(data.waitlistedSessionIds.length).eq(0);
    })
});
