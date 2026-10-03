<script lang="ts">
	interface PaginationProps {
		page: number;
		totalPages: number;
		/** Number of page buttons shown on each side of the current page. */
		siblingCount?: number;
		/** Accessible name of the navigation landmark. */
		label?: string;
		onpagechange: (page: number) => void;
		class?: string;
	}

	let {
		page,
		totalPages,
		siblingCount = 1,
		label = 'Pagination',
		onpagechange,
		class: customClass = ''
	}: PaginationProps = $props();

	type PageItem = { kind: 'page'; value: number } | { kind: 'gap'; key: string };

	const safeTotal = $derived(Math.max(1, Math.floor(totalPages)));
	const currentPage = $derived(Math.min(Math.max(1, Math.floor(page)), safeTotal));

	/**
	 * Builds the visible page list with gap markers, always showing the first and
	 * last page so the reader can jump without paging through the whole set.
	 */
	const items = $derived.by<PageItem[]>(() => {
		const pages: PageItem[] = [];
		const windowStart = Math.max(2, currentPage - siblingCount);
		const windowEnd = Math.min(safeTotal - 1, currentPage + siblingCount);

		pages.push({ kind: 'page', value: 1 });

		if (windowStart > 2) {
			pages.push({ kind: 'gap', key: 'start-gap' });
		}

		for (let value = windowStart; value <= windowEnd; value++) {
			pages.push({ kind: 'page', value });
		}

		if (windowEnd < safeTotal - 1) {
			pages.push({ kind: 'gap', key: 'end-gap' });
		}

		if (safeTotal > 1) {
			pages.push({ kind: 'page', value: safeTotal });
		}

		return pages;
	});

	const canGoPrevious = $derived(currentPage > 1);
	const canGoNext = $derived(currentPage < safeTotal);
</script>

{#if safeTotal > 1}
	<nav aria-label={label} class="flex items-center justify-center gap-1 {customClass}">
		<button
			type="button"
			disabled={!canGoPrevious}
			onclick={() => onpagechange(currentPage - 1)}
			aria-label="Previous page"
			class="inline-flex items-center justify-center min-h-[44px] min-w-[44px] px-3 rounded-md border border-stone-300 bg-white text-sm text-stone-700 transition-colors hover:bg-stone-100 active:bg-stone-200 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
		>
			<svg
				class="w-4 h-4"
				fill="none"
				viewBox="0 0 24 24"
				stroke="currentColor"
				aria-hidden="true"
				focusable="false"
			>
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"
				></path>
			</svg>
		</button>

		{#each items as item (item.kind === 'page' ? `page-${item.value}` : item.key)}
			{#if item.kind === 'page'}
				<button
					type="button"
					onclick={() => onpagechange(item.value)}
					aria-current={item.value === currentPage ? 'page' : undefined}
					aria-label="Page {item.value}"
					class="inline-flex items-center justify-center min-h-[44px] min-w-[44px] px-3 rounded-md border text-sm font-mono tabular-nums transition-colors cursor-pointer {item.value ===
					currentPage
						? 'bg-stone-900 text-stone-50 border-stone-900'
						: 'bg-white text-stone-700 border-stone-300 hover:bg-stone-100 active:bg-stone-200'}"
				>
					{item.value}
				</button>
			{:else}
				<span class="inline-flex items-center justify-center min-h-[44px] min-w-[8px] text-stone-400" aria-hidden="true">
					…
				</span>
			{/if}
		{/each}

		<button
			type="button"
			disabled={!canGoNext}
			onclick={() => onpagechange(currentPage + 1)}
			aria-label="Next page"
			class="inline-flex items-center justify-center min-h-[44px] min-w-[44px] px-3 rounded-md border border-stone-300 bg-white text-sm text-stone-700 transition-colors hover:bg-stone-100 active:bg-stone-200 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
		>
			<svg
				class="w-4 h-4"
				fill="none"
				viewBox="0 0 24 24"
				stroke="currentColor"
				aria-hidden="true"
				focusable="false"
			>
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"
				></path>
			</svg>
		</button>
	</nav>
{/if}