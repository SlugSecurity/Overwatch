import { EmbedBuilder, SlashCommandBuilder, type ChatInputCommandInteraction } from 'discord.js';

const create = () => {
	const command = new SlashCommandBuilder()
		.setName('server')
		.setDescription('Replies with a small amount of information about this server!')
		.setDMPermission(false);

	return command.toJSON();
};

const invoke = (interaction: ChatInputCommandInteraction) => {
	const guild = interaction.guild;
	if (!guild) return;

	const embed = new EmbedBuilder().setTitle(guild.name).addFields([
		{
			name: 'Members',
			value: guild.memberCount.toString(),
			inline: true,
		},
		{
			name: 'Created At',
			value: guild.createdAt.toLocaleDateString('de-DE', {
				day: '2-digit',
				month: '2-digit',
				year: 'numeric',
			}),
			inline: true,
		},
		{
			name: 'ID',
			value: guild.id,
			inline: true,
		},
		{
			name: 'AFK channel',
			value: guild.afkChannel?.name ?? 'None',
			inline: true,
		},
		{
			name: 'AFK timeout',
			value: guild.afkTimeout.toString(),
			inline: true,
		},
		{
			name: 'Custom URL',
			value: guild.vanityURLCode ?? 'None',
			inline: true,
		},
		{
			name: 'Boosts',
			value: (guild.premiumSubscriptionCount ?? 0).toString(),
			inline: true,
		},
		{
			name: 'Discord Partner',
			value: guild.partnered ? 'Yes' : 'No',
			inline: true,
		},
		{
			name: 'Verified',
			value: guild.verified ? 'Yes' : 'No',
			inline: true,
		},
	]);

	// Reply to the user
	interaction.reply({
		embeds: [embed],
	});
};

export { create, invoke };
