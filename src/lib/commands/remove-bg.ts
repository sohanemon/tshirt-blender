import {
	mkdir,
	readdir,
	readFile,
	rm,
	stat,
	writeFile,
} from 'node:fs/promises';
import path from 'node:path';
import { notify, timer } from '@ts-utilities/notify';
import { $ } from 'bun';
import { Command } from 'commander';

const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp']);

interface RemoveBackgroundOptions {
	input: string;
	out?: string | undefined;
	force: boolean;
}

interface ImageFile {
	input: string;
	output: string;
}

async function collectImages(root: string, current = root): Promise<string[]> {
	const entries = await readdir(current, { withFileTypes: true });
	const files: string[] = [];
	for (const entry of entries) {
		const fullPath = path.join(current, entry.name);
		if (entry.isDirectory()) {
			files.push(...(await collectImages(root, fullPath)));
		} else if (
			entry.isFile() &&
			IMAGE_EXTENSIONS.has(path.extname(entry.name).toLowerCase())
		) {
			files.push(fullPath);
		}
	}
	return files.sort();
}

function defaultOutput(input: string, isDirectory: boolean): string {
	if (isDirectory) {
		const parent = path.dirname(input);
		return path.join(parent, `${path.basename(input)}.out`);
	}
	const parsed = path.parse(input);
	return path.join(parsed.dir, `${parsed.name}.out.png`);
}

function isWithin(parent: string, candidate: string): boolean {
	const relative = path.relative(parent, candidate);
	return (
		relative === '' ||
		(!relative.startsWith('..') && !path.isAbsolute(relative))
	);
}

async function fileExists(file: string): Promise<boolean> {
	try {
		return (await stat(file)).isFile();
	} catch {
		return false;
	}
}

async function runSingle(input: string, output: string, force: boolean) {
	if (!force && (await fileExists(output))) {
		notify.warning(`Skipped existing output: ${output}`);
		return { written: 0, skipped: 1, failed: 0 };
	}
	await mkdir(path.dirname(output), { recursive: true });
	const bytes = await readFile(input);
	const result =
		await $`rembg i -m birefnet-general - < ${new Response(bytes)}`;
	const outputBytes = Buffer.from(await result.arrayBuffer());
	if (outputBytes.length === 0)
		throw new Error('rembg returned an empty image');
	await writeFile(output, outputBytes);
	return { written: 1, skipped: 0, failed: 0 };
}

async function runBatch(
	inputDir: string,
	outputDir: string,
	inputs: string[],
	force: boolean,
) {
	const files: ImageFile[] = inputs.map((input) => {
		const relative = path.relative(inputDir, input);
		const parsed = path.parse(relative);
		return {
			input,
			output: path.join(outputDir, parsed.dir, `${parsed.name}.png`),
		};
	});
	const outputs = new Set<string>();
	for (const file of files) {
		if (outputs.has(file.output)) {
			throw new Error(
				`Multiple inputs map to the same PNG output: ${file.output}`,
			);
		}
		outputs.add(file.output);
	}

	const existed = new Set<string>();
	for (const file of files) {
		if (await fileExists(file.output)) {
			existed.add(file.output);
			if (force) await rm(file.output);
		}
	}
	await mkdir(outputDir, { recursive: true });
	let commandError: unknown;
	try {
		await $`rembg p -m isnet-general-use ${inputDir} ${outputDir}`;
	} catch (error) {
		commandError = error;
	}

	let written = 0;
	let skipped = 0;
	let failed = 0;
	for (const file of files) {
		if (!(await fileExists(file.output))) {
			failed++;
			notify.error(`Failed ${file.input}: rembg did not create ${file.output}`);
		} else if (existed.has(file.output) && !force) {
			skipped++;
		} else {
			written++;
		}
	}
	if (commandError && failed === 0) {
		throw commandError;
	}
	return { written, skipped, failed };
}

export function removeBgCommand() {
	return new Command('remove-bg')
		.description('Remove image backgrounds and save transparent PNGs')
		.requiredOption('-i, --input <path>', 'Image file or folder of images')
		.option('-o, --out <path>', 'Output PNG path or output folder')
		.option('--force', 'Overwrite existing output files', false)
		.action(async (options: RemoveBackgroundOptions) => {
			await timer.measure(async () => {
				if (!Bun.which('rembg')) {
					notify.error(
						'rembg was not found; run `mise install` in this project',
					);
					process.exitCode = 1;
					return;
				}

				const input = path.resolve(options.input);
				let inputStats: Awaited<ReturnType<typeof stat>>;
				try {
					inputStats = await stat(input);
				} catch {
					notify.error(`Cannot read input path: ${input}`);
					process.exitCode = 1;
					return;
				}
				const isDirectory = inputStats.isDirectory();
				if (!isDirectory && !inputStats.isFile()) {
					notify.error(`Input must be an image file or directory: ${input}`);
					process.exitCode = 1;
					return;
				}

				const output = path.resolve(
					options.out ?? defaultOutput(input, isDirectory),
				);
				if (isDirectory && isWithin(input, output)) {
					notify.error('Output folder must be outside the input folder');
					process.exitCode = 1;
					return;
				}
				if (!isDirectory && path.extname(output).toLowerCase() !== '.png') {
					notify.error('Single-image output must use the .png extension');
					process.exitCode = 1;
					return;
				}
				if (!isDirectory && input === output) {
					notify.error('Output path must differ from the input image');
					process.exitCode = 1;
					return;
				}

				try {
					const result = isDirectory
						? await (async () => {
								const inputs = await collectImages(input);
								if (inputs.length === 0) {
									throw new Error(
										'No supported images found in the input folder',
									);
								}
								return runBatch(input, output, inputs, options.force);
							})()
						: await runSingle(input, output, options.force);
					const summary = `Done: ${result.written} written, ${result.skipped} skipped, ${result.failed} failed — outputs in ${output}`;
					if (result.failed > 0) {
						notify.warning(summary);
						process.exitCode = 1;
					} else {
						notify.success(summary);
					}
				} catch (error) {
					notify.error(error instanceof Error ? error.message : String(error));
					process.exitCode = 1;
				}
			});
		});
}
