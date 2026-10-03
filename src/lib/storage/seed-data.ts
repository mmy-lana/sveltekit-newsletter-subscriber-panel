import type { NewsletterIssue, PublicationSettings, Subscriber } from '#lib/types/newsletter';

export const initialSettings: PublicationSettings = {
	publicationName: 'The Margins & Letters',
	tagline: 'Reflections on software architecture, craft, and systems design.',
	description:
		'A weekly newsletter dissecting engineering choices, clean software systems, and long-term resilience.',
	supportEmail: 'editor@themargins.example',
	accentColor: '#191919',
	fontFamily: 'serif',
	defaultAudience: 'all',
	enablePublicArchive: true,
	enableComments: false
};

export const initialSubscribers: Subscriber[] = [
	{
		id: 'sub-001',
		email: 'sarah.connor@example.com',
		firstName: 'Sarah',
		lastName: 'Connor',
		status: 'active',
		tier: 'founding',
		tags: ['architect', 'systems'],
		metrics: {
			emailsReceivedCount: 14,
			emailsOpenedCount: 13,
			linksClickedCount: 8,
			lastOpenedAt: '2026-10-01T14:32:00Z',
			openRatePercent: 92.8,
			clickRatePercent: 57.1
		},
		subscribedAt: '2025-01-15T09:00:00Z',
		updatedAt: '2026-10-01T14:32:00Z',
		notes: 'Key community advocate'
	},
	{
		id: 'sub-002',
		email: 'alex.chen@clouddev.io',
		firstName: 'Alex',
		lastName: 'Chen',
		status: 'active',
		tier: 'paid',
		tags: ['backend', 'distributed-systems'],
		metrics: {
			emailsReceivedCount: 12,
			emailsOpenedCount: 9,
			linksClickedCount: 3,
			lastOpenedAt: '2026-09-28T18:12:00Z',
			openRatePercent: 75.0,
			clickRatePercent: 25.0
		},
		subscribedAt: '2025-03-22T11:45:00Z',
		updatedAt: '2026-09-28T18:12:00Z',
		notes: ''
	},
	{
		id: 'sub-003',
		email: 'marcus.vance@inbox.net',
		firstName: 'Marcus',
		lastName: 'Vance',
		status: 'active',
		tier: 'free',
		tags: ['frontend', 'svelte'],
		metrics: {
			emailsReceivedCount: 8,
			emailsOpenedCount: 4,
			linksClickedCount: 1,
			lastOpenedAt: '2026-09-15T08:20:00Z',
			openRatePercent: 50.0,
			clickRatePercent: 12.5
		},
		subscribedAt: '2025-06-10T16:20:00Z',
		updatedAt: '2026-09-15T08:20:00Z',
		notes: ''
	},
	{
		id: 'sub-004',
		email: 'elena.rostova@techjournal.org',
		firstName: 'Elena',
		lastName: 'Rostova',
		status: 'unsubscribed',
		tier: 'free',
		tags: ['press'],
		metrics: {
			emailsReceivedCount: 5,
			emailsOpenedCount: 1,
			linksClickedCount: 0,
			lastOpenedAt: '2025-08-01T10:05:00Z',
			openRatePercent: 20.0,
			clickRatePercent: 0.0
		},
		subscribedAt: '2025-04-01T12:00:00Z',
		updatedAt: '2025-08-05T09:00:00Z',
		notes: 'Unsubscribed via footer link'
	},
	{
		id: 'sub-005',
		email: 'devnull-test@domain-bounced.xyz',
		firstName: 'Invalid',
		lastName: 'Target',
		status: 'bounced',
		tier: 'free',
		tags: ['test'],
		metrics: {
			emailsReceivedCount: 2,
			emailsOpenedCount: 0,
			linksClickedCount: 0,
			lastOpenedAt: null,
			openRatePercent: 0.0,
			clickRatePercent: 0.0
		},
		subscribedAt: '2025-08-10T14:10:00Z',
		updatedAt: '2025-08-12T10:00:00Z',
		notes: 'Hard bounce 550 User not found'
	},
	{
		id: 'sub-006',
		email: 'priya.raman@orbital.dev',
		firstName: 'Priya',
		lastName: 'Raman',
		status: 'active',
		tier: 'paid',
		tags: ['platform', 'kubernetes'],
		metrics: {
			emailsReceivedCount: 11,
			emailsOpenedCount: 7,
			linksClickedCount: 2,
			lastOpenedAt: '2026-09-30T07:41:00Z',
			openRatePercent: 63.6,
			clickRatePercent: 18.2
		},
		subscribedAt: '2025-07-02T08:00:00Z',
		updatedAt: '2026-09-30T07:41:00Z',
		notes: ''
	},
	{
		id: 'sub-007',
		email: 'tomas.lindqvist@nordicstack.se',
		firstName: 'Tomas',
		lastName: 'Lindqvist',
		status: 'active',
		tier: 'founding',
		tags: ['typescript', 'dx'],
		metrics: {
			emailsReceivedCount: 14,
			emailsOpenedCount: 12,
			linksClickedCount: 9,
			lastOpenedAt: '2026-10-02T06:15:00Z',
			openRatePercent: 85.7,
			clickRatePercent: 64.3
		},
		subscribedAt: '2025-01-15T09:05:00Z',
		updatedAt: '2026-10-02T06:15:00Z',
		notes: 'Replied with detailed feedback on issue 4'
	},
	{
		id: 'sub-008',
		email: 'nadia.osei@brightloop.io',
		firstName: 'Nadia',
		lastName: 'Osei',
		status: 'active',
		tier: 'free',
		tags: ['frontend', 'accessibility'],
		metrics: {
			emailsReceivedCount: 9,
			emailsOpenedCount: 6,
			linksClickedCount: 3,
			lastOpenedAt: '2026-09-25T19:03:00Z',
			openRatePercent: 66.7,
			clickRatePercent: 33.3
		},
		subscribedAt: '2025-09-12T10:30:00Z',
		updatedAt: '2026-09-25T19:03:00Z',
		notes: ''
	},
	{
		id: 'sub-009',
		email: 'james.whitaker@legacycorp.com',
		firstName: 'James',
		lastName: 'Whitaker',
		status: 'pending',
		tier: 'free',
		tags: ['legacy', 'migration'],
		metrics: {
			emailsReceivedCount: 0,
			emailsOpenedCount: 0,
			linksClickedCount: 0,
			lastOpenedAt: null,
			openRatePercent: 0.0,
			clickRatePercent: 0.0
		},
		subscribedAt: '2026-10-03T07:12:00Z',
		updatedAt: '2026-10-03T07:12:00Z',
		notes: 'Double opt-in confirmation not yet returned'
	},
	{
		id: 'sub-010',
		email: 'lucia.ferrari@studioquattro.it',
		firstName: 'Lucia',
		lastName: 'Ferrari',
		status: 'active',
		tier: 'paid',
		tags: ['design-systems', 'frontend'],
		metrics: {
			emailsReceivedCount: 10,
			emailsOpenedCount: 8,
			linksClickedCount: 4,
			lastOpenedAt: '2026-09-29T11:27:00Z',
			openRatePercent: 80.0,
			clickRatePercent: 40.0
		},
		subscribedAt: '2025-11-30T15:45:00Z',
		updatedAt: '2026-09-29T11:27:00Z',
		notes: ''
	},
	{
		id: 'sub-011',
		email: 'omar.haddad@desertbyte.jo',
		firstName: 'Omar',
		lastName: 'Haddad',
		status: 'active',
		tier: 'free',
		tags: ['security', 'backend'],
		metrics: {
			emailsReceivedCount: 7,
			emailsOpenedCount: 2,
			linksClickedCount: 0,
			lastOpenedAt: '2026-08-19T05:50:00Z',
			openRatePercent: 28.6,
			clickRatePercent: 0.0
		},
		subscribedAt: '2026-02-18T09:20:00Z',
		updatedAt: '2026-08-19T05:50:00Z',
		notes: 'Low engagement — consider a re-engagement dispatch'
	},
	{
		id: 'sub-012',
		email: 'grace.okonkwo@meridianlabs.co',
		firstName: 'Grace',
		lastName: 'Okonkwo',
		status: 'active',
		tier: 'founding',
		tags: ['observability', 'systems'],
		metrics: {
			emailsReceivedCount: 13,
			emailsOpenedCount: 11,
			linksClickedCount: 5,
			lastOpenedAt: '2026-10-01T09:38:00Z',
			openRatePercent: 84.6,
			clickRatePercent: 38.5
		},
		subscribedAt: '2025-01-15T09:10:00Z',
		updatedAt: '2026-10-01T09:38:00Z',
		notes: 'Annual renewal conversation in November'
	},
	{
		id: 'sub-013',
		email: 'henrik.sorensen@fjordworks.no',
		firstName: 'Henrik',
		lastName: 'Sorensen',
		status: 'bounced',
		tier: 'paid',
		tags: ['testing'],
		metrics: {
			emailsReceivedCount: 6,
			emailsOpenedCount: 1,
			linksClickedCount: 0,
			lastOpenedAt: '2026-06-02T13:10:00Z',
			openRatePercent: 16.7,
			clickRatePercent: 0.0
		},
		subscribedAt: '2025-10-05T11:11:00Z',
		updatedAt: '2026-06-04T08:00:00Z',
		notes: 'Soft bounce 552 Mailbox full'
	},
	{
		id: 'sub-014',
		email: 'mei.tanaka@quietstack.jp',
		firstName: 'Mei',
		lastName: 'Tanaka',
		status: 'active',
		tier: 'free',
		tags: ['svelte', 'frontend'],
		metrics: {
			emailsReceivedCount: 4,
			emailsOpenedCount: 3,
			linksClickedCount: 2,
			lastOpenedAt: '2026-09-27T22:04:00Z',
			openRatePercent: 75.0,
			clickRatePercent: 50.0
		},
		subscribedAt: '2026-09-14T03:22:00Z',
		updatedAt: '2026-09-27T22:04:00Z',
		notes: 'Referred by Tomas Lindqvist'
	}
];

