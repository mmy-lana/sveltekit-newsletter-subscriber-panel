import type {
	Subscriber,
	SubscriberFilterOptions,
	SubscriberSortField,
	SubscriberStatus,
	SubscriberTier
} from '#lib/types/newsletter';
import { getSeedSubscribers, loadSubscribers, saveSubscribers } from '#lib/storage/local-storage-client';
import { generateUuid } from '#lib/utils/uuid';
import { createEmptyMetrics, recalculateEngagement } from '#lib/utils/metrics-calculator';
import { normalizeEmail } from '#lib/utils/validators';

/**
 * Reactive subscriber directory.
 *
 * Reactivity notes:
 * - State is seeded with the canonical fixtures so the server render and the first
 *   client render produce identical markup; `hydrate()` then swaps in whatever is
 *   persisted in LocalStorage.
 * - Every list the UI shows (filtered, sorted, paginated, aggregated) is *derived*,
 *   never stored, so there is exactly one source of truth for each entity.
 */
export class SubscriberStore {
	items = $state<Subscriber[]>(getSeedSubscribers());
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
	/** True once persisted data has been merged into the in-memory state. */
	isHydrated = $state(false);
	/**
	 * Message describing the last failed persistence attempt (quota exhaustion,
	 * private-mode restrictions). Null when every write succeeded.
	 */
	persistenceError = $state<string | null>(null);

	/** Applies persisted data in the browser; a no-op on the server. */
	hydrate(): void {
		if (typeof window === 'undefined' || this.isHydrated) return;
		this.items = loadSubscribers();
		this.isHydrated = true;
	}

	filteredItems = $derived.by(() => {
		const query = this.filters.searchQuery.trim().toLowerCase();
		let result = [...this.items];

		if (query.length > 0) {
			result = result.filter(
				(subscriber) =>
					subscriber.email.toLowerCase().includes(query) ||
					subscriber.firstName.toLowerCase().includes(query) ||
					subscriber.lastName.toLowerCase().includes(query) ||
					subscriber.tags.some((tag) => tag.toLowerCase().includes(query))
			);
		}

		if (this.filters.status !== 'all') {
			result = result.filter((subscriber) => subscriber.status === this.filters.status);
		}

		if (this.filters.tier !== 'all') {
			result = result.filter((subscriber) => subscriber.tier === this.filters.tier);
		}

		if (this.filters.tag !== 'all') {
			result = result.filter((subscriber) => subscriber.tags.includes(this.filters.tag));
		}

		const direction = this.filters.sortDirection === 'asc' ? 1 : -1;

		result.sort((a, b) => compareSubscribers(a, b, this.filters.sortBy) * direction);

		return result;
	});

	paginatedItems = $derived.by(() => {
		const startIndex = (this.filters.page - 1) * this.filters.pageSize;
		return this.filteredItems.slice(startIndex, startIndex + this.filters.pageSize);
	});

	totalPages = $derived.by(() =>
		Math.max(1, Math.ceil(this.filteredItems.length / Math.max(1, this.filters.pageSize)))
	);

	/** Page count clamped to the filtered result set so filters can never strand the reader. */
	currentPage = $derived(Math.min(this.filters.page, this.totalPages));

	allTags = $derived.by(() => {
		const tagSet = new Set<string>();
		for (const subscriber of this.items) {
			for (const tag of subscriber.tags) tagSet.add(tag);
		}
		return Array.from(tagSet).sort();
	});

	totalCount = $derived(this.items.length);
	activeCount = $derived(this.items.filter((subscriber) => subscriber.status === 'active').length);
	paidCount = $derived(
		this.items.filter((subscriber) => subscriber.status === 'active' && subscriber.tier !== 'free').length
	);
	bouncedCount = $derived(this.items.filter((subscriber) => subscriber.status === 'bounced').length);

