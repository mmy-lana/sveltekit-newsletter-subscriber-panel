<script lang="ts">
	import type { NewsletterIssue } from '#lib/types/newsletter';
	import Byline from '#lib/components/editorial/Byline.svelte';
	import { toSafeImageSource } from '#lib/utils/validators';

	interface Props {
		issue: NewsletterIssue;
		/** Precomputed read time; derived from the body when omitted. */
		readingMinutes?: number;
		issueNumber?: number | null;
	}

	let { issue, readingMinutes, issueNumber = null }: Props = $props();

	/**
	 * The cover URL is author-supplied, so it is allow-listed before it reaches an
	 * image attribute: an untrusted `javascript:`/`data:`/`//host` value is dropped
	 * rather than rendered.
	 */
	const coverImageSrc = $derived(toSafeImageSource(issue.coverImageUrl));
</script>

<header class="space-y-5">
	{#if issue.tags.length > 0}
		<div class="flex flex-wrap gap-2">
			{#each issue.tags as tag (tag)}
				<span
					class="font-mono text-[11px] uppercase tracking-wider text-stone-500 border border-stone-200 rounded-full px-2.5 py-0.5"
				>
					{tag}
				</span>
			{/each}
		</div>
	{/if}

	<h1 class="font-serif font-bold text-3xl sm:text-4xl lg:text-5xl text-stone-900 tracking-tight leading-tight text-balance">
		{issue.title}
	</h1>

	{#if issue.subtitle}
		<p class="font-serif text-lg sm:text-xl text-stone-600 leading-relaxed">{issue.subtitle}</p>
	{/if}

	<Byline
		authorName={issue.authorName}
		authorAvatarUrl={issue.authorAvatarUrl}
		publishedAt={issue.publishedAt}
		{readingMinutes}
		{issueNumber}
	/>

	{#if coverImageSrc}
		<img
			src={coverImageSrc}
			alt=""
			width="1200"
			height="480"
			class="w-full h-56 sm:h-72 lg:h-96 object-cover rounded border border-stone-200"
			decoding="async"
		/>
	{/if}
</header>