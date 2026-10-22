import { readFile } from 'node:fs/promises';
import path from 'node:path';

import sharp from 'sharp';

sharp.cache(false);
sharp.concurrency(1); // job-level limiter owns parallelism, not libvips

/** Longest edge of the working canvas the composite runs on. */
const WORK_MAX = 2400;

/** Sigma of the light blur feeding the fabric shading map. */
const SHADE_BLUR_SIGMA = 1.5;

/** Sigma of the heavy blur feeding the fabric displacement map. */
const DISPLACE_BLUR_SIGMA = 14;

/** Shirt pixels with alpha below this are background, not fabric. */
const ALPHA_SILHOUETTE = 200;

/** Design alpha below this is dropped — kills dark fringing halos. */
const ALPHA_CUTOFF = 2 / 255;

/** Gradient magnitude (luminance units per pixel) below this counts as flat. */
const GRADIENT_FLOOR_LUM = 0.005;

/** Mean shirt luminance below this counts as a dark base shirt. */
export const DARK_SHIRT_LUMINANCE = 0.35;

/** Mean design luminance below this vanishes on a dark shirt. */
export const DARK_DESIGN_LUMINANCE = 0.25;

/** Print-area rectangle expressed as fractions of the shirt image. */
export interface OverlayBox {
	left: number;
	top: number;
	width: number;
	height: number;
}

/** Print-area rectangle in pixels. */
export interface PixelBox {
	left: number;
	top: number;
	width: number;
	height: number;
}

export interface OverlayOptions {
	/** Output edge length in pixels (square). */
	size: number;
	/** Design opacity over the fabric. */
	opacity: number;
	/** Maximum displacement in pixels along the fabric gradient. */
	displace: number;
	/** Fabric shading strength applied to the ink. */
	shade: number;
	/** Print area as fractions of the shirt image. */
	box: OverlayBox;
	/** Optional shirt color variant (hex). */
	color?: string | undefined;
}

/** Shirt pixels plus the maps derived from them, computed once per shirt. */
export interface ShirtMaps {
	/** Resolved path the maps were built from. */
	shirtPath: string;
	width: number;
	height: number;
	/** Working-resolution shirt pixels (RGBA). */
	rgba: Buffer;
	/** Normalized luminance deviation per pixel — scaled by shade strength. */
	shade: Float32Array;
	/** Raw gradient of the blurred fabric luminance, before scale. */
	gradX: Float32Array;
	gradY: Float32Array;
	/** Reference slope inside the print area — a typical fold gradient. */
	gradRef: number;
	/** Luminance range the gradient was normalized against. */
	gradRange: number;
	/** Box key the current gradient reference was computed for. */
	gradBoxKey: string | null;
	/** Mean luminance of the visible fabric (0..1). */
	meanLuminance: number;
	/** True when the base shirt is dark. */
	isDark: boolean;
}

export interface OverlayResult {
	/** Rendered JPEG bytes. */
	data: Buffer;
	/** Mean luminance of the design ink (0..1). */
	designLuminance: number;
}

export interface CompositeRequest {
	designPath: string;
	maps: ShirtMaps;
	options: OverlayOptions;
}

export interface LoadDesignRequest {
	designPath: string;
	maxWidth: number;
	maxHeight: number;
}

interface DesignImage {
	rgba: Buffer;
	width: number;
	height: number;
	/** Mean luminance of the visible ink (0..1). */
	meanLuminance: number;
}

const shirtCache = new Map<string, Promise<ShirtMaps>>();

/** Recolored shirt bases, keyed by shirt path + hex. */
const recolorCache = new Map<string, Buffer>();

function clamp(value: number, min: number, max: number): number {
	if (value < min) return min;
	if (value > max) return max;
	return value;
}

