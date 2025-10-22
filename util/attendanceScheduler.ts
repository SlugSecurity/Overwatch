import type { Client } from 'discord.js';
import { EmbedBuilder } from 'discord.js';
import { Database } from 'bun:sqlite';
import { ATTENDANCE_MESSAGES } from '../config/attendance.js';

const db = new Database('databases/server.db');

// track timeouts for cleanup
const activeTimeouts = new Map<number, NodeJS.Timeout>();

async function closeAttendanceSession(
	client: Client,
	sessionId: number,
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

		activeTimeouts.delete(sessionId);

		console.log(`Closed attendance session ${sessionId}`);
	} catch (error) {
		console.error(`Failed to close attendance session ${sessionId}:`, error);
	}
}

export function scheduleSessionClose(
	client: Client,
	sessionId: number,
	channelId: string,
	messageId: string,
	expiresAt: number
): void {
	const now = Math.floor(Date.now() / 1000);
	const msUntilExpiration = (expiresAt - now) * 1000;

	if (msUntilExpiration <= 0) {
		// already expired
		closeAttendanceSession(client, sessionId, channelId, messageId);
		return;
	}

	const timeout = setTimeout(() => {
		closeAttendanceSession(client, sessionId, channelId, messageId);
	}, msUntilExpiration);

	activeTimeouts.set(sessionId, timeout);

	console.log(`Scheduled session ${sessionId} to close in ${Math.round(msUntilExpiration / 1000)}s`);
}

export async function initializeAttendanceScheduler(client: Client): Promise<void> {
	console.log('Initializing attendance scheduler...');

	const now = Math.floor(Date.now() / 1000);

	// check recently expired in case bot was down
	const activeSessions = db.query(`
		SELECT session_id, channel_id, message_id, expires_at
		FROM attendance_sessions
		WHERE expires_at > ?
	`).all(now - 3600) as Array<{
		session_id: number;
		channel_id: string;
		message_id: string;
		expires_at: number;
	}>;

	console.log(`Found ${activeSessions.length} active or recently expired sessions`);

	for (const session of activeSessions) {
		scheduleSessionClose(
			client,
			session.session_id,
			session.channel_id,
			session.message_id,
			session.expires_at
		);
	}

	console.log('Attendance scheduler initialized!');
}
