import type { NewsletterIssue, PublicationSettings, Subscriber } from '#lib/types/newsletter';
import { renderEditorialMarkdown } from '#lib/utils/markdown-renderer';
import { createEmptyIssueStats, createEmptyMetrics } from '#lib/utils/metrics-calculator';
import { initialIssues, initialSettings, initialSubscribers } from '#lib/storage/seed-data';

/**
 * Versioned, SSR-safe persistence adapter.
 *
 * Design rules:
 * 1. Every read returns a defensive copy, so a caller can mutate freely without
 *    corrupting the seed fixtures (which are shared module singletons).
 * 2. Every read validates the shape of persisted JSON and falls back to the seed
 *    fixtures when the payload is missing, corrupt, or structurally wrong.
 * 3. Writes never throw: quota exhaustion and private-mode restrictions are
 *    reported through the return value so callers can surface the failure
 *    instead of silently losing the operator's work.
 */

export const STORAGE_KEYS = {
	SUBSCRIBERS: 'snsp_subscribers_v1',
	ISSUES: 'snsp_issues_v1',
	SETTINGS: 'snsp_settings_v1'
} as const;

const SUBSCRIBER_STATUSES = new Set(['active', 'unsubscribed', 'bounced', 'pending']);
const SUBSCRIBER_TIERS = new Set(['free', 'paid', 'founding']);
const ISSUE_STATUSES = new Set(['draft', 'scheduled', 'sending', 'sent', 'archived']);
const AUDIENCE_FILTERS = new Set(['all', 'free_only', 'paid_only', 'founding_only']);

function isBrowser(): boolean {
	return typeof window !== 'undefined' && typeof localStorage !== 'undefined';
}

/** True when LocalStorage is reachable — false in SSR and in locked-down browsers. */
export function isStorageAvailable(): boolean {
	if (!isBrowser()) return false;
	try {
		const probeKey = `${STORAGE_KEYS.SETTINGS}__probe`;
		localStorage.setItem(probeKey, '1');
		localStorage.removeItem(probeKey);
		return true;
	} catch {
		return false;
	}
}

export function loadSubscribers(): Subscriber[] {
	if (!isBrowser()) return clone(initialSubscribers);

	const raw = safeRead(STORAGE_KEYS.SUBSCRIBERS);
	if (raw === null) {
		const seeded = seedSubscribers();
		saveSubscribers(seeded);
		return seeded;
	}

	const parsed = parseJson(raw);
	const normalized = normalizeSubscribers(parsed);
	if (!normalized) {
		const seeded = seedSubscribers();
		saveSubscribers(seeded);
		return seeded;
	}

	// Write back when the persisted document is not already canonical, so a
	// payload written by an older schema converges on the next read.
	persistIfChanged(STORAGE_KEYS.SUBSCRIBERS, raw, normalized);
	return normalized;
}

/**
 * @returns `true` when the document reached storage, `false` on the server or on
 * a quota/permission failure. Callers must surface the failure to the operator.
 */
export function saveSubscribers(subscribers: Subscriber[]): boolean {
	if (!isBrowser()) return false;
	return safeWrite(STORAGE_KEYS.SUBSCRIBERS, subscribers);
}

export function loadIssues(): NewsletterIssue[] {
	if (!isBrowser()) return seedIssues();

	const raw = safeRead(STORAGE_KEYS.ISSUES);
	if (raw === null) {
		const seeded = seedIssues();
		saveIssues(seeded);
		return seeded;
	}

	const normalized = normalizeIssues(parseJson(raw));
	if (!normalized) {
		const seeded = seedIssues();
		saveIssues(seeded);
		return seeded;
	}

	persistIfChanged(STORAGE_KEYS.ISSUES, raw, normalized);
	return normalized;
}

/** @returns `true` when the document reached storage, `false` on failure. */
export function saveIssues(issues: NewsletterIssue[]): boolean {
	if (!isBrowser()) return false;
	return safeWrite(STORAGE_KEYS.ISSUES, issues);
}

export function loadSettings(): PublicationSettings {
	if (!isBrowser()) return { ...initialSettings };

	const raw = safeRead(STORAGE_KEYS.SETTINGS);
	if (raw === null) {
		saveSettings({ ...initialSettings });
		return { ...initialSettings };
	}

	const normalized = normalizeSettings(parseJson(raw));
	if (!normalized) {
		saveSettings({ ...initialSettings });
		return { ...initialSettings };
	}

	persistIfChanged(STORAGE_KEYS.SETTINGS, raw, normalized);
	return normalized;
}

