/**
 * Deterministic logic suite for the pure domain layer.
 *
 * Runs unmodified in Node (via `scripts/verify/run-logic.mjs`) and in headless
 * Chrome (via `scripts/verify/chrome-logic.mjs`). It imports only pure modules —
 * no DOM, no timers, no randomness — so both environments produce identical
 * results.
 */

import type { CsvImportResult } from '#lib/types/newsletter';
import { initialIssues, initialSettings, initialSubscribers } from '#lib/storage/seed-data';
import {
	neutralizeFormulaInjection,
	parseSubscribersCsv,
	toSubscribersCsv
} from '#lib/utils/csv-parser';
import { escapeHtml, renderEditorialMarkdown, sanitizeHref, toExcerpt } from '#lib/utils/markdown-renderer';
import {
	calculateAudienceClickRate,
	calculateAudienceOpenRate,
	calculateDashboardMetrics,
	calculateIssueWeightedOpenRate,
	recalculateEngagement,
	resolveAudienceSubscribers,
	summarizeDeliveryJobs
} from '#lib/utils/metrics-calculator';
import {
	formatCurrency,
	formatDate,
	fromDateTimeLocalValue,
	toDateTimeLocalValue,
	formatRelativeTime
} from '#lib/utils/format';
import {
	clamp,
	normalizeEmail,
	parseTimestamp,
	roundTo,
	sanitizeSlug,
	validateEmail,
	validateHexColor,
	validateHttpUrl
} from '#lib/utils/validators';
import { generateUuid } from '#lib/utils/uuid';

// Phase 4 — Svelte 5 rune stores (state, derived values and the dispatch engine).
import { SubscriberStore } from '#lib/state/subscriber.svelte';
import { IssueStore } from '#lib/state/issue.svelte';
import { DeliveryQueueManager } from '#lib/state/queue.svelte';
import { ToastStore } from '#lib/state/toast.svelte';

export interface SuiteResult {
	passed: number;
	failed: number;
	total: number;
	failures: string[];
}

interface CaseResult {
	name: string;
	ok: boolean;
	detail?: string;
}

const cases: Array<{ name: string; run: () => void | Promise<void> }> = [];

function test(name: string, run: () => void | Promise<void>): void {
	cases.push({ name, run });
}

function assert(condition: boolean, message: string): void {
	if (!condition) throw new Error(message);
}

function assertEqual<T>(actual: T, expected: T, message: string): void {
	if (!Object.is(actual, expected)) {
		throw new Error(`${message} — expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}`);
	}
}

function assertClose(actual: number, expected: number, tolerance: number, message: string): void {
	if (!(Math.abs(actual - expected) <= tolerance)) {
		throw new Error(`${message} — expected ${expected} ±${tolerance}, received ${actual}`);
	}
}

const FIXED_NOW = '2026-10-05T12:00:00.000Z';

/* ------------------------------------------------------------------ */
/* uuid                                                                */
/* ------------------------------------------------------------------ */

test('generateUuid returns RFC 4122 version 4 identifiers', () => {
	const id = generateUuid();
	assert(
		/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id),
		`unexpected uuid shape: ${id}`
	);
});

test('generateUuid produces unique identifiers', () => {
	const ids = new Set(Array.from({ length: 2000 }, () => generateUuid()));
	assertEqual(ids.size, 2000, 'uuid collisions detected');
});

/* ------------------------------------------------------------------ */
/* validators                                                          */
/* ------------------------------------------------------------------ */

test('validateEmail accepts real addresses and rejects malformed input', () => {
	const valid = [
		'sarah.connor@example.com',
		'alex.chen@clouddev.io',
		'weird+tag@sub.domain.example.co.uk',
		"o'brien@example.org",
		'user_name@example-host.com'
	];
	for (const email of valid) {
		assert(validateEmail(email), `expected valid: ${email}`);
	}

	const invalid = ['', 'plain', 'no-domain@', '@example.com', 'spaces in@example.com', 'a@', 'a@b.'];
	for (const email of invalid) {
		assert(!validateEmail(email), `expected invalid: ${email}`);
	}

	assert(!validateEmail(`${'a'.repeat(250)}@example.com`), 'expected 254+ char address to fail');
});

test('normalizeEmail trims and lowercases', () => {
	assertEqual(normalizeEmail('  Sarah.CONNOR@Example.COM '), 'sarah.connor@example.com', 'normalisation');
});

test('sanitizeSlug produces URL-safe slugs', () => {
	assertEqual(sanitizeSlug('The Art of Minimal State!'), 'the-art-of-minimal-state', 'basic slug');
	assertEqual(sanitizeSlug('  --Hello__World--  '), 'hello-world', 'separator collapsing');
	assertEqual(sanitizeSlug('C++ & Rust: a tale'), 'c-rust-a-tale', 'punctuation stripping');
	assertEqual(sanitizeSlug('!!!'), '', 'punctuation-only input collapses to empty');
});

test('numeric helpers clamp and round without drift', () => {
	assertEqual(clamp(5, 1, 3), 3, 'clamp upper bound');
	assertEqual(clamp(-2, 1, 3), 1, 'clamp lower bound');
	assertEqual(clamp(Number.NaN, 1, 3), 1, 'clamp NaN falls back to min');
	assertEqual(roundTo(1.005, 2), 1.01, 'roundTo half-up');
	assertEqual(roundTo(2.675, 2), 2.68, 'roundTo avoids binary drift');
});