	/**
	 * Normalised emails in the audience — the source for duplicate detection.
	 *
	 * [HIGH-01] Values are compared case-insensitively everywhere: a legacy record
	 * written before normalisation must still collide with its normalised twin.
	 */
	existingEmails = $derived(this.items.map((subscriber) => normalizeEmail(subscriber.email)));

	getById(id: string): Subscriber | undefined {
		return this.items.find((subscriber) => subscriber.id === id);
	}

	getByEmail(email: string): Subscriber | undefined {
		const needle = normalizeEmail(email);
		return this.items.find((subscriber) => normalizeEmail(subscriber.email) === needle);
	}

	setFilter<K extends keyof SubscriberFilterOptions>(key: K, value: SubscriberFilterOptions[K]): void {
		this.filters[key] = value;
		// Any filter change invalidates the current page offset.
		if (key !== 'page') this.filters.page = 1;
	}

	setPage(page: number): void {
		this.filters.page = Math.min(Math.max(1, page), this.totalPages);
	}

	setSort(sortBy: SubscriberSortField): void {
		if (this.filters.sortBy === sortBy) {
			this.filters.sortDirection = this.filters.sortDirection === 'asc' ? 'desc' : 'asc';
			return;
		}
		this.filters.sortBy = sortBy;
		this.filters.sortDirection = sortBy === 'email' ? 'asc' : 'desc';
		this.filters.page = 1;
	}

	resetFilters(): void {
		this.filters = {
			searchQuery: '',
			status: 'all',
			tier: 'all',
			tag: 'all',
			sortBy: 'subscribedAt',
			sortDirection: 'desc',
			page: 1,
			pageSize: this.filters.pageSize
		};
	}

	addSubscriber(draft: Omit<Subscriber, 'id' | 'subscribedAt' | 'updatedAt' | 'metrics'>): Subscriber {
		const now = new Date().toISOString();
		const created: Subscriber = {
			...draft,
			email: normalizeEmail(draft.email),
			id: generateUuid(),
			subscribedAt: now,
			updatedAt: now,
			metrics: createEmptyMetrics()
		};

		this.items = [created, ...this.items];
		this.persist();
		return created;
	}

	/** Inserts a parsed CSV batch, preserving file order. */
	addBatch(subscribers: Subscriber[]): void {
		if (subscribers.length === 0) return;
		this.items = [...subscribers, ...this.items];
		this.persist();
	}

	updateSubscriber(id: string, patch: Partial<Subscriber>): void {
		const now = new Date().toISOString();
		this.items = this.items.map((subscriber) => {
			if (subscriber.id !== id) return subscriber;

			const merged: Subscriber = {
				...subscriber,
				...patch,
				updatedAt: now
			};

			if (patch.email !== undefined) merged.email = normalizeEmail(patch.email);
			if (patch.metrics) merged.metrics = recalculateEngagement({ ...subscriber.metrics, ...patch.metrics });

			return merged;
		});
		this.persist();
	}

	deleteSubscriber(id: string): void {
		this.items = this.items.filter((subscriber) => subscriber.id !== id);
		this.persist();
	}

	/**
	 * Applies a status to many records at once.
	 *
	 * Bounced addresses can never be silently reactivated: a hard bounce is only
	 * cleared by an explicit single-record edit, so a bulk action cannot resurrect
	 * an address that is known to be undeliverable.
	 */
	bulkUpdateStatus(ids: string[], newStatus: SubscriberStatus): number {
		const idSet = new Set(ids);
		const now = new Date().toISOString();
		let changed = 0;

		this.items = this.items.map((subscriber) => {
			if (!idSet.has(subscriber.id)) return subscriber;
			if (subscriber.status === newStatus) return subscriber;
			if (subscriber.status === 'bounced' && newStatus === 'active') return subscriber;

			changed++;
			return { ...subscriber, status: newStatus, updatedAt: now };
		});

		this.persist();
		return changed;
	}

	bulkDelete(ids: string[]): void {
		if (ids.length === 0) return;
		const idSet = new Set(ids);
		this.items = this.items.filter((subscriber) => !idSet.has(subscriber.id));
		this.persist();
	}

