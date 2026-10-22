import { mkdir, readdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { notify, timer, toast } from '@ts-utilities/notify';
import { Command } from 'commander';

import { createLimiter } from '../utils/async';
import {
	compositeOverlayOntoShirt,
	DARK_DESIGN_LUMINANCE,
	loadShirtMaps,
	type OverlayBox,
	type OverlayOptions,
	parseBoxFractions,
	parseHexColor,
} from '../utils/overlay-compositor';

/** Design file types picked up when `--design` points at a folder. */
const DESIGN_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp']);

/** Parallel composites in a batch run. */
const BATCH_CONCURRENCY = 4;

interface OverlayCommandOptions {
	shirt: string;
	design: string;
	out: string;
	color: string[];
	size: string;
	opacity: string;
	displace: string;
	shade: string;
	box: string;
}

interface OverlayJob {
	designPath: string;
	color?: string | undefined;
	outFile: string;
}

function collectColor(value: string, previous: string[]): string[] {
	return [...previous, value];
}

function parseNumber(raw: string): number {
	return Number(raw.trim());
}

async function collectDesigns(designPath: string): Promise<string[]> {
	const stats = await stat(designPath);
	if (!stats.isDirectory()) return [designPath];

	const entries = await readdir(designPath, { withFileTypes: true });
	return entries
		.filter(
			(entry) =>
				entry.isFile() &&
				DESIGN_EXTENSIONS.has(path.extname(entry.name).toLowerCase()),
		)
		.map((entry) => path.join(designPath, entry.name))
		.sort();
}

export function overlayCommand() {
	return new Command('overlay')
		.description('Composite design images onto a t-shirt photo')
		.option(
			'-s, --shirt <path>',
			'T-shirt photo (transparent background)',
			'src/assets/black-tshirt.png',
		)
		.requiredOption('-d, --design <path>', 'Design image or folder of designs')
		.option('-o, --out <path>', 'Output file or folder', 'out/mockups')
		.option(
			'--color <hex>',
			'Shirt color variant (repeatable, e.g. #ff0000)',
			collectColor,
			[],
		)
		.option('--size <px>', 'Output size in pixels (square)', '2000')
		.option('--opacity <n>', 'Design opacity over the fabric', '0.93')
		.option('--displace <px>', 'Displacement along the fabric folds', '8')
		.option('--shade <n>', 'Fabric shading strength', '2')
		.option(
			'--box <l,t,w,h>',
			'Print area as fractions of the shirt image',
			'0.33,0.22,0.34,0.32',
		)
		.action(async (options: OverlayCommandOptions) => {
			await timer.measure(async () => {
				const size = Number.parseInt(options.size, 10);
				if (!Number.isFinite(size) || size < 16) {
					notify.error('--size must be an integer of at least 16');
					process.exitCode = 1;
					return;
				}

				const opacity = parseNumber(options.opacity);
				if (!Number.isFinite(opacity) || opacity <= 0 || opacity > 1) {
					notify.error('--opacity must be in (0, 1]');
					process.exitCode = 1;
					return;
				}

				const displace = parseNumber(options.displace);
				if (!Number.isFinite(displace) || displace < 0) {
					notify.error('--displace must be a non-negative number');
					process.exitCode = 1;
					return;
				}

				const shade = parseNumber(options.shade);
				if (!Number.isFinite(shade) || shade < 0) {
					notify.error('--shade must be a non-negative number');
					process.exitCode = 1;
					return;
				}

				const box: OverlayBox | null = parseBoxFractions(options.box);
				if (!box) {
					notify.error(
						'--box must be "left,top,width,height" fractions between 0 and 1',
					);
					process.exitCode = 1;
					return;
				}

				const colors: string[] = [];
				for (const raw of options.color) {
					try {
						parseHexColor(raw);
					} catch {
						notify.error(`Invalid --color value: ${raw}`);
						process.exitCode = 1;
						return;
					}
					colors.push(raw.replace(/^#/, '').toLowerCase());
				}

				const designPath = path.resolve(options.design);
				let designs: string[];
				try {
					designs = await collectDesigns(designPath);
				} catch {
					notify.error(`Cannot read design path: ${designPath}`);
					process.exitCode = 1;
					return;
				}
				if (designs.length === 0) {
					notify.error('No png/webp designs found in the design folder');
					process.exitCode = 1;
					return;
				}

				const maps = await loadShirtMaps(path.resolve(options.shirt));

				if (colors.length > 0 && maps.isDark) {
					notify.warning(
						`Base shirt is dark (mean luminance ${maps.meanLuminance.toFixed(2)}) — recoloring from a dark base looks fake, use a light base photo instead`,
					);
				}

				const outPath = path.resolve(options.out);
				const isBatch = designs.length > 1 || colors.length > 1;
				const outIsFile = !isBatch && /\.jpe?g$/i.test(outPath);

				const jobs: OverlayJob[] = [];
				for (const design of designs) {
					const base = path.basename(design, path.extname(design));
					for (const color of colors.length > 0 ? colors : ['']) {
						const name = color ? `${base}-${color}.jpg` : `${base}.jpg`;
						jobs.push({
							designPath: design,
							color: color || undefined,
							outFile: outIsFile ? outPath : path.join(outPath, name),
						});
					}
				}

				await mkdir(outIsFile ? path.dirname(outPath) : outPath, {
					recursive: true,
				});

				const compositeOptions: OverlayOptions = {
					size,
					opacity,
					displace,
					shade,
					box,
				};

				const limit = createLimiter(BATCH_CONCURRENCY);
				let done = 0;
				let failed = 0;

				const progress = toast.progress(
					{ total: jobs.length, variant: 'line' },
					{
						loading: 'Compositing mockups',
						success: 'Mockups complete',
					},
				);

				await Promise.all(
					jobs.map((job) =>
						limit(async () => {
							try {
								const result = await compositeOverlayOntoShirt({
									designPath: job.designPath,
									maps,
									options: { ...compositeOptions, color: job.color },
								});
								await writeFile(job.outFile, result.data);
								if (
									maps.isDark &&
									result.designLuminance < DARK_DESIGN_LUMINANCE
								) {
									notify.warning(
										`Design "${path.basename(job.designPath)}" is very dark (mean luminance ${result.designLuminance.toFixed(2)}) and will disappear on a dark shirt`,
									);
								}
								done++;
							} catch (err) {
								failed++;
								notify.error(
									`Failed ${job.designPath}: ${err instanceof Error ? err.message : String(err)}`,
								);
							}
							progress.advance();
						}),
					),
				);

				if (failed > 0) {
					notify.warning(
						`Done: ${done} ok, ${failed} failed (${jobs.length} total) — outputs in ${outPath}`,
					);
					process.exitCode = 1;
				} else {
					notify.success(
						`Done: ${done}/${jobs.length} mockups written to ${outPath}`,
					);
				}
			});
		});
}