test('parseTimestamp rejects non-dates', () => {
	assert(parseTimestamp('2026-10-05T12:00:00Z') !== null, 'valid ISO string');
	assertEqual(parseTimestamp('not-a-date'), null, 'invalid string');
	assertEqual(parseTimestamp(null), null, 'null input');
});

test('url and colour validators', () => {
	assert(validateHttpUrl('https://example.com/a?b=c'), 'https url');
	assert(!validateHttpUrl('javascript:alert(1)'), 'script url rejected');
	assert(!validateHttpUrl(''), 'empty url rejected');
	assert(validateHexColor('#191919'), 'six digit hex');
	assert(validateHexColor('#fff'), 'three digit hex');
	assert(!validateHexColor('191919'), 'missing hash rejected');
});

/* ------------------------------------------------------------------ */
/* CSV parser                                                          */
/* ------------------------------------------------------------------ */

test('parseSubscribersCsv imports a well-formed batch', () => {
	const csv = [
		'email,firstname,lastname,tags',
		'rhea.kapoor@example.com,Rhea,Kapoor,"systems; sre"',
		'omar.haddad@desertbyte.jo,Omar,Haddad,security'
	].join('\n');

	const { imported, summary } = parseSubscribersCsv(csv, new Set(), FIXED_NOW);

	assertEqual(summary.totalRows, 2, 'row count');
	assertEqual(summary.successfulImports, 2, 'success count');
	assertEqual(summary.failedImports, 0, 'failure count');
	assertEqual(summary.errors.length, 0, 'no errors');
	assertEqual(imported.length, 2, 'imported length');
	assertEqual(imported[0].email, 'rhea.kapoor@example.com', 'email lowercased');
	assertEqual(imported[0].status, 'active', 'default status');
	assertEqual(imported[0].tier, 'free', 'default tier');
	assertEqual(imported[0].tags.join('|'), 'systems|sre', 'semicolon separated tags');
	assertEqual(imported[0].subscribedAt, FIXED_NOW, 'injected timestamp applied');
	assertEqual(imported[0].metrics.emailsReceivedCount, 0, 'telemetry zeroed');
	assert(imported[0].id !== imported[1].id, 'identifiers must be unique');
});

test('parseSubscribersCsv handles RFC 4180 multiline and quoted fields', () => {
	const csv = [
		'email,firstname,lastname,notes',
		'"multi@example.com","Ada","Byron","Line one',
		'Line two, with comma"',
		'"quote@example.com","Sam","Quoted","He said ""hello"""',
		'"crlf@example.com","Crlf","Row","Trailing value"'
	].join('\r\n');

	const { imported, summary } = parseSubscribersCsv(csv, new Set(), FIXED_NOW);

	assertEqual(summary.failedImports, 0, `unexpected failures: ${JSON.stringify(summary.errors)}`);
	assertEqual(imported.length, 3, 'multiline records imported');
	assertEqual(imported[0].firstName, 'Ada', 'field after embedded newline');
	assertEqual(
		imported[0].notes,
		'Line one\r\nLine two, with comma',
		'embedded CRLF and comma preserved verbatim (RFC 4180)'
	);
	assertEqual(imported[1].notes, 'He said "hello"', 'escaped quotes unescaped');
	assertEqual(imported[2].email, 'crlf@example.com', 'CRLF terminator handled');
});

test('parseSubscribersCsv rejects duplicates against database and batch', () => {
	const csv = [
		'email,firstname,lastname,tags,status,tier',
		'already@example.com',
		'fresh@example.com',
		'fresh@example.com',
		'broken@@example'
	].join('\n');

	const { imported, summary } = parseSubscribersCsv(
		csv,
		new Set(['already@example.com']),
		FIXED_NOW
	);

	assertEqual(summary.totalRows, 4, 'all rows counted');
	assertEqual(summary.successfulImports, 1, 'only the fresh unique row succeeds');
	assertEqual(summary.failedImports, 3, 'three rows rejected');
	assertEqual(imported.length, 1, 'single import');
	assertEqual(imported[0].email, 'fresh@example.com', 'correct survivor');

	const reasons = summary.errors.map((error) => error.reason);
	assert(reasons.includes('Already subscribed to this publication.'), 'database duplicate reason');
	assert(reasons.includes('Duplicate email inside this file.'), 'in-batch duplicate reason');
	assert(reasons.includes('Invalid email syntax.'), 'invalid syntax reason');
});

test('parseSubscribersCsv reports missing email header', () => {
	const { imported, summary } = parseSubscribersCsv('firstname,lastname\nAda,Byron', new Set(), FIXED_NOW);
	assertEqual(imported.length, 0, 'nothing imported');
	assertEqual(summary.errors.length, 1, 'single header error');
	assert(summary.errors[0].reason.includes('email'), 'error mentions the missing header');
});

test('parseSubscribersCsv tolerates empty and blank input', () => {
	const empty = parseSubscribersCsv('', new Set(), FIXED_NOW);
	assertEqual(empty.summary.totalRows, 0, 'empty input');
	assertEqual(empty.summary.errors.length, 0, 'empty input is not an error');

	const headersOnly = parseSubscribersCsv('email,firstname\n', new Set(), FIXED_NOW);
	assertEqual(headersOnly.summary.totalRows, 0, 'header-only input');
	assertEqual(headersOnly.imported.length, 0, 'header-only input imports nothing');
});

