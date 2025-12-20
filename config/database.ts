import { MongoClient, type Db, type Collection } from 'mongodb';
import type { VerifiedUser, GreetedUser, AttendanceSession, AttendanceRecord, AttendanceMetric, MessageCount, ActiveMemberQualification } from '../types/database.js';

const MONGO_URI = process.env.MONGO_URI || '';

let client: MongoClient | null = null;
let db: Db | null = null;

export async function connectDatabase(): Promise<Db> {
	if (db) return db;

	if (!MONGO_URI) {
		throw new Error('MONGO_URI environment variable is required');
	}

	client = new MongoClient(MONGO_URI);
	await client.connect();

	db = client.db();

	await createIndexes(db);

	console.log('[MongoDB] connected successfully');
	return db;
}

export function getDatabase(): Db {
	if (!db) {
		throw new Error('Database not connected. Call connectDatabase() first');
	}
	return db;
}

async function createIndexes(database: Db): Promise<void> {
	await database.collection('verifiedUsers').createIndex({ email: 1 }, { unique: true });
	await database.collection('attendanceRecords').createIndex({ sessionId: 1, userId: 1 }, { unique: true });
	await database.collection('attendanceRecords').createIndex({ userId: 1, submittedAt: -1 });
	await database.collection('attendanceSessions').createIndex({ expiresAt: 1 });
	await database.collection('attendanceMetrics').createIndex({ eventSeries: 1, cruzid: 1 });
	await database.collection('messageCounts').createIndex({ userId: 1, date: 1 }, { unique: true });
	await database.collection('messageCounts').createIndex({ date: 1 });
}

export async function closeDatabase(): Promise<void> {
	if (client) {
		await client.close();
		client = null;
		db = null;
	}
}

export function getVerifiedUsersCollection(): Collection<VerifiedUser> {
	return getDatabase().collection<VerifiedUser>('verifiedUsers');
}

export function getGreetedUsersCollection(): Collection<GreetedUser> {
	return getDatabase().collection<GreetedUser>('greetedUsers');
}

export function getAttendanceSessionsCollection(): Collection<AttendanceSession> {
	return getDatabase().collection<AttendanceSession>('attendanceSessions');
}

export function getAttendanceRecordsCollection(): Collection<AttendanceRecord> {
	return getDatabase().collection<AttendanceRecord>('attendanceRecords');
}

export function getAttendanceMetricsCollection(): Collection<AttendanceMetric> {
	return getDatabase().collection<AttendanceMetric>('attendanceMetrics');
}

export function getMessageCountsCollection(): Collection<MessageCount> {
	return getDatabase().collection<MessageCount>('messageCounts');
}

export function getActiveMemberQualificationsCollection(): Collection<ActiveMemberQualification> {
	return getDatabase().collection<ActiveMemberQualification>('activeMemberQualifications');
}
