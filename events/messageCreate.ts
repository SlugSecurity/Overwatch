import { Events, type Client, type Message } from 'discord.js';
import { sendFirstTimeGreeting } from '#util/greeting.ts';
import { VERIFIED_ROLE_ID } from '#config/sso.ts';
import { ACTIVE_MEMBER_ROLE_ID, ACTIVE_MEMBER_CONFIG } from '#config/activeMember.ts';
import { incrementMessageCount, getQuarterMessageCount, tryGrantActiveMemberRole } from '#util/activeMember.ts';

const once = false;
const eventType = Events.MessageCreate;

async function invoke(client: Client, message: Message): Promise<void> {
	if (message.author.bot) {
		return;
	}

	await sendFirstTimeGreeting(message.author, message.member);

	if (!message.member?.roles.cache.has(VERIFIED_ROLE_ID)) {
		return;
	}

	await incrementMessageCount(message.author.id);

	if (!ACTIVE_MEMBER_ROLE_ID || message.member.roles.cache.has(ACTIVE_MEMBER_ROLE_ID)) {
		return;
	}

	const totalCount = await getQuarterMessageCount(message.author.id);
	if (totalCount >= ACTIVE_MEMBER_CONFIG.messageThreshold) {
		await tryGrantActiveMemberRole(message.member);
	}
}

export { once, eventType, invoke };
