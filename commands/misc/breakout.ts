import { SlashCommandBuilder, type ChatInputCommandInteraction, type GuildMember, type VoiceChannel, MessageFlags } from 'discord.js';
import { hasActiveBreakout, createBreakout, getBreakoutChannelId } from '../../util/breakoutManager.js';

const create = () => {
	const command = new SlashCommandBuilder()
		.setName('breakout')
		.setDescription('Create a temporary voice channel and move there in 5 seconds')
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
		content: `Created **${breakoutChannel.name}**. Moving you there in 5 seconds...`,
		flags: MessageFlags.Ephemeral
	});

	setTimeout(async () => {
		try {
			if (member.voice.channel) {
				await member.voice.setChannel(breakoutChannel);
			}
		} catch (error) {
			console.error('Failed to move member to breakout channel:', error);
		}
	}, 5000);
};

export { create, invoke };
