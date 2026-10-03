import type { Subscriber, NewsletterIssue, PublicationSettings } from '$lib/types/newsletter';

export const initialSettings: PublicationSettings = {
  publicationName: 'The Margins & Letters',
  tagline: 'Reflections on software architecture, craft, and systems design.',
  description: 'A weekly newsletter dissecting engineering choices, clean software systems, and long-term resilience.',
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
  }
];

export const initialIssues: NewsletterIssue[] = [
  {
    id: 'issue-001',
    slug: 'the-art-of-minimal-state',
    title: 'The Art of Minimal State in Modern Web Clients',
    subtitle: 'Why eliminating redundant state reduces bug surface area by an order of magnitude.',
    excerpt: 'State coordination is often the single greatest source of frontend entropy.',
    contentMarkdown: '# The Art of Minimal State in Modern Web Clients\n\nState coordination is often the single greatest source of frontend entropy.',
    contentHtml: '<h1 class="text-3xl font-serif font-bold text-stone-900 mt-12 mb-5 tracking-tight">The Art of Minimal State in Modern Web Clients</h1><p class="font-serif text-lg leading-relaxed text-stone-800 my-4 text-left">State coordination is often the single greatest source of frontend entropy.</p>',
    coverImageUrl: null,
    authorName: 'Julian Sterling',
    authorAvatarUrl: null,
    status: 'sent',
    audience: 'all',
    tags: ['architecture', 'frontend'],
    scheduledAt: null,
    publishedAt: '2026-09-20T10:00:00Z',
    createdAt: '2026-09-18T14:00:00Z',
    updatedAt: '2026-09-20T10:00:00Z',
    stats: {
      totalRecipients: 2,
      deliveredCount: 2,
      openedCount: 2,
      clickedCount: 1,
      bouncedCount: 0,
      unsubscribedCount: 0,
      deliveryCompletedAt: '2026-09-20T10:02:15Z'
    }
  }
];
