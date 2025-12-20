import {
	SlashCommandBuilder,
	type ChatInputCommandInteraction,
	EmbedBuilder,
	MessageFlags
} from 'discord.js';
import { getVerifiedUsersCollection, getAttendanceMetricsCollection } from '#config/database.ts';
import { SSO_MESSAGES, formatMessage } from '#config/sso.ts';
import { pluralize } from '#config/attendance.ts';

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
	const targetUser = interaction.options.getUser('user', true);

	const verifiedUser = await getVerifiedUsersCollection().findOne({ _id: targetUser.id });

	if (!verifiedUser) {
		console.log(`[SSO] /whois lookup failed: officer_id=${interaction.user.id} target_discord_id=${targetUser.id} not verified`);
		await interaction.reply({
			content: formatMessage(SSO_MESSAGES.command.whois.notVerified, { username: targetUser.tag }),
			flags: MessageFlags.Ephemeral
		});
		return;
	}

	console.log(`[SSO] /whois lookup: officer_id=${interaction.user.id} target_discord_id=${targetUser.id} email=${verifiedUser.email}`);

	const cruzid = verifiedUser.email.split('@')[0];

	const attendanceHistory = await getAttendanceMetricsCollection().aggregate([
		{ $match: { cruzid } },
		{ $group: {
			_id: '$eventSeries',
			count: { $sum: 1 }
		}},
		{ $sort: { _id: 1 } }
	]).toArray() as Array<{ _id: string; count: number }>;

	let attendanceText = '';
	if (attendanceHistory.length > 0) {
		for (const record of attendanceHistory) {
			const plural = pluralize(record.count, 'session', 'sessions');
			attendanceText += `\n- ${record._id}: ${record.count} ${plural}`;
		}
	} else {
		attendanceText = 'No attendance records';
	}

	const verifiedAtUnix = Math.floor(verifiedUser.verifiedAt.getTime() / 1000);

	const embed = new EmbedBuilder()
		.setColor(SSO_MESSAGES.command.whois.resultColor)
		.setTitle(SSO_MESSAGES.command.whois.resultTitle)
		.addFields(
			{ name: 'Discord User', value: `<@${targetUser.id}> (${targetUser.id})`, inline: false },
			{ name: 'Email', value: verifiedUser.email, inline: true },
			{ name: 'Name', value: verifiedUser.fullName || 'N/A', inline: true },
			{ name: 'Verified At', value: `<t:${verifiedAtUnix}:F>`, inline: false },
			{ name: 'Attendance History', value: attendanceText, inline: false }
		)
		.setThumbnail(targetUser.displayAvatarURL());

	await interaction.reply({
		embeds: [embed],
		flags: MessageFlags.Ephemeral
	});
};

export { create, invoke };
