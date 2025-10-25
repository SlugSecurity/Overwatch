import { InfluxDB } from '@influxdata/influxdb-client';

export const INFLUX_CONFIG = {
	url: process.env.INFLUX_URL || '',
	token: process.env.INFLUX_TOKEN || '',
	org: process.env.INFLUX_ORG || '',
	bucket: process.env.INFLUX_BUCKET || ''
} as const;

let influxClient: InfluxDB | null = null;

export function getInfluxClient(): InfluxDB | null {
	if (!INFLUX_CONFIG.url || !INFLUX_CONFIG.token) {
		console.warn('[InfluxDB] configuration missing, metrics disabled');
		return null;
	}

	if (!influxClient) {
		influxClient = new InfluxDB({
			url: INFLUX_CONFIG.url,
			token: INFLUX_CONFIG.token
		});
		console.log('[InfluxDB] client initialized');
	}

	return influxClient;
}
