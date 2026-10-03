<script lang="ts">
	interface Props {
		publicationName: string;
		/** Highlights the archive link when the reader is already on an issue. */
		isArchiveActive?: boolean;
		/** Hides the publisher link when the reader is already inside the panel. */
		showPublisherLink?: boolean;
	}

	let { publicationName, isArchiveActive = false, showPublisherLink = true }: Props = $props();
</script>

<header class="border-b border-stone-200 bg-white/90 backdrop-blur-md sticky top-0 z-30">
	<div class="max-w-4xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
		<a href="/" class="inline-flex items-center min-h-[44px] font-serif font-bold text-lg sm:text-xl tracking-tight text-stone-900 truncate">
			{publicationName}
		</a>

		<nav class="flex items-center gap-2" aria-label="Publication">
			<a
				href="/"
				aria-current={isArchiveActive ? 'page' : undefined}
				class="text-xs font-mono uppercase tracking-wider px-3 min-h-[44px] inline-flex items-center rounded hover:bg-stone-100 transition-colors {isArchiveActive
					? 'text-stone-900 font-semibold'
					: 'text-stone-600'}"
			>
				Archive
			</a>
			{#if showPublisherLink}
				<a
					href="/admin"
					class="text-xs font-mono uppercase tracking-wider px-3 min-h-[44px] inline-flex items-center border border-stone-300 rounded hover:bg-stone-100 transition-colors text-stone-700"
				>
					Publisher
				</a>
			{/if}
		</nav>
	</div>
</header>