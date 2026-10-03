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
import { parseSubscribersCsv, toSubscribersCsv } from '#lib/utils/csv-parser';
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

const cases: Array<{ name: string; run: () => void }> = [];

function test(name: string, run: () => void): void {
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
/* runner                                                              */
/* ------------------------------------------------------------------ */

export function runSuite(): SuiteResult {
	const executed: CaseResult[] = [];

	for (const testCase of cases) {
		try {
			testCase.run();
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

/** Convenience export so the Node runner can print a per-case report. */
export function runSuiteDetailed(): { results: CaseResult[]; summary: SuiteResult } {
	const summary = runSuite();
	return { results: cases.map((testCase) => ({ name: testCase.name, ok: !summary.failures.some((failure) => failure.startsWith(testCase.name)) })), summary };
}

export type { CsvImportResult };