test('parseSubscribersCsv honours header aliases and status/tier columns', () => {
	const csv = [
		'"E-Mail","First Name","Surname","Labels","Tier","Status"',
		'"alias@example.com","Alias","Test","a;b","paid","unsubscribed"'
	].join('\n');

	const { imported, summary } = parseSubscribersCsv(csv, new Set(), FIXED_NOW);
	assertEqual(summary.failedImports, 0, `alias mapping failed: ${JSON.stringify(summary.errors)}`);
	assertEqual(imported[0].firstName, 'Alias', 'first name alias');
	assertEqual(imported[0].lastName, 'Test', 'surname alias');
	assertEqual(imported[0].tier, 'paid', 'tier parsed');
	assertEqual(imported[0].status, 'unsubscribed', 'status parsed');
	assertEqual(imported[0].tags.join('|'), 'a|b', 'label alias split');
});

test('toSubscribersCsv neutralizes spreadsheet formula injection', () => {
	// [SEC-01] CWE-1236: a cell starting with a formula trigger is executed by
	// Excel/LibreOffice/Sheets as soon as the export is opened.
	const payloads = [
		'=1+1',
		'+1+1',
		'-1+1',
		'@SUM(A1:A9)',
		"\t=cmd|'/C calc'!A0",
		"\r=cmd|'/C calc'!A0",
		'|danger'
	];

	const exported = toSubscribersCsv(
		payloads.map((payload, index) => ({
			...initialSubscribers[0],
			id: `formula-${index}`,
			firstName: payload,
			lastName: `Last${index}`,
			tags: [payload]
		}))
	);

	for (const payload of payloads) {
		// The escaped cell still *contains* the payload as a substring, so the
		// meaningful check is that every occurrence is immediately preceded by the
		// neutralising apostrophe.
		let occurrence = exported.indexOf(payload);

		while (occurrence !== -1) {
			assert(
				exported[occurrence - 1] === "'",
				`payload must never survive unescaped: ${JSON.stringify(payload)}`
			);
			occurrence = exported.indexOf(payload, occurrence + 1);
		}
	}

	// Values that merely contain a trigger are untouched.
	const safe = toSubscribersCsv([
		{ ...initialSubscribers[0], id: 'safe-1', firstName: 'Ada', lastName: 'Lovelace', tags: ['math=fun'] }
	]);
	assert(safe.includes('Ada'), 'benign values are exported verbatim');
	assert(safe.includes('math=fun'), 'an equals sign inside a value is not a trigger');
	assert(!safe.includes("'math=fun"), 'only a leading trigger is escaped, never an inner one');
});

test('neutralizeFormulaInjection escapes only leading triggers', () => {
	assertEqual(neutralizeFormulaInjection('=cmd'), "'=cmd", 'leading equals');
	assertEqual(neutralizeFormulaInjection('@handle'), "'@handle", 'leading at sign');
	assertEqual(neutralizeFormulaInjection('normal value'), 'normal value', 'untouched');
	assertEqual(neutralizeFormulaInjection(''), '', 'empty string');
	assertEqual(neutralizeFormulaInjection('a=b'), 'a=b', 'inner equals is safe');
});

test('parseSubscribersCsv strips a UTF-8 byte order mark', () => {
	// [DATA-03] Spreadsheet exports start with U+FEFF, which would otherwise be
	// glued to the first header cell and break column detection.
	const csv = '\uFEFFemail,firstname,lastname\nada@example.com,Ada,Lovelace';
	const { imported, summary } = parseSubscribersCsv(csv, new Set(), FIXED_NOW);

	assertEqual(summary.errors.length, 0, `BOM broke header detection: ${JSON.stringify(summary.errors)}`);
	assertEqual(summary.successfulImports, 1, 'row imported from BOM-prefixed content');
	assertEqual(imported[0].email, 'ada@example.com', 'email parsed cleanly');
	assertEqual(imported[0].firstName, 'Ada', 'first name parsed cleanly');
});

test('toSubscribersCsv round-trips through the parser', () => {
	const exported = toSubscribersCsv([
		{ ...initialSubscribers[0], tags: ['a,b', 'c'] },
		{ ...initialSubscribers[1], firstName: 'Quote "Q"' }
	]);

	const { imported, summary } = parseSubscribersCsv(exported, new Set(), FIXED_NOW);
	assertEqual(summary.failedImports, 0, `round-trip failures: ${JSON.stringify(summary.errors)}`);
	assertEqual(imported.length, 2, 'round-trip row count');
	assertEqual(imported[0].tags.join('|'), 'a,b|c', 'tag containing a comma survives');
	assertEqual(imported[1].firstName, 'Quote "Q"', 'embedded quotes survive');
});

/* ------------------------------------------------------------------ */
/* markdown renderer                                                   */
/* ------------------------------------------------------------------ */

test('renderEditorialMarkdown renders the supported dialect', () => {
	const markdown = [
		'# Title',
		'',
		'Body paragraph with **bold**, *italic*, ***both*** and `code`.',
		'',
		'## Section',
		'',
		'> A quote.',
		'',
		'* item one',
		'* item two',
		'',
		'---',
		'',
		'Final line with [a link](https://example.com).'
	].join('\n');

	const html = renderEditorialMarkdown(markdown);

	assert(html.includes('<h1 class="text-3xl'), 'h1 rendered');
	assert(html.includes('<h2 class="text-2xl'), 'h2 rendered');
	assert(html.includes('<blockquote'), 'blockquote rendered');
	assert(html.includes('<ul'), 'list rendered');
	assert(html.includes('<li'), 'list item rendered');
	assert(html.includes('<strong>bold</strong>'), 'bold rendered');
	assert(html.includes('<em>italic</em>'), 'italic rendered');
	assert(html.includes('<strong><em>both</em></strong>'), 'bold-italic rendered');
	assert(html.includes('<code'), 'inline code rendered');
	assert(html.includes('<hr'), 'thematic break rendered');
	assert(html.includes('href="https://example.com"'), 'link href kept');
	assert(html.includes('rel="noopener noreferrer"'), 'link rel hardening');
});

