import { v4 as uuidv4 } from 'uuid';
import { SSO_CONFIG } from '#config/sso.ts';

interface OAuthState {
	discordId: string;
	createdAt: number;
}

const stateStore = new Map<string, OAuthState>();

const STATE_EXPIRATION_MS = 10 * 60 * 1000;

export function generateState(discordId: string): string {
	const state = uuidv4();
	stateStore.set(state, {
		discordId,
		createdAt: Date.now()
	});

	setTimeout(() => {
		stateStore.delete(state);
	}, STATE_EXPIRATION_MS);

	return state;
}

export function validateState(state: string): string | null {
	const stateData = stateStore.get(state);

	if (!stateData) {
		return null;
	}

	if (Date.now() - stateData.createdAt > STATE_EXPIRATION_MS) {
		stateStore.delete(state);
		return null;
	}

	return stateData.discordId;
}

export function consumeState(state: string): string | null {
	const discordId = validateState(state);
	if (discordId) {
		stateStore.delete(state);
	}
	return discordId;
}

export function buildAuthorizeUrl(state: string): string {
	const params = new URLSearchParams({
		client_id: SSO_CONFIG.clientId,
		redirect_uri: SSO_CONFIG.redirectUri,
		response_type: 'code',
		scope: 'openid email profile',
		state
	});

	return `${SSO_CONFIG.authentikUrl}/application/o/authorize/?${params.toString()}`;
}

export async function exchangeCodeForToken(code: string): Promise<{
	access_token: string;
	id_token: string;
	token_type: string;
}> {
	const params = new URLSearchParams({
		grant_type: 'authorization_code',
		code,
		redirect_uri: SSO_CONFIG.redirectUri,
		client_id: SSO_CONFIG.clientId,
		client_secret: SSO_CONFIG.clientSecret
	});

	const response = await fetch(`${SSO_CONFIG.authentikUrl}/application/o/token/`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/x-www-form-urlencoded'
		},
		body: params.toString()
	});

	if (!response.ok) {
		const errorBody = await response.text();
		console.error(`[SSO] token exchange failed: ${response.statusText}`, errorBody);
		throw new Error(`token exchange failed: ${response.statusText}`);
	}

	return await response.json();
}

export async function getUserInfo(accessToken: string): Promise<{
	email: string;
	name: string;
	sub: string;
}> {
	const response = await fetch(`${SSO_CONFIG.authentikUrl}/application/o/userinfo/`, {
		headers: {
			'Authorization': `Bearer ${accessToken}`
		}
	});

	if (!response.ok) {
		throw new Error(`Failed to fetch user info: ${response.statusText}`);
	}

	return await response.json();
}
