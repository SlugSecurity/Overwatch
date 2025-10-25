import { Events, type Client, type Message } from 'discord.js';
import { sendFirstTimeGreeting } from '#util/greeting.ts';

const once = false;
const eventType = Events.MessageCreate;

async function invoke(client: Client, message: Message): Promise<void> {
	if (message.author.bot) {
		return;
	}

	await sendFirstTimeGreeting(message.author);
}

export { once, eventType, invoke };