test('renderEditorialMarkdown neutralises script injection', () => {
	const hostile = [
		'<script>alert("xss")</script>',
		'',
		'<img src=x onerror="alert(1)">',
		'',
		'[click](javascript:alert(1))',
		'',
		'[data](data:text/html;base64,PHNjcmlwdD4=)',
		'',
		'[protocol relative](//evil.example.com)'
	].join('\n');

	const html = renderEditorialMarkdown(hostile);

	assert(!html.includes('<script'), 'script tag neutralised');
	assert(!/<img[^>]*onerror/i.test(html), 'img onerror neutralised');
	assert(!html.includes('javascript:'), 'javascript scheme neutralised');
	assert(!html.includes('data:text/html'), 'data scheme neutralised');
	assert(!html.includes('//evil.example.com'), 'protocol-relative URL neutralised');
	assert(html.includes('#blocked-uri'), 'blocked href sentinel present');
});

test('sanitizeHref allow-lists navigable schemes', () => {
	assertEqual(sanitizeHref('https://example.com'), 'https://example.com', 'https allowed');
	assertEqual(sanitizeHref('mailto:a@b.com'), 'mailto:a@b.com', 'mailto allowed');
	assertEqual(sanitizeHref('/admin/issues'), '/admin/issues', 'relative allowed');
	assertEqual(sanitizeHref('#section'), '#section', 'fragment allowed');
	assertEqual(sanitizeHref('javascript:alert(1)'), '#blocked-uri', 'javascript blocked');
	assertEqual(sanitizeHref('vbscript:msgbox'), '#blocked-uri', 'vbscript blocked');
	assertEqual(sanitizeHref('  '), '#blocked-uri', 'blank blocked');
});

test('escapeHtml and toExcerpt produce plain text', () => {
	assertEqual(escapeHtml('<b>&"</b>'), '&lt;b&gt;&amp;&quot;&lt;/b&gt;', 'escaping');
	const excerpt = toExcerpt('# Heading\n\nSome **bold** text with a [link](https://x.dev).', 40);
	assert(!excerpt.includes('#'), 'heading marker removed');
	assert(!excerpt.includes('**'), 'emphasis markers removed');
	assert(excerpt.length <= 40, 'excerpt respects the limit');
});

test('renderEditorialMarkdown handles empty input', () => {
	assertEqual(renderEditorialMarkdown(''), '', 'empty string');
});

/* ------------------------------------------------------------------ */
/* metrics                                                             */
/* ------------------------------------------------------------------ */

test('recalculateEngagement recomputes percentages safely', () => {
	const recomputed = recalculateEngagement({
		emailsReceivedCount: 10,
		emailsOpenedCount: 8,
		linksClickedCount: 3,
		lastOpenedAt: null,
		openRatePercent: 0,
		clickRatePercent: 0
	});
	assertEqual(recomputed.openRatePercent, 80, 'open rate');
	assertEqual(recomputed.clickRatePercent, 37.5, 'click rate');

	const clamped = recalculateEngagement({
		emailsReceivedCount: 2,
		emailsOpenedCount: 5,
		linksClickedCount: 9,
		lastOpenedAt: null,
		openRatePercent: 0,
		clickRatePercent: 0
	});
	assertEqual(clamped.emailsOpenedCount, 2, 'opens clamped to receives');
	assertEqual(clamped.linksClickedCount, 2, 'clicks clamped to opens');

	const zero = recalculateEngagement({
		emailsReceivedCount: 0,
		emailsOpenedCount: 0,
		linksClickedCount: 0,
		lastOpenedAt: null,
		openRatePercent: 0,
		clickRatePercent: 0
	});
	assertEqual(zero.openRatePercent, 0, 'no division by zero');
});

test('calculateIssueWeightedOpenRate averages per-issue rates', () => {
	const base = initialIssues[0];
	const issues = [
		{ ...base, status: 'sent' as const, stats: { ...base.stats, deliveredCount: 100, openedCount: 50 } },
		{ ...base, id: 'b', status: 'sent' as const, stats: { ...base.stats, deliveredCount: 100, openedCount: 30 } },
		{ ...base, id: 'c', status: 'sent' as const, stats: { ...base.stats, deliveredCount: 100, openedCount: 0 } }
	];
	assertEqual(calculateIssueWeightedOpenRate(issues), 26.7, 'mean of 50, 30 and 0');

	const withZeroDelivery = [
		...issues,
		{ ...base, id: 'd', status: 'sent' as const, stats: { ...base.stats, deliveredCount: 0, openedCount: 0 } }
	];
	assertEqual(calculateIssueWeightedOpenRate(withZeroDelivery), 20, 'zero-delivery issue contributes 0%');
	assertEqual(calculateIssueWeightedOpenRate([]), 0, 'empty list');
});

