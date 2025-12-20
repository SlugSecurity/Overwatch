import {
	SlashCommandBuilder,
	type ChatInputCommandInteraction,
	type AutocompleteInteraction,
	MessageFlags
} from 'discord.js';
import { ObjectId } from 'mongodb';
import { getAttendanceSessionsCollection, getAttendanceRecordsCollection, getVerifiedUsersCollection } from '#config/database.ts';
import { ATTENDANCE_MESSAGES, formatMessage } from '../../config/attendance.js';
import { writeAttendanceMetric } from '../../util/metrics.js';

const create = () => {
	const command = new SlashCommandBuilder()
		.setName('addattendance')
		.setDescription(ATTENDANCE_MESSAGES.addCommand.description)
		.addStringOption(option =>
			option
				.setName('session')
				.setDescription(ATTENDANCE_MESSAGES.addCommand.options.session)
				.setRequired(true)
				.setAutocomplete(true)
		)
		.addUserOption(option =>
			option
				.setName('user')
				.setDescription(ATTENDANCE_MESSAGES.addCommand.options.user)
				.setRequired(true)
		)
		.setDMPermission(false);

	return command.toJSON();
};

const autocomplete = async (interaction: AutocompleteInteraction) => {
	const sessions = await getAttendanceSessionsCollection()
		.find({})
		.sort({ expiresAt: -1 })
		.limit(20)
		.toArray();

	const choices = sessions.map(session => {
		const date = session.expiresAt.toLocaleDateString('en-US', {
			month: 'short',
			day: 'numeric',
			year: 'numeric'
		});
		const name = `${session.eventSeries} - ${date}`;
		return {
			name: name.length > 100 ? name.slice(0, 97) + '...' : name,
			value: session._id.toHexString()
		};
	});

	await interaction.respond(choices);
};

const invoke = async (interaction: ChatInputCommandInteraction) => {
	const sessionIdStr = interaction.options.getString('session', true);
	const targetUser = interaction.options.getUser('user', true);

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

	const existingRecord = await getAttendanceRecordsCollection().findOne({
		sessionId,
		userId: targetUser.id
	});

	if (existingRecord) {
		await interaction.reply({
			content: formatMessage(ATTENDANCE_MESSAGES.addCommand.alreadyInSession, { username: targetUser.tag }),
			flags: MessageFlags.Ephemeral
		});
		return;
	}

	await getAttendanceRecordsCollection().insertOne({
		_id: new ObjectId(),
		sessionId,
		userId: targetUser.id,
		username: targetUser.tag,
		submittedAt: new Date()
	});

	const verifiedUser = await getVerifiedUsersCollection().findOne({ _id: targetUser.id });
	if (verifiedUser) {
		const cruzid = verifiedUser.email.split('@')[0];
		writeAttendanceMetric({
			eventSeries: session.eventSeries,
			cruzid,
			username: targetUser.tag,
			sessionId
		});
	}

	await interaction.reply({
		content: formatMessage(ATTENDANCE_MESSAGES.addCommand.success, {
			username: targetUser.tag,
			eventSeries: session.eventSeries
		}),
		flags: MessageFlags.Ephemeral
	});
};

export { create, invoke, autocomplete };
