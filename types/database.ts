import type { ObjectId } from 'mongodb';

export interface VerifiedUser {
	_id: string;
	email: string;
	fullName: string | null;
	verifiedAt: Date;
}

export interface GreetedUser {
	_id: string;
	greetedAt: Date;
}

export interface AttendanceSession {
	_id: ObjectId;
	eventSeries: string;
	messageId: string;
	channelId: string;
	attendanceKey: string;
	createdBy: string;
	expiresAt: Date;
}

export interface AttendanceRecord {
	_id: ObjectId;
	sessionId: ObjectId;
	userId: string;
	username: string;
	submittedAt: Date;
}

export interface AttendanceMetric {
	_id: ObjectId;
	eventSeries: string;
	cruzid: string;
	username: string;
	sessionId: ObjectId;
	recordedAt: Date;
}

export interface MessageCount {
	_id: ObjectId;
	userId: string;
	date: string;
	count: number;
}

export interface ActiveMemberQualification {
	_id: string;
	cruzid: string;
	qualifiedQuarter: string;
	qualifiedAt: Date;
}
