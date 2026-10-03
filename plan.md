# Architectural Specification: Newsletter Distribution & Subscriber Panel (`sveltekit-newsletter-subscriber-panel`)

---

## 1. Executive Summary & Design Aesthetics

The **Newsletter Distribution & Subscriber Panel** is an editorial-first publication and subscriber management system styled in the minimalist Substack aesthetic. The architecture provides:
- Clean serif-driven editorial typesetting for reading and authoring.
- High-contrast, dense monochrome layouts for administrative tables and metric telemetry.
- An asynchronous distribution queue engine with batch simulation, cancellation mechanisms, and delivery logging.
- Offline-first persistence via a typed LocalStorage adapter with SSR guards.
- Mobile-first responsiveness tested across 360px, 390px, 430px, 768px, and 1024px+ viewports with zero reliance on hover states.

---

## 2. Technical Stack & Architectural Directives

- **Framework**: SvelteKit (latest stable)
- **Component Model**: Svelte 5 Runes (`$state`, `$derived`, `$derived.by`, `$props`, `$bindable`, `$effect`)
- **Styling**: Tailwind CSS v4 with CSS-first `@theme` variables and custom utilities
- **Language**: Strict TypeScript
- **Storage Strategy**: LocalStorage with hydration detection and seed fallback
- **State Pattern**: Factory-based rune classes (`getSubscriberState()`, `getIssueState()`, `getDeliveryQueue()`) with explicit deprecation proxy shims for backwards compatibility
- **Safety Standard**: In-browser SSR safety shims for `crypto.randomUUID()`, XSS mitigation on markdown outputs, and RFC 4180 multiline CSV handling

---

## 3. Data Schema & Pure TypeScript Interfaces

```typescript
// src/lib/types/newsletter.ts

export type SubscriberStatus = 'active' | 'unsubscribed' | 'bounced' | 'pending';
export type SubscriberTier = 'free' | 'paid' | 'founding';

export interface SubscriberMetrics {
  emailsReceivedCount: number;
  emailsOpenedCount: number;
  linksClickedCount: number;
  lastOpenedAt: string | null;
  openRatePercent: number;
  clickRatePercent: number;
}

export interface Subscriber {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  status: SubscriberStatus;
  tier: SubscriberTier;
  tags: string[];
  metrics: SubscriberMetrics;
  subscribedAt: string;
  updatedAt: string;
  notes: string;
}

export type IssueStatus = 'draft' | 'scheduled' | 'sending' | 'sent' | 'archived';
export type AudienceFilter = 'all' | 'free_only' | 'paid_only' | 'founding_only';

export interface IssueDeliveryStats {
  totalRecipients: number;
  deliveredCount: number;
  openedCount: number;
  clickedCount: number;
  bouncedCount: number;
  unsubscribedCount: number;
  deliveryCompletedAt: string | null;
}

export interface NewsletterIssue {
  id: string;
  slug: string;
  title: string;
  subtitle: string;
  excerpt: string;
  contentMarkdown: string;
  contentHtml: string;
  coverImageUrl: string | null;
  authorName: string;
  authorAvatarUrl: string | null;
  status: IssueStatus;
  audience: AudienceFilter;
  tags: string[];
  scheduledAt: string | null;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  stats: IssueDeliveryStats;
}

export type DeliveryJobStatus = 'queued' | 'in_transit' | 'delivered' | 'failed' | 'bounced';

export interface DeliveryJobLog {
  id: string;
  issueId: string;
  subscriberId: string;
  subscriberEmail: string;
  status: DeliveryJobStatus;
  attemptCount: number;
  errorMessage: string | null;
  queuedAt: string;
  processedAt: string | null;
  openedAt: string | null;
  clickedAt: string | null;
}

export interface DistributionResult {
  delivered: number;
  bounced: number;
  opened: number;
  clicked: number;
  cancelled: boolean;
}

export interface PublicationSettings {
  publicationName: string;
  tagline: string;
  description: string;
  supportEmail: string;
  accentColor: string;
  fontFamily: 'serif' | 'sans';
  defaultAudience: AudienceFilter;
  enablePublicArchive: boolean;
  enableComments: boolean;
}

export interface SubscriberFilterOptions {
  searchQuery: string;
  status: SubscriberStatus | 'all';
  tier: SubscriberTier | 'all';
  tag: string | 'all';
  sortBy: 'subscribedAt' | 'email' | 'openRatePercent' | 'lastOpenedAt';
  sortDirection: 'asc' | 'desc';
  page: number;
  pageSize: number;
}

export interface IssueFilterOptions {
  status: IssueStatus | 'all';
  searchQuery: string;
  sortBy: 'createdAt' | 'publishedAt' | 'totalRecipients';
  sortDirection: 'asc' | 'desc';
  page: number;
  pageSize: number;
}

export interface DashboardMetricsSummary {
  totalSubscribers: number;
  activeSubscribers: number;
  paidSubscribers: number;
  monthlyRevenueEst: number;
  averageOpenRatePercent: number;
  averageClickRatePercent: number;
  thirtyDayGrowthCount: number;
  issuesSentCount: number;
}

export interface CsvImportResult {
  totalRows: number;
  successfulImports: number;
  failedImports: number;
  errors: Array<{ row: number; email: string; reason: string }>;
}
```

---

## 4. Design System & Tailwind v4 Configuration

### Stylesheet (`src/app.css`)
```css
@import "tailwindcss";

@theme {
  --color-stone-50: #fafaf9;
  --color-stone-100: #f5f5f4;
  --color-stone-200: #e7e5e4;
  --color-stone-300: #d6d3d1;
  --color-stone-400: #a8a29e;
  --color-stone-500: #78716c;
  --color-stone-600: #57534e;
  --color-stone-700: #44403c;
  --color-stone-800: #292524;
  --color-stone-900: #1c1917;
  --color-stone-950: #0c0a09;

  --font-serif: Charter, "Bitstream Charter", "Sitka Text", Cambria, Georgia, serif;
  --font-sans: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  --font-mono: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
}

/* Ensure backdrop blur and border divide compatibility across browsers with Tailwind v4 */
@layer utilities {
  .backdrop-blur-sm {
    -webkit-backdrop-filter: blur(4px);
    backdrop-filter: blur(4px);
  }
}
```

---

## 5. Storage Layer & Pure Base Utilities

### 5.1. SSR-Safe UUID Utility (`src/lib/utils/uuid.ts`)
```typescript
export function generateUuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
    const random = (Math.random() * 16) | 0;
    const value = char === 'x' ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });
}
```

### 5.2. Pure Field Validators (`src/lib/utils/validators.ts`)
```typescript
export function validateEmail(email: string): boolean {
  if (!email || email.length > 254) return false;
  const regex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
  return regex.test(email);
}

export function sanitizeSlug(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
```