test('resolveAudienceSubscribers filters by tier and status', () => {
	const subscribers = initialSubscribers;
	assertEqual(resolveAudienceSubscribers(subscribers, 'all').length, 10, 'all active subscribers');
	assertEqual(resolveAudienceSubscribers(subscribers, 'free_only').length, 4, 'free tier');
	assertEqual(resolveAudienceSubscribers(subscribers, 'paid_only').length, 3, 'paid tier');
	assertEqual(resolveAudienceSubscribers(subscribers, 'founding_only').length, 3, 'founding tier');

	const everyResolved = resolveAudienceSubscribers(subscribers, 'all');
	assert(
		everyResolved.every((subscriber) => subscriber.status === 'active'),
		'bounced/unsubscribed/pending must never be targeted'
	);
});

test('summarizeDeliveryJobs aggregates the delivery log', () => {
	const jobs = [
		{ status: 'delivered', openedAt: '2026-10-05T12:00:01Z', clickedAt: '2026-10-05T12:00:02Z' },
		{ status: 'delivered', openedAt: '2026-10-05T12:00:03Z', clickedAt: null },
		{ status: 'bounced', openedAt: null, clickedAt: null },
		{ status: 'delivered', openedAt: null, clickedAt: null }
	] as Parameters<typeof summarizeDeliveryJobs>[0];

	const stats = summarizeDeliveryJobs(jobs, FIXED_NOW);
	assertEqual(stats.totalRecipients, 4, 'recipients');
	assertEqual(stats.deliveredCount, 3, 'delivered');
	assertEqual(stats.bouncedCount, 1, 'bounced');
	assertEqual(stats.openedCount, 2, 'opened');
	assertEqual(stats.clickedCount, 1, 'clicked');
	assertEqual(stats.deliveryCompletedAt, FIXED_NOW, 'completion timestamp');
});

test('calculateDashboardMetrics summarises the publication', () => {
	const summary = calculateDashboardMetrics(initialSubscribers, initialIssues, new Date(FIXED_NOW));

	assertEqual(summary.totalSubscribers, 14, 'total subscribers');
	assertEqual(summary.activeSubscribers, 10, 'active subscribers');
	assertEqual(summary.paidSubscribers, 6, 'paid + founding subscribers');
	assertEqual(summary.monthlyRevenueEst, 3 * 8 + 3 * 15, 'revenue estimate');
	assertEqual(summary.issuesSentCount, 3, 'sent issues');
	assert(summary.thirtyDayGrowthCount >= 1, 'recent growth detected');
	assert(summary.averageOpenRatePercent > 0, 'open rate populated');
});

test('audience averages ignore subscribers with no sends', () => {
	assertEqual(calculateAudienceOpenRate([]), 0, 'empty list');
	assert(calculateAudienceClickRate(initialSubscribers) >= 0, 'click rate computed');
});

/* ------------------------------------------------------------------ */
/* formatting                                                          */
/* ------------------------------------------------------------------ */

test('format helpers are deterministic and locale-pinned', () => {
	assertEqual(formatCurrency(248), '$248', 'currency');
	assertEqual(formatDate('2026-09-20T10:00:00Z'), 'Sep 20, 2026', 'date');
	assertEqual(formatDate(null), '—', 'missing date placeholder');
	assertEqual(formatDate('nonsense'), '—', 'invalid date placeholder');
	assertEqual(toDateTimeLocalValue('2026-09-20T10:00:00Z'), '2026-09-20T10:00', 'datetime-local value');
	assertEqual(fromDateTimeLocalValue('2026-09-20T10:00'), '2026-09-20T10:00:00.000Z', 'datetime-local parse');
	assertEqual(fromDateTimeLocalValue(''), null, 'empty datetime-local');
	assertEqual(formatRelativeTime('2026-10-05T11:59:40Z', new Date(FIXED_NOW)), 'just now', 'relative now');
	assertEqual(formatRelativeTime('2026-10-02T12:00:00Z', new Date(FIXED_NOW)), '3 days ago', 'relative days');
});

/* ------------------------------------------------------------------ */
/* seed data invariants                                                */
/* ------------------------------------------------------------------ */

test('seed fixtures are internally consistent', () => {
	const emails = new Set(initialSubscribers.map((subscriber) => subscriber.email));
	assertEqual(emails.size, initialSubscribers.length, 'no duplicate seed emails');

	const issueIds = new Set(initialIssues.map((issue) => issue.id));
	const slugs = new Set(initialIssues.map((issue) => issue.slug));
	assertEqual(issueIds.size, initialIssues.length, 'unique issue ids');
	assertEqual(slugs.size, initialIssues.length, 'unique issue slugs');

	assert(initialSubscribers.length >= 12, 'seed list large enough to exercise pagination');
	assert(initialIssues.length >= 5, 'seed issues cover every screen');
	assert(initialSettings.publicationName.length > 0, 'publication name present');
});

test('seed issue markdown renders to non-empty sanitised HTML', () => {
	for (const issue of initialIssues) {
		const html = renderEditorialMarkdown(issue.contentMarkdown);
		assert(html.length > 0, `issue ${issue.id} rendered empty`);
		assert(!html.includes('<script'), `issue ${issue.id} contains script markup`);
		assert(issue.excerpt.length > 0, `issue ${issue.id} missing excerpt`);
	}
});

/* ------------------------------------------------------------------ */
/* Phase 4 — rune stores                                                */
/* ------------------------------------------------------------------ */

