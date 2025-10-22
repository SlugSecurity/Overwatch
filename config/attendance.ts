export const EVENT_SERIES = [
	"Workshop",
	"Cyber Defense Working Group",
	"Hardware Hacking Working Group"
] as const;

export const ATTENDANCE_OFFICER_ROLES = [
	"1430437261421580299"
] as const;

export const ATTENDANCE_MESSAGES = {
	command: {
		description: 'Create an attendance tracking session',
		options: {
			eventSeries: 'Select the event series',
			expirationMins: 'How long until attendance closes (in minutes)',
			attendanceKey: 'Secret attendance key that users must enter'
		}
	},

	errors: {
		noPermission: 'You do not have permission to use this command.',
		channelNotFound: 'Failed to create attendance session: channel not found.',
		sessionNotFound: 'This attendance session no longer exists.',
		sessionExpired: 'This attendance session has expired.',
		alreadySignedIn: 'You have already signed in for this event.',
		incorrectCode: 'Incorrect attendance code. Please try again.'
	},

	status: {
		creating: 'Creating sign-in session...',
		closed: 'Sign-ins are now closed.'
	},

	embed: {
		color: 0xff6e42,
		titleTemplate: '{eventSeries} - Sign-In',
		description: 'Sign in below to mark your attendance for this event!',
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
		signedInTemplate: 'Signed in for **{eventSeries}**.',
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
