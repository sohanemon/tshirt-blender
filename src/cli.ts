#!/usr/bin/env node

import { Command } from 'commander';
import packageJson from '../package.json' with { type: 'json' };
import { overlayCommand } from './lib/commands/overlay';

const program = new Command();

program
	.name(packageJson.name)
	.description(packageJson.description ?? '')
	.version(packageJson.version)
	.showSuggestionAfterError();

program.addCommand(overlayCommand());

// Show help and exit 0 when no args are passed
if (process.argv.length === 2) {
	program.outputHelp();
	process.exit(0);
}

try {
	await program.parseAsync(process.argv);
} catch (err) {
	console.error(err instanceof Error ? err.message : err);
	process.exit(1);
}
