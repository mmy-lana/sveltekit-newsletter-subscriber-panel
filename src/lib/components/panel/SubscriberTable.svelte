<script lang="ts">
	import type { Subscriber, SubscriberSortField } from '#lib/types/newsletter';
	import type { Snippet } from 'svelte';
	import Badge from '#lib/components/ui/Badge.svelte';
	import Button from '#lib/components/ui/Button.svelte';
	import { formatDate, formatRelativeTime } from '#lib/utils/format';

	interface Props {
		subscribers: Subscriber[];
		selectedIds: string[];
		/** True while a page of results is loading. */
		isLoading?: boolean;
		/** Message shown when the list is empty; distinguishes "no data" from "no matches". */
		emptyMessage?: string;
		/** Optional call-to-action rendered inside the empty state. */
		emptyAction?: Snippet;
		sortBy?: SubscriberSortField;
		sortDirection?: 'asc' | 'desc';
		ontoggleSelect: (id: string) => void;
		ontoggleselectall?: (ids: string[]) => void;
		onsortchange?: (field: SubscriberSortField) => void;
		onedit: (subscriber: Subscriber) => void;
		ondelete: (subscriber: Subscriber) => void;
	}

	let {
		subscribers,
		selectedIds,
		isLoading = false,
		emptyMessage = 'No subscribers match the current filters.',
		emptyAction,
		sortBy = 'subscribedAt',
		sortDirection = 'desc',
		ontoggleSelect,
		ontoggleselectall,
		onsortchange,
		onedit,
		ondelete
	}: Props = $props();

	const allSelected = $derived(
		subscribers.length > 0 && subscribers.every((subscriber) => selectedIds.includes(subscriber.id))
	);

	const someSelected = $derived(
		subscribers.some((subscriber) => selectedIds.includes(subscriber.id)) && !allSelected
	);

	const headerCheckboxState = $derived(allSelected ? 'true' : someSelected ? 'mixed' : 'false');

	const columns: Array<{ field: SubscriberSortField; label: string; className?: string }> = [
		{ field: 'email', label: 'Subscriber' },
		{ field: 'status', label: 'Status', className: 'w-32' },
		{ field: 'tier', label: 'Tier', className: 'w-28' },
		{ field: 'openRatePercent', label: 'Open Rate', className: 'w-32' },
		{ field: 'lastOpenedAt', label: 'Last Open', className: 'w-40' }
	];

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

	function tierVariant(tier: Subscriber['tier']): 'neutral' | 'outline' {
		return tier === 'free' ? 'neutral' : 'outline';
	}

	function handleSort(field: SubscriberSortField): void {
		onsortchange?.(field);
	}

	function handleSelectAll(): void {
		ontoggleselectall?.(subscribers.map((subscriber) => subscriber.id));
	}
</script>

