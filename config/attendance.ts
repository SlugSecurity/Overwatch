export const EVENT_SERIES = [
	"Workshop",
	"Cyber Defense Working Group",
	"Hardware Hacking Working Group",
	"Officer Meeting"
] as const;

export const ATTENDANCE_MESSAGES = {
	command: {
		description: 'Create a timed sign-in session for an event',
		options: {
			eventSeries: 'Select the event series',
			expirationMins: 'How long until attendance closes (in minutes)',
			attendanceKey: 'Secret code that people need to enter when they sign in'
		}
	},

	addCommand: {
		description: 'Manually add a user to an attendance session',
		options: {
			session: 'Select the session to add the user to',
			user: 'The user to add'
		},
		success: 'Added **{username}** to **{eventSeries}**',
		alreadyInSession: '**{username}** is already in this session'
	},

	errors: {
		channelNotFound: 'Couldn\'t create the sign-in session, channel not found',
		sessionNotFound: 'This sign-in session doesn\'t exist anymore',
		sessionExpired: 'This sign-in session has expired',
		alreadySignedIn: 'You already signed in for this event',
		incorrectCode: 'Wrong code, try again',
		notVerified: 'You need to verify your account before you can sign in for events\n\nUse the `/verify` command to link your UCSC account and unlock attendance, cyber range access, and more'
	},

	status: {
		creating: 'Creating sign-in session...',
		closed: 'Sign-ins are now closed'
	},

	embed: {
		color: 0xff6e42,
		titleTemplate: '{eventSeries} - Sign-In',
		description: 'Sign in below to mark your attendance for this event! We use attendance to keep track of active members and club stats',
		fields: {
			closes: 'Closes',
			signedIn: 'Signed In',
			whosHere: 'Who\'s Here'
		},
		emptyState: 'No one yet',
		overflowTemplate: '... and {remaining} more',
		footerTemplate: 'Started by {username}'
	},

	button: {
		label: 'Sign In'
	},

	modal: {
		title: 'Sign In',
		inputLabel: 'Sign-In Code'
	},

	success: {
		createdTemplate: 'Sign-in session created for **{eventSeries}**!\n\nCode: `{attendanceKey}`\nCloses: <t:{expiresAt}:R>',
		signedInTemplate: 'Signed in for **{eventSeries}**',
		historyHeader: '\n\nYour attendance history:',
		historyItemTemplate: '\n- {eventSeries}: {count} {plural}'
	}
} as const;

export function formatMessage(template: string, values: Record<string, any>): string {
	return template.replace(/\{(\w+)\}/g, (_, key) => String(values[key] ?? `{${key}}`));
}

export function pluralize(count: number, singular: string, plural: string): string {
	return count === 1 ? singular : plural;
}

export type EventSeries = typeof EVENT_SERIES[number];
