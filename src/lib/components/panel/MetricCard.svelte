<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		title: string;
		value: string;
		subtitle?: string;
		/** Optional trend indicator rendered above the value. */
		trend?: { direction: 'up' | 'down' | 'flat'; label: string };
		/** Icon snippet rendered in the top-right corner. */
		icon?: Snippet;
		class?: string;
	}

	let { title, value, subtitle, trend, icon, class: customClass = '' }: Props = $props();

	const trendStyles = {
		up: 'text-emerald-700',
		down: 'text-rose-700',
		flat: 'text-stone-500'
	} as const;
</script>

<article
	class="bg-white border border-stone-200 p-5 rounded-lg shadow-panel flex flex-col justify-between {customClass}"
>
	<div class="flex items-start justify-between gap-3">
		<div class="text-xs uppercase font-mono tracking-wider text-stone-500">{title}</div>
		{#if icon}
			<div class="text-stone-400 shrink-0" aria-hidden="true">
				{@render icon()}
			</div>
		{/if}
	</div>

	<div class="text-3xl font-serif font-bold text-stone-900 mt-2 tracking-tight tabular-nums">
		{value}
	</div>

	<div class="mt-1 flex items-center gap-2 flex-wrap">
		{#if trend}
			<span class="text-xs font-mono inline-flex items-center gap-1 {trendStyles[trend.direction]}">
				{#if trend.direction === 'up'}
					<svg class="w-3 h-3" viewBox="0 0 12 12" fill="none" aria-hidden="true" focusable="false">
						<path d="M6 10V2M6 2L2.5 5.5M6 2l3.5 3.5" stroke="currentColor" stroke-width="1.5" />
					</svg>
				{:else if trend.direction === 'down'}
					<svg class="w-3 h-3" viewBox="0 0 12 12" fill="none" aria-hidden="true" focusable="false">
						<path d="M6 2v8M6 10l3.5-3.5M6 10L2.5 6.5" stroke="currentColor" stroke-width="1.5" />
					</svg>
				{/if}
				{trend.label}
			</span>
		{/if}

		{#if subtitle}
			<span class="text-xs text-stone-500 font-mono">{subtitle}</span>
		{/if}
	</div>
</article>