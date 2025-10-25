import express from 'express';
import type { Client } from 'discord.js';
import { SSO_CONFIG } from '#config/sso.ts';
import { handleVerifyRedirect, handleCallback } from './routes.js';

export function startServer(client: Client) {
	const app = express();

	app.use(express.json());
	app.use(express.urlencoded({ extended: true }));

	app.get('/auth/verify/:state', handleVerifyRedirect);

	app.get('/auth/callback', async (req, res) => {
		await handleCallback(req, res, client);
	});

	app.get('/', (req, res) => {
		res.send('Discord SSO Bot - Server Running');
	});

	app.listen(SSO_CONFIG.serverPort, () => {
		console.log(`OAuth server listening on port ${SSO_CONFIG.serverPort}`);
	});

	return app;
}
