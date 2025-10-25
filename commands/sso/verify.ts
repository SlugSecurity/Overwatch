import {
	SlashCommandBuilder,
	type ChatInputCommandInteraction,
	EmbedBuilder,
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
	MessageFlags
} from 'discord.js';
import { ssoDb, SSO_MESSAGES, formatMessage, SSO_CONFIG, VERIFIED_ROLE_ID } from '#config/sso.ts';
import { generateState } from '#server/oauth.ts';

const create = () => {
	const command = new SlashCommandBuilder()
		.setName('verify')
		.setDescription(SSO_MESSAGES.command.verify.description)
		.setDMPermission(false);

	return command.toJSON();
};

const invoke = async (interaction: ChatInputCommandInteraction) => {
	const userId = interaction.user.id;

	const existingUser = ssoDb.query('SELECT email FROM verified_users WHERE discord_id = ?').get(userId) as { email: string } | null;

	if (existingUser) {
		const member = interaction.member;
		if (member && 'roles' in member && !member.roles.cache.has(VERIFIED_ROLE_ID)) {
			try {
				await member.roles.add(VERIFIED_ROLE_ID);
				console.log(`[SSO] /verify assigned missing role: discord_id=${userId} email=${existingUser.email}`);
			} catch (err) {
				console.error(`[SSO] /verify failed to assign missing role: discord_id=${userId}`, err);
			}
		}

		console.log(`[SSO] /verify blocked: discord_id=${userId} already verified as ${existingUser.email}`);
		await interaction.reply({
			content: formatMessage(SSO_MESSAGES.command.verify.alreadyVerified, { email: existingUser.email }),
			flags: MessageFlags.Ephemeral
		});
		return;
	}

	const state = generateState(userId);
	const verifyUrl = `${SSO_CONFIG.callbackBaseUrl}/auth/verify/${state}`;

	console.log(`[SSO] /verify initiated: discord_id=${userId}`);

	const embed = new EmbedBuilder()
		.setColor(SSO_MESSAGES.command.verify.embedColor)
		.setTitle(SSO_MESSAGES.command.verify.embedTitle)
		.setDescription(SSO_MESSAGES.command.verify.embedDescription);

	const row = new ActionRowBuilder<ButtonBuilder>()
		.addComponents(
			new ButtonBuilder()
				.setLabel(SSO_MESSAGES.command.verify.button)
				.setStyle(ButtonStyle.Link)
				.setURL(verifyUrl)
		);

	await interaction.reply({
		embeds: [embed],
		components: [row],
		flags: MessageFlags.Ephemeral
	});
};

export { create, invoke };
