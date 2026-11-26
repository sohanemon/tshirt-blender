import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { notify, timer, toast } from '@ts-utilities/notify';
import { Command } from 'commander';

import { createLimiter } from '../utils/async';
import {
	DEFAULT_FLUX_MODEL,
	buildPrintArtPrompt,
	generateImage,
	readCloudflareCredentials,
} from '../utils/image-gen';
import { parsePromptFile } from '../utils/prompt-file';

interface GenCommandOptions {
	prompts: string;
	out: string;
	model: string;
	concurrency: string;
	force: boolean;
}

async function fileExists(file: string): Promise<boolean> {
	try {
		await stat(file);
		return true;
	} catch {
		return false;
	}
}

export function genCommand() {
	return new Command('gen')
		.description('Generate images in bulk from a prompt file')
		.requiredOption('-p, --prompts <path>', 'Prompt file, one prompt per line')
		.option('-o, --out <dir>', 'Output folder', 'out/images')
		.option('--model <id>', 'Cloudflare Workers AI model', DEFAULT_FLUX_MODEL)
		.option('--concurrency <n>', 'Parallel requests', '2')
		.option('--force', 'Overwrite existing images', false)
		.action(async (options: GenCommandOptions) => {
			await timer.measure(async () => {
				const credentials = readCloudflareCredentials(Bun.env);
				if (!credentials) {
					notify.error('Set CF_ACCOUNT_ID and CF_API_TOKEN');
					process.exitCode = 1;
					return;
				}

				if (options.model.trim().length === 0) {
					notify.error('--model must not be empty');
					process.exitCode = 1;
					return;
				}

				const concurrency = Number.parseInt(options.concurrency, 10);
				if (!Number.isFinite(concurrency) || concurrency < 1) {
					notify.error('--concurrency must be an integer of at least 1');
					process.exitCode = 1;
					return;
				}

				const promptsPath = path.resolve(options.prompts);
				let text: string;
				try {
					text = await readFile(promptsPath, 'utf8');
				} catch {
					notify.error(`Cannot read prompt file: ${promptsPath}`);
					process.exitCode = 1;
					return;
				}

				let entries: ReturnType<typeof parsePromptFile>;
				try {
					entries = parsePromptFile(text);
				} catch (err) {
					notify.error(err instanceof Error ? err.message : String(err));
					process.exitCode = 1;
					return;
				}
				if (entries.length === 0) {
					notify.error('No prompts found in the prompt file');
					process.exitCode = 1;
					return;
				}

				const outDir = path.resolve(options.out);
				await mkdir(outDir, { recursive: true });

				const limit = createLimiter(concurrency);
				let written = 0;
				let skipped = 0;
				let failed = 0;

				const progress = toast.progress(
					{ total: entries.length, variant: 'line' },
					{
						loading: 'Generating images',
						success: 'Generation complete',
					},
				);

				await Promise.all(
					entries.map((entry) =>
						limit(async () => {
							const outFile = path.join(outDir, `${entry.slug}.jpg`);
							try {
								if (!options.force && (await fileExists(outFile))) {
									skipped++;
									return;
								}
								const prompt = buildPrintArtPrompt(entry.prompt);
								const bytes = await generateImage({
									accountId: credentials.accountId,
									apiToken: credentials.apiToken,
									model: options.model,
									prompt,
								});
								await writeFile(outFile, bytes);
								written++;
							} catch (err) {
								failed++;
								notify.error(
									`Failed line ${entry.line} (${entry.slug}): ${err instanceof Error ? err.message : String(err)}`,
								);
							} finally {
								progress.advance();
							}
						}),
					),
				);

				const summary = `Done: ${written} written, ${skipped} skipped, ${failed} failed — outputs in ${outDir}`;
				if (failed > 0) {
					notify.warning(summary);
					process.exitCode = 1;
				} else {
					notify.success(summary);
				}
			});
		});
}
