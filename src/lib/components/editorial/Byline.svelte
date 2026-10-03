<script lang="ts">
	import { formatDate, formatRelativeTime, toInitials } from '#lib/utils/format';

	interface Props {
		authorName: string;
		authorAvatarUrl?: string | null;
		/** ISO timestamp rendered as the dateline. */
		publishedAt?: string | null;
		/** ISO timestamp used for the machine-readable dateTime attribute. */
		datetime?: string | null;
		/** Optional read-time estimate. */
		readingMinutes?: number;
		/** Optional issue number within the publication run. */
		issueNumber?: number | null;
		class?: string;
	}

	let {
		authorName,
		authorAvatarUrl = null,
		publishedAt = null,
		datetime = null,
		readingMinutes,
		issueNumber = null,
		class: customClass = ''
	}: Props = $props();

	const nameParts = $derived(authorName.trim().split(/\s+/));
	const firstName = $derived(nameParts[0] ?? '');
	const lastName = $derived(nameParts.slice(1).join(' '));
</script>

<div class="flex items-center gap-3 {customClass}">
	{#if authorAvatarUrl}
		<img
			src={authorAvatarUrl}
			alt=""
			class="w-10 h-10 rounded-full object-cover border border-stone-200"
			loading="lazy"
		/>
	{:else}
		<span
			class="w-10 h-10 rounded-full bg-stone-200 text-stone-700 inline-flex items-center justify-center text-xs font-mono"
			aria-hidden="true"
		>
			{toInitials(firstName ?? '', lastName)}
		</span>
	{/if}

	<div class="min-w-0">
		<p class="text-sm text-stone-900">
			{#if issueNumber}
				<span class="font-mono text-xs text-stone-500 uppercase tracking-wider mr-1.5">
					No. {issueNumber}
				</span>
			{/if}
			<span class="font-medium">{authorName}</span>
		</p>
		<p class="text-xs text-stone-500 font-mono">
			{#if publishedAt}
				<time datetime={datetime ?? publishedAt ?? undefined}>{formatDate(publishedAt)}</time>
				<span class="text-stone-400"> · {formatRelativeTime(publishedAt)}</span>
			{:else}
				Unpublished draft
			{/if}
			{#if typeof readingMinutes === 'number'}
				<span class="text-stone-400"> · {readingMinutes} min read</span>
			{/if}
		</p>
	</div>
</div>