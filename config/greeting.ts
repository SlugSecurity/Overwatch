import { Database } from 'bun:sqlite';

const db = new Database('databases/server.db');

db.exec(`
	CREATE TABLE IF NOT EXISTS greeted_users (
		discord_id TEXT PRIMARY KEY,
		greeted_at INTEGER NOT NULL
	)
`);

export const GREETING_MESSAGES = {
	title: 'Welcome to SlugSec!',
	description: 'Hey, first time seeing you here! Before you get started, to get full access to the server and all our features, you\'ll need to link your UCSC Google account with SlugSec\'s auth system\n\nThis will let you sign in for event attendance, access club compute resources like our cyber range, and make it easier to collaborate with other members\n\nClick the button below to verify now, or use the `/verify` command anytime',
	button: 'Verify Now',
	embedColor: 0xff6e42,
	additionalInfo: 'Additional info can be configured here later'
} as const;

export { db as greetingDb };
