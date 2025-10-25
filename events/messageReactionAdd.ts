import { Events, type Client, type MessageReaction, type User } from 'discord.js';
import { sendFirstTimeGreeting } from '#util/greeting.ts';

const once = false;
const eventType = Events.MessageReactionAdd;

async function invoke(client: Client, reaction: MessageReaction, user: User): Promise<void> {
	if (user.bot) {
		return;
	}

	await sendFirstTimeGreeting(user);
}

export { once, eventType, invoke };
