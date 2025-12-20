export const ACTIVE_MEMBER_ROLE_ID = process.env.ACTIVE_MEMBER_ROLE_ID || '';

export const ACTIVE_MEMBER_MESSAGE = {
	description: 'Hey, just wanted to let you know you\'ve been marked as an active member for the quarter! Thanks for being part of the community and contributing to SlugSec\n\nThis role gives you access to member-only channels and resources. Keep showing up to events and staying active, we appreciate you being here\n\nIn addition, your name will be added to our active member list on our website using the name from your account in our authentication system. If you would like to redact your name, let an officer know',
	embedColor: 0xff6e42
} as const;

export function getActiveMemberTitle(): string {
	const { quarter, year } = getCurrentQuarter();
	const quarterName = quarter.charAt(0).toUpperCase() + quarter.slice(1);
	return `You're an Active Member for ${quarterName} ${year}!`;
}

export const ACTIVE_MEMBER_CONFIG = {
	messageThreshold: 200,
	attendanceThreshold: 2,
	syncIntervalMs: 3 * 60 * 60 * 1000,
	cleanupDaysOld: 365
} as const;

export type Quarter = 'fall' | 'winter' | 'spring' | 'summer';

interface QuarterDates {
	start: { month: number; day: number };
	end: { month: number; day: number };
}

// UCSC quarter boundaries - each ends when the next begins (month is 0-indexed)
const QUARTER_DATES: Record<Quarter, QuarterDates> = {
	winter: { start: { month: 0,  day: 6  }, end: { month: 2,  day: 24 } },
	spring: { start: { month: 2,  day: 25 }, end: { month: 5,  day: 19 } },
	summer: { start: { month: 5,  day: 20 }, end: { month: 8,  day: 19 } },
	fall:   { start: { month: 8,  day: 20 }, end: { month: 0,  day: 5  } }
};

export function getCurrentQuarter(date: Date = new Date()): { quarter: Quarter; year: number } {
	const month = date.getMonth();
	const day = date.getDate();
	const year = date.getFullYear();

	const checkDate = (q: Quarter): boolean => {
		const { start, end } = QUARTER_DATES[q];
		if (start.month <= end.month) {
			if (month > start.month && month < end.month) return true;
			if (month === start.month && day >= start.day) return true;
			if (month === end.month && day <= end.day) return true;
		} else {
			if (month > start.month || month < end.month) return true;
			if (month === start.month && day >= start.day) return true;
			if (month === end.month && day <= end.day) return true;
		}
		return false;
	};

	if (checkDate('winter')) return { quarter: 'winter', year };
	if (checkDate('spring')) return { quarter: 'spring', year };
	if (checkDate('summer')) return { quarter: 'summer', year };
	if (checkDate('fall')) {
		// fall quarter uses the year it started in
		if (month < 6) return { quarter: 'fall', year: year - 1 };
		return { quarter: 'fall', year };
	}

	return { quarter: 'fall', year };
}

export function getQuarterString(date: Date = new Date()): string {
	const { quarter, year } = getCurrentQuarter(date);
	return `${year}-${quarter}`;
}

export function getQuarterDateRange(date: Date = new Date()): { start: Date; end: Date } {
	const { quarter, year } = getCurrentQuarter(date);
	const { start, end } = QUARTER_DATES[quarter];

	const startDate = new Date(year, start.month, start.day);
	let endDate = new Date(year, end.month, end.day, 23, 59, 59);

	// fall quarter spans year boundary
	if (quarter === 'fall') {
		endDate = new Date(year + 1, end.month, end.day, 23, 59, 59);
	}

	return { start: startDate, end: endDate };
}
