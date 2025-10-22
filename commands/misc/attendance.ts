import {
	SlashCommandBuilder,
	type ChatInputCommandInteraction,
	EmbedBuilder,
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
	MessageFlags
} from 'discord.js';
import { Database } from 'bun:sqlite';
import { EVENT_SERIES, ATTENDANCE_OFFICER_ROLES, ATTENDANCE_MESSAGES, formatMessage } from '../../config/attendance.js';
import { scheduleSessionClose } from '../../util/attendanceScheduler.js';

const db = new Database('databases/server.db');

db.exec(`
	CREATE TABLE IF NOT EXISTS attendance_sessions (
		session_id INTEGER PRIMARY KEY AUTOINCREMENT,
		event_series TEXT NOT NULL,
		message_id TEXT NOT NULL,
		channel_id TEXT NOT NULL,
		attendance_key TEXT NOT NULL,
		created_by TEXT NOT NULL,
		expires_at INTEGER NOT NULL
	)
`);

db.exec(`
	CREATE TABLE IF NOT EXISTS attendance_records (
		record_id INTEGER PRIMARY KEY AUTOINCREMENT,
		session_id INTEGER NOT NULL,
		user_id TEXT NOT NULL,
		username TEXT NOT NULL,
		submitted_at INTEGER NOT NULL,
		UNIQUE(session_id, user_id),
		FOREIGN KEY (session_id) REFERENCES attendance_sessions(session_id)
	)
`);

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
				.setMaxValue(1440) // max 24 hours
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
	const member = interaction.member;
	if (!member || !('roles' in member)) {
		await interaction.reply({
			content: ATTENDANCE_MESSAGES.errors.noPermission,
			flags: MessageFlags.Ephemeral
		});
		return;
	}

	const hasRole = ATTENDANCE_OFFICER_ROLES.some(roleId =>
		member.roles.cache.has(roleId)
	);

	if (!hasRole) {
		await interaction.reply({
			content: ATTENDANCE_MESSAGES.errors.noPermission,
			flags: MessageFlags.Ephemeral
		});
		return;
	}

	const eventSeries = interaction.options.getString('event_series', true);
	const expirationMins = interaction.options.getInteger('expiration_time_mins', true);
	const attendanceKey = interaction.options.getString('attendance_key', true);

	const expiresAt = Math.floor(Date.now() / 1000) + (expirationMins * 60);

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
			{ name: ATTENDANCE_MESSAGES.embed.fields.closes, value: `<t:${expiresAt}:R>`, inline: true },
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

	const stmt = db.query(`
		INSERT INTO attendance_sessions (event_series, message_id, channel_id, attendance_key, created_by, expires_at)
		VALUES (?, ?, ?, ?, ?, ?)
	`);

	const result = stmt.run(
		eventSeries,
		message.id,
		interaction.channelId,
		attendanceKey,
		interaction.user.id,
		expiresAt
	);

	const sessionId = result.lastInsertRowid;

	// button needs actual session id after db insert
	const updatedRow = new ActionRowBuilder<ButtonBuilder>()
		.addComponents(
			new ButtonBuilder()
				.setCustomId(`attendance_submit_${sessionId}`)
				.setLabel(ATTENDANCE_MESSAGES.button.label)
				.setStyle(ButtonStyle.Success)
		);

	await message.edit({
		embeds: [embed],
		components: [updatedRow]
	});

	scheduleSessionClose(
		interaction.client,
		sessionId as number,
		interaction.channelId!,
		message.id,
		expiresAt
	);

	await interaction.editReply({
		content: formatMessage(ATTENDANCE_MESSAGES.success.createdTemplate, {
			eventSeries,
			attendanceKey,
			expiresAt
		})
	});
};

export { create, invoke };
