<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		title: string;
		/** Optional count rendered next to the title, e.g. total records. */
		count?: number;
		/** Secondary line describing the current screen. */
		subtitle?: string;
		ontogglenav: () => void;
		/** Primary actions rendered on the trailing edge. */
		actions?: Snippet;
	}

	let { title, count, subtitle, ontogglenav, actions }: Props = $props();
</script>

<header
	class="h-16 flex items-center justify-between gap-3 px-4 sm:px-6 border-b border-stone-200 bg-white shrink-0"
>
	<div class="flex items-center gap-3 min-w-0">
		<button
			type="button"
			class="lg:hidden p-2 -ml-2 text-stone-600 hover:text-stone-900 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-md shrink-0 cursor-pointer"
			onclick={ontogglenav}
			aria-label="Open navigation"
		>
			<svg
				class="w-6 h-6"
				fill="none"
				viewBox="0 0 24 24"
				stroke="currentColor"
				aria-hidden="true"
				focusable="false"
			>
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"
				></path>
			</svg>
		</button>

		<div class="min-w-0">
			<h1 class="font-serif font-bold text-stone-900 text-base sm:text-lg truncate">
				{title}{#if typeof count === 'number'}
					<span class="text-stone-400 font-mono text-sm tabular-nums">({count})</span>
				{/if}
			</h1>
			{#if subtitle}
				<p class="text-xs text-stone-500 truncate hidden sm:block">{subtitle}</p>
			{/if}
		</div>
	</div>

	{#if actions}
		<div class="flex items-center gap-2 shrink-0">
			{@render actions()}
		</div>
	{/if}
</header>