test('SubscriberStore derives filtering, sorting and pagination', () => {
	const store = new SubscriberStore();
	store.filters.pageSize = 5;

	assertEqual(store.totalCount, 14, 'seed population');
	assertEqual(store.activeCount, 10, 'active count derived from state');
	assertEqual(store.paidCount, 6, 'paid + founding count derived from state');
	assertEqual(store.bouncedCount, 2, 'bounced count derived from state');

	store.setFilter('searchQuery', 'svelte');
	assertEqual(store.filteredItems.length, 2, 'search matches name, email and tags');
	assertEqual(store.paginatedItems.length, 2, 'page slice respects the result set');

	store.setFilter('status', 'active');
	assert(
		store.filteredItems.every((subscriber) => subscriber.status === 'active'),
		'status filter applied'
	);

	store.setFilter('searchQuery', '');
	store.setFilter('tier', 'founding');
	assertEqual(store.filteredItems.length, 3, 'tier filter applied');

	store.setFilter('tier', 'all');
	store.setSort('email');
	assertEqual(store.filters.sortDirection, 'asc', 'email sorts ascending first');
	const emails = store.filteredItems.map((subscriber) => subscriber.email);
	assertEqual(
		emails.join(','),
		[...emails].sort((a, b) => a.localeCompare(b)).join(','),
		'email ordering is deterministic'
	);

	store.setSort('openRatePercent');
	assertEqual(store.filters.sortDirection, 'desc', 'numeric columns default to descending');
	assert(
		store.filteredItems.every(
			(subscriber, index, list) => index === 0 || list[index - 1].metrics.openRatePercent >= subscriber.metrics.openRatePercent
		),
		'open rate ordered descending'
	);

	store.setSort('email');
	assertEqual(store.filters.sortDirection, 'asc', 're-sorting toggles direction');
});

test('SubscriberStore resets pagination whenever a filter changes', () => {
	const store = new SubscriberStore();
	store.filters.pageSize = 5;
	store.setPage(2);
	assertEqual(store.filters.page, 2, 'page advanced');

	store.setFilter('searchQuery', 'a');
	assertEqual(store.filters.page, 1, 'filter change resets the page offset');

	store.setFilter('page', 2);
	assertEqual(store.filters.page, 2, 'explicit page assignment survives');
});

test('SubscriberStore mutates the audience with persistence-safe semantics', () => {
	const store = new SubscriberStore();

	const created = store.addSubscriber({
		email: '  NEW.READER@Example.COM ',
		firstName: 'New',
		lastName: 'Reader',
		status: 'active',
		tier: 'paid',
		tags: ['test'],
		notes: ''
	});
	assertEqual(created.email, 'new.reader@example.com', 'created email normalised');
	assertEqual(created.metrics.emailsReceivedCount, 0, 'telemetry zeroed');
	assertEqual(store.totalCount, 15, 'record added');
	assert(store.getByEmail('NEW.READER@example.com') !== undefined, 'lookup by email works');

	const before = store.getById(created.id);
	if (!before) throw new Error('created record missing');
	store.updateSubscriber(created.id, { tier: 'founding', firstName: 'Renamed' });
	const after = store.getById(created.id);
	if (!after) throw new Error('updated record missing');
	assertEqual(after.tier, 'founding', 'patch applied');
	assertEqual(after.firstName, 'Renamed', 'patch applied');
	assert(after.updatedAt >= before.updatedAt, 'updatedAt advanced');

	store.recordDelivery(created.id, { opened: true, clicked: true });
	const engaged = store.getById(created.id);
	if (!engaged) throw new Error('engaged record missing');
	assertEqual(engaged.metrics.emailsReceivedCount, 1, 'delivery recorded');
	assertEqual(engaged.metrics.emailsOpenedCount, 1, 'open recorded');
	assertEqual(engaged.metrics.openRatePercent, 100, 'engagement recalculated');

	store.deleteSubscriber(created.id);
	assertEqual(store.totalCount, 14, 'record deleted');
	assertEqual(store.getById(created.id), undefined, 'deleted record is gone');
});

test('SubscriberStore reconciles a whole delivery run in one pass', () => {
	const store = new SubscriberStore();
	const [first, second, third] = store.items;

	const before = store.persistenceError;
	store.recordDeliveriesBatch([
		{ subscriberId: first.id, opened: true, clicked: true, openedAt: '2026-10-05T12:00:00Z' },
		{ subscriberId: second.id, opened: true, clicked: false, openedAt: '2026-10-05T12:00:01Z' },
		{ subscriberId: third.id, opened: false, clicked: false, openedAt: null }
	]);

	const updatedFirst = store.getById(first.id);
	const updatedSecond = store.getById(second.id);
	const updatedThird = store.getById(third.id);

	if (!updatedFirst || !updatedSecond || !updatedThird) {
		throw new Error('all batch targets must still exist');
	}
	assertEqual(updatedFirst.metrics.emailsReceivedCount, first.metrics.emailsReceivedCount + 1, 'receive counted');
	assertEqual(updatedSecond.metrics.linksClickedCount, second.metrics.linksClickedCount, 'no click recorded');
	assertEqual(updatedThird.metrics.emailsOpenedCount, third.metrics.emailsOpenedCount, 'non-open not counted');
	assertEqual(
		updatedFirst.metrics.lastOpenedAt,
		'2026-10-05T12:00:00Z',
		'explicit open timestamp retained'
	);

	// An empty batch is a no-op.
	const snapshot = store.items.map((subscriber) => subscriber.metrics.emailsReceivedCount);
	store.recordDeliveriesBatch([]);
	assertEqual(
		store.items.map((subscriber) => subscriber.metrics.emailsReceivedCount).join(','),
		snapshot.join(','),
		'empty batch changes nothing'
	);

	assertEqual(store.persistenceError, before ?? null, 'no persistence error raised');
});

