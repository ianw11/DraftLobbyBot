import { Arg, SubstituteOf } from "@fluffy-spoon/substitute";
import {  GuildChannelManager, Snowflake } from "discord.js";
import { DiscordResolver, Resolver } from "../../../src/models/types/ResolverTypes";
import { asyncForEach } from "../../../src/Utils";
import { expect } from "../../chaiAsync.spec";
import setup, { MocksInterface } from "../../setup.spec";
import { buildMockAnnouncementChannel, buildMockDiscordResolver, buildMockGuild, mockConstants, mockEnv, MockGuildParams } from "../../TestHelpers.spec";

describe('ResolverTypes', () => {
    let mocks: MocksInterface;
    beforeEach(() => {
        mocks = setup();
    });
    describe('Test DiscordResolver', () => {
        let resolver: DiscordResolver;
        beforeEach(() => {
            resolver = new DiscordResolver(mocks.mockGuild, mockEnv);
        });

        function resolverFromGuildParams(params: Partial<MockGuildParams>): DiscordResolver {
            return new DiscordResolver(buildMockGuild({...{channel: mocks.mockAnnouncementChannel, message: mocks.mockMessage}, ...params})[0], mockEnv);
        }

        describe('Test resolving GuildMembers from Tags', () => {
            it('fetches the announcement channel if not already in the cache', () => {
                const guild = buildMockGuild({announcementChannelMissingFromCache: true, channel: mocks.mockAnnouncementChannel, message: mocks.mockMessage})[0];
    
                resolver = new DiscordResolver(guild, mockEnv);
    
                (guild.channels as SubstituteOf<GuildChannelManager>).received(1).create(mockEnv.DRAFT_CHANNEL_NAME);
            });
    
            it('can find GuildMember from a provided tag', () => {
                expect(resolver.resolveGuildMemberFromTag(mockConstants.TAG)).deep.equals(mocks.mockGuildMembers[0]);
            });
            it('returns undefined if no member matches the provided tag', () => {
                expect(resolver.resolveGuildMemberFromTag('FAKE#TAG')).is.undefined;
            });
    
            it('can resolve every GuildMember and will not resolve others', () => {
                mocks.mockGuildMembers.forEach(guildMember => {
                    expect(resolver.resolveGuildMember(guildMember.id)).is.not.undefined;
                    expect(resolver.resolveGuildMember(guildMember.id + 'FAKE' as Snowflake)).is.undefined;
                });
            });
            it('can fetch every GuildMember and will not resolve others', async () => {
                await asyncForEach(mocks.mockGuildMembers, async guildMember => {
                    await expect(resolver.fetchGuildMember(guildMember.id)).is.eventually.not.undefined;
                    await expect(resolver.fetchGuildMember(guildMember.id + 'FAKE' as Snowflake)).is.eventually.undefined;
                });
            });
        });

        describe('Test resolving GuildMembers and Users', () => {
            it('can resolve a user from a userId', () => {
                resolver = resolverFromGuildParams({includedMember: mocks.mockDiscordUser});
    
                const user = resolver.resolveUser(mockConstants.DISCORD_USER_ID);
    
                expect(user).equals(mocks.mockDiscordUser);
            });
            it('returns undefined if the desired userId is not present', () => {
                expect(resolver.resolveUser(mockConstants.DISCORD_USER_ID)).to.be.undefined;
            });
            it('can await fetching a user from a userId', async () => {
                resolver = resolverFromGuildParams({includedMember: mocks.mockDiscordUser, channel: mocks.mockAnnouncementChannel, message: mocks.mockMessage});
    
                const user = await resolver.resolveUserAsync(mockConstants.DISCORD_USER_ID);
                
                expect(user).equals(mocks.mockDiscordUser);
            });
        });

        describe('Test resolving Messages', () => {
            it("can retrieve the session's corresponding message", async () => {
                const message = await resolver.resolveMessageInAnnouncementChannel(mockConstants.SESSION_ID);
                expect(message).equals(mocks.mockMessage);
            });
            it("can fetch the session's corresponding message", async () => {
                const announcementChannel = buildMockAnnouncementChannel({forceFetch: true, announcementMessage: mocks.mockMessage});
                resolver = resolverFromGuildParams({forceFetch: true, channel: announcementChannel});
                await expect(resolver.resolveMessageInAnnouncementChannel(mockConstants.SESSION_ID)).eventually.equals(mocks.mockMessage);
            });

            it('will error if the announcementChannel is not set properly', async () => {
                resolver = resolverFromGuildParams({announcementChannelMissingFromCache: true});
                await expect(resolver.resolveMessageInAnnouncementChannel(mockConstants.SESSION_ID)).eventually.rejectedWith("Text Channel not attached - unable to resolveMessage.  If the server just came online, maybe try one more time in 10-15 seconds");
            });

            it('will return undefined if the channel does not exist', async () => {
                resolver = resolverFromGuildParams({resolveNonTextChannel: 'none'});
                await expect(resolver.resolveMessageInAnnouncementChannel(mockConstants.SESSION_ID)).eventually.to.be.undefined;
            });
            it('will return undefined if the channel is not text', async () => {
                resolver = resolverFromGuildParams({resolveNonTextChannel: 'voice'});
                await expect(resolver.resolveMessageInAnnouncementChannel(mockConstants.SESSION_ID)).eventually.to.be.undefined;
            });
        });
    });

    

    describe('Test Resolver', () => {
        let resolver: Resolver;
        beforeEach(() => {
            resolver = new Resolver(buildMockDiscordResolver(mocks.mockMessage, mocks.mockAnnouncementChannel), mocks.mockDBDriver);
        });

        it('should resolve a DraftUser from the id', () => {
            resolver.resolveUser(mockConstants.DISCORD_USER_ID);
            
            expect(mocks.mockDBDriver.received(1).getOrCreateUserView(mockConstants.DISCORD_SERVER_ID, mockConstants.DISCORD_USER_ID));
        });

        it('should resolve a Session - 100 times with only 1 call to the db', () => {
            for (let i = 0; i < 100; ++i) {
                resolver.resolveSession(mockConstants.SESSION_ID);
            }
            expect(mocks.mockDBDriver.received(1).getSessionView(mockConstants.DISCORD_SERVER_ID, mockConstants.SESSION_ID));
        });
        it('should resolve 5 sessions then drop the lowest to fit in a sixth', () => {
            for(let i = 0; i < 6; ++i) {
                resolver.resolveSession(`SESSION_VIEW_${i}` as unknown as Snowflake);
            }
            for (let i = 1; i < 6; ++i) {
                resolver.resolveSession(`SESSION_VIEW_${i}` as unknown as Snowflake);
            }
            expect(mocks.mockDBDriver.received(6).getSessionView(Arg.all()));
        });
    });
});