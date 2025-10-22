import {
	Events,
	type Client,
	type Interaction,
	ModalBuilder,
	TextInputBuilder,
	TextInputStyle,
	ActionRowBuilder,
	EmbedBuilder,
	MessageFlags
} from 'discord.js';
import { Database } from 'bun:sqlite';
import { ATTENDANCE_MESSAGES, formatMessage, pluralize } from '../config/attendance.js';

const once = false;
const eventType = Events.InteractionCreate;

const db = new Database('databases/server.db');

async function invoke(client: Client, interaction: Interaction): Promise<void> {
	if (interaction.isChatInputCommand()) {
		const commandModule = (client as any).commands.get(interaction.commandName);
		await commandModule.invoke(interaction);
		return;
	}

	if (interaction.isButton()) {
		const customId = interaction.customId;

		if (customId.startsWith('attendance_submit_')) {
			const sessionId = parseInt(customId.split('_')[2]);

			const session = db.query('SELECT * FROM attendance_sessions WHERE session_id = ?').get(sessionId) as any;

			if (!session) {
				await interaction.reply({
					content: ATTENDANCE_MESSAGES.errors.sessionNotFound,
					flags: MessageFlags.Ephemeral
				});
				return;
			}

			const now = Math.floor(Date.now() / 1000);
			if (now > session.expires_at) {
				await interaction.reply({
					content: ATTENDANCE_MESSAGES.errors.sessionExpired,
					flags: MessageFlags.Ephemeral
				});
				return;
			}

			const existingRecord = db.query(
				'SELECT * FROM attendance_records WHERE session_id = ? AND user_id = ?'
			).get(sessionId, interaction.user.id);

			if (existingRecord) {
				await interaction.reply({
					content: ATTENDANCE_MESSAGES.errors.alreadySignedIn,
					flags: MessageFlags.Ephemeral
				});
				return;
			}

			const modal = new ModalBuilder()
				.setCustomId(`attendance_modal_${sessionId}`)
				.setTitle(ATTENDANCE_MESSAGES.modal.title);

			const keyInput = new TextInputBuilder()
				.setCustomId('attendance_key_input')
				.setLabel(ATTENDANCE_MESSAGES.modal.inputLabel)
				.setStyle(TextInputStyle.Short)
				.setRequired(true)
				.setMinLength(3)
				.setMaxLength(50);

			const row = new ActionRowBuilder<TextInputBuilder>().addComponents(keyInput);
			modal.addComponents(row);

			await interaction.showModal(modal);
		}
		return;
	}

	if (interaction.isModalSubmit()) {
		const customId = interaction.customId;

		if (customId.startsWith('attendance_modal_')) {
			const sessionId = parseInt(customId.split('_')[2]);

			const session = db.query('SELECT * FROM attendance_sessions WHERE session_id = ?').get(sessionId) as any;

			if (!session) {
				await interaction.reply({
					content: ATTENDANCE_MESSAGES.errors.sessionNotFound,
					flags: MessageFlags.Ephemeral
				});
				return;
			}

			const now = Math.floor(Date.now() / 1000);
			if (now > session.expires_at) {
				await interaction.reply({
					content: ATTENDANCE_MESSAGES.errors.sessionExpired,
					flags: MessageFlags.Ephemeral
				});
				return;
			}

			const submittedKey = interaction.fields.getTextInputValue('attendance_key_input');

			if (submittedKey !== session.attendance_key) {
				await interaction.reply({
					content: ATTENDANCE_MESSAGES.errors.incorrectCode,
					flags: MessageFlags.Ephemeral
				});
				return;
			}

			// race condition protection
			const existingRecord = db.query(
				'SELECT * FROM attendance_records WHERE session_id = ? AND user_id = ?'
			).get(sessionId, interaction.user.id);

			if (existingRecord) {
				await interaction.reply({
					content: ATTENDANCE_MESSAGES.errors.alreadySignedIn,
					flags: MessageFlags.Ephemeral
				});
				return;
			}

			db.query(`
				INSERT INTO attendance_records (session_id, user_id, username, submitted_at)
				VALUES (?, ?, ?, ?)
			`).run(sessionId, interaction.user.id, interaction.user.tag, Math.floor(Date.now() / 1000));

			const attendees = db.query(
				'SELECT user_id FROM attendance_records WHERE session_id = ? ORDER BY submitted_at ASC'
			).all(sessionId) as Array<{ user_id: string }>;

			let mentionList = attendees.map(a => `<@${a.user_id}>`).join(' ');

			// discord embed field limit
			const maxLength = 900;
			if (mentionList.length > maxLength) {
				let truncated = '';
				let count = 0;
				for (const attendee of attendees) {
					const mention = `<@${attendee.user_id}> `;
					if (truncated.length + mention.length > maxLength) break;
					truncated += mention;
					count++;
				}
				const remaining = attendees.length - count;
				mentionList = truncated.trim() + formatMessage(ATTENDANCE_MESSAGES.embed.overflowTemplate, { remaining });
			}

			try {
				const channel = await client.channels.fetch(session.channel_id);
				if (channel?.isTextBased()) {
					const message = await channel.messages.fetch(session.message_id);
					const embed = EmbedBuilder.from(message.embeds[0]);

					embed.setFields(
						{ name: ATTENDANCE_MESSAGES.embed.fields.closes, value: `<t:${session.expires_at}:R>`, inline: true },
						{ name: ATTENDANCE_MESSAGES.embed.fields.signedIn, value: `${attendees.length}`, inline: true },
						{ name: ATTENDANCE_MESSAGES.embed.fields.whosHere, value: mentionList || ATTENDANCE_MESSAGES.embed.emptyState, inline: false }
					);

					await message.edit({ embeds: [embed], components: message.components });
				}
			} catch (error) {
				console.error('Failed to update attendance embed:', error);
			}

			const attendanceHistory = db.query(`
				SELECT s.event_series, COUNT(*) as count
				FROM attendance_records r
				JOIN attendance_sessions s ON r.session_id = s.session_id
				WHERE r.user_id = ?
				GROUP BY s.event_series
				ORDER BY s.event_series
			`).all(interaction.user.id) as Array<{ event_series: string; count: number }>;

			let message = formatMessage(ATTENDANCE_MESSAGES.success.signedInTemplate, {
				eventSeries: session.event_series
			});

			if (attendanceHistory.length > 0) {
				message += ATTENDANCE_MESSAGES.success.historyHeader;
				for (const record of attendanceHistory) {
					const plural = pluralize(record.count, 'session', 'sessions');
					message += formatMessage(ATTENDANCE_MESSAGES.success.historyItemTemplate, {
						eventSeries: record.event_series,
						count: record.count,
						plural
					});
				}
			}

			await interaction.reply({
				content: message,
				flags: MessageFlags.Ephemeral
			});
		}
		return;
	}
}

export { once, eventType, invoke };
