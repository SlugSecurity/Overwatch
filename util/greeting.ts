import {
	EmbedBuilder,
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
	type User,
	type GuildMember
} from 'discord.js';
import { getGreetedUsersCollection, getVerifiedUsersCollection } from '#config/database.ts';
import { GREETING_MESSAGES } from '#config/greeting.ts';
import { SSO_CONFIG, VERIFIED_ROLE_ID } from '#config/sso.ts';
import { generateState } from '#server/oauth.ts';

export async function sendFirstTimeGreeting(user: User, member?: GuildMember | null): Promise<boolean> {
	const userId = user.id;

	const alreadyGreeted = await getGreetedUsersCollection().findOne({ _id: userId });
	if (alreadyGreeted) {
		return false;
	}

	if (member?.roles.cache.has(VERIFIED_ROLE_ID)) {
		await getGreetedUsersCollection().insertOne({
			_id: userId,
			greetedAt: new Date()
		});
		return false;
	}

	const alreadyVerified = await getVerifiedUsersCollection().findOne({ _id: userId });
	if (alreadyVerified) {
		await getGreetedUsersCollection().insertOne({
			_id: userId,
			greetedAt: new Date()
		});
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

		await getGreetedUsersCollection().insertOne({
			_id: userId,
			greetedAt: new Date()
		});

		console.log(`[GREETING] first-time greeting sent via DM: discord_id=${userId}`);

		return true;
	} catch (err) {
		console.log(`[GREETING] failed to DM user: discord_id=${userId} (DMs likely disabled)`);
		await getGreetedUsersCollection().insertOne({
			_id: userId,
			greetedAt: new Date()
		});
		return false;
	}
}
