import type { Client } from 'discord.js';
import { EmbedBuilder } from 'discord.js';
import type { ObjectId } from 'mongodb';
import { getAttendanceSessionsCollection } from '#config/database.ts';
import { ATTENDANCE_MESSAGES } from '../config/attendance.js';

const activeTimeouts = new Map<string, NodeJS.Timeout>();

async function closeAttendanceSession(
	client: Client,
	sessionId: ObjectId,
	channelId: string,
	messageId: string
): Promise<void> {
	try {
		const channel = await client.channels.fetch(channelId);
		if (!channel?.isTextBased()) {
			console.error(`Channel ${channelId} not found or not text-based`);
			return;
		}

		const message = await channel.messages.fetch(messageId);
		const embed = EmbedBuilder.from(message.embeds[0]);

		embed.setDescription(ATTENDANCE_MESSAGES.status.closed);

		await message.edit({
			embeds: [embed],
			components: []
		});

		activeTimeouts.delete(sessionId.toHexString());

		console.log(`Closed attendance session ${sessionId.toHexString()}`);
	} catch (error) {
		console.error(`Failed to close attendance session ${sessionId.toHexString()}:`, error);
	}
}

export function scheduleSessionClose(
	client: Client,
	sessionId: ObjectId,
	channelId: string,
	messageId: string,
	expiresAt: Date
): void {
	const now = Date.now();
	const msUntilExpiration = expiresAt.getTime() - now;

	// already expired
	if (msUntilExpiration <= 0) {
		closeAttendanceSession(client, sessionId, channelId, messageId);
		return;
	}

	const timeout = setTimeout(() => {
		closeAttendanceSession(client, sessionId, channelId, messageId);
	}, msUntilExpiration);

	activeTimeouts.set(sessionId.toHexString(), timeout);

	console.log(`Scheduled session ${sessionId.toHexString()} to close in ${Math.round(msUntilExpiration / 1000)}s`);
}

export async function initializeAttendanceScheduler(client: Client): Promise<void> {
	console.log('Initializing attendance scheduler...');

	// check recently expired in case bot was down
	const oneHourAgo = new Date(Date.now() - 3600000);

	const activeSessions = await getAttendanceSessionsCollection()
		.find({ expiresAt: { $gt: oneHourAgo } })
		.toArray();

	console.log(`Found ${activeSessions.length} active or recently expired sessions`);

	for (const session of activeSessions) {
		scheduleSessionClose(
			client,
			session._id,
			session.channelId,
			session.messageId,
			session.expiresAt
		);
	}

	console.log('Attendance scheduler initialized!');
}