### 5.3. RFC 4180 Multiline CSV Parser (`src/lib/utils/csv-parser.ts`)
```typescript
import type { Subscriber, CsvImportResult } from '$lib/types/newsletter';
import { validateEmail } from '$lib/utils/validators';
import { generateUuid } from '$lib/utils/uuid';

interface ParsedRecord {
  lineNumber: number;
  fields: string[];
}

export function parseSubscribersCsv(
  csvContent: string,
  existingEmails: Set<string>
): { imported: Subscriber[]; summary: CsvImportResult } {
  const records = parseRfc4180Csv(csvContent);
  const result: CsvImportResult = {
    totalRows: 0,
    successfulImports: 0,
    failedImports: 0,
    errors: []
  };

  if (records.length === 0) {
    return { imported: [], summary: result };
  }

  const rawHeaders = records[0].fields.map((h) => h.trim().toLowerCase().replace(/['"]/g, ''));
  const emailIdx = rawHeaders.findIndex((h) => h === 'email');
  const firstNameIdx = rawHeaders.findIndex((h) => h === 'firstname' || h === 'first_name' || h === 'name');
  const lastNameIdx = rawHeaders.findIndex((h) => h === 'lastname' || h === 'last_name');
  const tagsIdx = rawHeaders.findIndex((h) => h === 'tags');

  if (emailIdx === -1) {
    result.errors.push({ row: records[0].lineNumber, email: '', reason: 'Required header "email" is missing.' });
    return { imported: [], summary: result };
  }

  const validSubscribers: Subscriber[] = [];
  const seenInBatch = new Set<string>();
  const now = new Date().toISOString();

  for (let i = 1; i < records.length; i++) {
    result.totalRows++;
    const { lineNumber, fields } = records[i];
    const rawEmail = fields[emailIdx]?.trim() ?? '';

    if (!rawEmail) {
      result.failedImports++;
      result.errors.push({ row: lineNumber, email: '', reason: 'Empty email column.' });
      continue;
    }

    const email = rawEmail.toLowerCase();

    if (!validateEmail(email)) {
      result.failedImports++;
      result.errors.push({ row: lineNumber, email, reason: 'Invalid email syntax.' });
      continue;
    }

    if (existingEmails.has(email) || seenInBatch.has(email)) {
      result.failedImports++;
      result.errors.push({ row: lineNumber, email, reason: 'Duplicate email address.' });
      continue;
    }

    const firstName = firstNameIdx !== -1 ? (fields[firstNameIdx]?.trim() ?? '') : '';
    const lastName = lastNameIdx !== -1 ? (fields[lastNameIdx]?.trim() ?? '') : '';
    const rawTags = tagsIdx !== -1 ? (fields[tagsIdx]?.trim() ?? '') : '';
    const tags = rawTags
      ? rawTags
          .split(';')
          .map((t) => t.trim())
          .filter(Boolean)
      : ['csv-import'];

    seenInBatch.add(email);
    result.successfulImports++;

    validSubscribers.push({
      id: generateUuid(),
      email,
      firstName,
      lastName,
      status: 'active',
      tier: 'free',
      tags,
      metrics: {
        emailsReceivedCount: 0,
        emailsOpenedCount: 0,
        linksClickedCount: 0,
        lastOpenedAt: null,
        openRatePercent: 0,
        clickRatePercent: 0
      },
      subscribedAt: now,
      updatedAt: now,
      notes: 'Imported via CSV'
    });
  }

  return { imported: validSubscribers, summary: result };
}

function parseRfc4180Csv(input: string): ParsedRecord[] {
  const records: ParsedRecord[] = [];
  let currentFields: string[] = [];
  let currentField = '';
  let inQuotes = false;
  let currentLine = 1;
  let recordStartLine = 1;

  for (let i = 0; i < input.length; i++) {
    const char = input[i];
    const nextChar = input[i + 1];

    if (inQuotes) {
      if (char === '"' && nextChar === '"') {
        currentField += '"';
        i++;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        if (char === '\n') currentLine++;
        currentField += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ',') {
        currentFields.push(currentField);
        currentField = '';
      } else if (char === '\r' && nextChar === '\n') {
        currentFields.push(currentField);
        if (currentFields.some((f) => f.trim().length > 0)) {
          records.push({ lineNumber: recordStartLine, fields: currentFields });
        }
        currentFields = [];
        currentField = '';
        currentLine++;
        recordStartLine = currentLine + 1;
        i++;
      } else if (char === '\n' || char === '\r') {
        currentFields.push(currentField);
        if (currentFields.some((f) => f.trim().length > 0)) {
          records.push({ lineNumber: recordStartLine, fields: currentFields });
        }
        currentFields = [];
        currentField = '';
        currentLine++;
        recordStartLine = currentLine;
      } else {
        currentField += char;
      }
    }
  }

  if (currentField.length > 0 || currentFields.length > 0) {
    currentFields.push(currentField);
    if (currentFields.some((f) => f.trim().length > 0)) {
      records.push({ lineNumber: recordStartLine, fields: currentFields });
    }
  }

  return records;
}
```

### 5.4. XSS-Safe Markdown Renderer (`src/lib/utils/markdown-renderer.ts`)
```typescript
function sanitizeHref(url: string): string {
  const clean = url.trim();
  if (/^(?:https?:|\/|mailto:)/i.test(clean)) {
    return clean.replace(/"/g, '&quot;');
  }
  return '#blocked-uri';
}

export function renderEditorialMarkdown(raw: string): string {
  if (!raw) return '';

  const escaped = raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

  const parsed = escaped
    .replace(/^### (.*$)/gim, '<h3 class="text-xl font-serif font-bold text-stone-900 mt-8 mb-3 tracking-tight">$1</h3>')
    .replace(/^## (.*$)/gim, '<h2 class="text-2xl font-serif font-bold text-stone-900 mt-10 mb-4 tracking-tight">$1</h2>')
    .replace(/^# (.*$)/gim, '<h1 class="text-3xl font-serif font-bold text-stone-900 mt-12 mb-5 tracking-tight">$1</h1>')
    .replace(/^\> (.*$)/gim, '<blockquote class="border-l-2 border-stone-900 pl-4 py-1 italic my-6 text-stone-700 font-serif">$1</blockquote>')
    .replace(/^---$/gim, '<hr class="my-10 border-stone-200" />')
    .replace(/\*\*\*(.*?)\*\*\*/gim, '<strong><em>$1</em></strong>')
    .replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/gim, '<em>$1</em>')
    .replace(/\[(.*?)\]\((.*?)\)/gim, (_, label, href) => {
      const safeHref = sanitizeHref(href);
      return `<a href="${safeHref}" class="underline underline-offset-4 text-stone-900 decoration-stone-400 hover:decoration-stone-900 transition-colors" target="_blank" rel="noopener noreferrer">${label}</a>`;
    })
    .replace(/^\* (.*$)/gim, '<li class="ml-6 list-disc list-outside my-1 text-stone-800 leading-relaxed">$1</li>')
    .replace(/^- (.*$)/gim, '<li class="ml-6 list-disc list-outside my-1 text-stone-800 leading-relaxed">$1</li>');

  return parsed
    .split(/\n\s*\n/)
    .map((block) => {
      const trimmed = block.trim();
      if (
        trimmed.startsWith('<h1') ||
        trimmed.startsWith('<h2') ||
        trimmed.startsWith('<h3') ||
        trimmed.startsWith('<blockquote') ||
        trimmed.startsWith('<hr') ||
        trimmed.startsWith('<li')
      ) {
        return trimmed;
      }
      return `<p class="font-serif text-lg leading-relaxed text-stone-800 my-4 text-left">${trimmed}</p>`;
    })
    .join('\n');
}
```

### 5.5. LocalStorage Repository (`src/lib/storage/local-storage-client.ts`)
```typescript
import type { Subscriber, NewsletterIssue, PublicationSettings } from '$lib/types/newsletter';
import { initialSubscribers, initialIssues, initialSettings } from './seed-data';

const STORAGE_KEYS = {
  SUBSCRIBERS: 'snsp_subscribers_v1',
  ISSUES: 'snsp_issues_v1',
  SETTINGS: 'snsp_settings_v1'
} as const;

function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof localStorage !== 'undefined';
}

export function loadSubscribers(): Subscriber[] {
  if (!isBrowser()) return initialSubscribers;
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.SUBSCRIBERS);
    if (!raw) {
      saveSubscribers(initialSubscribers);
      return initialSubscribers;
    }
    return JSON.parse(raw) as Subscriber[];
  } catch {
    return initialSubscribers;
  }
}

export function saveSubscribers(subscribers: Subscriber[]): void {
  if (!isBrowser()) return;
  try {
    localStorage.setItem(STORAGE_KEYS.SUBSCRIBERS, JSON.stringify(subscribers));
  } catch (error) {
    console.error('Failed to persist subscribers to localStorage', error);
  }
}

export function loadIssues(): NewsletterIssue[] {
  if (!isBrowser()) return initialIssues;
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.ISSUES);
    if (!raw) {
      saveIssues(initialIssues);
      return initialIssues;
    }
    return JSON.parse(raw) as NewsletterIssue[];
  } catch {
    return initialIssues;
  }
}

export function saveIssues(issues: NewsletterIssue[]): void {
  if (!isBrowser()) return;
  try {
    localStorage.setItem(STORAGE_KEYS.ISSUES, JSON.stringify(issues));
  } catch (error) {
    console.error('Failed to persist issues to localStorage', error);
  }
}

export function loadSettings(): PublicationSettings {
  if (!isBrowser()) return initialSettings;
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.SETTINGS);
    if (!raw) {
      saveSettings(initialSettings);
      return initialSettings;
    }
    return JSON.parse(raw) as PublicationSettings;
  } catch {
    return initialSettings;
  }
}

export function saveSettings(settings: PublicationSettings): void {
  if (!isBrowser()) return;
  try {
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
  } catch (error) {
    console.error('Failed to persist settings to localStorage', error);
  }
}
```

