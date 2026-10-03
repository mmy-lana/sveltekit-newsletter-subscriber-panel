import type {
	DeliveryJobLog,
	IssueFilterOptions,
	IssueSortField,
	IssueStatus,
	NewsletterIssue
} from '#lib/types/newsletter';
import { getSeedIssues, loadIssues, saveIssues } from '#lib/storage/local-storage-client';
import { renderEditorialMarkdown, toExcerpt } from '#lib/utils/markdown-renderer';
import { createEmptyIssueStats, summarizeDeliveryJobs } from '#lib/utils/metrics-calculator';
import { generateUuid } from '#lib/utils/uuid';
import { sanitizeSlug } from '#lib/utils/validators';

/**
 * Reactive newsletter issue collection.
 *
 * `contentHtml` is never authored: it is always derived from `contentMarkdown` by
 * the sanitising renderer, so persisted HTML can never drift from its source or
 * carry markup injected by an older build.
 */
export class IssueStore {
	items = $state<NewsletterIssue[]>(getSeedIssues());
	filters = $state<IssueFilterOptions>({
		status: 'all',
		searchQuery: '',
		sortBy: 'createdAt',
		sortDirection: 'desc',
		page: 1,
		pageSize: 10
	});
	/** Issue currently open in the editor, or null when browsing the list. */
	currentEditorIssue = $state<NewsletterIssue | null>(null);
	isHydrated = $state(false);

	hydrate(): void {
		if (typeof window === 'undefined' || this.isHydrated) return;
		this.items = loadIssues();
		this.isHydrated = true;
	}

	filteredItems = $derived.by(() => {
		const query = this.filters.searchQuery.trim().toLowerCase();
		let result = [...this.items];

		if (this.filters.status !== 'all') {
			result = result.filter((issue) => issue.status === this.filters.status);
		}

		if (query.length > 0) {
			result = result.filter(
				(issue) =>
					issue.title.toLowerCase().includes(query) ||
					issue.subtitle.toLowerCase().includes(query) ||
					issue.slug.toLowerCase().includes(query) ||
					issue.tags.some((tag) => tag.toLowerCase().includes(query))
			);
		}

		const direction = this.filters.sortDirection === 'asc' ? 1 : -1;
		result.sort((a, b) => compareIssues(a, b, this.filters.sortBy) * direction);

		return result;
	});

	paginatedItems = $derived.by(() => {
		const startIndex = (this.filters.page - 1) * this.filters.pageSize;
		return this.filteredItems.slice(startIndex, startIndex + this.filters.pageSize);
	});

	totalPages = $derived.by(() =>
		Math.max(1, Math.ceil(this.filteredItems.length / Math.max(1, this.filters.pageSize)))
	);

	currentPage = $derived(Math.min(this.filters.page, this.totalPages));

	/** Sent issues, newest first — the public archive reads from this list. */
	publishedIssues = $derived.by(() =>
		this.items
			.filter((issue) => issue.status === 'sent' && issue.publishedAt !== null)
			.sort((a, b) => Date.parse(b.publishedAt ?? '') - Date.parse(a.publishedAt ?? ''))
	);

	allTags = $derived.by(() => {
		const tagSet = new Set<string>();
		for (const issue of this.items) {
			for (const tag of issue.tags) tagSet.add(tag);
		}
		return Array.from(tagSet).sort();
	});

	totalCount = $derived(this.items.length);
	draftCount = $derived(this.items.filter((issue) => issue.status === 'draft').length);
	scheduledCount = $derived(this.items.filter((issue) => issue.status === 'scheduled').length);
	sentCount = $derived(this.items.filter((issue) => issue.status === 'sent').length);
	archivedCount = $derived(this.items.filter((issue) => issue.status === 'archived').length);

	getById(id: string): NewsletterIssue | undefined {
		return this.items.find((issue) => issue.id === id);
	}

	getBySlug(slug: string): NewsletterIssue | undefined {
		return this.items.find((issue) => issue.slug === slug);
	}

	setFilter<K extends keyof IssueFilterOptions>(key: K, value: IssueFilterOptions[K]): void {
		this.filters[key] = value;
		if (key !== 'page') this.filters.page = 1;
	}

	setPage(page: number): void {
		this.filters.page = Math.min(Math.max(1, page), this.totalPages);
	}

	setSort(sortBy: IssueSortField): void {
		if (this.filters.sortBy === sortBy) {
			this.filters.sortDirection = this.filters.sortDirection === 'asc' ? 'desc' : 'asc';
			return;
		}
		this.filters.sortBy = sortBy;
		this.filters.sortDirection = sortBy === 'title' ? 'asc' : 'desc';
		this.filters.page = 1;
	}

