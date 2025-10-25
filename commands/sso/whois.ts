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
		.setName('whois')
		.setDescription(SSO_MESSAGES.command.whois.description)
		.addUserOption(option =>
			option
				.setName('user')
				.setDescription(SSO_MESSAGES.command.whois.user)
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

	const targetUser = interaction.options.getUser('user', true);

	const verifiedUser = ssoDb.query(
		'SELECT email, full_name, verified_at FROM verified_users WHERE discord_id = ?'
	).get(targetUser.id) as { email: string; full_name: string; verified_at: number } | null;

	if (!verifiedUser) {
		console.log(`[SSO] /whois lookup failed: officer_id=${interaction.user.id} target_discord_id=${targetUser.id} not verified`);
		await interaction.reply({
			content: formatMessage(SSO_MESSAGES.command.whois.notVerified, { username: targetUser.tag }),
			flags: MessageFlags.Ephemeral
		});
		return;
	}

	console.log(`[SSO] /whois lookup: officer_id=${interaction.user.id} target_discord_id=${targetUser.id} email=${verifiedUser.email}`);

	const attendanceHistory = attendanceDb.query(`
		SELECT s.event_series, COUNT(*) as count
		FROM attendance_records r
		JOIN attendance_sessions s ON r.session_id = s.session_id
		WHERE r.user_id = ?
		GROUP BY s.event_series
		ORDER BY s.event_series
	`).all(targetUser.id) as Array<{ event_series: string; count: number }>;

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
		.setColor(SSO_MESSAGES.command.whois.resultColor)
		.setTitle(SSO_MESSAGES.command.whois.resultTitle)
		.addFields(
			{ name: 'Discord User', value: `<@${targetUser.id}> (${targetUser.id})`, inline: false },
			{ name: 'Email', value: verifiedUser.email, inline: true },
			{ name: 'Name', value: verifiedUser.full_name || 'N/A', inline: true },
			{ name: 'Verified At', value: `<t:${verifiedUser.verified_at}:F>`, inline: false },
			{ name: 'Attendance History', value: attendanceText, inline: false }
		)
		.setThumbnail(targetUser.displayAvatarURL());

	await interaction.reply({
		embeds: [embed],
		flags: MessageFlags.Ephemeral
	});
};

export { create, invoke };
