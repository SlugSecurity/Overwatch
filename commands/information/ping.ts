import { SlashCommandBuilder, type ChatInputCommandInteraction } from 'discord.js';

const create = () => {
	const command = new SlashCommandBuilder()
		.setName('ping')
		.setDescription('got latency?');

	return command.toJSON();
};


const invoke = async (interaction: ChatInputCommandInteraction) => {
	const startTime = Date.now();

	await interaction.deferReply({ ephemeral: true });

	const latency = Date.now() - startTime;

	interaction.editReply(`🏓 Pong! Latency: **${latency}ms**. API Latency: **${interaction.client.ws.ping}ms.**`);
};

export { create, invoke };