test('SubscriberStore refuses to reactivate hard bounces in bulk', () => {
	const store = new SubscriberStore();
	const bounced = store.items.filter((subscriber) => subscriber.status === 'bounced');
	assert(bounced.length > 0, 'seed contains bounced addresses');

	const changed = store.bulkUpdateStatus(
		bounced.map((subscriber) => subscriber.id),
		'active'
	);
	assertEqual(changed, 0, 'no bounced address was reactivated');
	assert(
		store.items
			.filter((subscriber) => bounced.some((original) => original.id === subscriber.id))
			.every((subscriber) => subscriber.status === 'bounced'),
		'bounced addresses stay bounced'
	);

	const active = store.items.filter((subscriber) => subscriber.status === 'active').slice(0, 2);
	const unsubscribed = store.bulkUpdateStatus(
		active.map((subscriber) => subscriber.id),
		'unsubscribed'
	);
	assertEqual(unsubscribed, 2, 'bulk status change applied to eligible records');
	assert(
		active.every((subscriber) => store.getById(subscriber.id)?.status === 'unsubscribed'),
		'target statuses updated'
	);
});

test('IssueStore creates drafts with unique slugs and rendered HTML', () => {
	const store = new IssueStore();
	assertEqual(store.totalCount, 6, 'seed issues');
	assertEqual(store.sentCount, 3, 'sent issues derived');
	assertEqual(store.draftCount, 1, 'draft issues derived');
	assertEqual(store.publishedIssues.length, 3, 'public archive list derived');

	assertEqual(store.buildUniqueSlug('The Art of Minimal State'), 'the-art-of-minimal-state-2', 'slug collision suffix');

	const draft = store.createDraft();
	assertEqual(store.totalCount, 7, 'draft inserted');
	assertEqual(draft.status, 'draft', 'draft status');
	assertEqual(draft.slug.startsWith('dispatch-'), true, 'generated slug prefix');
	assert(draft.contentHtml.includes('<h1'), 'draft HTML rendered from markdown');
	assertEqual(store.currentEditorIssue?.id, draft.id, 'editor target set');
});

test('IssueStore re-derives HTML, excerpt and slug on update', () => {
	const store = new IssueStore();
	const draft = store.createDraft();

	store.updateIssue(draft.id, {
		title: 'Signals All the Way Down',
		contentMarkdown: '# Signals\n\nReactive primitives keep derived truth honest.',
		excerpt: ''
	});

	const updated = store.getById(draft.id);
	if (!updated) throw new Error('updated issue missing');
	assertEqual(updated.slug, 'signals-all-the-way-down', 'slug derived from title for drafts');
	assert(updated.contentHtml.includes('<h1'), 'HTML re-rendered from markdown');
	assert(updated.contentHtml.includes('Reactive primitives'), 'new body rendered');
	assert(updated.excerpt.length > 0, 'excerpt auto-derived when cleared');
	assertEqual(store.currentEditorIssue?.title, updated.title, 'editor target refreshed');

	store.deleteIssue(draft.id);
	assertEqual(store.getById(draft.id), undefined, 'issue deleted');
	assertEqual(store.currentEditorIssue, null, 'editor target cleared on delete');
});

test('IssueStore reconciles delivery jobs onto the issue', () => {
	const store = new IssueStore();
	const draft = store.createDraft();

	const jobs = [
		{ status: 'delivered', openedAt: '2026-10-05T12:00:01Z', clickedAt: '2026-10-05T12:00:02Z' },
		{ status: 'delivered', openedAt: '2026-10-05T12:00:03Z', clickedAt: null },
		{ status: 'bounced', openedAt: null, clickedAt: null }
	] as Parameters<typeof summarizeDeliveryJobs>[0];

	store.markAsSentFromJobs(draft.id, jobs, 3);

	const sent = store.getById(draft.id);
	if (!sent) throw new Error('dispatched issue missing');
	assertEqual(sent.status, 'sent', 'status marked sent');
	assert(sent.publishedAt !== null, 'publication timestamp stamped');
	assertEqual(sent.stats.deliveredCount, 2, 'delivered reconciled');
	assertEqual(sent.stats.bouncedCount, 1, 'bounced reconciled');
	assertEqual(sent.stats.openedCount, 2, 'opened reconciled');
	assertEqual(sent.stats.clickedCount, 1, 'clicked reconciled');
	assertEqual(sent.stats.totalRecipients, 3, 'recipients reconciled');
	assert(sent.stats.deliveryCompletedAt !== null, 'completion timestamp stamped');
});