/** @returns `true` when the document reached storage, `false` on failure. */
export function saveSettings(settings: PublicationSettings): boolean {
	if (!isBrowser()) return false;
	return safeWrite(STORAGE_KEYS.SETTINGS, settings);
}

/**
 * Canonical seed payloads, for renderers that must produce identical markup on
 * the server and during the first client render (before persistence hydration).
 */
export function getSeedSubscribers(): Subscriber[] {
	return seedSubscribers();
}

export function getSeedIssues(): NewsletterIssue[] {
	return seedIssues();
}

export function getSeedSettings(): PublicationSettings {
	return { ...initialSettings };
}

/** Restores every collection to the bundled seed fixtures. */
export function resetStorage(): void {
	if (!isBrowser()) return;

	try {
		localStorage.removeItem(STORAGE_KEYS.SUBSCRIBERS);
		localStorage.removeItem(STORAGE_KEYS.ISSUES);
		localStorage.removeItem(STORAGE_KEYS.SETTINGS);
	} catch (error) {
		console.error('[snsp] Failed to clear localStorage', error);
	}

	saveSubscribers(seedSubscribers());
	saveIssues(seedIssues());
	saveSettings({ ...initialSettings });
}

/** Serialises a download payload for the "export list" action. */
export function exportToJson(payload: {
	subscribers: Subscriber[];
	issues: NewsletterIssue[];
	settings: PublicationSettings;
}): string {
	return JSON.stringify(
		{
			exportedAt: new Date().toISOString(),
			schemaVersion: 1,
			...payload
		},
		null,
		2
	);
}

function safeRead(key: string): string | null {
	try {
		return localStorage.getItem(key);
	} catch (error) {
		console.error(`[snsp] Failed to read "${key}" from localStorage`, error);
		return null;
	}
}

function safeWrite(key: string, value: unknown): boolean {
	try {
		localStorage.setItem(key, JSON.stringify(value));
		return true;
	} catch (error) {
		// QuotaExceededError, SecurityError in private mode, or a serialisation fault.
		console.error(`[snsp] Failed to persist "${key}" to localStorage`, error);
		return false;
	}
}

/**
 * Writes `next` back only when it serialises differently from what is stored,
 * which keeps reads side-effect-free in the common case while still converging
 * legacy payloads onto the canonical shape.
 */
function persistIfChanged<T>(key: string, previousRaw: string, next: T): boolean {
	let serialized: string;
	try {
		serialized = JSON.stringify(next);
	} catch (error) {
		console.error(`[snsp] Failed to serialise "${key}"`, error);
		return false;
	}

	if (serialized === previousRaw) return true;
	return safeWrite(key, next);
}

function parseJson(raw: string): unknown {
	try {
		return JSON.parse(raw);
	} catch (error) {
		console.error('[snsp] Persisted payload is not valid JSON; falling back to seed data', error);
		return null;
	}
}

function clone<T>(value: T): T {
	return structuredClone(value);
}

/**
 * Canonical seed payloads.
 *
 * The fixtures are normalised before they are handed out or persisted so the
 * stored document is always identical to the in-memory document — most visibly,
 * `contentHtml` is rendered from `contentMarkdown` even on a cold start.
 */
function seedSubscribers(): Subscriber[] {
	return normalizeSubscribers(initialSubscribers) ?? clone(initialSubscribers);
}

