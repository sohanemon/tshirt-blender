import { notify } from '@ts-utilities/notify';
import { Command } from 'commander';
import inquirer from 'inquirer';

export function interactiveCommand() {
	return new Command('interactive')
		.alias('i')
		.description('Launch an interactive prompt session')
		.action(async () => {
			const answers = await inquirer.prompt([
				{
					type: 'input',
					name: 'name',
					message: 'What is your name?',
					default: 'World',
				},

				{
					type: 'confirm',
					name: 'shout',
					message: 'Shout it?',
					default: false,
				},
			]);

			const msg = `Hello, ${answers.name}!`;
			const output = answers.shout ? msg.toUpperCase() : msg;
			notify.success(output);
		});
}
