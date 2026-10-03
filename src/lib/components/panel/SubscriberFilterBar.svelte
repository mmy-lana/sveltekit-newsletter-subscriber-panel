<script lang="ts">
	import type { SubscriberFilterOptions, SubscriberStatus, SubscriberTier } from '#lib/types/newsletter';
	import type { SelectOption } from '#lib/types/ui';
	import Select from '#lib/components/ui/Select.svelte';
	import Button from '#lib/components/ui/Button.svelte';

	interface Props {
		filters: SubscriberFilterOptions;
		/** Every tag present in the audience, used to build the tag filter. */
		availableTags: string[];
		/** Number of rows matching the active filters. */
		resultCount: number;
		/** Number of rows selected for a bulk action. */
		selectedCount: number;
		onfilterchange: <K extends keyof SubscriberFilterOptions>(
			key: K,
			value: SubscriberFilterOptions[K]
		) => void;
		onbulkstatus: (status: SubscriberStatus) => void;
		onbulkdelete: () => void;
		onclearselection: () => void;
	}

	let {
		filters,
		availableTags,
		resultCount,
		selectedCount,
		onfilterchange,
		onbulkstatus,
		onbulkdelete,
		onclearselection
	}: Props = $props();

	const statusOptions: SelectOption[] = [
		{ value: 'all', label: 'All statuses' },
		{ value: 'active', label: 'Active' },
		{ value: 'pending', label: 'Pending' },
		{ value: 'unsubscribed', label: 'Unsubscribed' },
		{ value: 'bounced', label: 'Bounced' }
	];

	const tierOptions: SelectOption[] = [
		{ value: 'all', label: 'All tiers' },
		{ value: 'free', label: 'Free' },
		{ value: 'paid', label: 'Paid' },
		{ value: 'founding', label: 'Founding' }
	];

	const sortOptions: SelectOption[] = [
		{ value: 'subscribedAt', label: 'Newest first' },
		{ value: 'email', label: 'Email A–Z' },
		{ value: 'openRatePercent', label: 'Open rate' },
		{ value: 'lastOpenedAt', label: 'Last opened' },
		{ value: 'status', label: 'Status' },
		{ value: 'tier', label: 'Tier' }
	];

	const tagOptions = $derived<SelectOption[]>([
		{ value: 'all', label: 'All tags' },
		...availableTags.map((tag) => ({ value: tag, label: tag }))
	]);

	const isFiltered = $derived(
		filters.searchQuery.trim().length > 0 ||
			filters.status !== 'all' ||
			filters.tier !== 'all' ||
			filters.tag !== 'all'
	);

	function resetFilters(): void {
		onfilterchange('searchQuery', '');
		onfilterchange('status', 'all');
		onfilterchange('tier', 'all');
		onfilterchange('tag', 'all');
	}

	function handleStatus(event: Event & { currentTarget: HTMLSelectElement }): void {
		onfilterchange('status', event.currentTarget.value as SubscriberStatus | 'all');
	}

	function handleTier(event: Event & { currentTarget: HTMLSelectElement }): void {
		onfilterchange('tier', event.currentTarget.value as SubscriberTier | 'all');
	}

	function handleTag(event: Event & { currentTarget: HTMLSelectElement }): void {
		onfilterchange('tag', event.currentTarget.value);
	}

	function handleSort(event: Event & { currentTarget: HTMLSelectElement }): void {
		onfilterchange('sortBy', event.currentTarget.value as SubscriberFilterOptions['sortBy']);
	}

	function handleSortDirection(): void {
		onfilterchange('sortDirection', filters.sortDirection === 'asc' ? 'desc' : 'asc');
	}
</script>

<div class="space-y-3">
	<div class="flex flex-col lg:flex-row gap-3">
		<div class="flex-1 min-w-0">
			<label for="subscriber-search" class="sr-only">Search subscribers</label>
			<div class="relative">
				<svg
					class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400"
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
					aria-hidden="true"
					focusable="false"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M21 21l-4.35-4.35M17 10.5a6.5 6.5 0 11-13 0 6.5 6.5 0 0113 0z"
					></path>
				</svg>
				<input
					id="subscriber-search"
					type="search"
					autocomplete="off"
					spellcheck="false"
					value={filters.searchQuery}
					oninput={(event) => onfilterchange('searchQuery', event.currentTarget.value)}
					placeholder="Search email, name or tag…"
					class="w-full min-h-[44px] border border-stone-300 rounded-md pl-9 pr-3 py-2 text-sm bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-stone-900 focus-visible:ring-offset-1"
				/>
			</div>
		</div>

		<Select
			id="filter-status"
			class="lg:w-44"
			label="Status"
			hideLabel
			options={statusOptions}
			value={filters.status}
			onchange={handleStatus}
		/>
		<Select
			id="filter-tier"
			class="lg:w-36"
			label="Tier"
			hideLabel
			options={tierOptions}
			value={filters.tier}
			onchange={handleTier}
		/>
		<Select
			id="filter-tag"
			class="lg:w-40"
			label="Tag"
			hideLabel
			options={tagOptions}
			value={filters.tag}
			onchange={handleTag}
		/>
		<Select
			id="filter-sort"
			class="lg:w-44"
			label="Sort by"
			hideLabel
			options={sortOptions}
			value={filters.sortBy}
			onchange={handleSort}
		/>
		<Button
			variant="outline"
			size="md"
			onclick={handleSortDirection}
			ariaLabel="Toggle sort direction"
			title={filters.sortDirection === 'asc' ? 'Sorted ascending' : 'Sorted descending'}
		>
			<span class="flex items-center gap-1.5">
				<span aria-hidden="true">{filters.sortDirection === 'asc' ? '↑' : '↓'}</span>
				<span class="hidden sm:inline">{filters.sortDirection === 'asc' ? 'Asc' : 'Desc'}</span>
			</span>
		</Button>
	</div>

	<div class="flex items-center justify-between gap-3 flex-wrap">
		<p class="text-xs font-mono text-stone-500 tabular-nums" aria-live="polite">
			{resultCount}
			{resultCount === 1 ? 'record' : 'records'}
			{#if isFiltered}<span class="text-stone-400">· filtered</span>{/if}
		</p>

		{#if isFiltered}
			<Button variant="ghost" size="sm" onclick={resetFilters}>Clear filters</Button>
		{/if}
	</div>

	{#if selectedCount > 0}
		<div
			class="flex flex-wrap items-center gap-2 rounded-md border border-stone-300 bg-stone-100 px-3 py-2"
			role="region"
			aria-label="Bulk actions"
		>
			<span class="text-xs font-mono tabular-nums">{selectedCount} selected</span>
			<div class="flex items-center gap-2 ml-auto flex-wrap">
				<Button variant="outline" size="sm" onclick={() => onbulkstatus('active')}>
					Mark active
				</Button>
				<Button variant="outline" size="sm" onclick={() => onbulkstatus('unsubscribed')}>
					Unsubscribe
				</Button>
				<Button variant="danger" size="sm" onclick={onbulkdelete}>Delete</Button>
				<Button variant="ghost" size="sm" onclick={onclearselection}>Clear</Button>
			</div>
		</div>
	{/if}
</div>