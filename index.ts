import { Client, GatewayIntentBits, Partials } from 'discord.js';
import { loadEvents } from '#util/botStartup.js';

const client = new Client({
	intents: [
		GatewayIntentBits.Guilds,
		GatewayIntentBits.GuildMessages,
		GatewayIntentBits.MessageContent,
		GatewayIntentBits.GuildMembers,
		GatewayIntentBits.GuildScheduledEvents,
	],
	partials: [
		Partials.Channel,
		Partials.Message,
		Partials.User,
		Partials.GuildMember
	],
});

await loadEvents(client);

console.log('\nLogging in...');
client.login(process.env.BOT_TOKEN);
