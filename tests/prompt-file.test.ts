import { describe, expect, test } from 'vitest';

import { parsePromptFile } from '../src/lib/utils/prompt-file';

describe('parsePromptFile', () => {
	test('skips blanks and comments and keeps explicit slugs', () => {
		const entries = parsePromptFile(`
# summer drop

whale: linocut sperm whale
  horse: white horse head
`);
		expect(entries).toEqual([
			{ slug: 'whale', prompt: 'linocut sperm whale', line: 4 },
			{ slug: 'horse', prompt: 'white horse head', line: 5 },
		]);
	});

	test('derives a slug from a bare prompt', () => {
		const entries = parsePromptFile(
			'red sports car, three-quarter view, flat vector\n',
		);
		expect(entries).toEqual([
			{
				slug: 'red-sports-car-three-quarter-view-flat-v',
				prompt: 'red sports car, three-quarter view, flat vector',
				line: 1,
			},
		]);
	});

	test('numbers duplicate slugs and keeps an explicit collision', () => {
		const entries = parsePromptFile(`
whale-2: already taken
whale: first
whale: second
`);
		expect(entries.map((entry) => entry.slug)).toEqual([
			'whale-2',
			'whale',
			'whale-3',
		]);
	});

	test('uses image-01 when the prompt has no filename characters', () => {
		const entries = parsePromptFile('!!!\n');
		expect(entries).toEqual([{ slug: 'image-01', prompt: '!!!', line: 1 }]);
	});

	test('rejects a slug with an empty prompt', () => {
		expect(() => parsePromptFile('whale:\n')).toThrow(
			'Line 1: slug "whale" has no prompt',
		);
	});

	test('keeps a colon in the prompt when the prefix is not a slug', () => {
		const entries = parsePromptFile('Look here: a red car\n');
		expect(entries[0]?.prompt).toBe('Look here: a red car');
		expect(entries[0]?.slug).toBe('look-here-a-red-car');
	});
});
