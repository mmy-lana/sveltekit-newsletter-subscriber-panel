<script lang="ts">
	import { renderEditorialMarkdown } from '#lib/utils/markdown-renderer';

	interface Props {
		/** Raw markdown body. */
		contentMarkdown: string;
		/** Pre-rendered HTML; when omitted the markdown is rendered here. */
		contentHtml?: string;
		class?: string;
	}

	let { contentMarkdown, contentHtml, class: customClass = '' }: Props = $props();

	const html = $derived(contentHtml ?? renderEditorialMarkdown(contentMarkdown));
	const isEmpty = $derived(html.trim().length === 0);
</script>

<div class="editorial-body {customClass}">
	{#if isEmpty}
		<p class="text-stone-500 font-sans text-base">
			This dispatch has no body content yet.
		</p>
	{:else}
		<!--
			`html` is produced by renderEditorialMarkdown, which HTML-escapes author input
			before emitting markup and allow-lists link schemes, so it is safe to inject.
		-->
		{@html html}
	{/if}
</div>