{#if isLoading}
	<div class="px-4 py-10 text-center text-sm text-stone-500" role="status" aria-live="polite">
		Loading subscribers…
	</div>
{:else if subscribers.length === 0}
	<div class="px-4 py-12 text-center space-y-2">
		<svg
			class="w-8 h-8 mx-auto text-stone-300"
			fill="none"
			viewBox="0 0 24 24"
			stroke="currentColor"
			aria-hidden="true"
			focusable="false"
		>
			<path
				stroke-linecap="round"
				stroke-linejoin="round"
				stroke-width="1.5"
				d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z"
			></path>
		</svg>
		<p class="text-sm text-stone-500">{emptyMessage}</p>
		{#if emptyAction}
			<div class="pt-1 flex items-center justify-center">{@render emptyAction()}</div>
		{/if}
	</div>
{:else}
	<!-- Mobile card view (< 640px) -->
	<div class="block sm:hidden divide-y divide-stone-200">
		{#each subscribers as subscriber (subscriber.id)}
			<div class="p-4 bg-white space-y-3">
				<div class="flex items-start justify-between gap-3">
					<label class="flex items-center gap-3 cursor-pointer min-h-[44px] min-w-[44px]">
						<!-- Deliberate: 20px checkbox keeps row density while the 44px
						     label wrapper provides the touch target on small screens. -->
						<input
							type="checkbox"
							class="h-5 w-5 shrink-0 rounded border-stone-300 text-stone-900 focus:ring-stone-900"
							checked={selectedIds.includes(subscriber.id)}
							onchange={() => ontoggleSelect(subscriber.id)}
							aria-label="Select {subscriber.email}"
						/>
						<span class="font-medium text-stone-900 text-sm break-all min-w-0">
							{subscriber.email}
						</span>
					</label>
					<Badge variant={statusVariant(subscriber.status)} size="sm">{subscriber.status}</Badge>
				</div>

				<div class="pl-8 space-y-2">
					{#if subscriber.firstName || subscriber.lastName}
						<p class="text-xs text-stone-600">
							{subscriber.firstName}
							{subscriber.lastName}
						</p>
					{/if}

					<div class="flex flex-wrap items-center gap-2">
						<Badge variant={tierVariant(subscriber.tier)} size="sm">{subscriber.tier}</Badge>
						{#each subscriber.tags.slice(0, 3) as tag (tag)}
							<Badge variant="outline" size="sm">{tag}</Badge>
						{/each}
					</div>

					<div class="flex items-center justify-between text-xs text-stone-500">
						<span>Open rate <strong class="text-stone-800 tabular-nums">{subscriber.metrics.openRatePercent.toFixed(1)}%</strong></span>
						<span title={formatDate(subscriber.metrics.lastOpenedAt)}>
							{subscriber.metrics.lastOpenedAt
								? formatRelativeTime(subscriber.metrics.lastOpenedAt)
								: 'Never opened'}
						</span>
					</div>
				</div>

				<div class="flex items-center gap-2 pt-2 border-t border-stone-100 justify-end">
					<Button variant="outline" size="sm" onclick={() => onedit(subscriber)}>
						Edit
					</Button>
					<Button
						variant="ghost"
						size="sm"
						class="text-rose-700"
						onclick={() => ondelete(subscriber)}
						ariaLabel="Delete {subscriber.email}"
					>
						Delete
					</Button>
				</div>
			</div>
		{/each}
	</div>

	<!-- Desktop table view (>= 640px) -->
	<div class="hidden sm:block overflow-x-auto no-scrollbar border-t border-stone-200">
		<table class="w-full text-left text-sm text-stone-700">
			<caption class="sr-only">
				Subscribers, sortable by {sortBy} in {sortDirection === 'asc' ? 'ascending' : 'descending'} order
			</caption>
			<thead class="bg-stone-50 text-xs uppercase text-stone-500 font-mono border-b border-stone-200">
				<tr>
					<th scope="col" class="p-4 w-10">
						{#if ontoggleselectall}
							<label class="flex items-center justify-center cursor-pointer min-h-[44px] min-w-[44px]">
								<input
									type="checkbox"
									class="h-4 w-4 rounded border-stone-300 text-stone-900 focus:ring-stone-900"
									checked={allSelected}
									aria-checked={headerCheckboxState}
									onchange={handleSelectAll}
									aria-label="Select all subscribers on this page"
								/>
							</label>
						{:else}
							<span class="sr-only">Select</span>
						{/if}
					</th>
					{#each columns as column (column.field)}
						<th
							scope="col"
							class="p-4 {column.className ?? ''} {onsortchange
								? 'cursor-pointer select-none hover:text-stone-900'
								: ''}"
							aria-sort={sortBy === column.field
								? sortDirection === 'asc'
									? 'ascending'
									: 'descending'
								: 'none'}
						>
							{#if onsortchange}
								<button
									type="button"
									class="inline-flex items-center gap-1 min-h-[44px] sm:min-h-[36px] uppercase font-mono"
									onclick={() => handleSort(column.field)}
								>
									{column.label}
									{#if sortBy === column.field}
										<span aria-hidden="true">{sortDirection === 'asc' ? '↑' : '↓'}</span>
									{/if}
								</button>
							{:else}
								{column.label}
							{/if}
						</th>
					{/each}
					<th scope="col" class="p-4 text-right w-32">Actions</th>
				</tr>
			</thead>
			<tbody class="divide-y divide-stone-200 bg-white">
				{#each subscribers as subscriber (subscriber.id)}
					<tr class="hover:bg-stone-50/50 transition-colors">
						<td class="p-4">
							<label class="flex items-center justify-center cursor-pointer min-h-[44px] min-w-[44px]">
								<input
									type="checkbox"
									class="h-4 w-4 rounded border-stone-300 text-stone-900 focus:ring-stone-900"
									checked={selectedIds.includes(subscriber.id)}
									onchange={() => ontoggleSelect(subscriber.id)}
									aria-label="Select {subscriber.email}"
								/>
							</label>
						</td>
						<td class="p-4">
							<div class="font-medium text-stone-900 break-all">{subscriber.email}</div>
							{#if subscriber.firstName || subscriber.lastName}
								<div class="text-xs text-stone-500">
									{subscriber.firstName}
									{subscriber.lastName}
								</div>
							{/if}
						</td>
						<td class="p-4">
							<Badge variant={statusVariant(subscriber.status)} size="sm">
								{subscriber.status}
							</Badge>
						</td>
						<td class="p-4">
							<Badge variant={tierVariant(subscriber.tier)} size="sm">{subscriber.tier}</Badge>
						</td>
						<td class="p-4 font-mono text-xs tabular-nums">
							{subscriber.metrics.openRatePercent.toFixed(1)}%
						</td>
						<td class="p-4 font-mono text-xs text-stone-500" title={formatDate(subscriber.metrics.lastOpenedAt)}>
							{subscriber.metrics.lastOpenedAt
								? formatDate(subscriber.metrics.lastOpenedAt)
								: '—'}
						</td>
						<td class="p-4 text-right">
							<div class="inline-flex items-center gap-1">
								<button
									type="button"
									class="text-xs font-medium text-stone-600 hover:text-stone-900 min-h-[44px] px-2 cursor-pointer"
									onclick={() => onedit(subscriber)}
								>
									Edit
								</button>
								<button
									type="button"
									class="text-xs font-medium text-rose-600 hover:text-rose-900 min-h-[44px] px-2 cursor-pointer"
									onclick={() => ondelete(subscriber)}
									aria-label="Delete {subscriber.email}"
								>
									Delete
								</button>
							</div>
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
{/if}