### 5.6. Seed Data (`src/lib/storage/seed-data.ts`)
```typescript
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
  }
];

export const initialIssues: NewsletterIssue[] = [
  {
    id: 'issue-001',
    slug: 'the-art-of-minimal-state',
    title: 'The Art of Minimal State in Modern Web Clients',
    subtitle: 'Why eliminating redundant state reduces bug surface area by an order of magnitude.',
    excerpt: 'State coordination is often the single greatest source of frontend entropy. In this essay, we examine reactive derivation, event streams, and bounded stores.',
    contentMarkdown: `# The Art of Minimal State in Modern Web Clients\n\nState coordination is often the single greatest source of frontend entropy.\n\nWhen we build client applications, the instinct is often to cache, duplicate, and synchronise multiple local representations of identical truths. Over time, these copies drift, causing edge-case visual discrepancies, stale screens, and race conditions.\n\n## The Derived Truth Principle\n\n> Never store what you can calculate purely from source data.\n\nWhenever a UI requires an aggregated counter, a sorted list, or an indicator flag, treat it as a pure mathematical derivation of the raw entity collection. Modern reactive primitives make this nearly cost-free.\n\n### Practical Guidelines\n\n* Keep the root store as an immutable key-value dictionary.\n* Compute view transformations as reactive derived expressions.\n* Decouple the distribution transport from local UI render trees.\n\nIn our next dispatch, we will explore background queue reconciliation over unreliable transports.`,
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
      totalRecipients: 4,
      deliveredCount: 4,
      openedCount: 3,
      clickedCount: 2,
      bouncedCount: 0,
      unsubscribedCount: 0,
      deliveryCompletedAt: '2026-09-20T10:02:15Z'
    }
  },
  {
    id: 'issue-002',
    slug: 'reliable-dispatch-in-browser-environments',
    title: 'Reliable Dispatch in Constrained Browser Environments',
    subtitle: 'Handling client-side delivery simulation with backoff and batch slicing.',
    excerpt: 'Executing bulk operations client-side requires careful execution pacing to keep the UI thread responsive and prevent browser freezing.',
    contentMarkdown: `# Reliable Dispatch in Constrained Browser Environments\n\nExecuting bulk operations client-side requires careful pacing.\n\nWhen executing batch deliveries or bulk database mutations directly in the user agent, relying on unbound \`Promise.all\` leads to resource starvation, network throttling, and frame rate drops.\n\n## Chunking and Event Loop Yielding\n\nBy slicing payloads into bounded queues and yielding back to the microtask queue, we achieve smooth 60fps responsiveness even during intense processing cycles.\n\n--- \n\nThank you to our founding members for supporting independent research.`,
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
  }
];
```

---

## 6. Reactive Domain State Management (Svelte 5 Runes)

### 6.1. Subscriber Store (`src/lib/state/subscriber.svelte.ts`)
```typescript
import type { Subscriber, SubscriberFilterOptions, SubscriberStatus } from '$lib/types/newsletter';
import { loadSubscribers, saveSubscribers } from '$lib/storage/local-storage-client';
import { generateUuid } from '$lib/utils/uuid';

// Svelte 5 Runes standard:
// - Use $derived(expr) for single expressions.
// - Use $derived.by(() => block) for multi-statement derivations.

export class SubscriberStore {
  items = $state<Subscriber[]>(loadSubscribers());

  filters = $state<SubscriberFilterOptions>({
    searchQuery: '',
    status: 'all',
    tier: 'all',
    tag: 'all',
    sortBy: 'subscribedAt',
    sortDirection: 'desc',
    page: 1,
    pageSize: 10
  });

  filteredItems = $derived.by(() => {
    let result = [...this.items];

    if (this.filters.searchQuery.trim().length > 0) {
      const q = this.filters.searchQuery.toLowerCase().trim();
      result = result.filter(
        (s) =>
          s.email.toLowerCase().includes(q) ||
          s.firstName.toLowerCase().includes(q) ||
          s.lastName.toLowerCase().includes(q) ||
          s.tags.some((t) => t.toLowerCase().includes(q))
      );
    }

    if (this.filters.status !== 'all') {
      result = result.filter((s) => s.status === this.filters.status);
    }

    if (this.filters.tier !== 'all') {
      result = result.filter((s) => s.tier === this.filters.tier);
    }

    if (this.filters.tag !== 'all') {
      result = result.filter((s) => s.tags.includes(this.filters.tag));
    }

    result.sort((a, b) => {
      let comparison = 0;
      if (this.filters.sortBy === 'email') {
        comparison = a.email.localeCompare(b.email);
      } else if (this.filters.sortBy === 'openRatePercent') {
        comparison = a.metrics.openRatePercent - b.metrics.openRatePercent;
      } else if (this.filters.sortBy === 'lastOpenedAt') {
        const timeA = a.metrics.lastOpenedAt ? new Date(a.metrics.lastOpenedAt).getTime() : 0;
        const timeB = b.metrics.lastOpenedAt ? new Date(b.metrics.lastOpenedAt).getTime() : 0;
        comparison = timeA - timeB;
      } else {
        comparison = new Date(a.subscribedAt).getTime() - new Date(b.subscribedAt).getTime();
      }
      return this.filters.sortDirection === 'asc' ? comparison : -comparison;
    });

    return result;
  });

  paginatedItems = $derived.by(() => {
    const startIndex = (this.filters.page - 1) * this.filters.pageSize;
    return this.filteredItems.slice(startIndex, startIndex + this.filters.pageSize);
  });

  totalPages = $derived.by(() => {
    return Math.max(1, Math.ceil(this.filteredItems.length / this.filters.pageSize));
  });

  allTags = $derived.by(() => {
    const tagSet = new Set<string>();
    for (const sub of this.items) {
      for (const tag of sub.tags) {
        tagSet.add(tag);
      }
    }
    return Array.from(tagSet).sort();
  });

  totalCount = $derived(this.items.length);
  activeCount = $derived(this.items.filter((s) => s.status === 'active').length);
  paidCount = $derived(this.items.filter((s) => s.status === 'active' && s.tier !== 'free').length);

  setFilter<K extends keyof SubscriberFilterOptions>(key: K, value: SubscriberFilterOptions[K]): void {
    this.filters[key] = value;
    if (key !== 'page') {
      this.filters.page = 1;
    }
  }

  addSubscriber(newSubscriber: Omit<Subscriber, 'id' | 'subscribedAt' | 'updatedAt' | 'metrics'>): void {
    const now = new Date().toISOString();
    const created: Subscriber = {
      ...newSubscriber,
      id: generateUuid(),
      subscribedAt: now,
      updatedAt: now,
      metrics: {
        emailsReceivedCount: 0,
        emailsOpenedCount: 0,
        linksClickedCount: 0,
        lastOpenedAt: null,
        openRatePercent: 0,
        clickRatePercent: 0
      }
    };
    this.items = [created, ...this.items];
    saveSubscribers(this.items);
  }

  addBatch(newSubscribers: Subscriber[]): void {
    this.items = [...newSubscribers, ...this.items];
    saveSubscribers(this.items);
  }

  updateSubscriber(id: string, patch: Partial<Subscriber>): void {
    const now = new Date().toISOString();
    this.items = this.items.map((sub) => {
      if (sub.id !== id) return sub;
      return {
        ...sub,
        ...patch,
        updatedAt: now
      };
    });
    saveSubscribers(this.items);
  }

  deleteSubscriber(id: string): void {
    this.items = this.items.filter((s) => s.id !== id);
    saveSubscribers(this.items);
  }

  bulkUpdateStatus(ids: string[], newStatus: SubscriberStatus): void {
    const idSet = new Set(ids);
    const now = new Date().toISOString();
    this.items = this.items.map((sub) => {
      if (!idSet.has(sub.id)) return sub;
      if (sub.status === 'bounced' && newStatus === 'active') {
        return sub; // Prevent invalid bounce-to-active regression
      }
      return {
        ...sub,
        status: newStatus,
        updatedAt: now
      };
    });
    saveSubscribers(this.items);
  }

  bulkDelete(ids: string[]): void {
    const idSet = new Set(ids);
    this.items = this.items.filter((s) => !idSet.has(s.id));
    saveSubscribers(this.items);
  }
}

let subscriberStoreInstance: SubscriberStore | null = null;

export function getSubscriberState(): SubscriberStore {
  if (typeof window === 'undefined') {
    return new SubscriberStore();
  }
  if (!subscriberStoreInstance) {
    subscriberStoreInstance = new SubscriberStore();
  }
  return subscriberStoreInstance;
}

/**
 * Backwards-compatible shim for existing page imports.
 *
 * NOTE: Svelte 5 fine-grained reactivity ($state/$derived) cannot be statically tracked
 * by the compiler through a dynamic Proxy object. Components must instantiate state via
 * `getSubscriberState()` inside component script scopes rather than reading this export directly.
 *
 * The set trap uses an unchecked cast for shim compatibility and is not type-enforced at compile time.
 * @deprecated Use `getSubscriberState()` directly in .svelte components.
 */
export const subscriberState = new Proxy({} as SubscriberStore, {
  get(_, prop: keyof SubscriberStore) {
    const instance = getSubscriberState();
    const value = instance[prop];
    return typeof value === 'function' ? value.bind(instance) : value;
  },
  set(_, prop: keyof SubscriberStore, val) {
    const instance = getSubscriberState();
    (instance as unknown as Record<keyof SubscriberStore, unknown>)[prop] = val;
    return true;
  }
});
```

### 6.2. Issue Store (`src/lib/state/issue.svelte.ts`)
```typescript
import type { NewsletterIssue } from '$lib/types/newsletter';
import { loadIssues, saveIssues } from '$lib/storage/local-storage-client';
import { renderEditorialMarkdown } from '$lib/utils/markdown-renderer';
import { generateUuid } from '$lib/utils/uuid';

export class IssueStore {
  items = $state<NewsletterIssue[]>(loadIssues());
  currentEditorIssue = $state<NewsletterIssue | null>(null);

  getIssueById(id: string): NewsletterIssue | undefined {
    return this.items.find((item) => item.id === id);
  }

  getIssueBySlug(slug: string): NewsletterIssue | undefined {
    return this.items.find((item) => item.slug === slug);
  }

