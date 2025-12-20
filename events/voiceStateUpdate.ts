import { Events, type Client, type VoiceState } from 'discord.js';
import { isBreakoutChannel, deleteBreakout } from '../util/breakoutManager.js';

const once = false;
const eventType = Events.VoiceStateUpdate;

async function invoke(client: Client, oldState: VoiceState, newState: VoiceState): Promise<void> {
	const leftChannel = oldState.channel;
	if (!leftChannel) return;

	if (!isBreakoutChannel(leftChannel.id)) return;

	if (leftChannel.members.size === 0) {
		await deleteBreakout(leftChannel.id);
		try {
			await leftChannel.delete();
		} catch (error) {
			console.error('Failed to delete breakout channel:', error);
		}
	}
}

export { once, eventType, invoke };
