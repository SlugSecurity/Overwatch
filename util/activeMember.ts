import { EmbedBuilder, type GuildMember } from 'discord.js';
import { getMessageCountsCollection, getAttendanceMetricsCollection, getActiveMemberQualificationsCollection, getVerifiedUsersCollection } from '#config/database.ts';
import { ACTIVE_MEMBER_ROLE_ID, ACTIVE_MEMBER_CONFIG, ACTIVE_MEMBER_MESSAGE, getActiveMemberTitle, getQuarterString, getQuarterDateRange } from '#config/activeMember.ts';

function getDateString(date: Date = new Date()): string {
	return date.toISOString().split('T')[0];
}

function getDateDaysAgo(days: number): string {
	const date = new Date();
	date.setDate(date.getDate() - days);
	return getDateString(date);
}

export async function incrementMessageCount(userId: string): Promise<number> {
	const today = getDateString();

	const result = await getMessageCountsCollection().findOneAndUpdate(
		{ userId, date: today },
		{ $inc: { count: 1 } },
		{ upsert: true, returnDocument: 'after' }
	);

	return result?.count ?? 1;
}

export async function getQuarterMessageCount(userId: string): Promise<number> {
	const { start } = getQuarterDateRange();
	const startDateStr = getDateString(start);

	const result = await getMessageCountsCollection().aggregate([
		{ $match: { userId, date: { $gte: startDateStr } } },
		{ $group: { _id: null, total: { $sum: '$count' } } }
	]).toArray();

	return result[0]?.total ?? 0;
}

export async function getQuarterAttendanceCount(userId: string): Promise<number> {
	const { start } = getQuarterDateRange();

	const verifiedUser = await getVerifiedUsersCollection().findOne({ _id: userId });
	if (!verifiedUser?.email) return 0;

	const cruzid = verifiedUser.email.split('@')[0];

	const count = await getAttendanceMetricsCollection().countDocuments({
		cruzid,
		recordedAt: { $gte: start }
	});

	return count;
}

export async function qualifiesForActiveMember(userId: string): Promise<boolean> {
	const messageCount = await getQuarterMessageCount(userId);
	if (messageCount >= ACTIVE_MEMBER_CONFIG.messageThreshold) {
		return true;
	}

	const attendanceCount = await getQuarterAttendanceCount(userId);
	return attendanceCount >= ACTIVE_MEMBER_CONFIG.attendanceThreshold;
}

export async function isQualifiedForCurrentQuarter(userId: string): Promise<boolean> {
	const currentQuarter = getQuarterString();
	const qualification = await getActiveMemberQualificationsCollection().findOne({ _id: userId });
	return qualification?.qualifiedQuarter === currentQuarter;
}

export async function setQualifiedForCurrentQuarter(userId: string): Promise<void> {
	const currentQuarter = getQuarterString();
	const verifiedUser = await getVerifiedUsersCollection().findOne({ _id: userId });
	const cruzid = verifiedUser?.email?.split('@')[0] || '';

	await getActiveMemberQualificationsCollection().updateOne(
		{ _id: userId },
		{ $set: { cruzid, qualifiedQuarter: currentQuarter, qualifiedAt: new Date() } },
		{ upsert: true }
	);
}

export async function tryGrantActiveMemberRole(member: GuildMember): Promise<boolean> {
	if (!ACTIVE_MEMBER_ROLE_ID) return false;
	if (member.roles.cache.has(ACTIVE_MEMBER_ROLE_ID)) return false;

	try {
		await member.roles.add(ACTIVE_MEMBER_ROLE_ID);
		await setQualifiedForCurrentQuarter(member.id);
		console.log(`[ACTIVE_MEMBER] granted role: ${member.user.tag}`);

		try {
			const embed = new EmbedBuilder()
				.setTitle(getActiveMemberTitle())
				.setDescription(ACTIVE_MEMBER_MESSAGE.description)
				.setColor(ACTIVE_MEMBER_MESSAGE.embedColor);

			await member.send({ embeds: [embed] });
		} catch {
			// user has DMs disabled
		}

		return true;
	} catch (err) {
		console.error(`[ACTIVE_MEMBER] failed to grant role: ${member.user.tag}`, err);
		return false;
	}
}

export async function tryRemoveActiveMemberRole(member: GuildMember): Promise<boolean> {
	if (!ACTIVE_MEMBER_ROLE_ID) return false;
	if (!member.roles.cache.has(ACTIVE_MEMBER_ROLE_ID)) return false;

	try {
		await member.roles.remove(ACTIVE_MEMBER_ROLE_ID);
		console.log(`[ACTIVE_MEMBER] removed role: ${member.user.tag}`);
		return true;
	} catch (err) {
		console.error(`[ACTIVE_MEMBER] failed to remove role: ${member.user.tag}`, err);
		return false;
	}
}

export async function cleanupOldMessageCounts(): Promise<number> {
	const cutoffDate = getDateDaysAgo(ACTIVE_MEMBER_CONFIG.cleanupDaysOld);

	const result = await getMessageCountsCollection().deleteMany({
		date: { $lt: cutoffDate }
	});

	return result.deletedCount;
}