export const initialIssues: NewsletterIssue[] = [
	{
		id: 'issue-001',
		slug: 'the-art-of-minimal-state',
		title: 'The Art of Minimal State in Modern Web Clients',
		subtitle: 'Why eliminating redundant state reduces bug surface area by an order of magnitude.',
		excerpt:
			'State coordination is often the single greatest source of frontend entropy. In this essay we examine reactive derivation, event streams, and bounded stores.',
		contentMarkdown: `# The Art of Minimal State in Modern Web Clients

State coordination is often the single greatest source of frontend entropy.

When we build client applications, the instinct is often to cache, duplicate, and synchronise multiple local representations of identical truths. Over time, these copies drift, causing edge-case visual discrepancies, stale screens, and race conditions.

## The Derived Truth Principle

> Never store what you can calculate purely from source data.

Whenever a UI requires an aggregated counter, a sorted list, or an indicator flag, treat it as a pure mathematical derivation of the raw entity collection. Modern reactive primitives make this nearly cost-free.

### Practical Guidelines

* Keep the root store as an immutable key-value dictionary.
* Compute view transformations as reactive derived expressions.
* Decouple the distribution transport from local UI render trees.

In our next dispatch, we will explore background queue reconciliation over unreliable transports.`,
		contentHtml: '',
		coverImageUrl: null,
		authorName: 'Julian Sterling',
		authorAvatarUrl: null,
		status: 'sent',
		audience: 'all',
		tags: ['architecture', 'javascript', 'frontend'],
		scheduledAt: null,
		publishedAt: '2026-09-20T10:00:00Z',
		createdAt: '2026-09-18T14:00:00Z',
		updatedAt: '2026-09-20T10:00:00Z',
		stats: {
			totalRecipients: 6,
			deliveredCount: 6,
			openedCount: 4,
			clickedCount: 2,
			bouncedCount: 0,
			unsubscribedCount: 1,
			deliveryCompletedAt: '2026-09-20T10:02:15Z'
		}
	},
	{
		id: 'issue-002',
		slug: 'reliable-dispatch-in-browser-environments',
		title: 'Reliable Dispatch in Constrained Browser Environments',
		subtitle: 'Handling client-side delivery simulation with backoff and batch slicing.',
		excerpt:
			'Executing bulk operations client-side requires careful execution pacing to keep the UI thread responsive and prevent browser freezing.',
		contentMarkdown: `# Reliable Dispatch in Constrained Browser Environments

Executing bulk operations client-side requires careful pacing.

When executing batch deliveries or bulk database mutations directly in the user agent, relying on unbounded \`Promise.all\` leads to resource starvation, network throttling, and frame rate drops.

## Chunking and Event Loop Yielding

By slicing payloads into bounded queues and yielding back to the event loop, we achieve smooth responsiveness even during intense processing cycles.

* Slice the work into bounded batches.
* Await between batches so the compositor can paint.
* Honour cancellation signals checked at every batch boundary.

---

Thank you to our founding members for supporting independent research.`,
		contentHtml: '',
		coverImageUrl: null,
		authorName: 'Julian Sterling',
		authorAvatarUrl: null,
		status: 'draft',
		audience: 'all',
		tags: ['performance', 'web-standards'],
		scheduledAt: null,
		publishedAt: null,
		createdAt: '2026-10-02T11:00:00Z',
		updatedAt: '2026-10-02T16:30:00Z',
		stats: {
			totalRecipients: 0,
			deliveredCount: 0,
			openedCount: 0,
			clickedCount: 0,
			bouncedCount: 0,
			unsubscribedCount: 0,
			deliveryCompletedAt: null
		}
	},
	{
		id: 'issue-003',
		slug: 'bounded-queues-and-abort-signals',
		title: 'Bounded Queues and Abort Signals',
		subtitle: 'A pattern for cancellable, observable background work in the browser.',
		excerpt:
			'Abortable controllers are the missing primitive for user-initiated long jobs: they let an operator halt a distribution run without corrupting state.',
		contentMarkdown: `# Bounded Queues and Abort Signals

A queue without a cancellation path is a queue you cannot stop.

The \`AbortController\` contract gives every batch loop a single boolean to consult at a safe boundary, which is enough to guarantee the UI never lands in a half-applied state.

## The Contract

* Check the signal before acquiring work.
* Check it again after every asynchronous boundary.
* Treat a cancelled run as a partial run and report it honestly.

> Cancellation is a feature, not an error path.

Reporting partial progress keeps operator trust intact when a dispatch halts midway through a thousand recipients.`,
		contentHtml: '',
		coverImageUrl: null,
		authorName: 'Julian Sterling',
		authorAvatarUrl: null,
		status: 'sent',
		audience: 'paid_only',
		tags: ['architecture', 'concurrency'],
		scheduledAt: null,
		publishedAt: '2026-09-13T10:00:00Z',
		createdAt: '2026-09-11T09:15:00Z',
		updatedAt: '2026-09-13T10:00:00Z',
		stats: {
			totalRecipients: 4,
			deliveredCount: 4,
			openedCount: 3,
			clickedCount: 1,
			bouncedCount: 0,
			unsubscribedCount: 0,
			deliveryCompletedAt: '2026-09-13T10:01:48Z'
		}
	},
	{
		id: 'issue-004',
		slug: 'reading-the-room-on-open-rates',
		title: 'Reading the Room on Open Rates',
		subtitle: 'Issue-weighted averages, small samples, and the metrics that mislead.',
		excerpt:
			'An average open rate across a mixed list of issues can hide a dispatch that reached nobody. Weighting per issue keeps the number honest.',
		contentMarkdown: `# Reading the Room on Open Rates

Averages are the most abused statistic in publishing.

Consider two lists with identical aggregate engagement: one dispatch that reached a thousand readers and one that reached three. A flat average treats them as equal. Weighting each issue by its own delivery count does not.

## What we recommend

* Weight every issue independently, then average the weights.
* Count an issue with zero deliveries as a hard zero.
* Publish the denominator alongside every percentage.

The [full methodology](https://example.com/methodology) is documented openly, because a metric you cannot audit is a metric you cannot defend.`,
		contentHtml: '',
		coverImageUrl: null,
		authorName: 'Julian Sterling',
		authorAvatarUrl: null,
		status: 'sent',
		audience: 'all',
		tags: ['analytics', 'editorial'],
		scheduledAt: null,
		publishedAt: '2026-09-06T10:00:00Z',
		createdAt: '2026-09-04T13:00:00Z',
		updatedAt: '2026-09-06T10:00:00Z',
		stats: {
			totalRecipients: 5,
			deliveredCount: 4,
			openedCount: 2,
			clickedCount: 0,
			bouncedCount: 1,
			unsubscribedCount: 0,
			deliveryCompletedAt: '2026-09-06T10:02:40Z'
		}
	},
	{
		id: 'issue-005',
		slug: 'scheduling-notes-for-october',
		title: 'Scheduling Notes for October',
		subtitle: 'A short dispatch on cadence, cooldowns, and list hygiene.',
		excerpt:
			'Cadence is a promise to the reader. This issue outlines the autumn schedule and the hygiene work behind it.',
		contentMarkdown: `# Scheduling Notes for October

Cadence is a promise. Here is what October looks like.

* Week one: bounded queues.
* Week two: storage adapters.
* Week three: a reader on typography in admin surfaces.

We are also tightening the double opt-in window and purging addresses that have hard-bounced twice.`,
		contentHtml: '',
		coverImageUrl: null,
		authorName: 'Julian Sterling',
		authorAvatarUrl: null,
		status: 'scheduled',
		audience: 'all',
		tags: ['editorial', 'operations'],
		scheduledAt: '2026-10-10T10:00:00Z',
		publishedAt: null,
		createdAt: '2026-10-03T08:45:00Z',
		updatedAt: '2026-10-03T08:45:00Z',
		stats: {
			totalRecipients: 0,
			deliveredCount: 0,
			openedCount: 0,
			clickedCount: 0,
			bouncedCount: 0,
			unsubscribedCount: 0,
			deliveryCompletedAt: null
		}
	},
	{
		id: 'issue-006',
		slug: 'the-founding-year-retrospective',
		title: 'The Founding Year, Retrospective',
		subtitle: 'What a year of writing about software architecture actually taught us.',
		excerpt:
			'An annual review of the essays that mattered most, the reader questions that changed our minds, and where the publication goes next.',
		contentMarkdown: `# The Founding Year, Retrospective

A year ago this publication sent its first dispatch. This is an honest accounting of what happened since.

## The numbers

We published eleven issues, lost four percent of the audience to unsubscribes, and grew the paying cohort by a third.

## What we learned

> Readers reward specificity more often than they reward frequency.

Next year we slow down and go deeper.`,
		contentHtml: '',
		coverImageUrl: null,
		authorName: 'Julian Sterling',
		authorAvatarUrl: null,
		status: 'archived',
		audience: 'all',
		tags: ['editorial', 'retrospective'],
		scheduledAt: null,
		publishedAt: '2026-08-30T10:00:00Z',
		createdAt: '2026-08-28T12:00:00Z',
		updatedAt: '2026-08-30T10:05:00Z',
		stats: {
			totalRecipients: 5,
			deliveredCount: 5,
			openedCount: 4,
			clickedCount: 2,
			bouncedCount: 0,
			unsubscribedCount: 0,
			deliveryCompletedAt: '2026-08-30T10:03:12Z'
		}
	}
];