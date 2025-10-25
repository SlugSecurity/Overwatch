import { Point } from '@influxdata/influxdb-client';
import { getInfluxClient, INFLUX_CONFIG } from '#config/influx.ts';

export interface AttendanceMetric {
	eventSeries: string;
	cruzid: string;
	username: string;
	sessionId: number;
}

export async function writeAttendanceMetric(data: AttendanceMetric): Promise<void> {
	const client = getInfluxClient();
	if (!client) {
		return;
	}

	try {
		const writeApi = client.getWriteApi(INFLUX_CONFIG.org, INFLUX_CONFIG.bucket);
		writeApi.useDefaultTags({ source: 'overwatch_bot' });

		const point = new Point('attendance')
			.tag('event_series', data.eventSeries)
			.tag('cruzid', data.cruzid)
			.tag('session_id', data.sessionId.toString())
			.stringField('username', data.username)
			.intField('count', 1);

		writeApi.writePoint(point);
		await writeApi.close();

		console.log(`[InfluxDB] wrote attendance metric: cruzid=${data.cruzid} event=${data.eventSeries}`);
	} catch (err) {
		console.error('[InfluxDB] failed to write attendance metric:', err);
	}
}