  createDraft(): NewsletterIssue {
    const now = new Date().toISOString();
    const entropy = Math.random().toString(36).substring(2, 7);
    const uniqueSlug = `dispatch-${Date.now()}-${entropy}`;

    const newIssue: NewsletterIssue = {
      id: generateUuid(),
      slug: uniqueSlug,
      title: 'Untitled Dispatch',
      subtitle: '',
      excerpt: '',
      contentMarkdown: '# Untitled Dispatch\n\nBegin writing your editorial here...',
      contentHtml: '',
      coverImageUrl: null,
      authorName: 'Publication Editor',
      authorAvatarUrl: null,
      status: 'draft',
      audience: 'all',
      tags: [],
      scheduledAt: null,
      publishedAt: null,
      createdAt: now,
      updatedAt: now,
      stats: {
        totalRecipients: 0,
        deliveredCount: 0,
        openedCount: 0,
        clickedCount: 0,
        bouncedCount: 0,
        unsubscribedCount: 0,
        deliveryCompletedAt: null
      }
    };
    newIssue.contentHtml = renderEditorialMarkdown(newIssue.contentMarkdown);
    this.items = [newIssue, ...this.items];
    saveIssues(this.items);
    return newIssue;
  }

  updateIssue(id: string, updates: Partial<NewsletterIssue>): void {
    const now = new Date().toISOString();
    this.items = this.items.map((issue) => {
      if (issue.id !== id) return issue;
      const merged = { ...issue, ...updates, updatedAt: now };
      if (updates.contentMarkdown !== undefined) {
        merged.contentHtml = renderEditorialMarkdown(merged.contentMarkdown);
      }
      return merged;
    });
    saveIssues(this.items);

    if (this.currentEditorIssue?.id === id) {
      this.currentEditorIssue = this.getIssueById(id) || null;
    }
  }

  deleteIssue(id: string): void {
    this.items = this.items.filter((item) => item.id !== id);
    saveIssues(this.items);
    if (this.currentEditorIssue?.id === id) {
      this.currentEditorIssue = null;
    }
  }

  markAsSent(
    id: string,
    totalRecipients: number,
    delivered: number,
    bounced: number,
    openedCount: number = 0,
    clickedCount: number = 0
  ): void {
    const now = new Date().toISOString();
    this.updateIssue(id, {
      status: 'sent',
      publishedAt: now,
      stats: {
        totalRecipients,
        deliveredCount: delivered,
        openedCount,
        clickedCount,
        bouncedCount: bounced,
        unsubscribedCount: 0,
        deliveryCompletedAt: now
      }
    });
  }
}

let issueStoreInstance: IssueStore | null = null;

export function getIssueState(): IssueStore {
  if (typeof window === 'undefined') {
    return new IssueStore();
  }
  if (!issueStoreInstance) {
    issueStoreInstance = new IssueStore();
  }
  return issueStoreInstance;
}

/**
 * Backwards-compatible shim for existing page imports.
 *
 * NOTE: Svelte 5 fine-grained reactivity ($state/$derived) cannot be statically tracked
 * by the compiler through a dynamic Proxy object. Components must instantiate state via
 * `getIssueState()` inside component script scopes rather than reading this export directly.
 *
 * The set trap uses an unchecked cast for shim compatibility and is not type-enforced at compile time.
 * @deprecated Use `getIssueState()` directly in .svelte components.
 */
export const issueState = new Proxy({} as IssueStore, {
  get(_, prop: keyof IssueStore) {
    const instance = getIssueState();
    const value = instance[prop];
    return typeof value === 'function' ? value.bind(instance) : value;
  },
  set(_, prop: keyof IssueStore, val) {
    const instance = getIssueState();
    (instance as unknown as Record<keyof IssueStore, unknown>)[prop] = val;
    return true;
  }
});
```

### 6.3. Queue Manager & Dispatch Engine (`src/lib/state/queue.svelte.ts`)
```typescript
import type { DeliveryJobLog, NewsletterIssue, Subscriber, DistributionResult } from '$lib/types/newsletter';
import { generateUuid } from '$lib/utils/uuid';

export class DeliveryQueueManager {
  jobs = $state<DeliveryJobLog[]>([]);
  isProcessing = $state<boolean>(false);
  processedCount = $state<number>(0);
  totalQueueCount = $state<number>(0);
  currentIssueId = $state<string | null>(null);
  private abortController: AbortController | null = null;

  get progressPercent(): number {
    if (this.totalQueueCount === 0) return 0;
    return Math.floor((this.processedCount / this.totalQueueCount) * 100);
  }

  enqueueIssue(issue: NewsletterIssue, targetSubscribers: Subscriber[]): void {
    if (this.isProcessing) {
      throw new Error('A delivery distribution job is currently running.');
    }

    const now = new Date().toISOString();
    this.currentIssueId = issue.id;
    this.processedCount = 0;
    this.jobs = targetSubscribers.map((sub) => ({
      id: generateUuid(),
      issueId: issue.id,
      subscriberId: sub.id,
      subscriberEmail: sub.email,
      status: 'queued',
      attemptCount: 0,
      errorMessage: null,
      queuedAt: now,
      processedAt: null,
      openedAt: null,
      clickedAt: null
    }));
    this.totalQueueCount = this.jobs.length;
  }

  cancelDistribution(): void {
    if (this.abortController && this.isProcessing) {
      this.abortController.abort();
    }
  }

  async runDistribution(
    batchSize = 25,
    onJobProcessed?: (job: DeliveryJobLog) => void
  ): Promise<DistributionResult> {
    this.isProcessing = true;
    this.abortController = new AbortController();
    const signal = this.abortController.signal;

    let delivered = 0;
    let bounced = 0;
    let opened = 0;
    let clicked = 0;
    let cancelled = false;

    for (let i = 0; i < this.jobs.length; i += batchSize) {
      if (signal.aborted) {
        cancelled = true;
        break;
      }

      const batch = this.jobs.slice(i, i + batchSize);

      await Promise.all(
        batch.map(async (job) => {
          if (signal.aborted) return;

          job.status = 'in_transit';
          job.attemptCount += 1;

          await new Promise((resolve) => setTimeout(resolve, 80 + Math.random() * 120));
          if (signal.aborted) return;

          const isBounce = Math.random() < 0.03;
          const processedTime = new Date().toISOString();
          job.processedAt = processedTime;

          if (isBounce) {
            job.status = 'bounced';
            job.errorMessage = 'Mailbox unavailable or invalid destination.';
            bounced++;
          } else {
            job.status = 'delivered';
            delivered++;

            const isOpened = Math.random() < 0.48;
            if (isOpened) {
              job.openedAt = new Date(Date.now() + 500).toISOString();
              opened++;
              const isClicked = Math.random() < 0.22;
              if (isClicked) {
                job.clickedAt = new Date(Date.now() + 1000).toISOString();
                clicked++;
              }
            }
          }

          this.processedCount += 1;
          if (onJobProcessed) {
            onJobProcessed(job);
          }
        })
      );
    }

    this.isProcessing = false;
    this.abortController = null;
    return { delivered, bounced, opened, clicked, cancelled };
  }

  reset(): void {
    if (this.isProcessing) {
      this.cancelDistribution();
    }
    this.jobs = [];
    this.isProcessing = false;
    this.processedCount = 0;
    this.totalQueueCount = 0;
    this.currentIssueId = null;
  }
}

let queueInstance: DeliveryQueueManager | null = null;

export function getDeliveryQueue(): DeliveryQueueManager {
  if (typeof window === 'undefined') {
    return new DeliveryQueueManager();
  }
  if (!queueInstance) {
    queueInstance = new DeliveryQueueManager();
  }
  return queueInstance;
}

/**
 * Backwards-compatible shim for existing page imports.
 *
 * NOTE: Svelte 5 fine-grained reactivity ($state/$derived) cannot be statically tracked
 * by the compiler through a dynamic Proxy object. Components must instantiate state via
 * `getDeliveryQueue()` inside component script scopes rather than reading this export directly.
 *
 * The set trap uses an unchecked cast for shim compatibility and is not type-enforced at compile time.
 * @deprecated Use `getDeliveryQueue()` directly in .svelte components.
 */
