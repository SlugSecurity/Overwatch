import {
	SlashCommandBuilder,
	type ChatInputCommandInteraction,
	EmbedBuilder,
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
	MessageFlags
} from 'discord.js';
import { ObjectId } from 'mongodb';
import { getAttendanceSessionsCollection } from '#config/database.ts';
import { EVENT_SERIES, ATTENDANCE_MESSAGES, formatMessage } from '../../config/attendance.js';
import { scheduleSessionClose } from '../../util/attendanceScheduler.js';

const create = () => {
	const command = new SlashCommandBuilder()
		.setName('attendance')
		.setDescription(ATTENDANCE_MESSAGES.command.description)
		.addStringOption(option =>
			option
				.setName('event_series')
				.setDescription(ATTENDANCE_MESSAGES.command.options.eventSeries)
				.setRequired(true)
				.addChoices(
					...EVENT_SERIES.map(series => ({ name: series, value: series }))
				)
		)
		.addIntegerOption(option =>
			option
				.setName('expiration_time_mins')
				.setDescription(ATTENDANCE_MESSAGES.command.options.expirationMins)
				.setRequired(true)
				.setMinValue(1)
				.setMaxValue(1440)
		)
		.addStringOption(option =>
			option
				.setName('attendance_key')
				.setDescription(ATTENDANCE_MESSAGES.command.options.attendanceKey)
				.setRequired(true)
				.setMinLength(3)
				.setMaxLength(50)
		)
		.setDMPermission(false);

	return command.toJSON();
};

const invoke = async (interaction: ChatInputCommandInteraction) => {
	const eventSeries = interaction.options.getString('event_series', true);
	const expirationMins = interaction.options.getInteger('expiration_time_mins', true);
	const attendanceKey = interaction.options.getString('attendance_key', true);

	const expiresAt = new Date(Date.now() + expirationMins * 60 * 1000);
	const expiresAtUnix = Math.floor(expiresAt.getTime() / 1000);

	// hides command parameters from non-officers
	await interaction.reply({
		content: ATTENDANCE_MESSAGES.status.creating,
		flags: MessageFlags.Ephemeral
	});

	const embed = new EmbedBuilder()
		.setColor(ATTENDANCE_MESSAGES.embed.color)
		.setTitle(formatMessage(ATTENDANCE_MESSAGES.embed.titleTemplate, { eventSeries }))
		.setDescription(ATTENDANCE_MESSAGES.embed.description)
		.addFields(
			{ name: ATTENDANCE_MESSAGES.embed.fields.closes, value: `<t:${expiresAtUnix}:R>`, inline: true },
			{ name: ATTENDANCE_MESSAGES.embed.fields.signedIn, value: '0', inline: true },
			{ name: ATTENDANCE_MESSAGES.embed.fields.whosHere, value: ATTENDANCE_MESSAGES.embed.emptyState, inline: false }
		)
		.setFooter({ text: formatMessage(ATTENDANCE_MESSAGES.embed.footerTemplate, { username: interaction.user.tag }) })
		.setTimestamp();

	const row = new ActionRowBuilder<ButtonBuilder>()
		.addComponents(
			new ButtonBuilder()
				.setCustomId('attendance_submit_temp')
				.setLabel(ATTENDANCE_MESSAGES.button.label)
				.setStyle(ButtonStyle.Success)
		);

	if (!interaction.channel) {
		await interaction.editReply({ content: ATTENDANCE_MESSAGES.errors.channelNotFound });
		return;
	}

	const message = await interaction.channel.send({
		embeds: [embed],
		components: [row]
	});

	const sessionId = new ObjectId();

	await getAttendanceSessionsCollection().insertOne({
		_id: sessionId,
		eventSeries,
		messageId: message.id,
		channelId: interaction.channelId,
		attendanceKey,
		createdBy: interaction.user.id,
		expiresAt
	});

	// button needs actual session id after db insert
	const updatedRow = new ActionRowBuilder<ButtonBuilder>()
		.addComponents(
			new ButtonBuilder()
				.setCustomId(`attendance_submit_${sessionId.toHexString()}`)
				.setLabel(ATTENDANCE_MESSAGES.button.label)
				.setStyle(ButtonStyle.Success)
		);

	await message.edit({
		embeds: [embed],
		components: [updatedRow]
	});

	scheduleSessionClose(
		interaction.client,
		sessionId,
		interaction.channelId!,
		message.id,
		expiresAt
	);

	await interaction.editReply({
		content: formatMessage(ATTENDANCE_MESSAGES.success.createdTemplate, {
			eventSeries,
			attendanceKey,
			expiresAt: expiresAtUnix
		})
	});
};

export { create, invoke };
