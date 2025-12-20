import type { Client, GuildMember } from 'discord.js';
import { getVerifiedUsersCollection } from '#config/database.ts';
import { ACTIVE_MEMBER_ROLE_ID, ACTIVE_MEMBER_CONFIG, getQuarterString } from '#config/activeMember.ts';
import {
	qualifiesForActiveMember,
	isQualifiedForCurrentQuarter,
	setQualifiedForCurrentQuarter,
	tryGrantActiveMemberRole,
	tryRemoveActiveMemberRole,
	cleanupOldMessageCounts
} from '#util/activeMember.ts';

async function runSync(client: Client): Promise<void> {
	const currentQuarter = getQuarterString();
	console.log(`[ACTIVE_MEMBER_SYNC] starting sync for ${currentQuarter}...`);

	if (!ACTIVE_MEMBER_ROLE_ID) {
		console.log('[ACTIVE_MEMBER_SYNC] ACTIVE_MEMBER_ROLE_ID not configured, skipping');
		return;
	}

	const verifiedUsers = await getVerifiedUsersCollection().find({}).toArray();
	const verifiedUserIds = new Set(verifiedUsers.map(u => u._id));

	console.log(`[ACTIVE_MEMBER_SYNC] checking ${verifiedUserIds.size} verified users`);

	let granted = 0;
	let removed = 0;
	let skipped = 0;
	let errors = 0;

	for (const [, guild] of client.guilds.cache) {
		const userIdArray = Array.from(verifiedUserIds);
		const batchSize = 10;

		for (let i = 0; i < userIdArray.length; i += batchSize) {
			const batch = userIdArray.slice(i, i + batchSize);

			await Promise.all(batch.map(async (userId) => {
				try {
					let member: GuildMember;
					try {
						member = await guild.members.fetch(userId);
					} catch {
						return;
					}

					const hasRole = member.roles.cache.has(ACTIVE_MEMBER_ROLE_ID);
					const qualifiedThisQuarter = await isQualifiedForCurrentQuarter(userId);

					if (hasRole && qualifiedThisQuarter) {
						skipped++;
						return;
					}

					if (hasRole && !qualifiedThisQuarter) {
						const stillQualifies = await qualifiesForActiveMember(userId);
						if (stillQualifies) {
							await setQualifiedForCurrentQuarter(userId);
							skipped++;
						} else {
							const success = await tryRemoveActiveMemberRole(member);
							if (success) removed++;
						}
						return;
					}

					if (!hasRole) {
						const qualifies = await qualifiesForActiveMember(userId);
						if (qualifies) {
							const success = await tryGrantActiveMemberRole(member);
							if (success) granted++;
						}
					}
				} catch (err) {
					console.error(`[ACTIVE_MEMBER_SYNC] error processing user ${userId}:`, err);
					errors++;
				}
			}));

			if (i + batchSize < userIdArray.length) {
				await new Promise(resolve => setTimeout(resolve, 1000));
			}
		}
	}

	const deleted = await cleanupOldMessageCounts();

	console.log(`[ACTIVE_MEMBER_SYNC] complete: granted=${granted} removed=${removed} skipped=${skipped} errors=${errors} oldRecordsDeleted=${deleted}`);
}

export async function initializeActiveMemberSync(client: Client): Promise<void> {
	if (!ACTIVE_MEMBER_ROLE_ID) {
		console.log('[ACTIVE_MEMBER_SYNC] ACTIVE_MEMBER_ROLE_ID not configured, sync disabled');
		return;
	}

	console.log('[ACTIVE_MEMBER_SYNC] initializing...');

	setTimeout(() => {
		runSync(client);
	}, 30000);

	setInterval(() => {
		runSync(client);
	}, ACTIVE_MEMBER_CONFIG.syncIntervalMs);

	console.log(`[ACTIVE_MEMBER_SYNC] scheduled every ${ACTIVE_MEMBER_CONFIG.syncIntervalMs / 1000 / 60} minutes`);
}
