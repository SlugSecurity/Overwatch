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
	const input = interaction.options.getString('cruzid', true);
	const email = input.includes('@') ? input : `${input}@ucsc.edu`;

	const verifiedUser = await getVerifiedUsersCollection().findOne({ email });

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
		discordUser = await interaction.client.users.fetch(verifiedUser._id);
	} catch (err) {
		console.error(`[SSO] /find lookup error: officer_id=${interaction.user.id} email=${email} discord_id=${verifiedUser._id} user fetch failed`, err);
		await interaction.reply({
			content: formatMessage(SSO_MESSAGES.command.find.notFound, { email }),
			flags: MessageFlags.Ephemeral
		});
		return;
	}

	console.log(`[SSO] /find lookup: officer_id=${interaction.user.id} email=${email} discord_id=${verifiedUser._id}`);

	const cruzid = email.split('@')[0];

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
		.setColor(SSO_MESSAGES.command.find.resultColor)
		.setTitle(SSO_MESSAGES.command.find.resultTitle)
		.addFields(
			{ name: 'Discord User', value: `<@${discordUser.id}> (${discordUser.id})`, inline: false },
			{ name: 'Email', value: email, inline: true },
			{ name: 'Name', value: verifiedUser.fullName || 'N/A', inline: true },
			{ name: 'Verified At', value: `<t:${verifiedAtUnix}:F>`, inline: false },
			{ name: 'Attendance History', value: attendanceText, inline: false }
		)
		.setThumbnail(discordUser.displayAvatarURL());

	await interaction.reply({
		embeds: [embed],
		flags: MessageFlags.Ephemeral
	});
};

export { create, invoke };
