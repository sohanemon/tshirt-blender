import { notify } from '@ts-utilities/notify';
import { Command } from 'commander';

interface GreetOptions {
	formal?: boolean;
}

export function greetCommand() {
	return new Command('greet')
		.description('Greet someone')
		.argument('<name>', 'person to greet')
		.option('-f, --formal', 'use formal greeting')
		.action((name: string, options: GreetOptions) => {
			if (options.formal) {
				notify.info(`Good day, ${name}.`);
			} else {
				notify.success(`Hello, ${name}!`);
			}
		});
}
