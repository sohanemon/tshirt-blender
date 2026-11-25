/** Flux schnell on Cloudflare Workers AI. Matches the working curl model id. */
export const DEFAULT_FLUX_MODEL = '@cf/black-forest-labs/flux-1-schnell';

/** Workers AI rejects prompts outside this length. */
export const PROMPT_MAX = 2048;

export interface CloudflareCredentials {
	accountId: string;
	apiToken: string;
}

export interface GenerateImageRequest {
	accountId: string;
	apiToken: string;
	model: string;
	prompt: string;
	/** Injectable so tests never hit the network. */
	fetch?: typeof fetch;
}

/**
 * Reads `CF_ACCOUNT_ID` and `CF_API_TOKEN`, falling back to the
 * `CLOUDFLARE_*` names from the Cloudflare docs.
 */
export function readCloudflareCredentials(
	env: Record<string, string | undefined>,
): CloudflareCredentials | null {
	const accountId = env.CF_ACCOUNT_ID || env.CLOUDFLARE_ACCOUNT_ID;
	const apiToken = env.CF_API_TOKEN || env.CLOUDFLARE_API_TOKEN;
	if (!accountId || !apiToken) return null;
	return { accountId, apiToken };
}

/**
 * POST `{ prompt }` to the Workers AI run endpoint and return the JPEG bytes
 * from `result.image`.
 */
export async function generateImage(request: GenerateImageRequest): Promise<Buffer> {
	if (request.prompt.length === 0 || request.prompt.length > PROMPT_MAX) {
		throw new Error(`Prompt must be 1-${PROMPT_MAX} characters`);
	}

	const fetchImpl = request.fetch ?? fetch;
	const url = `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(request.accountId)}/ai/run/${request.model}`;
	// NOTE: The working curl sends a JSON object. fetch will not set this header for a string body.
	const response = await fetchImpl(url, {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${request.apiToken}`,
			'Content-Type': 'application/json',
		},
		body: JSON.stringify({ prompt: request.prompt }),
	});

	let body: unknown;
	try {
		body = await response.json();
	} catch {
		throw new Error(`Cloudflare AI request failed (${response.status})`);
	}

	if (!response.ok || isExplicitFailure(body)) {
		throw new Error(failureMessage(body, response.status));
	}

	const image = readResultImage(body);
	if (!image) {
		throw new Error(`Cloudflare AI response missing result.image (${response.status})`);
	}

	// NOTE: Some bindings prefix the same field as a data URI. The REST field is raw base64.
	const base64 = image.includes(',') ? (image.split(',').pop() ?? '') : image;
	const bytes = Buffer.from(base64, 'base64');
	if (bytes.length === 0) {
		throw new Error('Cloudflare AI returned an empty image');
	}
	return bytes;
}

function isExplicitFailure(body: unknown): boolean {
	return isRecord(body) && body.success === false;
}

function failureMessage(body: unknown, status: number): string {
	const details = isRecord(body) ? errorTexts(body.errors) : [];
	const suffix = details.length > 0 ? `: ${details.join('; ')}` : '';
	return `Cloudflare AI request failed (${status})${suffix}`;
}

function errorTexts(errors: unknown): string[] {
	if (!Array.isArray(errors)) return [];
	const texts: string[] = [];
	for (const error of errors) {
		if (!isRecord(error) || typeof error.message !== 'string') continue;
		if (error.message.length === 0) continue;
		texts.push(error.message);
	}
	return texts;
}

function readResultImage(body: unknown): string | null {
	if (!isRecord(body) || !isRecord(body.result)) return null;
	const image = body.result.image;
	return typeof image === 'string' && image.length > 0 ? image : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null;
}
