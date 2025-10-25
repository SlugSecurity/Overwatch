import { Events, type Client, type GuildMember } from 'discord.js';
import { ssoDb, VERIFIED_ROLE_ID } from '#config/sso.ts';

const once = false;
const eventType = Events.GuildMemberAdd;

async function invoke(client: Client, member: GuildMember): Promise<void> {
	const verifiedUser = ssoDb.query('SELECT email FROM verified_users WHERE discord_id = ?').get(member.id) as { email: string } | null;

	if (!verifiedUser) {
		return;
	}

	try {
		await member.roles.add(VERIFIED_ROLE_ID);
		console.log(`[SSO] auto-assigned role on rejoin: discord_id=${member.id} email=${verifiedUser.email} guild_id=${member.guild.id}`);
	} catch (err) {
		console.error(`[SSO] failed to auto-assign role on rejoin: discord_id=${member.id} guild_id=${member.guild.id}`, err);
	}
}

export { once, eventType, invoke };