test('DeliveryQueueManager runs batches and reconciles a full distribution', async () => {
	// NOTE: the suite runner awaits every async case before reporting.
	const queue = new DeliveryQueueManager();
	const issue = new IssueStore().items[0];
	const audience = new SubscriberStore().items
		.filter((subscriber) => subscriber.status === 'active')
		.slice(0, 6);

	const enqueued = queue.enqueueIssue(issue, audience);
	assertEqual(enqueued, 6, 'one job per recipient');
	assertEqual(queue.totalQueueCount, 6, 'queue size tracked');
	assertEqual(queue.progressPercent, 0, 'progress starts at zero');
	assertEqual(queue.statusCounts.queued, 6, 'all jobs start queued');

	let processedNotifications = 0;
	const result = await queue.runDistribution(
		{ batchSize: 2, minLatencyMs: 0, maxLatencyMs: 1, randomSource: () => 0.9 },
		() => {
			processedNotifications++;
		}
	);

	assertEqual(result.cancelled, false, 'run completed normally');
	assertEqual(result.delivered, 6, 'all delivered with a low-entropy random source');
	assertEqual(result.bounced, 0, 'no bounces');
	assertEqual(processedNotifications, 6, 'per-job callback fired');
	assertEqual(queue.processedCount, 6, 'processed counter');
	assertEqual(queue.progressPercent, 100, 'progress completed');
	assertEqual(queue.isProcessing, false, 'engine released after the run');
	assertEqual(
		queue.jobs.every((job) => job.processedAt !== null && job.attemptCount === 1),
		true,
		'each job recorded a processed timestamp and one attempt'
	);

	queue.reset();
	assertEqual(queue.totalQueueCount, 0, 'reset clears the queue');
	assertEqual(queue.jobs.length, 0, 'reset drops the job log');
});

test('DeliveryQueueManager marks every job as bounced at zero entropy', async () => {
	const queue = new DeliveryQueueManager();
	const issue = new IssueStore().items[0];
	const audience = new SubscriberStore().items.slice(0, 3);

	queue.enqueueIssue(issue, audience);
	const result = await queue.runDistribution({
		batchSize: 3,
		minLatencyMs: 0,
		maxLatencyMs: 1,
		randomSource: () => 0
	});

	assertEqual(result.bounced, 3, 'every job bounced');
	assertEqual(result.delivered, 0, 'nothing delivered');
	assert(
		queue.jobs.every((job) => job.errorMessage !== null),
		'bounced jobs carry a diagnostic message'
	);
});

test('DeliveryQueueManager halts on cancellation and pauses on demand', async () => {
	const queue = new DeliveryQueueManager();
	const issue = new IssueStore().items[0];
	const audience = new SubscriberStore().items.slice(0, 8);

	queue.enqueueIssue(issue, audience);

	const running = queue.runDistribution({
		batchSize: 1,
		minLatencyMs: 5,
		maxLatencyMs: 8,
		randomSource: () => 0.9
	});

	// Pause, then verify the engine stops making progress before resuming.
	queue.pause();
	assertEqual(queue.isPaused, true, 'pause flag set');

	await new Promise((resolve) => setTimeout(resolve, 60));
	const processedWhilePaused = queue.processedCount;
	await new Promise((resolve) => setTimeout(resolve, 60));
	assertEqual(queue.processedCount, processedWhilePaused, 'no progress while paused');

	queue.resume();
	assertEqual(queue.isPaused, false, 'resume flag cleared');

	// Halt the run before it can complete.
	await new Promise((resolve) => setTimeout(resolve, 10));
	queue.cancelDistribution();

	const result = await running;
	assertEqual(result.cancelled, true, 'cancelled run reports cancellation');
	assert(queue.processedCount < 8, `halted early (processed ${queue.processedCount})`);
	assertEqual(queue.isProcessing, false, 'engine released after cancellation');
});

test('DeliveryQueueManager refuses to enqueue while a run is active', async () => {
	const queue = new DeliveryQueueManager();
	const issue = new IssueStore().items[0];
	const audience = new SubscriberStore().items.slice(0, 2);

	queue.enqueueIssue(issue, audience);
	const running = queue.runDistribution({ batchSize: 1, minLatencyMs: 5, maxLatencyMs: 6 });

	let threw = false;
	try {
		queue.enqueueIssue(issue, audience);
	} catch {
		threw = true;
	}
	assertEqual(threw, true, 'concurrent enqueue rejected');

	queue.cancelDistribution();
	await running;
});

test('ToastStore queues, caps and dismisses notifications', () => {
	const toasts = new ToastStore();

	toasts.success('Saved', 'Subscriber created');
	toasts.error('Import failed', '2 rows rejected');
	toasts.warning('Heads up', 'List hygiene due');
	toasts.info('Heads up', 'Scheduled run queued');
	toasts.info('Overflow', 'Stack is capped');

	assertEqual(toasts.toasts.length, 4, 'visible stack capped at four');
	assertEqual(toasts.toasts[0].title, 'Overflow', 'newest toast first');
	assertEqual(toasts.toasts[0].variant, 'info', 'variant preserved');

	const firstId = toasts.toasts[0].id;
	toasts.dismiss(firstId);
	assertEqual(
		toasts.toasts.some((toast) => toast.id === firstId),
		false,
		'dismissed toast removed'
	);

	toasts.clear();
	assertEqual(toasts.toasts.length, 0, 'clear empties the stack');
});

/* ------------------------------------------------------------------ */
/* runner                                                              */
/* ------------------------------------------------------------------ */

export async function runSuite(): Promise<SuiteResult> {
	const executed: CaseResult[] = [];

	for (const testCase of cases) {
		try {
			await testCase.run();
			executed.push({ name: testCase.name, ok: true });
		} catch (error) {
			executed.push({
				name: testCase.name,
				ok: false,
				detail: error instanceof Error ? error.message : String(error)
			});
		}
	}

	const failures = executed
		.filter((result) => !result.ok)
		.map((result) => `${result.name}: ${result.detail ?? 'unknown failure'}`);

	return {
		passed: executed.filter((result) => result.ok).length,
		failed: failures.length,
		total: executed.length,
		failures
	};
}

export type { CsvImportResult };