	/** Generates a slug that is unique within the collection. */
	buildUniqueSlug(title: string): string {
		const base = sanitizeSlug(title) || 'dispatch';
		if (!this.items.some((issue) => issue.slug === base)) return base;

		let candidate = `${base}-2`;
		let suffix = 3;
		while (this.items.some((issue) => issue.slug === candidate)) {
			candidate = `${base}-${suffix}`;
			suffix++;
		}
		return candidate;
	}

	createDraft(authorName = 'Publication Editor'): NewsletterIssue {
		const now = new Date().toISOString();

		const draft: NewsletterIssue = {
			id: generateUuid(),
			slug: `dispatch-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
			title: 'Untitled Dispatch',
			subtitle: '',
			excerpt: '',
			contentMarkdown: '# Untitled Dispatch\n\nBegin writing your editorial here...',
			contentHtml: '',
			coverImageUrl: null,
			authorName,
			authorAvatarUrl: null,
			status: 'draft',
			audience: 'all',
			tags: [],
			scheduledAt: null,
			publishedAt: null,
			createdAt: now,
			updatedAt: now,
			stats: createEmptyIssueStats()
		};

		draft.contentHtml = renderEditorialMarkdown(draft.contentMarkdown);

		this.items = [draft, ...this.items];
		this.currentEditorIssue = draft;
		this.persist();
		return draft;
	}

	updateIssue(id: string, updates: Partial<NewsletterIssue>): void {
		const now = new Date().toISOString();

		this.items = this.items.map((issue) => {
			if (issue.id !== id) return issue;

			const merged: NewsletterIssue = { ...issue, ...updates, updatedAt: now };

			// HTML is always re-derived from the markdown source of truth.
			if (updates.contentMarkdown !== undefined) {
				merged.contentHtml = renderEditorialMarkdown(merged.contentMarkdown);
			}

			// Keep the excerpt useful when the author never wrote one.
			if (updates.excerpt === '' && updates.contentMarkdown !== undefined) {
				merged.excerpt = toExcerpt(merged.contentMarkdown, 180);
			}

			if (updates.title !== undefined && updates.slug === undefined && issue.status === 'draft') {
				const base = sanitizeSlug(merged.title);
				if (base.length > 0 && !this.items.some((other) => other.slug === base && other.id !== id)) {
					merged.slug = base;
				}
			}

			return merged;
		});

		if (this.currentEditorIssue?.id === id) {
			this.currentEditorIssue = this.getById(id) ?? null;
		}

		this.persist();
	}

	deleteIssue(id: string): void {
		this.items = this.items.filter((issue) => issue.id !== id);
		if (this.currentEditorIssue?.id === id) {
			this.currentEditorIssue = null;
		}
		this.persist();
	}

	setStatus(id: string, status: IssueStatus): void {
		const updates: Partial<NewsletterIssue> = { status };
		if (status === 'sent' && this.getById(id)?.publishedAt === null) {
			updates.publishedAt = new Date().toISOString();
		}
		this.updateIssue(id, updates);
	}

	/**
	 * Reconciles a finished (or halted) distribution run onto the issue: the issue
	 * is marked as sent, the published timestamp is stamped, and the statistics are
	 * derived from the delivery log rather than from the counters alone.
	 */
	markAsSentFromJobs(id: string, jobs: DeliveryJobLog[], totalRecipients: number): NewsletterIssue | undefined {
		const issue = this.getById(id);
		if (!issue) return undefined;

		const now = new Date().toISOString();
		const stats = summarizeDeliveryJobs(jobs, now);

		this.updateIssue(id, {
			status: 'sent',
			publishedAt: issue.publishedAt ?? now,
			stats: { ...stats, totalRecipients }
		});

		return this.getById(id);
	}

	private persist(): void {
		saveIssues(this.items);
	}
}

function compareIssues(a: NewsletterIssue, b: NewsletterIssue, sortBy: IssueSortField): number {
	switch (sortBy) {
		case 'publishedAt':
			return toTime(a.publishedAt) - toTime(b.publishedAt);
		case 'totalRecipients':
			return a.stats.totalRecipients - b.stats.totalRecipients;
		case 'title':
			return a.title.localeCompare(b.title);
		case 'status':
			return a.status.localeCompare(b.status);
		default:
			return toTime(a.createdAt) - toTime(b.createdAt);
	}
}

function toTime(value: string | null): number {
	if (!value) return 0;
	const parsed = Date.parse(value);
	return Number.isNaN(parsed) ? 0 : parsed;
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
	get(_target, prop: keyof IssueStore) {
		const instance = getIssueState();
		const value = instance[prop];
		return typeof value === 'function' ? value.bind(instance) : value;
	},
	set(_target, prop: keyof IssueStore, value) {
		const instance = getIssueState();
		(instance as unknown as Record<string, unknown>)[prop as string] = value;
		return true;
	}
});