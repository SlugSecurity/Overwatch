import type { Request, Response } from 'express';
import type { Client } from 'discord.js';
import { buildAuthorizeUrl, consumeState, exchangeCodeForToken, getUserInfo } from './oauth.js';
import { ssoDb, VERIFIED_ROLE_ID, SSO_MESSAGES, formatMessage } from '#config/sso.ts';

function htmlTemplate(title: string, heading: string, message: string): string {
	return `
		<!DOCTYPE html>
		<html>
		<head>
			<title>${title}</title>
			<meta name="viewport" content="width=device-width, initial-scale=1">
			<style>
				body {
					font-family: system-ui, sans-serif;
					display: flex;
					justify-content: center;
					align-items: center;
					min-height: 100vh;
					margin: 0;
					background: #0f0f0f;
					color: #ffffff;
				}
				.container {
					text-align: center;
					padding: 20px;
					max-width: 600px;
				}
				h1 {
					font-size: 2.5rem;
					margin-bottom: 1.5rem;
					color: #ff6e42;
				}
				p {
					font-size: 1.1rem;
					line-height: 1.6;
					white-space: pre-line;
				}
			</style>
		</head>
		<body>
			<div class="container">
				<h1>${heading}</h1>
				<p>${message}</p>
			</div>
		</body>
		</html>
	`;
}

export function handleVerifyRedirect(req: Request, res: Response) {
	const { state } = req.params;

	if (!state) {
		res.status(400).send(htmlTemplate('Error', 'Verification Error', 'Missing state parameter'));
		return;
	}

	const authorizeUrl = buildAuthorizeUrl(state);
	res.redirect(authorizeUrl);
}

export async function handleCallback(req: Request, res: Response, client: Client) {
	const { code, state } = req.query;

	if (!code || !state || typeof code !== 'string' || typeof state !== 'string') {
		console.error('[SSO] callback failed: missing or invalid parameters');
		res.status(400).send(htmlTemplate('Error', 'Verification Error', 'Missing or invalid parameters'));
		return;
	}

	const discordId = consumeState(state);
	if (!discordId) {
		console.error('[SSO] callback failed: invalid or expired state token');
		res.status(400).send(htmlTemplate('Error', 'Verification Error', SSO_MESSAGES.errors.invalidState));
		return;
	}

	console.log(`[SSO] verification attempt: discord_id=${discordId}`);

	try {
		const tokens = await exchangeCodeForToken(code);
		const userInfo = await getUserInfo(tokens.access_token);

		const existingUser = ssoDb.query('SELECT discord_id FROM verified_users WHERE email = ?').get(userInfo.email) as { discord_id: string } | null;

		if (existingUser && existingUser.discord_id !== discordId) {
			console.error(`[SSO] verification failed: email=${userInfo.email} already linked to discord_id=${existingUser.discord_id}`);
			res.status(400).send(htmlTemplate('Error', 'Already Linked', SSO_MESSAGES.errors.alreadyLinked));
			return;
		}

		const verifiedAt = Math.floor(Date.now() / 1000);

		ssoDb.query(`
			INSERT INTO verified_users (discord_id, email, full_name, verified_at)
			VALUES (?, ?, ?, ?)
			ON CONFLICT(discord_id) DO UPDATE SET
				email = excluded.email,
				full_name = excluded.full_name,
				verified_at = excluded.verified_at
		`).run(discordId, userInfo.email, userInfo.name, verifiedAt);

		console.log(`[SSO] user verified: discord_id=${discordId} email=${userInfo.email} name=${userInfo.name}`);

		let roleAssigned = false;
		for (const [, guild] of client.guilds.cache) {
			try {
				const member = await guild.members.fetch(discordId);
				if (member) {
					await member.roles.add(VERIFIED_ROLE_ID);
					roleAssigned = true;
					console.log(`[SSO] role assigned: discord_id=${discordId} guild_id=${guild.id}`);
				}
			} catch (err) {
				console.error(`[SSO] role assignment failed: discord_id=${discordId} guild_id=${guild.id}`, err);
			}
		}

		if (!roleAssigned) {
			console.warn(`[SSO] verification complete but no role assigned: discord_id=${discordId}`);
		}

		const successMessage = roleAssigned
			? formatMessage(SSO_MESSAGES.success.verified, { email: userInfo.email })
			: `${formatMessage(SSO_MESSAGES.success.verified, { email: userInfo.email })}\n\n${SSO_MESSAGES.success.roleFailed}`;

		res.send(htmlTemplate(
			'Account Linked',
			'Account Linked',
			`${successMessage}\n\nYou may close this page and return to Discord`
		));
	} catch (err) {
		console.error(`[SSO] verification failed: discord_id=${discordId}`, err);
		res.status(500).send(htmlTemplate('Error', 'Server Error', SSO_MESSAGES.errors.serverError));
	}
}
