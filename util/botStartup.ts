import fs from 'fs';
import path from 'path';
import type { Client } from 'discord.js';

const getAllFiles = (dir: string, ext: string): string[] => {
	let files: string[] = [];
	const items = fs.readdirSync(dir, { withFileTypes: true });

	for (let item of items) {
		const fullPath = path.join(dir, item.name);
		if (item.isDirectory()) {
			files = files.concat(getAllFiles(fullPath, ext));
		} else if (item.isFile() && item.name.endsWith(ext)) {
			files.push(fullPath);
		}
	}

	return files;
};

const loadEvents = async (client: Client): Promise<void> => {
	console.log('Fetching events...');
	const eventsDir = './events';
	const events = getAllFiles(eventsDir, '.ts');

	for (let eventFile of events) {
		const event = await import(path.resolve(eventFile));
		const eventHandler = (...args: any[]) => event.invoke(client, ...args);
		if (event.once) {
			client.once(event.eventType, eventHandler);
		} else {
			client.on(event.eventType, eventHandler);
		}
	}

	console.log(`Loaded ${events.length} events!`);
	events.forEach(event => console.log(`"${path.basename(event)}"`));
};

const loadCommands = async (client: Client): Promise<void> => {
	console.log('\nFetching commands...');
	const commandsDir = './commands';
	const commands = getAllFiles(commandsDir, '.ts');

	const commandsArray: any[] = [];
	const commandMap = new Map();

	for (let commandFile of commands) {
		const commandModule = await import(path.resolve(commandFile));
		const cmd = commandModule.create();
		commandsArray.push(cmd);
		commandMap.set(cmd.name, commandModule);
	}
	client.application?.commands.set(commandsArray);
	(client as any).commands = commandMap;

	console.log(`Loaded ${commandsArray.length} commands!`);
	commandsArray.forEach(command => console.log(`"${command.name}", description: ${command.description}`));
};

const loadJobs = async (client: Client): Promise<void> => {
	console.log('\nFetching jobs...');
	const jobsDir = './jobs';
	const jobs = getAllFiles(jobsDir, '.ts');

	console.log(`Loaded ${jobs.length} jobs!`);
	jobs.forEach(jobFile => console.log(`"${path.basename(jobFile, '.ts')}"`));

	for (let jobFile of jobs) {
		const jobModule = await import(path.resolve(jobFile));
		jobModule.default(client);
	}
};

export { loadCommands, loadJobs, loadEvents };
