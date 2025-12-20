import { Client, GatewayIntentBits, Partials } from 'discord.js';
import { loadEvents } from '#util/botStartup.js';
import { startServer } from '#server/index.ts';

const client = new Client({
	intents: [
		GatewayIntentBits.Guilds,
		GatewayIntentBits.GuildMessages,
		GatewayIntentBits.MessageContent,
		GatewayIntentBits.GuildMembers,
		GatewayIntentBits.GuildScheduledEvents,
		GatewayIntentBits.GuildMessageReactions,
		GatewayIntentBits.GuildVoiceStates
	],
	partials: [
		Partials.Channel,
		Partials.Message,
		Partials.User,
		Partials.GuildMember,
		Partials.Reaction
	],
});

await loadEvents(client);

startServer(client);

console.log('\nLogging in...');
client.login(process.env.BOT_TOKEN);
