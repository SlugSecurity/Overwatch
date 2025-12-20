import { SlashCommandBuilder, type ChatInputCommandInteraction, type GuildMember, type VoiceChannel, MessageFlags } from 'discord.js';
import { hasActiveBreakout, createBreakout, getBreakoutChannelId, deleteBreakout } from '../../util/breakoutManager.js';

const create = () => {
	const command = new SlashCommandBuilder()
		.setName('breakout')
		.setDescription('Create a temporary voice channel with admin perms (auto-deletes when empty)')
		.setDMPermission(false);

	return command.toJSON();
};

const invoke = async (interaction: ChatInputCommandInteraction) => {
	const member = interaction.member as GuildMember;

	if (!member.voice.channel) {
		await interaction.reply({
			content: 'You need to be in a voice channel to use this command',
			flags: MessageFlags.Ephemeral
		});
		return;
	}

	if (hasActiveBreakout(member.id)) {
		const existingChannelId = getBreakoutChannelId(member.id);
		await interaction.reply({
			content: `You already have an active breakout channel: <#${existingChannelId}>`,
			flags: MessageFlags.Ephemeral
		});
		return;
	}

	const currentChannel = member.voice.channel as VoiceChannel;

	let breakoutChannel: VoiceChannel;
	try {
		breakoutChannel = await createBreakout(member, currentChannel);
	} catch (error) {
		console.error('Failed to create breakout channel:', error);
		await interaction.reply({
			content: 'Failed to create breakout channel',
			flags: MessageFlags.Ephemeral
		});
		return;
	}

	await interaction.reply({
		content: `Created <#${breakoutChannel.id}>, moving you there in 5 seconds\n\nYou have admin permissions in this channel and it will automatically delete once everyone leaves`,
		flags: MessageFlags.Ephemeral
	});

	setTimeout(async () => {
		try {
			if (member.voice.channel) {
				await member.voice.setChannel(breakoutChannel);
			} else if (breakoutChannel.members.size === 0) {
				await deleteBreakout(breakoutChannel.id);
				await breakoutChannel.delete();
			}
		} catch (error) {
			console.error('Failed to move member to breakout channel:', error);
		}
	}, 5000);
};

export { create, invoke };
