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
import { ObjectId } from 'mongodb';
import { getAttendanceSessionsCollection, getAttendanceRecordsCollection, getAttendanceMetricsCollection, getVerifiedUsersCollection } from '#config/database.ts';
import { ATTENDANCE_MESSAGES, formatMessage, pluralize } from '../config/attendance.js';
import { VERIFIED_ROLE_ID } from '../config/sso.js';
import { writeAttendanceMetric } from '../util/metrics.js';

const once = false;
const eventType = Events.InteractionCreate;

async function invoke(client: Client, interaction: Interaction): Promise<void> {
	if (interaction.isChatInputCommand()) {
		const commandModule = (client as any).commands.get(interaction.commandName);
		await commandModule.invoke(interaction);
		return;
	}

	if (interaction.isAutocomplete()) {
		const commandModule = (client as any).commands.get(interaction.commandName);
		if (commandModule?.autocomplete) {
			await commandModule.autocomplete(interaction);
		}
		return;
	}

	if (interaction.isButton()) {
		const customId = interaction.customId;

		if (customId.startsWith('attendance_submit_')) {
			const sessionIdStr = customId.split('_')[2];
			let sessionId: ObjectId;
			try {
				sessionId = new ObjectId(sessionIdStr);
			} catch {
				await interaction.reply({
					content: ATTENDANCE_MESSAGES.errors.sessionNotFound,
					flags: MessageFlags.Ephemeral
				});
				return;
			}

			const session = await getAttendanceSessionsCollection().findOne({ _id: sessionId });

			if (!session) {
				await interaction.reply({
					content: ATTENDANCE_MESSAGES.errors.sessionNotFound,
					flags: MessageFlags.Ephemeral
				});
				return;
			}

			const now = new Date();
			if (now > session.expiresAt) {
				await interaction.reply({
					content: ATTENDANCE_MESSAGES.errors.sessionExpired,
					flags: MessageFlags.Ephemeral
				});
				return;
			}

			if (!interaction.member || !('roles' in interaction.member) || !interaction.member.roles.cache.has(VERIFIED_ROLE_ID)) {
				await interaction.reply({
					content: ATTENDANCE_MESSAGES.errors.notVerified,
					flags: MessageFlags.Ephemeral
				});
				return;
			}

			const existingRecord = await getAttendanceRecordsCollection().findOne({
				sessionId,
				userId: interaction.user.id
			});

			if (existingRecord) {
				await interaction.reply({
					content: ATTENDANCE_MESSAGES.errors.alreadySignedIn,
					flags: MessageFlags.Ephemeral
				});
				return;
			}

			const modal = new ModalBuilder()
				.setCustomId(`attendance_modal_${sessionId.toHexString()}`)
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
			const sessionIdStr = customId.split('_')[2];
			let sessionId: ObjectId;
			try {
				sessionId = new ObjectId(sessionIdStr);
			} catch {
				await interaction.reply({
					content: ATTENDANCE_MESSAGES.errors.sessionNotFound,
					flags: MessageFlags.Ephemeral
				});
				return;
			}

			const session = await getAttendanceSessionsCollection().findOne({ _id: sessionId });

			if (!session) {
				await interaction.reply({
					content: ATTENDANCE_MESSAGES.errors.sessionNotFound,
					flags: MessageFlags.Ephemeral
				});
				return;
			}

			const now = new Date();
			if (now > session.expiresAt) {
				await interaction.reply({
					content: ATTENDANCE_MESSAGES.errors.sessionExpired,
					flags: MessageFlags.Ephemeral
				});
				return;
			}

			const submittedKey = interaction.fields.getTextInputValue('attendance_key_input');

			if (submittedKey !== session.attendanceKey) {
				await interaction.reply({
					content: ATTENDANCE_MESSAGES.errors.incorrectCode,
					flags: MessageFlags.Ephemeral
				});
				return;
			}

			// race condition protection
			try {
				await getAttendanceRecordsCollection().insertOne({
					_id: new ObjectId(),
					sessionId,
					userId: interaction.user.id,
					username: interaction.user.tag,
					submittedAt: new Date()
				});
			} catch (err: any) {
				if (err.code === 11000) {
					await interaction.reply({
						content: ATTENDANCE_MESSAGES.errors.alreadySignedIn,
						flags: MessageFlags.Ephemeral
					});
					return;
				}
				throw err;
			}

			const verifiedUser = await getVerifiedUsersCollection().findOne({ _id: interaction.user.id });
			if (verifiedUser) {
				const cruzid = verifiedUser.email.split('@')[0];
				writeAttendanceMetric({
					eventSeries: session.eventSeries,
					cruzid,
					username: interaction.user.tag,
					sessionId
				});
			}

			const attendees = await getAttendanceRecordsCollection()
				.find({ sessionId })
				.sort({ submittedAt: 1 })
				.toArray();

			let mentionList = attendees.map(a => `<@${a.userId}>`).join(' ');

			// discord embed field limit
			const maxLength = 900;
			if (mentionList.length > maxLength) {
				let truncated = '';
				let count = 0;
				for (const attendee of attendees) {
					const mention = `<@${attendee.userId}> `;
					if (truncated.length + mention.length > maxLength) break;
					truncated += mention;
					count++;
				}
				const remaining = attendees.length - count;
				mentionList = truncated.trim() + formatMessage(ATTENDANCE_MESSAGES.embed.overflowTemplate, { remaining });
			}

			try {
				const channel = await client.channels.fetch(session.channelId);
				if (channel?.isTextBased()) {
					const message = await channel.messages.fetch(session.messageId);
					const embed = EmbedBuilder.from(message.embeds[0]);

					const expiresAtUnix = Math.floor(session.expiresAt.getTime() / 1000);

					embed.setFields(
						{ name: ATTENDANCE_MESSAGES.embed.fields.closes, value: `<t:${expiresAtUnix}:R>`, inline: true },
						{ name: ATTENDANCE_MESSAGES.embed.fields.signedIn, value: `${attendees.length}`, inline: true },
						{ name: ATTENDANCE_MESSAGES.embed.fields.whosHere, value: mentionList || ATTENDANCE_MESSAGES.embed.emptyState, inline: false }
					);

					await message.edit({ embeds: [embed], components: message.components });
				}
			} catch (error) {
				console.error('Failed to update attendance embed:', error);
			}

			const verifiedUserForHistory = await getVerifiedUsersCollection().findOne({ _id: interaction.user.id });
			const cruzid = verifiedUserForHistory?.email?.split('@')[0] || '';

			const attendanceHistory = await getAttendanceMetricsCollection().aggregate([
				{ $match: { cruzid } },
				{ $group: {
					_id: '$eventSeries',
					count: { $sum: 1 }
				}},
				{ $sort: { _id: 1 } }
			]).toArray() as Array<{ _id: string; count: number }>;

			let message = formatMessage(ATTENDANCE_MESSAGES.success.signedInTemplate, {
				eventSeries: session.eventSeries
			});

			if (attendanceHistory.length > 0) {
				message += ATTENDANCE_MESSAGES.success.historyHeader;
				for (const record of attendanceHistory) {
					const plural = pluralize(record.count, 'session', 'sessions');
					message += formatMessage(ATTENDANCE_MESSAGES.success.historyItemTemplate, {
						eventSeries: record._id,
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
