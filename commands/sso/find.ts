import {
	SlashCommandBuilder,
	type ChatInputCommandInteraction,
	EmbedBuilder,
	MessageFlags
} from 'discord.js';
import { Database } from 'bun:sqlite';
import { ssoDb, SSO_MESSAGES, formatMessage } from '#config/sso.ts';
import { ATTENDANCE_OFFICER_ROLES, ATTENDANCE_MESSAGES, pluralize } from '#config/attendance.ts';

const attendanceDb = new Database('databases/server.db');

const create = () => {
	const command = new SlashCommandBuilder()
		.setName('find')
		.setDescription(SSO_MESSAGES.command.find.description)
		.addStringOption(option =>
			option
				.setName('cruzid')
				.setDescription(SSO_MESSAGES.command.find.cruzid)
				.setRequired(true)
		)
		.setDMPermission(false);

	return command.toJSON();
};

const invoke = async (interaction: ChatInputCommandInteraction) => {
	const member = interaction.member;
	if (!member || !('roles' in member)) {
		await interaction.reply({
			content: SSO_MESSAGES.errors.noPermission,
			flags: MessageFlags.Ephemeral
		});
		return;
	}

	const hasRole = ATTENDANCE_OFFICER_ROLES.some(roleId =>
		member.roles.cache.has(roleId)
	);

	if (!hasRole) {
		await interaction.reply({
			content: SSO_MESSAGES.errors.noPermission,
			flags: MessageFlags.Ephemeral
		});
		return;
	}

	const input = interaction.options.getString('cruzid', true);
	const email = input.includes('@') ? input : `${input}@ucsc.edu`;

	const verifiedUser = ssoDb.query(
		'SELECT discord_id, full_name, verified_at FROM verified_users WHERE email = ?'
	).get(email) as { discord_id: string; full_name: string; verified_at: number } | null;

	if (!verifiedUser) {
		console.log(`[SSO] /find lookup failed: officer_id=${interaction.user.id} email=${email} not found`);
		await interaction.reply({
			content: formatMessage(SSO_MESSAGES.command.find.notFound, { email }),
			flags: MessageFlags.Ephemeral
		});
		return;
	}

	let discordUser;
	try {
		discordUser = await interaction.client.users.fetch(verifiedUser.discord_id);
	} catch (err) {
		console.error(`[SSO] /find lookup error: officer_id=${interaction.user.id} email=${email} discord_id=${verifiedUser.discord_id} user fetch failed`, err);
		await interaction.reply({
			content: formatMessage(SSO_MESSAGES.command.find.notFound, { email }),
			flags: MessageFlags.Ephemeral
		});
		return;
	}

	console.log(`[SSO] /find lookup: officer_id=${interaction.user.id} email=${email} discord_id=${verifiedUser.discord_id}`);

	const attendanceHistory = attendanceDb.query(`
		SELECT s.event_series, COUNT(*) as count
		FROM attendance_records r
		JOIN attendance_sessions s ON r.session_id = s.session_id
		WHERE r.user_id = ?
		GROUP BY s.event_series
		ORDER BY s.event_series
	`).all(verifiedUser.discord_id) as Array<{ event_series: string; count: number }>;

	let attendanceText = '';
	if (attendanceHistory.length > 0) {
		for (const record of attendanceHistory) {
			const plural = pluralize(record.count, 'session', 'sessions');
			attendanceText += `\n- ${record.event_series}: ${record.count} ${plural}`;
		}
	} else {
		attendanceText = 'No attendance records';
	}

	const embed = new EmbedBuilder()
		.setColor(SSO_MESSAGES.command.find.resultColor)
		.setTitle(SSO_MESSAGES.command.find.resultTitle)
		.addFields(
			{ name: 'Discord User', value: `<@${discordUser.id}> (${discordUser.id})`, inline: false },
			{ name: 'Email', value: email, inline: true },
			{ name: 'Name', value: verifiedUser.full_name || 'N/A', inline: true },
			{ name: 'Verified At', value: `<t:${verifiedUser.verified_at}:F>`, inline: false },
			{ name: 'Attendance History', value: attendanceText, inline: false }
		)
		.setThumbnail(discordUser.displayAvatarURL());

	await interaction.reply({
		embeds: [embed],
		flags: MessageFlags.Ephemeral
	});
};

export { create, invoke };
