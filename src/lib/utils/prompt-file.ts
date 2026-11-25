/** One line of a prompt file, ready to generate. */
export interface PromptEntry {
	/** Output filename stem, without an extension. */
	slug: string;
	/** Prompt text sent to the image API. */
	prompt: string;
	/** 1-based line number in the source file. */
	line: number;
}

const EXPLICIT_SLUG = /^[a-z0-9][a-z0-9-]{0,40}$/;

/**
 * Parses a prompt file. Blank lines and `#` comments are skipped.
 * `slug: prompt` sets the filename; any other line is the prompt itself.
 */
export function parsePromptFile(text: string): PromptEntry[] {
	const used = new Set<string>();
	let fallbacks = 0;
	const entries: PromptEntry[] = [];

	const lines = text.split(/\r?\n/);
	for (let index = 0; index < lines.length; index++) {
		const raw = lines[index]?.trim() ?? '';
		if (raw.length === 0 || raw.startsWith('#')) continue;

		const parsed = splitSlug(raw, index + 1);
		const slug = uniqueSlug(parsed.slug ?? slugify(parsed.prompt) ?? nextFallback(++fallbacks), used);
		entries.push({ slug, prompt: parsed.prompt, line: index + 1 });
	}

	return entries;
}

function splitSlug(raw: string, line: number): { slug?: string; prompt: string } {
	const colon = raw.indexOf(':');
	if (colon === -1) return { prompt: raw };

	const candidate = raw.slice(0, colon).trim().toLowerCase();
	if (!EXPLICIT_SLUG.test(candidate)) return { prompt: raw };

	const prompt = raw.slice(colon + 1).trim();
	if (prompt.length === 0) {
		throw new Error(`Line ${line}: slug "${candidate}" has no prompt`);
	}
	return { slug: candidate, prompt };
}

function slugify(prompt: string): string | null {
	const slug = prompt
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '')
		.slice(0, 40)
		.replace(/-+$/g, '');
	return slug.length > 0 ? slug : null;
}

function nextFallback(n: number): string {
	return `image-${String(n).padStart(2, '0')}`;
}

function uniqueSlug(slug: string, used: Set<string>): string {
	if (!used.has(slug)) {
		used.add(slug);
		return slug;
	}
	let n = 2;
	let next = `${slug}-${n}`;
	while (used.has(next)) {
		n++;
		next = `${slug}-${n}`;
	}
	used.add(next);
	return next;
}
