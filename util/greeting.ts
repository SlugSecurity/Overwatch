import {
	EmbedBuilder,
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
	type User
} from 'discord.js';
import { greetingDb, GREETING_MESSAGES } from '#config/greeting.ts';
import { ssoDb, SSO_CONFIG } from '#config/sso.ts';
import { generateState } from '#server/oauth.ts';

export async function sendFirstTimeGreeting(user: User): Promise<boolean> {
	const userId = user.id;

	const alreadyGreeted = greetingDb.query('SELECT discord_id FROM greeted_users WHERE discord_id = ?').get(userId);
	if (alreadyGreeted) {
		return false;
	}

	const alreadyVerified = ssoDb.query('SELECT discord_id FROM verified_users WHERE discord_id = ?').get(userId);
	if (alreadyVerified) {
		greetingDb.query('INSERT INTO greeted_users (discord_id, greeted_at) VALUES (?, ?)').run(userId, Math.floor(Date.now() / 1000));
		return false;
	}

	const state = generateState(userId);
	const verifyUrl = `${SSO_CONFIG.callbackBaseUrl}/auth/verify/${state}`;

	const embed = new EmbedBuilder()
		.setColor(GREETING_MESSAGES.embedColor)
		.setTitle(GREETING_MESSAGES.title)
		.setDescription(GREETING_MESSAGES.description);

	const row = new ActionRowBuilder<ButtonBuilder>()
		.addComponents(
			new ButtonBuilder()
				.setLabel(GREETING_MESSAGES.button)
				.setStyle(ButtonStyle.Link)
				.setURL(verifyUrl)
		);

	try {
		await user.send({
			embeds: [embed],
			components: [row]
		});

		greetingDb.query('INSERT INTO greeted_users (discord_id, greeted_at) VALUES (?, ?)').run(userId, Math.floor(Date.now() / 1000));

		console.log(`[GREETING] first-time greeting sent via DM: discord_id=${userId}`);

		return true;
	} catch (err) {
		console.log(`[GREETING] failed to DM user: discord_id=${userId} (DMs likely disabled)`);
		greetingDb.query('INSERT INTO greeted_users (discord_id, greeted_at) VALUES (?, ?)').run(userId, Math.floor(Date.now() / 1000));
		return false;
	}
}
