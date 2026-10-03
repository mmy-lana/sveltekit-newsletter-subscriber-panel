<script lang="ts">
	import type { NewsletterIssue } from '#lib/types/newsletter';
	import Byline from '#lib/components/editorial/Byline.svelte';

	interface Props {
		issue: NewsletterIssue;
		/** Precomputed read time; derived from the body when omitted. */
		readingMinutes?: number;
		issueNumber?: number | null;
	}

	let { issue, readingMinutes, issueNumber = null }: Props = $props();
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

	<h1 class="font-serif font-bold text-3xl sm:text-4xl lg:text-5xl text-stone-900 tracking-tight leading-tight">
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

	{#if issue.coverImageUrl}
		<img
			src={issue.coverImageUrl}
			alt=""
			class="w-full h-56 sm:h-72 lg:h-96 object-cover rounded border border-stone-200"
		/>
	{/if}
</header>