export const deliveryQueue = new Proxy({} as DeliveryQueueManager, {
  get(_, prop: keyof DeliveryQueueManager) {
    const instance = getDeliveryQueue();
    const value = instance[prop];
    return typeof value === 'function' ? value.bind(instance) : value;
  },
  set(_, prop: keyof DeliveryQueueManager, val) {
    const instance = getDeliveryQueue();
    (instance as unknown as Record<keyof DeliveryQueueManager, unknown>)[prop] = val;
    return true;
  }
});
```

---

## 7. Atomic Primitives & UI Foundation

### 7.1. Button Primitive (`src/lib/components/ui/Button.svelte`)
```svelte
<script lang="ts">
  import type { Snippet } from 'svelte';

  interface ButtonProps {
    variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
    size?: 'sm' | 'md' | 'lg';
    type?: 'button' | 'submit' | 'reset';
    disabled?: boolean;
    loading?: boolean;
    onclick?: (event: MouseEvent) => void;
    children?: Snippet;
    class?: string;
  }

  let {
    variant = 'primary',
    size = 'md',
    type = 'button',
    disabled = false,
    loading = false,
    onclick,
    children,
    class: customClass = ''
  }: ButtonProps = $props();

  const baseStyles = 'inline-flex items-center justify-center font-medium transition-colors select-none focus:outline-none focus:ring-2 focus:ring-stone-900 focus:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation cursor-pointer';

  const sizeStyles = {
    sm: 'text-xs px-2.5 py-1.5 min-h-[36px] rounded',
    md: 'text-sm px-4 py-2 min-h-[44px] rounded-md',
    lg: 'text-base px-6 py-3 min-h-[48px] rounded-md font-semibold'
  };

  const variantStyles = {
    primary: 'bg-stone-900 text-stone-50 hover:bg-stone-800 active:bg-black',
    secondary: 'bg-stone-100 text-stone-900 hover:bg-stone-200 active:bg-stone-300',
    outline: 'border border-stone-300 text-stone-900 bg-transparent hover:bg-stone-100 active:bg-stone-200',
    ghost: 'text-stone-700 bg-transparent hover:bg-stone-100 hover:text-stone-900 active:bg-stone-200',
    danger: 'bg-red-700 text-white hover:bg-red-800 active:bg-red-900'
  };
</script>

<button
  {type}
  disabled={disabled || loading}
  {onclick}
  class="{baseStyles} {sizeStyles[size]} {variantStyles[variant]} {customClass}"
