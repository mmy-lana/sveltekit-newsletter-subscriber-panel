<script lang="ts">
	import type { NewsletterIssue } from '#lib/types/newsletter';
	import { formatDate } from '#lib/utils/format';

	interface Props {
		issue: NewsletterIssue;
		/** Position in the publication run, rendered as a serial number. */
		issueNumber?: number | null;
		class?: string;
	}

	let { issue, issueNumber = null, class: customClass = '' }: Props = $props();

	/** Plain-text summary derived from the markdown body when no excerpt exists. */
	const summary = $derived(
		issue.excerpt.trim().length > 0 ? issue.excerpt : 'This dispatch has no summary yet.'
	);
</script>

<article class="py-6 sm:py-8 space-y-2">
	<div class="flex items-center gap-3 text-[11px] font-mono uppercase tracking-wider text-stone-500">
		{#if issueNumber}
			<span>No. {issueNumber}</span>
			<span aria-hidden="true">·</span>
		{/if}
		{#if issue.publishedAt}
			<time datetime={issue.publishedAt}>{formatDate(issue.publishedAt)}</time>
		{:else}
			<span>Unpublished</span>
		{/if}
		{#if issue.stats.totalRecipients > 0}
			<span aria-hidden="true">·</span>
			<span>{issue.stats.totalRecipients} recipients</span>
		{/if}
	</div>

	<h3 class="text-xl sm:text-2xl font-serif font-bold text-stone-900 tracking-tight">
		<a
			href="/p/{issue.slug}"
			class="inline-flex items-center min-h-[44px] hover:underline underline-offset-4 decoration-stone-300"
		>
			{issue.title}
		</a>
	</h3>

	{#if issue.subtitle}
		<p class="font-serif text-stone-700 leading-relaxed">{issue.subtitle}</p>
	{/if}

	<p class="text-sm text-stone-600 leading-relaxed">{summary}</p>

	<a
		href="/p/{issue.slug}"
		class="inline-flex items-center gap-1 text-sm text-stone-900 font-medium underline underline-offset-4 decoration-stone-300 hover:decoration-stone-900 min-h-[44px] {customClass}"
	>
		Read dispatch
		<svg
			class="w-4 h-4"
			fill="none"
			viewBox="0 0 24 24"
			stroke="currentColor"
			aria-hidden="true"
			focusable="false"
		>
			<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 8l4 4m0 0l-4 4m4-4H3"
			></path>
		</svg>
	</a>
</article>