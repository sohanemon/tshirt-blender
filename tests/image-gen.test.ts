import { describe, expect, test } from 'vitest';

import {
	DEFAULT_FLUX_MODEL,
	generateImage,
	readCloudflareCredentials,
} from '../src/lib/utils/image-gen';

const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xd9]);

function jsonResponse(body: unknown, status = 200): Response {
	return new Response(JSON.stringify(body), { status });
}

describe('readCloudflareCredentials', () => {
	test('reads CF_ACCOUNT_ID and CF_API_TOKEN', () => {
		expect(
			readCloudflareCredentials({
				CF_ACCOUNT_ID: 'acc',
				CF_API_TOKEN: 'tok',
			}),
		).toEqual({ accountId: 'acc', apiToken: 'tok' });
	});

	test('falls back to CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN', () => {
		expect(
			readCloudflareCredentials({
				CLOUDFLARE_ACCOUNT_ID: 'acc',
				CLOUDFLARE_API_TOKEN: 'tok',
			}),
		).toEqual({ accountId: 'acc', apiToken: 'tok' });
	});

	test('returns null when either value is missing', () => {
		expect(readCloudflareCredentials({ CF_ACCOUNT_ID: 'acc' })).toBeNull();
		expect(readCloudflareCredentials({})).toBeNull();
	});
});

describe('generateImage', () => {
	test('posts the prompt and decodes result.image', async () => {
		let captured: { url: string; init: RequestInit } | undefined;
		const fetchImpl: typeof fetch = async (input, init) => {
			captured = { url: String(input), init: init ?? {} };
			return jsonResponse({
				success: true,
				result: { image: jpeg.toString('base64') },
			});
		};

		const bytes = await generateImage({
			accountId: 'acc',
			apiToken: 'tok',
			model: DEFAULT_FLUX_MODEL,
			prompt: 'a cat astronaut on mars',
			fetch: fetchImpl,
		});

		expect(Buffer.compare(bytes, jpeg)).toBe(0);
		expect(captured?.url).toBe(
			`https://api.cloudflare.com/client/v4/accounts/acc/ai/run/${DEFAULT_FLUX_MODEL}`,
		);
		expect(captured?.init.method).toBe('POST');
		const headers = new Headers(captured?.init.headers);
		expect(headers.get('authorization')).toBe('Bearer tok');
		expect(headers.get('content-type')).toBe('application/json');
		expect(JSON.parse(String(captured?.init.body))).toEqual({
			prompt: 'a cat astronaut on mars',
		});
	});

	test('includes the Cloudflare error message', async () => {
		const fetchImpl: typeof fetch = async () =>
			jsonResponse(
				{ success: false, errors: [{ message: 'Authentication error' }] },
				401,
			);

		await expect(
			generateImage({
				accountId: 'acc',
				apiToken: 'tok',
				model: DEFAULT_FLUX_MODEL,
				prompt: 'a cat',
				fetch: fetchImpl,
			}),
		).rejects.toThrow('Cloudflare AI request failed (401): Authentication error');
	});

	test('rejects a missing image payload', async () => {
		const fetchImpl: typeof fetch = async () =>
			jsonResponse({ success: true, result: {} });

		await expect(
			generateImage({
				accountId: 'acc',
				apiToken: 'tok',
				model: DEFAULT_FLUX_MODEL,
				prompt: 'a cat',
				fetch: fetchImpl,
			}),
		).rejects.toThrow('missing result.image');
	});
});
