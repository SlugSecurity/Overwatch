import { Events, type Client, type DMChannel, type NonThreadGuildBasedChannel } from 'discord.js';
import { isBreakoutChannel, deleteBreakout } from '../util/breakoutManager.js';

const once = false;
const eventType = Events.ChannelDelete;

async function invoke(client: Client, channel: DMChannel | NonThreadGuildBasedChannel): Promise<void> {
	if (channel.isDMBased()) return;

	if (isBreakoutChannel(channel.id)) {
		await deleteBreakout(channel.id);
	}
}

export { once, eventType, invoke };