function seedIssues(): NewsletterIssue[] {
	return normalizeIssues(initialIssues) ?? clone(initialIssues);
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asString(value: unknown, fallback = ''): string {
	return typeof value === 'string' ? value : fallback;
}

function asNullableString(value: unknown): string | null {
	return typeof value === 'string' && value.length > 0 ? value : null;
}

function asCount(value: unknown): number {
	return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : 0;
}

function asNumber(value: unknown, fallback: number): number {
	return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

/** Returns null when the payload is not an array, otherwise a fully-normalised copy. */
function normalizeSubscribers(payload: unknown): Subscriber[] | null {
	if (!Array.isArray(payload)) return null;

	return payload.filter(isRecord).map((record) => {
		const rawMetrics = isRecord(record.metrics) ? record.metrics : {};
		const tags = Array.isArray(record.tags)
			? record.tags.filter((tag): tag is string => typeof tag === 'string')
			: [];

		const status = SUBSCRIBER_STATUSES.has(record.status as string)
			? (record.status as Subscriber['status'])
			: 'pending';
		const tier = SUBSCRIBER_TIERS.has(record.tier as string)
			? (record.tier as Subscriber['tier'])
			: 'free';

		return {
			id: asString(record.id),
			email: asString(record.email).toLowerCase(),
			firstName: asString(record.firstName),
			lastName: asString(record.lastName),
			status,
			tier,
			tags,
			metrics: {
				...createEmptyMetrics(),
				emailsReceivedCount: asCount(rawMetrics.emailsReceivedCount),
				emailsOpenedCount: asCount(rawMetrics.emailsOpenedCount),
				linksClickedCount: asCount(rawMetrics.linksClickedCount),
				lastOpenedAt: asNullableString(rawMetrics.lastOpenedAt),
				openRatePercent: asNumber(rawMetrics.openRatePercent, 0),
				clickRatePercent: asNumber(rawMetrics.clickRatePercent, 0)
			},
			subscribedAt: asString(record.subscribedAt, new Date(0).toISOString()),
			updatedAt: asString(record.updatedAt, new Date(0).toISOString()),
			notes: asString(record.notes)
		};
	});
}

/**
 * Returns null when the payload is not an array, otherwise a fully-normalised copy.
 * `contentHtml` is always re-derived from `contentMarkdown` so persisted HTML can
 * never drift from the markdown that produced it (or carry stale injected markup).
 */
function normalizeIssues(payload: unknown): NewsletterIssue[] | null {
	if (!Array.isArray(payload)) return null;

	return payload.filter(isRecord).map((record) => {
		const rawStats = isRecord(record.stats) ? record.stats : {};
		const contentMarkdown = asString(record.contentMarkdown);
		const status = ISSUE_STATUSES.has(record.status as string)
			? (record.status as NewsletterIssue['status'])
			: 'draft';
		const audience = AUDIENCE_FILTERS.has(record.audience as string)
			? (record.audience as NewsletterIssue['audience'])
			: 'all';
		const tags = Array.isArray(record.tags)
			? record.tags.filter((tag): tag is string => typeof tag === 'string')
			: [];

		return {
			id: asString(record.id),
			slug: asString(record.slug),
			title: asString(record.title, 'Untitled Dispatch'),
			subtitle: asString(record.subtitle),
			excerpt: asString(record.excerpt),
			contentMarkdown,
			contentHtml: renderEditorialMarkdown(contentMarkdown),
			coverImageUrl: asNullableString(record.coverImageUrl),
			authorName: asString(record.authorName, 'Publication Editor'),
			authorAvatarUrl: asNullableString(record.authorAvatarUrl),
			status,
			audience,
			tags,
			scheduledAt: asNullableString(record.scheduledAt),
			publishedAt: asNullableString(record.publishedAt),
			createdAt: asString(record.createdAt, new Date(0).toISOString()),
			updatedAt: asString(record.updatedAt, new Date(0).toISOString()),
			stats: {
				...createEmptyIssueStats(),
				totalRecipients: asCount(rawStats.totalRecipients),
				deliveredCount: asCount(rawStats.deliveredCount),
				openedCount: asCount(rawStats.openedCount),
				clickedCount: asCount(rawStats.clickedCount),
				bouncedCount: asCount(rawStats.bouncedCount),
				unsubscribedCount: asCount(rawStats.unsubscribedCount),
				deliveryCompletedAt: asNullableString(rawStats.deliveryCompletedAt)
			}
		};
	});
}

function normalizeSettings(payload: unknown): PublicationSettings | null {
	if (!isRecord(payload)) return null;

	return {
		publicationName: asString(payload.publicationName, initialSettings.publicationName),
		tagline: asString(payload.tagline, initialSettings.tagline),
		description: asString(payload.description, initialSettings.description),
		supportEmail: asString(payload.supportEmail, initialSettings.supportEmail),
		accentColor: asString(payload.accentColor, initialSettings.accentColor),
		fontFamily: payload.fontFamily === 'sans' ? 'sans' : 'serif',
		defaultAudience: AUDIENCE_FILTERS.has(payload.defaultAudience as string)
			? (payload.defaultAudience as PublicationSettings['defaultAudience'])
			: initialSettings.defaultAudience,
		enablePublicArchive:
			typeof payload.enablePublicArchive === 'boolean'
				? payload.enablePublicArchive
				: initialSettings.enablePublicArchive,
		enableComments:
			typeof payload.enableComments === 'boolean'
				? payload.enableComments
				: initialSettings.enableComments
	};
}