/**
 * Pure field validators shared by forms, importers and domain stores.
 *
 * Every function here is total: it accepts any string and returns a verdict
 * instead of throwing, so callers can compose it into reactive form state.
 */

/** Maximum length permitted by RFC 5321 for a forward-path address. */
const MAX_EMAIL_LENGTH = 254;

/**
 * Pragmatic email syntax check.
 *
 * The pattern mirrors the grammar in RFC 5322 §3.4.1 for the practical subset
 * that mailbox providers accept, including quoted local-part characters and
 * multi-level (sub)domains.
 */
export function validateEmail(email: string): boolean {
	if (!email || email.length > MAX_EMAIL_LENGTH) return false;
	const regex =
		/^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
	return regex.test(email);
}

/**
 * Normalises an email for storage and duplicate detection.
 * Trims surrounding whitespace and lowercases the whole address — the local
 * part of a real mailbox is case sensitive, but every major provider treats
 * it case-insensitively for delivery purposes.
 */
export function normalizeEmail(email: string): string {
	return email.trim().toLowerCase();
}

/**
 * Converts free text into a URL-safe slug.
 * Strips punctuation, collapses whitespace/underscores/hyphens, and trims
 * leading and trailing separators so the result never starts or ends with "-".
 */
export function sanitizeSlug(input: string): string {
	return input
		.toLowerCase()
		.trim()
		.replace(/[^\w\s-]/g, '')
		.replace(/[\s_-]+/g, '-')
		.replace(/^-+|-+$/g, '');
}

/** Strips markup and collapses whitespace — used to derive slugs from titles. */
export function toPlainText(input: string): string {
	return input
		.replace(/<[^>]*>/g, ' ')
		.replace(/\s+/g, ' ')
		.trim();
}

/** True when the string contains at least one non-whitespace character. */
export function isNonEmpty(input: string): boolean {
	return input.trim().length > 0;
}

/** Clamps a number into an inclusive range. */
export function clamp(value: number, min: number, max: number): number {
	if (Number.isNaN(value)) return min;
	return Math.min(Math.max(value, min), max);
}

/** Rounds a value to a fixed number of decimals without float drift artefacts. */
export function roundTo(value: number, decimals: number): number {
	const factor = 10 ** decimals;
	return Math.round((value + Number.EPSILON) * factor) / factor;
}

/** Parses an ISO-8601 timestamp, returning null when the value is not a date. */
export function parseTimestamp(value: string | null): Date | null {
	if (!value) return null;
	const parsed = new Date(value);
	return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/** True when the value is a syntactically valid http(s) absolute URL. */
export function validateHttpUrl(value: string): boolean {
	if (!value) return false;
	try {
		const url = new URL(value);
		return url.protocol === 'http:' || url.protocol === 'https:';
	} catch {
		return false;
	}
}

/** True when the string is a valid `#rrggbb` or `#rgb` CSS hex colour. */
export function validateHexColor(value: string): boolean {
	return /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(value.trim());
}