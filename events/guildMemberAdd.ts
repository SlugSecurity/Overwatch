import { Events, type Client, type GuildMember } from 'discord.js';
import { getVerifiedUsersCollection } from '#config/database.ts';
import { VERIFIED_ROLE_ID } from '#config/sso.ts';
import { ACTIVE_MEMBER_ROLE_ID } from '#config/activeMember.ts';
import { isQualifiedForCurrentQuarter } from '#util/activeMember.ts';

const once = false;
const eventType = Events.GuildMemberAdd;

async function invoke(client: Client, member: GuildMember): Promise<void> {
	const verifiedUser = await getVerifiedUsersCollection().findOne({ _id: member.id });

	if (!verifiedUser) {
		return;
	}

	try {
		await member.roles.add(VERIFIED_ROLE_ID);
		console.log(`[SSO] auto-assigned role on rejoin: discord_id=${member.id} email=${verifiedUser.email} guild_id=${member.guild.id}`);
	} catch (err) {
		console.error(`[SSO] failed to auto-assign role on rejoin: discord_id=${member.id} guild_id=${member.guild.id}`, err);
	}

	if (!ACTIVE_MEMBER_ROLE_ID) return;

	const qualified = await isQualifiedForCurrentQuarter(member.id);
	if (!qualified) return;

	try {
		await member.roles.add(ACTIVE_MEMBER_ROLE_ID);
		console.log(`[ACTIVE_MEMBER] auto-assigned role on rejoin: discord_id=${member.id} guild_id=${member.guild.id}`);
	} catch (err) {
		console.error(`[ACTIVE_MEMBER] failed to auto-assign role on rejoin: discord_id=${member.id} guild_id=${member.guild.id}`, err);
	}
}

export { once, eventType, invoke };