function luminance(r: number, g: number, b: number): number {
	return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Parses `#rgb`, `#rrggbb` or the bare hex form into 0..255 channels. */
export function parseHexColor(hex: string): {
	r: number;
	g: number;
	b: number;
} {
	const raw = hex.trim().replace(/^#/, '');
	if (/^[\da-f]{3}$/i.test(raw)) {
		const r = Number.parseInt((raw[0] ?? '').repeat(2), 16);
		const g = Number.parseInt((raw[1] ?? '').repeat(2), 16);
		const b = Number.parseInt((raw[2] ?? '').repeat(2), 16);
		return { r, g, b };
	}
	if (/^[\da-f]{6}$/i.test(raw)) {
		return {
			r: Number.parseInt(raw.slice(0, 2), 16),
			g: Number.parseInt(raw.slice(2, 4), 16),
			b: Number.parseInt(raw.slice(4, 6), 16),
		};
	}
	throw new Error(`Invalid hex color: ${hex}`);
}

/** Parses a `left,top,width,height` fraction string. */
export function parseBoxFractions(raw: string): OverlayBox | null {
	const parts = raw.split(',').map((v) => Number(v.trim()));
	if (parts.length !== 4) return null;
	if (parts.some((v) => !Number.isFinite(v) || v < 0 || v > 1)) return null;
	const [left, top, width, height] = parts as [number, number, number, number];
	if (width <= 0 || height <= 0) return null;
	return { left, top, width, height };
}

/** Converts fraction box into pixel box on a `width` x `height` image. */
export function resolveBoxPixels(request: {
	box: OverlayBox;
	width: number;
	height: number;
}): PixelBox {
	const { box, width, height } = request;
	const left = Math.round(box.left * width);
	const top = Math.round(box.top * height);
	const boxWidth = Math.max(1, Math.round(box.width * width));
	const boxHeight = Math.max(1, Math.round(box.height * height));
	return {
		left: clamp(left, 0, Math.max(0, width - 1)),
		top: clamp(top, 0, Math.max(0, height - 1)),
		width: Math.min(boxWidth, width - left),
		height: Math.min(boxHeight, height - top),
	};
}

/** Percentile of a 256-bin histogram (0..255 luminance). */
function percentileFromHistogram(
	hist: Uint32Array,
	total: number,
	percentile: number,
): number {
	if (total === 0) return 0;
	const target = (total * percentile) / 100;
	let seen = 0;
	for (let value = 0; value < hist.length; value++) {
		seen += hist[value] ?? 0;
		if (seen >= target) return value;
	}
	return hist.length - 1;
}

/** Blurred copy of a single channel luminance map, raw bytes. */
async function blurredLuma(
	luma: Buffer,
	width: number,
	height: number,
	sigma: number,
): Promise<Buffer> {
	return sharp(luma, { raw: { width, height, channels: 1 } })
		.blur(sigma)
		.raw()
		.toBuffer();
}

/**
 * Loads the shirt once and derives the shading + displacement maps from it.
 * Results are cached per shirt path so a batch pays for it only once.
 */
export async function buildShirtMaps(shirtPath: string): Promise<ShirtMaps> {
	const buffer = await readFile(shirtPath);
	const meta = await sharp(buffer).metadata();
	const srcWidth = meta.width ?? 0;
	const srcHeight = meta.height ?? 0;
	if (!srcWidth || !srcHeight) {
		throw new Error(`Unreadable shirt image: ${shirtPath}`);
	}

	const scale = Math.min(1, WORK_MAX / Math.max(srcWidth, srcHeight));
	const width = Math.max(1, Math.round(srcWidth * scale));
	const height = Math.max(1, Math.round(srcHeight * scale));

	const { data } = await sharp(buffer)
		.rotate()
		.ensureAlpha()
		.resize(width, height, { fit: 'fill', kernel: 'lanczos3' })
		.raw()
		.toBuffer({ resolveWithObject: true });

	const rgba = Buffer.from(data);

	// NOTE: percentile histogram over the visible fabric only.
	const rawHist = new Uint32Array(256);
	let opaque = 0;
	let lumSum = 0;
	for (let i = 0; i < rgba.length; i += 4) {
		if ((rgba[i + 3] ?? 0) <= ALPHA_SILHOUETTE) continue;
		const l = Math.round(
			luminance(rgba[i] ?? 0, rgba[i + 1] ?? 0, rgba[i + 2] ?? 0),
		);
		rawHist[l] = (rawHist[l] ?? 0) + 1;
		opaque++;
		lumSum += l;
	}
	if (opaque === 0) {
		throw new Error(`Shirt image has no visible pixels: ${shirtPath}`);
	}
	const rawP2 = percentileFromHistogram(rawHist, opaque, 2);
	const rawP50 = percentileFromHistogram(rawHist, opaque, 50);
	const rawP98 = percentileFromHistogram(rawHist, opaque, 98);
	const range = Math.max(rawP98 - rawP2, 1);

	// NOTE: fill the background with a neutral gray so the blur does not bleed
	// the photo backdrop into the fabric edges.
	const filled = Buffer.from(rgba);
	for (let i = 0; i < filled.length; i += 4) {
		if ((filled[i + 3] ?? 0) > ALPHA_SILHOUETTE) continue;
		filled[i] = rawP50;
		filled[i + 1] = rawP50;
		filled[i + 2] = rawP50;
		filled[i + 3] = 255;
	}

	// NOTE: stretch the contrast before blurring. A black shirt only spans a
	// few luminance levels, so an unstretched 8-bit blur quantizes the fabric
	// slope into a staircase and the print tears along every step.
	const rawLuma = await sharp(filled, {
		raw: { width, height, channels: 4 },
	})
		.greyscale()
		.extractChannel(0)
		.raw()
		.toBuffer();

	const stretched = Buffer.alloc(width * height);
	const stretch = 255 / range;
	for (let i = 0; i < stretched.length; i++) {
		stretched[i] = clamp(
			Math.round((((rawLuma[i] ?? 0) - rawP2) * stretch) | 0),
			0,
			255,
		);
	}

	const shadeLuma = await blurredLuma(
		stretched,
		width,
		height,
		SHADE_BLUR_SIGMA,
	);
	const displaceLuma = await blurredLuma(
		stretched,
		width,
		height,
		DISPLACE_BLUR_SIGMA,
	);

	// NOTE: normalize the shading map on its own 2/50/98 percentiles so a black
	// shirt with a tiny luminance range still stretches to the full effect.
	const shadeHist = new Uint32Array(256);
	let shadeOpaque = 0;
	for (let i = 0, p = 0; i < rgba.length; i += 4, p++) {
		if ((rgba[i + 3] ?? 0) <= ALPHA_SILHOUETTE) continue;
		const l = shadeLuma[p] ?? 0;
		shadeHist[l] = (shadeHist[l] ?? 0) + 1;
		shadeOpaque++;
	}
	const p2 = percentileFromHistogram(shadeHist, shadeOpaque, 2);
	const p50 = percentileFromHistogram(shadeHist, shadeOpaque, 50);
	const p98 = percentileFromHistogram(shadeHist, shadeOpaque, 98);
	const shadeRange = Math.max(p98 - p2, 1);

	const count = width * height;
	const shade = new Float32Array(count);
	for (let i = 0; i < count; i++) {
		shade[i] = ((shadeLuma[i] ?? 0) - p50) / shadeRange;
	}

	// NOTE: central differences on the heavily blurred map give the fabric
	// slope the print follows. The aperture is wide on purpose — the blurred
	// map is 8-bit, so a 1px baseline quantizes to zero across flat fabric.
	const aperture = Math.max(2, Math.round(Math.max(width, height) / 300));
	const gradX = new Float32Array(count);
	const gradY = new Float32Array(count);
	for (let y = 0; y < height; y++) {
		const yUp = Math.max(0, y - aperture);
		const yDown = Math.min(height - 1, y + aperture);
		for (let x = 0; x < width; x++) {
			const xLeft = Math.max(0, x - aperture);
			const xRight = Math.min(width - 1, x + aperture);
			const i = y * width + x;
			gradX[i] =
				((displaceLuma[y * width + xRight] ?? 0) -
					(displaceLuma[y * width + xLeft] ?? 0)) /
				(2 * aperture * shadeRange);
			gradY[i] =
				((displaceLuma[yDown * width + x] ?? 0) -
					(displaceLuma[yUp * width + x] ?? 0)) /
				(2 * aperture * shadeRange);
		}
	}

	// NOTE: smooth the remaining quantization into a continuous fabric slope.
	const smoothRadius = Math.max(1, Math.round(aperture / 2));
	blurField(gradX, width, height, smoothRadius);
	blurField(gradY, width, height, smoothRadius);

	const meanLuminance = lumSum / opaque / 255;

	return {
		shirtPath,
		width,
		height,
		rgba,
		shade,
		gradX,
		gradY,
		gradRef: 0,
		gradRange: (shadeRange * range) / 255,
		gradBoxKey: null,
		meanLuminance,
		isDark: meanLuminance < DARK_SHIRT_LUMINANCE,
	};
}

/** Loads (and caches) the shirt maps for a given shirt photo. */
export function loadShirtMaps(shirtPath: string): Promise<ShirtMaps> {
	const key = path.resolve(shirtPath);
	const cached = shirtCache.get(key);
	if (cached) return cached;
	const promise = buildShirtMaps(key).catch((err) => {
		shirtCache.delete(key);
		throw err;
	});
	shirtCache.set(key, promise);
	return promise;
}

/**
 * Separable box blur over a float field, in place. The gradient comes from an
 * 8-bit blurred map, so it is quantized into steps — blurring smooths those
 * steps into a continuous slope and stops the print from tearing.
 */
function blurField(
	field: Float32Array,
	width: number,
	height: number,
	radius: number,
): void {
	if (radius < 1) return;
	const norm = 1 / (2 * radius + 1);
	const tmp = new Float32Array(field.length);

	for (let y = 0; y < height; y++) {
		const row = y * width;
		let sum = 0;
		for (let x = -radius; x <= radius; x++) {
			sum += field[row + clamp(x, 0, width - 1)] ?? 0;
		}
		for (let x = 0; x < width; x++) {
			tmp[row + x] = sum * norm;
			sum +=
				(field[row + Math.min(width - 1, x + radius + 1)] ?? 0) -
				(field[row + Math.max(0, x - radius)] ?? 0);
		}
	}

	for (let x = 0; x < width; x++) {
		let sum = 0;
		for (let y = -radius; y <= radius; y++) {
			sum += tmp[clamp(y, 0, height - 1) * width + x] ?? 0;
		}
		for (let y = 0; y < height; y++) {
			field[y * width + x] = sum * norm;
			sum +=
				(tmp[Math.min(height - 1, y + radius + 1) * width + x] ?? 0) -
				(tmp[Math.max(0, y - radius) * width + x] ?? 0);
		}
	}
}

/**
 * Measures the typical fabric slope inside the print area: the 90th percentile
 * of the gradient magnitudes. The displacement is scaled against it, so
 * `--displace` is the pixel shift a strong fold produces no matter how
 * contrasty the shirt photo is. Flat shirts get no displacement at all.
 */
function applyGradientScale(maps: ShirtMaps, box: PixelBox): number {
	const key = `${box.left},${box.top},${box.width}x${box.height}`;
	if (maps.gradBoxKey === key) return maps.gradRef;

	const mags: number[] = [];
	const right = Math.min(maps.width, box.left + box.width);
	const bottom = Math.min(maps.height, box.top + box.height);
	for (let y = box.top; y < bottom; y++) {
		for (let x = box.left; x < right; x++) {
			const i = y * maps.width + x;
			if ((maps.rgba[i * 4 + 3] ?? 0) < ALPHA_SILHOUETTE) continue;
			const mag = Math.hypot(maps.gradX[i] ?? 0, maps.gradY[i] ?? 0);
			if (mag > 0) mags.push(mag);
		}
	}
	mags.sort((a, b) => a - b);

	// NOTE: the reference is checked in raw luminance units so a flat shirt
	// is never amplified out of its own sensor noise.
	const reference = mags[Math.floor(mags.length * 0.9)] ?? 0;
	maps.gradRef =
		reference * maps.gradRange < GRADIENT_FLOOR_LUM ? 0 : reference;
	maps.gradBoxKey = key;
	return maps.gradRef;
}

/** Loads a design, trims its transparent border and fits it into the box. */
async function loadDesign(request: LoadDesignRequest): Promise<DesignImage> {
	const { designPath, maxWidth, maxHeight } = request;
	const buffer = await readFile(designPath);
	const { data, info } = await sharp(buffer)
		.rotate()
		.ensureAlpha()
		.raw()
		.toBuffer({ resolveWithObject: true });

	const raw = Buffer.from(data);
	const width = info.width;
	const height = info.height;
	const channels = info.channels;

	let minX = width;
	let minY = height;
	let maxX = -1;
	let maxY = -1;
	let lumSum = 0;
	let lumCount = 0;
	for (let y = 0; y < height; y++) {
		for (let x = 0; x < width; x++) {
			const i = (y * width + x) * channels;
			const alpha = raw[i + 3] ?? 0;
			if (alpha <= ALPHA_CUTOFF * 255) continue;
			if (x < minX) minX = x;
			if (x > maxX) maxX = x;
			if (y < minY) minY = y;
			if (y > maxY) maxY = y;
			if (alpha > ALPHA_SILHOUETTE) {
				lumSum += luminance(raw[i] ?? 0, raw[i + 1] ?? 0, raw[i + 2] ?? 0);
				lumCount++;
			}
		}
	}
	if (maxX < 0 || maxY < 0) {
		throw new Error(`Design has no visible pixels: ${designPath}`);
	}

	const cropLeft = minX;
	const cropTop = minY;
	const cropWidth = maxX - minX + 1;
	const cropHeight = maxY - minY + 1;

	const { data: fitData, info: fitInfo } = await sharp(raw, {
		raw: { width, height, channels },
	})
		.extract({
			left: cropLeft,
			top: cropTop,
			width: cropWidth,
			height: cropHeight,
		})
		.resize(Math.max(1, maxWidth), Math.max(1, maxHeight), {
			fit: 'inside',
			kernel: 'lanczos3',
		})
		.raw()
		.toBuffer({ resolveWithObject: true });

	return {
		rgba: Buffer.from(fitData),
		width: fitInfo.width,
		height: fitInfo.height,
		meanLuminance: lumCount > 0 ? lumSum / lumCount / 255 : 0,
	};
}

/** Tints the shirt pixels with `hex`, keeping the fabric luminance detail. */
function recolorShirt(maps: ShirtMaps, hex: string): Buffer {
	const key = `${maps.shirtPath}:${hex.toLowerCase()}`;
	const cached = recolorCache.get(key);
	if (cached) return Buffer.from(cached);

	const { r, g, b } = parseHexColor(hex);
	const out = Buffer.from(maps.rgba);
	for (let i = 0; i < out.length; i += 4) {
		if ((out[i + 3] ?? 0) < ALPHA_SILHOUETTE) continue;
		const lum = luminance(out[i] ?? 0, out[i + 1] ?? 0, out[i + 2] ?? 0) / 255;
		out[i] = Math.round(r * lum);
		out[i + 1] = Math.round(g * lum);
		out[i + 2] = Math.round(b * lum);
	}
	recolorCache.set(key, out);
	return Buffer.from(out);
}

/**
 * Composites a design onto the shirt: displaced sampling along the fabric
 * gradient, shaded ink, alpha blend, then a square JPEG on white.
 */
export async function compositeOverlayOntoShirt(
	request: CompositeRequest,
): Promise<OverlayResult> {
	const { designPath, maps, options } = request;
	const box = resolveBoxPixels({
		box: options.box,
		width: maps.width,
		height: maps.height,
	});
	const design = await loadDesign({
		designPath,
		maxWidth: box.width,
		maxHeight: box.height,
	});

	const base = options.color
		? recolorShirt(maps, options.color)
		: Buffer.from(maps.rgba);

	const gradRef = applyGradientScale(maps, box);
	const shadeScale = options.shade * 0.1;
	const displace = options.displace;
	const opacity = options.opacity;

	// NOTE: design sits centered horizontally, top aligned inside the print box.
	const offsetX = box.left + Math.floor((box.width - design.width) / 2);
	const offsetY = box.top;

	const dw = design.width;
	const dh = design.height;
	const d = design.rgba;
	const lastX = dw - 1;
	const lastY = dh - 1;

	for (let y = 0; y < dh; y++) {
		const py = offsetY + y;
		if (py < 0 || py >= maps.height) continue;
		for (let x = 0; x < dw; x++) {
			const px = offsetX + x;
			if (px < 0 || px >= maps.width) continue;

			const si = (py * maps.width + px) * 4;
			if ((base[si + 3] ?? 0) < ALPHA_SILHOUETTE) continue;

			const mi = py * maps.width + px;
			const gx = maps.gradX[mi] ?? 0;
			const gy = maps.gradY[mi] ?? 0;
			const mag = Math.hypot(gx, gy);
			// NOTE: scale the offset against the typical fold slope. The soft
			// curve keeps a hard crease from tearing the print apart.
			let ox = 0;
			let oy = 0;
			if (mag > 1e-9 && gradRef > 0) {
				const weight = (2 * mag) / (mag + gradRef);
				ox = (gx / mag) * weight * displace;
				oy = (gy / mag) * weight * displace;
			}

			// NOTE: sample the design displaced along the fabric slope.
			const fx = px - ox - offsetX;
			const fy = py - oy - offsetY;
			const x0 = Math.floor(fx);
			const y0 = Math.floor(fy);
			const tx = fx - x0;
			const ty = fy - y0;
			const xa = clamp(x0, 0, lastX);
			const xb = clamp(x0 + 1, 0, lastX);
			const ya = clamp(y0, 0, lastY);
			const yb = clamp(y0 + 1, 0, lastY);

			const w00 = (1 - tx) * (1 - ty);
			const w10 = tx * (1 - ty);
			const w01 = (1 - tx) * ty;
			const w11 = tx * ty;

			const i00 = (ya * dw + xa) * 4;
			const i10 = (ya * dw + xb) * 4;
			const i01 = (yb * dw + xa) * 4;
			const i11 = (yb * dw + xb) * 4;

			// NOTE: filter premultiplied so transparent black never bleeds a halo.
			const a00 = (d[i00 + 3] ?? 0) / 255;
			const a10 = (d[i10 + 3] ?? 0) / 255;
			const a01 = (d[i01 + 3] ?? 0) / 255;
			const a11 = (d[i11 + 3] ?? 0) / 255;

			const pa = a00 * w00 + a10 * w10 + a01 * w01 + a11 * w11;
			if (pa < ALPHA_CUTOFF) continue;

			const pr =
				(d[i00] ?? 0) * a00 * w00 +
				(d[i10] ?? 0) * a10 * w10 +
				(d[i01] ?? 0) * a01 * w01 +
				(d[i11] ?? 0) * a11 * w11;
			const pg =
				(d[i00 + 1] ?? 0) * a00 * w00 +
				(d[i10 + 1] ?? 0) * a10 * w10 +
				(d[i01 + 1] ?? 0) * a01 * w01 +
				(d[i11 + 1] ?? 0) * a11 * w11;
			const pb =
				(d[i00 + 2] ?? 0) * a00 * w00 +
				(d[i10 + 2] ?? 0) * a10 * w10 +
				(d[i01 + 2] ?? 0) * a01 * w01 +
				(d[i11 + 2] ?? 0) * a11 * w11;

			const inkR = clamp(pr / pa, 0, 255);
			const inkG = clamp(pg / pa, 0, 255);
			const inkB = clamp(pb / pa, 0, 255);

			const shade = clamp((maps.shade[mi] ?? 0) * shadeScale, -0.6, 0.6);
			const lightK = 1 + shade;
			const alpha = pa * opacity;

			base[si] = Math.round(
				(base[si] ?? 0) * (1 - alpha) + Math.min(255, inkR * lightK) * alpha,
			);
			base[si + 1] = Math.round(
				(base[si + 1] ?? 0) * (1 - alpha) +
					Math.min(255, inkG * lightK) * alpha,
			);
			base[si + 2] = Math.round(
				(base[si + 2] ?? 0) * (1 - alpha) +
					Math.min(255, inkB * lightK) * alpha,
			);
		}
	}

	const data = await sharp(base, {
		raw: { width: maps.width, height: maps.height, channels: 4 },
	})
		.resize(options.size, options.size, {
			fit: 'contain',
			background: '#ffffff',
		})
		.flatten({ background: '#ffffff' })
		.jpeg({ quality: 88, mozjpeg: true })
		.toBuffer();

	return { data, designLuminance: design.meanLuminance };
}

/** Clears the per-process shirt cache. Useful in tests. */
export function clearOverlayCaches(): void {
	shirtCache.clear();
	recolorCache.clear();
}