>
  {#if loading}
    <svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-current" fill="none" viewBox="0 0 24 24">
      <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
      <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
    </svg>
  {/if}
  {#if children}
    {@render children()}
  {/if}
</button>
```

### 7.2. Badge Primitive (`src/lib/components/ui/Badge.svelte`)
```svelte
<script lang="ts">
  import type { Snippet } from 'svelte';

  interface BadgeProps {
    variant?: 'neutral' | 'success' | 'warning' | 'error' | 'outline';
    size?: 'sm' | 'md' | 'touch';
    interactive?: boolean;
    onclick?: () => void;
    children?: Snippet;
    class?: string;
  }

  let {
    variant = 'neutral',
    size = 'sm',
    interactive = false,
    onclick,
    children,
    class: customClass = ''
  }: BadgeProps = $props();

  const variantStyles = {
    neutral: 'bg-stone-100 text-stone-800 border-stone-200',
    success: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    warning: 'bg-amber-50 text-amber-800 border-amber-200',
    error: 'bg-rose-50 text-rose-800 border-rose-200',
    outline: 'bg-transparent text-stone-700 border-stone-300'
  };

  const sizeStyles = {
    sm: 'text-[11px] px-2 py-0.5 leading-tight',
    md: 'text-xs px-2.5 py-1 leading-normal',
    touch: 'text-xs px-3 min-h-[44px] min-w-[44px] leading-normal'
  };
</script>

{#if interactive}
  <button
    type="button"
    {onclick}
    class="inline-flex items-center justify-center font-medium border rounded-full font-mono uppercase tracking-wider transition-colors hover:bg-stone-200 active:bg-stone-300 cursor-pointer {sizeStyles[size]} {variantStyles[variant]} {customClass}"
  >
    {#if children}
      {@render children()}
    {/if}
  </button>
{:else}
  <span
    class="inline-flex items-center font-medium border rounded-full font-mono uppercase tracking-wider {sizeStyles[size]} {variantStyles[variant]} {customClass}"
  >
    {#if children}
      {@render children()}
    {/if}
  </span>
{/if}
```

### 7.3. Modal Primitive (`src/lib/components/ui/Modal.svelte`)
```svelte
<script lang="ts">
  import type { Snippet } from 'svelte';

  interface ModalProps {
    isOpen?: boolean;
    title: string;
    onclose: () => void;
    children?: Snippet;
    footer?: Snippet;
  }

  let { isOpen = $bindable(false), title, onclose, children, footer }: ModalProps = $props();

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape' && isOpen) {
      onclose();
    }
  }

  $effect(() => {
    if (typeof document === 'undefined') return;
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = '';
      };
    }
  });
</script>

<svelte:window onkeydown={handleKeydown} />

{#if isOpen}
  <div
    class="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-6 md:p-10 h-[100dvh]"
    role="dialog"
    aria-modal="true"
    aria-labelledby="modal-title"
  >
    <div
      class="fixed inset-0 bg-stone-900/40 backdrop-blur-sm transition-opacity"
      tabindex="-1"
      onclick={onclose}
      onkeydown={(e) => e.key === 'Enter' && onclose()}
      role="button"
      aria-label="Close backdrop"
    ></div>

    <div
      class="relative z-10 w-full max-w-xl max-h-[85dvh] sm:max-h-[90dvh] flex flex-col bg-white rounded-t-xl sm:rounded-lg shadow-xl border border-stone-200 overflow-hidden"
    >
      <div class="flex items-center justify-between px-6 py-4 border-b border-stone-200">
        <h2 id="modal-title" class="text-lg font-serif font-bold text-stone-900 tracking-tight">
          {title}
        </h2>
        <button
          type="button"
          class="p-2 -mr-2 text-stone-400 hover:text-stone-700 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full hover:bg-stone-100 transition-colors"
          onclick={onclose}
          aria-label="Close dialog"
        >
          <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div class="px-6 py-4 overflow-y-auto flex-1 text-stone-700 text-sm overscroll-contain">
        {#if children}
          {@render children()}
        {/if}
      </div>

      {#if footer}
        <div class="px-6 py-3 bg-stone-50 border-t border-stone-200 flex items-center justify-end gap-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          {@render footer()}
        </div>
      {/if}
    </div>
  </div>
{/if}
```

---

## 8. Compound Feature Components

### 8.1. Admin Navigation Sidebar (`src/lib/components/panel/AdminSidebar.svelte`)
```svelte
<script lang="ts">
  import { page } from '$app/stores';

  interface Props {
    isMobileOpen: boolean;
    onclose: () => void;
  }

  let { isMobileOpen = false, onclose }: Props = $props();

  const navigation = [
    { name: 'Dashboard', href: '/admin' },
    { name: 'Subscribers', href: '/admin/subscribers' },
    { name: 'Issues', href: '/admin/issues' }
  ];

  $effect(() => {
    if (typeof document === 'undefined') return;
    if (isMobileOpen) {
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = '';
      };
    }
  });
</script>

{#if isMobileOpen}
  <div
    class="fixed inset-0 z-40 bg-stone-900/40 backdrop-blur-sm lg:hidden transition-opacity"
    tabindex="-1"
    role="button"
    aria-label="Close menu"
    onclick={onclose}
    onkeydown={(e) => e.key === 'Escape' && onclose()}
  ></div>
{/if}

<aside
  class="fixed top-0 bottom-0 left-0 z-50 w-64 bg-stone-50 border-r border-stone-200 transition-transform duration-200 ease-in-out lg:translate-x-0 lg:static lg:z-auto flex flex-col justify-between {isMobileOpen ? 'translate-x-0' : '-translate-x-full'}"
>
  <div>
    <div class="h-16 flex items-center justify-between px-6 border-b border-stone-200">
      <span class="font-serif font-bold text-stone-900 text-lg tracking-tight">Publisher Studio</span>
      <button
        type="button"
        class="lg:hidden p-2 text-stone-500 hover:text-stone-900 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-md"
        onclick={onclose}
        aria-label="Close navigation"
      >
        <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>

    <nav class="p-4 space-y-1">
      {#each navigation as item}
        {@const isActive = $page.url.pathname === item.href}
        <a
          href={item.href}
          onclick={onclose}
          class="flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors min-h-[44px] {isActive ? 'bg-stone-200 text-stone-900 font-semibold' : 'text-stone-600 hover:bg-stone-100 hover:text-stone-900'}"
        >
          {item.name}
        </a>
      {/each}
    </nav>
  </div>

  <div class="p-4 border-t border-stone-200">
    <a
      href="/"
      target="_blank"
      class="flex items-center justify-center w-full px-4 py-2 text-xs font-mono border border-stone-300 rounded text-stone-700 hover:bg-stone-100 transition-colors min-h-[44px]"
    >
      View Public Archive
    </a>
  </div>
</aside>
```

### 8.2. Dual-Mode Subscriber Table (`src/lib/components/panel/SubscriberTable.svelte`)
```svelte
<script lang="ts">
  import type { Subscriber } from '$lib/types/newsletter';
  import Badge from '$lib/components/ui/Badge.svelte';
  import Button from '$lib/components/ui/Button.svelte';

  interface Props {
    subscribers: Subscriber[];
    selectedIds: string[];
    ontoggleSelect: (id: string) => void;
    onedit: (subscriber: Subscriber) => void;
    ondelete: (id: string) => void;
  }

  let { subscribers, selectedIds, ontoggleSelect, onedit, ondelete }: Props = $props();

  function statusVariant(status: Subscriber['status']): 'success' | 'error' | 'neutral' | 'warning' {
    switch (status) {
      case 'active':
        return 'success';
      case 'bounced':
        return 'error';
      case 'unsubscribed':
        return 'neutral';
      default:
        return 'warning';
    }
  }
</script>

<!-- Mobile Card View (< 640px) -->
<div class="block sm:hidden divide-y divide-stone-200">
  {#each subscribers as sub (sub.id)}
    <div class="p-4 bg-white space-y-3">
      <div class="flex items-start justify-between gap-3">
        <label class="flex items-center gap-2 cursor-pointer">
          <!-- Deliberate: h-5 w-5 on mobile ensures accessible touch target alongside text label -->
          <input
            type="checkbox"
            checked={selectedIds.includes(sub.id)}
            onchange={() => ontoggleSelect(sub.id)}
            class="h-5 w-5 rounded border-stone-300 text-stone-900 focus:ring-stone-900"
          />
          <div class="font-medium text-stone-900 text-sm break-all">
            {sub.email}
          </div>
        </label>
        <Badge variant={statusVariant(sub.status)} size="sm">{sub.status}</Badge>
      </div>

      {#if sub.firstName || sub.lastName}
        <div class="text-xs text-stone-600 pl-7">
          {sub.firstName} {sub.lastName}
        </div>
      {/if}

      <div class="flex items-center justify-between text-xs text-stone-500 pl-7 pt-1">
        <span>Tier: <strong class="text-stone-800 uppercase">{sub.tier}</strong></span>
        <span>Open Rate: {sub.metrics.openRatePercent.toFixed(1)}%</span>
      </div>

      <div class="flex items-center gap-2 pt-2 border-t border-stone-100 justify-end">
        <Button variant="outline" size="sm" onclick={() => onedit(sub)}>Edit</Button>
        <Button variant="ghost" size="sm" class="text-red-700" onclick={() => ondelete(sub.id)}>Delete</Button>
      </div>
    </div>
  {/each}
</div>

<!-- Desktop Table View (>= 640px) -->
<div class="hidden sm:block overflow-x-auto border-t border-stone-200">
  <table class="w-full text-left text-sm text-stone-700">
    <thead class="bg-stone-50 text-xs uppercase text-stone-500 font-mono border-b border-stone-200">
      <tr>
        <th class="p-4 w-10">
          <span class="sr-only">Select</span>
        </th>
        <th class="p-4">Subscriber</th>
        <th class="p-4">Status</th>
        <th class="p-4">Tier</th>
        <th class="p-4">Open Rate</th>
        <th class="p-4 text-right">Actions</th>
      </tr>
    </thead>
    <tbody class="divide-y divide-stone-200 bg-white">
      {#each subscribers as sub (sub.id)}
        <tr class="hover:bg-stone-50/50 transition-colors">
          <td class="p-4">
            <!-- Deliberate: h-4 w-4 on desktop preserves compact table row density -->
            <input
              type="checkbox"
              checked={selectedIds.includes(sub.id)}
              onchange={() => ontoggleSelect(sub.id)}
              class="h-4 w-4 rounded border-stone-300 text-stone-900 focus:ring-stone-900"
            />
          </td>
          <td class="p-4">
            <div class="font-medium text-stone-900">{sub.email}</div>
            {#if sub.firstName || sub.lastName}
              <div class="text-xs text-stone-500">{sub.firstName} {sub.lastName}</div>
            {/if}
          </td>
          <td class="p-4">
            <Badge variant={statusVariant(sub.status)} size="sm">{sub.status}</Badge>
          </td>
          <td class="p-4 uppercase text-xs font-mono">{sub.tier}</td>
          <td class="p-4 font-mono text-xs">{sub.metrics.openRatePercent.toFixed(1)}%</td>
          <td class="p-4 text-right space-x-2">
            <button
              type="button"
              class="text-xs font-medium text-stone-600 hover:text-stone-900 min-h-[44px] min-w-[44px] px-2 cursor-pointer"
              onclick={() => onedit(sub)}
            >
              Edit
            </button>
            <button
              type="button"
              class="text-xs font-medium text-rose-600 hover:text-rose-900 min-h-[44px] min-w-[44px] px-2 cursor-pointer"
              onclick={() => ondelete(sub.id)}
            >
              Delete
            </button>
          </td>
        </tr>
      {/each}
    </tbody>
  </table>
</div>
```

### 8.3. Metric Telemetry Card (`src/lib/components/panel/MetricCard.svelte`)
```svelte
<script lang="ts">
  interface Props {
    title: string;
    value: string;
    subtitle?: string;
  }

  let { title, value, subtitle }: Props = $props();
</script>

<div class="bg-white border border-stone-200 p-5 rounded-lg shadow-sm">
  <div class="text-xs uppercase font-mono tracking-wider text-stone-500">{title}</div>
  <div class="text-3xl font-serif font-bold text-stone-900 mt-2 tracking-tight">{value}</div>
  {#if subtitle}
    <div class="text-xs text-stone-500 mt-1 font-mono">{subtitle}</div>
  {/if}
</div>
```

### 8.4. Delivery Queue Modal & Dispatch Wire (`src/lib/components/panel/IssueDeliveryQueueModal.svelte`)
```svelte
<script lang="ts">
  import Modal from '$lib/components/ui/Modal.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import { getDeliveryQueue } from '$lib/state/queue.svelte';
  import { getIssueState } from '$lib/state/issue.svelte';
  import { getSubscriberState } from '$lib/state/subscriber.svelte';
  import type { NewsletterIssue } from '$lib/types/newsletter';

  interface Props {
    isOpen: boolean;
    issue: NewsletterIssue;
    onclose: () => void;
  }

  let { isOpen = $bindable(false), issue, onclose }: Props = $props();

  const queue = getDeliveryQueue();
  const issueStore = getIssueState();
  const subscriberStore = getSubscriberState();

  let hasStarted = $state(false);
  let isFinished = $state(false);
  let summary = $state({ delivered: 0, bounced: 0, opened: 0, clicked: 0, cancelled: false });

  const targetRecipients = $derived(
    subscriberStore.items.filter((sub) => {
      if (sub.status !== 'active') return false;
      if (issue.audience === 'free_only') return sub.tier === 'free';
      if (issue.audience === 'paid_only') return sub.tier === 'paid';
      if (issue.audience === 'founding_only') return sub.tier === 'founding';
      return true;
    })
  );

  async function startDispatch() {
    hasStarted = true;
    queue.enqueueIssue(issue, targetRecipients);

    const result = await queue.runDistribution(20);
    summary = result;
    isFinished = true;

    // Full reconciliation of delivery stats including opened and clicked counts
    issueStore.markAsSent(
      issue.id,
      targetRecipients.length,
      result.delivered,
      result.bounced,
      result.opened,
      result.clicked
    );
  }

  function handleCancel() {
    queue.cancelDistribution();
  }

  function handleComplete() {
    queue.reset();
    hasStarted = false;
    isFinished = false;
    onclose();
  }
</script>

<Modal {isOpen} title="Dispatch Newsletter" {onclose}>
  <div class="space-y-4">
    <div class="border-b border-stone-200 pb-3">
      <h3 class="font-serif font-bold text-stone-900 text-base">{issue.title}</h3>
      <p class="text-xs text-stone-500 font-mono mt-1">
        Audience: {issue.audience} | Target Recipients: {targetRecipients.length} active subscribers
      </p>
    </div>

    {#if !hasStarted}
      <p class="text-stone-700 text-sm leading-relaxed">
        You are about to distribute this issue to <strong>{targetRecipients.length}</strong> recipients. 
        Once initiated, messages are processed in asynchronous batches with delivery logging.
      </p>
    {:else}
      <div class="space-y-3">
        <div class="flex items-center justify-between text-xs font-mono text-stone-600">
          <span>Progress: {queue.progressPercent}%</span>
          <span>{queue.processedCount} / {queue.totalQueueCount}</span>
        </div>

        <div class="w-full bg-stone-100 rounded-full h-3 overflow-hidden border border-stone-200">
          <div
            class="bg-stone-900 h-full transition-all duration-150 ease-out"
            style="width: {queue.progressPercent}%"
          ></div>
        </div>

        {#if isFinished}
          <div class="bg-stone-50 border border-stone-200 rounded p-3 text-xs space-y-1 font-mono text-stone-700">
            <div>Status: {summary.cancelled ? 'Distribution Halted' : 'Distribution Completed'}</div>
            <div>Delivered: {summary.delivered}</div>
            <div>Bounced: {summary.bounced}</div>
            <div>Simulated Opens: {summary.opened}</div>
            <div>Simulated Clicks: {summary.clicked}</div>
          </div>
        {/if}
      </div>
    {/if}
  </div>

  {#snippet footer()}
    {#if !hasStarted}
      <Button variant="outline" size="sm" onclick={onclose}>Cancel</Button>
      <Button variant="primary" size="sm" onclick={startDispatch} disabled={targetRecipients.length === 0}>
        Confirm & Send
      </Button>
    {:else if !isFinished}
      <Button variant="danger" size="sm" onclick={handleCancel}>Halt Distribution</Button>
    {:else}
      <Button variant="primary" size="sm" onclick={handleComplete}>Done</Button>
    {/if}
  {/snippet}
</Modal>
```

---

## 9. Page Routes & Responsive Shells

### 9.1. Root Layout (`src/routes/+layout.svelte`)
```svelte
<script lang="ts">
  import '../app.css';
  import type { Snippet } from 'svelte';

  interface LayoutProps {
    children?: Snippet;
  }

  let { children }: LayoutProps = $props();
</script>

<svelte:head>
  <title>Newsletter Distribution & Subscriber Panel</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0" />
</svelte:head>

<div class="min-h-screen bg-[#fcfbf9] text-stone-900 selection:bg-stone-900 selection:text-white flex flex-col font-sans antialiased">
  {#if children}
    {@render children()}
  {/if}
</div>
```

### 9.2. Admin Dashboard Overview (`src/routes/admin/+page.svelte`)
```svelte
<script lang="ts">
  import { getSubscriberState } from '$lib/state/subscriber.svelte';
  import { getIssueState } from '$lib/state/issue.svelte';
  import MetricCard from '$lib/components/panel/MetricCard.svelte';
  import AdminSidebar from '$lib/components/panel/AdminSidebar.svelte';

  const subscriberStore = getSubscriberState();
  const issueStore = getIssueState();

  let isMobileNavOpen = $state(false);

  const activeSubscribersCount = $derived(subscriberStore.activeCount);
  const paidSubscribersCount = $derived(subscriberStore.paidCount);
  const totalIssuesCount = $derived(issueStore.items.filter((i) => i.status === 'sent').length);

  const averageOpenRate = $derived.by(() => {
    const sentIssues = issueStore.items.filter((i) => i.status === 'sent');
    if (sentIssues.length === 0) return 0;

    // Issue-weighted open rate: issues with 0 deliveries explicitly contribute 0.0%
    const totalIssueRates = sentIssues.reduce((acc, issue) => {
      const issueRate = issue.stats.deliveredCount > 0
        ? (issue.stats.openedCount / issue.stats.deliveredCount) * 100
        : 0;
      return acc + issueRate;
    }, 0);

    return totalIssueRates / sentIssues.length;
  });
</script>

<div class="flex h-screen bg-[#fcfbf9] overflow-hidden">
  <AdminSidebar isMobileOpen={isMobileNavOpen} onclose={() => (isMobileNavOpen = false)} />

  <div class="flex-1 flex flex-col min-w-0 overflow-hidden">
    <header class="h-16 flex items-center justify-between px-6 border-b border-stone-200 bg-white lg:hidden">
      <button
        type="button"
        class="p-2 -ml-2 text-stone-600 hover:text-stone-900 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-md"
        onclick={() => (isMobileNavOpen = true)}
        aria-label="Open navigation"
      >
        <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>
      <span class="font-serif font-bold text-stone-900">Dashboard</span>
      <div class="w-8"></div>
    </header>

    <main class="flex-1 overflow-y-auto p-6 md:p-8 pb-24 sm:pb-12">
      <div class="max-w-6xl mx-auto space-y-8">
        <div>
          <h1 class="text-2xl md:text-3xl font-serif font-bold text-stone-900 tracking-tight">Overview</h1>
          <p class="text-sm text-stone-500 mt-1">Key distribution and audience metrics.</p>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard title="Active Audience" value={activeSubscribersCount.toString()} subtitle="Total active subscribers" />
          <MetricCard title="Paid Members" value={paidSubscribersCount.toString()} subtitle="Tier subscribers" />
          <MetricCard title="Avg Open Rate" value="{averageOpenRate.toFixed(1)}%" subtitle="Across dispatched issues" />
          <MetricCard title="Published Issues" value={totalIssuesCount.toString()} subtitle="Lifetime newsletters sent" />
        </div>
      </div>
    </main>
  </div>
</div>
```

### 9.3. Subscribers Directory Screen (`src/routes/admin/subscribers/+page.svelte`)
```svelte
<script lang="ts">
  import { getSubscriberState } from '$lib/state/subscriber.svelte';
  import AdminSidebar from '$lib/components/panel/AdminSidebar.svelte';
  import SubscriberTable from '$lib/components/panel/SubscriberTable.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import Modal from '$lib/components/ui/Modal.svelte';
  import Input from '$lib/components/ui/Input.svelte';
  import { parseSubscribersCsv } from '$lib/utils/csv-parser';
  import type { Subscriber } from '$lib/types/newsletter';

  const subscriberStore = getSubscriberState();

  let isMobileNavOpen = $state(false);
  let selectedIds = $state<string[]>([]);
  let isAddModalOpen = $state(false);
  let isImportModalOpen = $state(false);

  // Form states
  let newEmail = $state('');
  let newFirstName = $state('');
  let newLastName = $state('');
  let newTier = $state<Subscriber['tier']>('free');

  // CSV Import State
  let csvText = $state('');
  let csvError = $state<string | null>(null);

  function toggleSelect(id: string) {
    if (selectedIds.includes(id)) {
      selectedIds = selectedIds.filter((item) => item !== id);
    } else {
      selectedIds = [...selectedIds, id];
    }
  }

  function handleCreateSubscriber() {
    if (!newEmail.trim()) return;
    subscriberStore.addSubscriber({
      email: newEmail.trim().toLowerCase(),
      firstName: newFirstName.trim(),
      lastName: newLastName.trim(),
      status: 'active',
      tier: newTier,
      tags: ['manual-entry'],
      notes: ''
    });
    newEmail = '';
    newFirstName = '';
    newLastName = '';
    isAddModalOpen = false;
  }

  function handleCsvImport() {
    csvError = null;
    const existing = new Set(subscriberStore.items.map((s) => s.email.toLowerCase()));
    const { imported, summary } = parseSubscribersCsv(csvText, existing);

    if (summary.errors.length > 0 && imported.length === 0) {
      csvError = summary.errors.map((e) => `Row ${e.row}: ${e.reason}`).join('; ');
      return;
    }

    subscriberStore.addBatch(imported);
    csvText = '';
    isImportModalOpen = false;
  }

  function handleDelete(id: string) {
    subscriberStore.deleteSubscriber(id);
    selectedIds = selectedIds.filter((item) => item !== id);
  }
</script>

<div class="flex h-screen bg-[#fcfbf9] overflow-hidden">
  <AdminSidebar isMobileOpen={isMobileNavOpen} onclose={() => (isMobileNavOpen = false)} />

  <div class="flex-1 flex flex-col min-w-0 overflow-hidden">
    <!-- Header -->
    <header class="h-16 flex items-center justify-between px-6 border-b border-stone-200 bg-white">
      <div class="flex items-center gap-3">
        <button
          type="button"
          class="lg:hidden p-2 -ml-2 text-stone-600 hover:text-stone-900 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-md"
          onclick={() => (isMobileNavOpen = true)}
          aria-label="Open navigation"
        >
          <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <h1 class="font-serif font-bold text-stone-900 text-lg">Subscribers ({subscriberStore.totalCount})</h1>
      </div>
      <div class="flex items-center gap-2">
        <Button variant="outline" size="sm" onclick={() => (isImportModalOpen = true)}>Import CSV</Button>
        <Button variant="primary" size="sm" onclick={() => (isAddModalOpen = true)}>Add Subscriber</Button>
      </div>
    </header>

    <!-- Main Table Area -->
    <main class="flex-1 overflow-y-auto p-4 sm:p-6 pb-24 sm:pb-12">
      <div class="max-w-6xl mx-auto space-y-4">
        <!-- Search and Filter Bar -->
        <div class="flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            placeholder="Search email, name or tag..."
            value={subscriberStore.filters.searchQuery}
            oninput={(e) => subscriberStore.setFilter('searchQuery', e.currentTarget.value)}
            class="flex-1 border border-stone-300 rounded px-3 py-2 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-stone-900 min-h-[44px]"
          />
        </div>

        <!-- Subscriber Table -->
        <div class="bg-white border border-stone-200 rounded-lg overflow-hidden shadow-sm">
          <SubscriberTable
            subscribers={subscriberStore.paginatedItems}
            {selectedIds}
            ontoggleSelect={toggleSelect}
            onedit={() => {}}
            ondelete={handleDelete}
          />
        </div>
      </div>
    </main>
  </div>
</div>

<!-- Add Subscriber Modal -->
<Modal isOpen={isAddModalOpen} title="Add New Subscriber" onclose={() => (isAddModalOpen = false)}>
  <div class="space-y-4">
    <div>
      <label for="sub-email" class="block text-xs font-mono uppercase text-stone-600 mb-1">Email</label>
      <input
        id="sub-email"
        type="email"
        bind:value={newEmail}
        placeholder="reader@example.com"
        class="w-full border border-stone-300 rounded px-3 py-2 text-sm min-h-[44px]"
      />
    </div>
    <div class="grid grid-cols-2 gap-3">
      <div>
        <label for="sub-fn" class="block text-xs font-mono uppercase text-stone-600 mb-1">First Name</label>
        <input
          id="sub-fn"
          type="text"
          bind:value={newFirstName}
          class="w-full border border-stone-300 rounded px-3 py-2 text-sm min-h-[44px]"
        />
      </div>
      <div>
        <label for="sub-ln" class="block text-xs font-mono uppercase text-stone-600 mb-1">Last Name</label>
        <input
          id="sub-ln"
          type="text"
          bind:value={newLastName}
          class="w-full border border-stone-300 rounded px-3 py-2 text-sm min-h-[44px]"
        />
      </div>
    </div>
  </div>
  {#snippet footer()}
    <Button variant="outline" size="sm" onclick={() => (isAddModalOpen = false)}>Cancel</Button>
    <Button variant="primary" size="sm" onclick={handleCreateSubscriber}>Save Subscriber</Button>
  {/snippet}
</Modal>

<!-- Import CSV Modal -->
<Modal isOpen={isImportModalOpen} title="Import Subscribers from CSV" onclose={() => (isImportModalOpen = false)}>
  <div class="space-y-4">
    <p class="text-xs text-stone-600">
      Paste standard RFC 4180 CSV with headers: <code>email,firstname,lastname,tags</code>
    </p>
    <textarea
      bind:value={csvText}
      rows="6"
      placeholder="email,firstname,lastname,tags&#10;sarah@example.com,Sarah,Connor,systems"
      class="w-full border border-stone-300 rounded p-3 text-xs font-mono"
    ></textarea>
    {#if csvError}
      <div class="p-2 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded">
        {csvError}
      </div>
    {/if}
  </div>
  {#snippet footer()}
    <Button variant="outline" size="sm" onclick={() => (isImportModalOpen = false)}>Cancel</Button>
    <Button variant="primary" size="sm" onclick={handleCsvImport} disabled={!csvText.trim()}>Execute Import</Button>
  {/snippet}
</Modal>
```

### 9.4. Issues Management Directory Screen (`src/routes/admin/issues/+page.svelte`)
```svelte
<script lang="ts">
  import { getIssueState } from '$lib/state/issue.svelte';
  import AdminSidebar from '$lib/components/panel/AdminSidebar.svelte';
  import Badge from '$lib/components/ui/Badge.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import IssueDeliveryQueueModal from '$lib/components/panel/IssueDeliveryQueueModal.svelte';
  import type { NewsletterIssue } from '$lib/types/newsletter';

  const issueStore = getIssueState();
  let isMobileNavOpen = $state(false);
  let activeDispatchIssue = $state<NewsletterIssue | null>(null);

  function createNewDraft() {
    const draft = issueStore.createDraft();
    window.location.href = `/admin/issues/${draft.id}`;
  }
</script>

<div class="flex h-screen bg-[#fcfbf9] overflow-hidden">
  <AdminSidebar isMobileOpen={isMobileNavOpen} onclose={() => (isMobileNavOpen = false)} />

  <div class="flex-1 flex flex-col min-w-0 overflow-hidden">
    <header class="h-16 flex items-center justify-between px-6 border-b border-stone-200 bg-white">
      <div class="flex items-center gap-3">
        <button
          type="button"
          class="lg:hidden p-2 -ml-2 text-stone-600 hover:text-stone-900 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-md"
          onclick={() => (isMobileNavOpen = true)}
          aria-label="Open navigation"
        >
          <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <h1 class="font-serif font-bold text-stone-900 text-lg">Newsletter Issues</h1>
      </div>
      <Button variant="primary" size="sm" onclick={createNewDraft}>New Dispatch</Button>
    </header>

    <main class="flex-1 overflow-y-auto p-6 md:p-8 pb-24 sm:pb-12">
      <div class="max-w-6xl mx-auto space-y-6">
        <div class="bg-white border border-stone-200 rounded-lg overflow-hidden shadow-sm divide-y divide-stone-200">
          {#each issueStore.items as item (item.id)}
            <div class="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div class="space-y-1">
                <div class="flex items-center gap-2">
                  <h2 class="font-serif font-bold text-stone-900 text-base">{item.title}</h2>
                  <Badge variant={item.status === 'sent' ? 'success' : 'neutral'} size="sm">{item.status}</Badge>
                </div>
                <p class="text-xs text-stone-500 font-mono">
                  Slug: {item.slug} | Created: {new Date(item.createdAt).toLocaleDateString()}
                </p>
                {#if item.status === 'sent'}
                  <p class="text-xs text-stone-600 font-mono">
                    Delivered: {item.stats.deliveredCount} | Opens: {item.stats.openedCount} | Clicks: {item.stats.clickedCount}
                  </p>
                {/if}
              </div>

              <div class="flex items-center gap-2">
                <a
                  href="/admin/issues/{item.id}"
                  class="inline-flex items-center justify-center border border-stone-300 rounded px-3 py-1.5 text-xs font-medium text-stone-800 hover:bg-stone-50 min-h-[44px]"
                >
                  Edit
                </a>
                {#if item.status !== 'sent'}
                  <Button variant="primary" size="sm" onclick={() => (activeDispatchIssue = item)}>
                    Send Issue
                  </Button>
                {/if}
              </div>
            </div>
          {/each}
        </div>
      </div>
    </main>
  </div>
</div>

{#if activeDispatchIssue}
  <IssueDeliveryQueueModal
    isOpen={true}
    issue={activeDispatchIssue}
    onclose={() => (activeDispatchIssue = null)}
  />
{/if}
```

---

## 10. Mobile-First Layout Validation & Target Matrices

| Viewport Width | Visual Shell Profile | Layout Strategy |
| :--- | :--- | :--- |
| **360px – 430px (Mobile Handsets)** | Single stacked column with zero horizontal overflow | - Navigation hidden behind off-canvas drawer with body scroll lock.<br>- Data rows converted into card list items (`SubscriberTable.svelte`).<br>- Touch checkbox targets expanded to `h-5 w-5` (min 44px hit-box alignment).<br>- All bottom page content padded with `pb-24` to avoid fixed action overlapping. |
| **768px (Tablet)** | 2-column adaptive layout | - Metrics arranged in 2x2 grid.<br>- Data tables reveal Email, Status, Tier, and Actions columns.<br>- Sheet modals center within visible viewport space. |
| **1024px+ (Desktop Workspace)** | Dual-column split layout | - Permanent left navigation bar (`w-64`).<br>- 4-column KPI telemetry summary.<br>- Full data density with `h-4 w-4` checkboxes and comprehensive statistical columns. |

---

## 11. 5-Phase Sequential Execution Queue

### Phase 1: Foundation, Types, and Deterministic Base Logic
- [x] Pure data contracts in `src/lib/types/newsletter.ts`.
- [x] SSR-safe UUID generator in `src/lib/utils/uuid.ts`.
- [x] Pure RFC 4180 CSV state-machine parser in `src/lib/utils/csv-parser.ts`.
- [x] XSS-sanitizing Markdown parser in `src/lib/utils/markdown-renderer.ts`.
- [x] Typed LocalStorage adapter in `src/lib/storage/local-storage-client.ts`.
- [x] Seed data fixtures in `src/lib/storage/seed-data.ts`.

### Phase 2: Design Tokens, Primitives, and Theme Construction
- [x] Configure Tailwind v4 `@theme` and vendor-prefixed blur utilities in `src/app.css`.
- [x] Implement accessible Button primitive with touch-friendly dimensions (`Button.svelte`).
- [x] Implement Badge component with both visual and interactive filter button branches (`Badge.svelte`).
- [x] Implement Sheet Modal with safe-area inset padding and body scroll locks (`Modal.svelte`).

### Phase 3: Domain Components & Dual-Mode Patterns
- [x] Build mobile-drawer-locking Admin Sidebar (`AdminSidebar.svelte`).
- [x] Build dual-mode Subscriber Table supporting card fallback on mobile and dense grid on desktop (`SubscriberTable.svelte`).
- [x] Build Metric Telemetry Card for publication stats (`MetricCard.svelte`).
- [x] Build complete Delivery Queue Modal with pause, halt, and stats reconciliation (`IssueDeliveryQueueModal.svelte`).

### Phase 4: State Runes & Architectural Hardening
- [x] Svelte 5 Subscriber Store with pagination reset and bounce guards (`subscriber.svelte.ts`).
- [x] Svelte 5 Issue Store with entropy-suffixed slugs and delivery updates (`issue.svelte.ts`).
- [x] Svelte 5 Delivery Queue Manager with abortable batch simulation (`queue.svelte.ts`).
- [x] Deprecation notices on proxy exports warning against non-tracked Svelte 5 reactivity reads.

### Phase 5: Screen Integration & Viewport Audit
- [x] Assemble Overview Dashboard with issue-weighted average open rates (`src/routes/admin/+page.svelte`).
- [x] Assemble Subscriber Directory with CSV upload integration (`src/routes/admin/subscribers/+page.svelte`).
- [x] Assemble Newsletter Issues screen with draft and dispatch triggers (`src/routes/admin/issues/+page.svelte`).
- [x] Audit all interactive breakpoints across 360px, 390px, 430px, 768px, and 1024px+.