	/** Records that a subscriber received, and optionally opened, an issue. */
	recordDelivery(
		id: string,
		outcome: { opened?: boolean; clicked?: boolean; openedAt?: string | null }
	): void {
		this.recordDeliveriesBatch([{ subscriberId: id, ...outcome }]);
	}

	/**
	 * Reconciles a whole delivery run in a single pass.
	 *
	 * The per-record path serialised and rewrote the entire audience once per
	 * recipient, which is quadratic for a large dispatch. This builds one lookup
	 * table, maps once, and performs exactly one storage write.
	 */
	recordDeliveriesBatch(
		outcomes: Array<{
			subscriberId: string;
			opened?: boolean;
			clicked?: boolean;
			openedAt?: string | null;
		}>
	): void {
		if (outcomes.length === 0) return;

		const now = new Date().toISOString();
		const outcomesById = new Map(outcomes.map((outcome) => [outcome.subscriberId, outcome]));

		this.items = this.items.map((subscriber) => {
			const outcome = outcomesById.get(subscriber.id);
			if (!outcome) return subscriber;

			const metrics = recalculateEngagement({
				...subscriber.metrics,
				emailsReceivedCount: subscriber.metrics.emailsReceivedCount + 1,
				emailsOpenedCount: subscriber.metrics.emailsOpenedCount + (outcome.opened ? 1 : 0),
				linksClickedCount: subscriber.metrics.linksClickedCount + (outcome.clicked ? 1 : 0),
				lastOpenedAt: outcome.opened ? (outcome.openedAt ?? now) : subscriber.metrics.lastOpenedAt
			});

			return { ...subscriber, metrics, updatedAt: now };
		});

		this.persist();
	}

	/** Clears the surfaced persistence failure after the operator acknowledges it. */
	dismissPersistenceError(): void {
		this.persistenceError = null;
	}

	private persist(): void {
		// Persistence only exists in the browser; during SSR there is nothing to
		// write, so this is not a failure condition.
		if (typeof window === 'undefined') return;

		const persisted = saveSubscribers(this.items);
		this.persistenceError = persisted
			? null
			: 'Changes could not be saved to this browser’s local storage. Free up space or disable private browsing, then try again.';
	}
}

/** Stable comparator for every sortable column, including null-safe timestamps. */
function compareSubscribers(a: Subscriber, b: Subscriber, sortBy: SubscriberSortField): number {
	switch (sortBy) {
		case 'email':
			return a.email.localeCompare(b.email);
		case 'openRatePercent':
			return a.metrics.openRatePercent - b.metrics.openRatePercent;
		case 'lastOpenedAt':
			return toTime(a.metrics.lastOpenedAt) - toTime(b.metrics.lastOpenedAt);
		case 'tier':
			return tierRank(a.tier) - tierRank(b.tier);
		case 'status':
			return a.status.localeCompare(b.status);
		default:
			return toTime(a.subscribedAt) - toTime(b.subscribedAt);
	}
}

function toTime(value: string | null): number {
	if (!value) return 0;
	const parsed = Date.parse(value);
	return Number.isNaN(parsed) ? 0 : parsed;
}

function tierRank(tier: SubscriberTier): number {
	switch (tier) {
		case 'founding':
			return 3;
		case 'paid':
			return 2;
		default:
			return 1;
	}
}

let subscriberStoreInstance: SubscriberStore | null = null;

/**
 * Returns the process-wide subscriber store in the browser, and a throwaway
 * instance on the server (one per request, never shared between users).
 */
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
	get(_target, prop: keyof SubscriberStore) {
		const instance = getSubscriberState();
		const value = instance[prop];
		return typeof value === 'function' ? value.bind(instance) : value;
	},
	set(_target, prop: keyof SubscriberStore, value) {
		const instance = getSubscriberState();
		(instance as unknown as Record<string, unknown>)[prop as string] = value;
		return true;
	}
});