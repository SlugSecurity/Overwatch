export const VERIFIED_ROLE_ID = process.env.VERIFIED_ROLE_ID || '';

export const SSO_CONFIG = {
	authentikUrl: process.env.AUTHENTIK_URL || '',
	clientId: process.env.AUTHENTIK_CLIENT_ID || '',
	clientSecret: process.env.AUTHENTIK_CLIENT_SECRET || '',
	callbackBaseUrl: process.env.CALLBACK_BASE_URL || 'http://localhost:3000',
	serverPort: 3000,
	redirectUri: `${process.env.CALLBACK_BASE_URL || 'http://localhost:3000'}/auth/callback`
} as const;

export const SSO_MESSAGES = {
	command: {
		verify: {
			description: 'Link your Discord account with SlugSec\'s auth system',
			alreadyVerified: 'You\'re already verified! Your account is linked to {email}',
			button: 'Verify Account',
			embedTitle: 'SlugSec Auth',
			embedDescription: 'Link your Discord account with your UCSC email to unlock all the club features\n\n**How it works:**\n1. Click the button below\n2. Sign in with your UCSC Google account\n3. You\'ll automatically get the verified role\n\n**What you get:**\nSign in for event attendance, access club compute resources like our cyber range, and make it easier to collaborate with other members',
			embedColor: 0xff6e42
		},
		whois: {
			description: 'Look up a user in the auth system',
			user: 'The user to look up',
			notVerified: '**{username}** doesn\'t have a linked account',
			resultTitle: 'User Information',
			resultColor: 0xff6e42
		},
		find: {
			description: 'Look up a user by their email in the auth system',
			cruzid: 'CruzID or full email address',
			notFound: '**{email}** doesn\'t have a linked account',
			resultTitle: 'User Lookup',
			resultColor: 0xff6e42
		}
	},
	errors: {
		invalidState: 'Invalid or expired verification session, try again',
		authFailed: 'Authentication failed, try again',
		alreadyLinked: 'This email is already linked to another Discord account',
		serverError: 'Something went wrong during verification, try again later'
	},
	success: {
		verified: 'You\'re verified! Your account is now linked to {email}',
		roleFailed: 'Verification successful, but couldn\'t assign your role - contact an officer'
	}
} as const;

export function formatMessage(template: string, values: Record<string, any>): string {
	return template.replace(/\{(\w+)\}/g, (_, key) => String(values[key] ?? `{${key}}`));
}
