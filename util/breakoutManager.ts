import { ChannelType, PermissionFlagsBits, type VoiceChannel, type GuildMember, type CategoryChannel } from 'discord.js';
import wordlist from 'eff-diceware-passphrase/wordlist.json';

const userToChannel = new Map<string, string>();
const channelToUser = new Map<string, string>();

function getRandomName(): string {
	const word1 = wordlist[Math.floor(Math.random() * wordlist.length)];
	const word2 = wordlist[Math.floor(Math.random() * wordlist.length)];
	return `${word1}-${word2}`;
}

export function hasActiveBreakout(userId: string): boolean {
	return userToChannel.has(userId);
}

export function isBreakoutChannel(channelId: string): boolean {
	return channelToUser.has(channelId);
}

export async function createBreakout(member: GuildMember, currentChannel: VoiceChannel): Promise<VoiceChannel> {
	const guild = member.guild;
	const category = currentChannel.parent as CategoryChannel | null;

	const breakoutChannel = await guild.channels.create({
		name: getRandomName(),
		type: ChannelType.GuildVoice,
		parent: category,
		permissionOverwrites: [
			{
				id: member.id,
				allow: [PermissionFlagsBits.ManageChannels]
			}
		]
	});

	userToChannel.set(member.id, breakoutChannel.id);
	channelToUser.set(breakoutChannel.id, member.id);

	return breakoutChannel;
}

export async function deleteBreakout(channelId: string): Promise<void> {
	const userId = channelToUser.get(channelId);
	if (!userId) return;

	channelToUser.delete(channelId);
	userToChannel.delete(userId);
}

export function getBreakoutChannelId(userId: string): string | undefined {
	return userToChannel.get(userId);
}
