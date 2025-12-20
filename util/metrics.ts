import { ObjectId } from 'mongodb';
import { getAttendanceMetricsCollection } from '#config/database.ts';

export interface AttendanceMetricInput {
	eventSeries: string;
	cruzid: string;
	username: string;
	sessionId: ObjectId;
}

export async function writeAttendanceMetric(data: AttendanceMetricInput): Promise<void> {
	try {
		const collection = getAttendanceMetricsCollection();
		await collection.insertOne({
			_id: new ObjectId(),
			eventSeries: data.eventSeries,
			cruzid: data.cruzid,
			username: data.username,
			sessionId: data.sessionId,
			recordedAt: new Date()
		});
		console.log(`[MongoDB] wrote attendance metric: cruzid=${data.cruzid} event=${data.eventSeries}`);
	} catch (err) {
		console.error('[MongoDB] failed to write attendance metric:', err);
	}
}
