<script lang="ts">
	import type { NewsletterIssue } from '#lib/types/newsletter';
	import Badge from '#lib/components/ui/Badge.svelte';
	import { formatAudienceLabel, formatDate, formatPercentFixed } from '#lib/utils/format';
	import { renderEditorialMarkdown } from '#lib/utils/markdown-renderer';

	interface Props {
		issue: NewsletterIssue;
		/** Rendered HTML for the body; derived from markdown when omitted. */
		contentHtml?: string;
		class?: string;
	}

	let { issue, contentHtml, class: customClass = '' }: Props = $props();

	// Preview always reflects the *current* markdown, not the last persisted HTML.
	const previewHtml = $derived(contentHtml ?? renderEditorialMarkdown(issue.contentMarkdown));

	const statusVariant = $derived(
		issue.status === 'sent'
			? ('success' as const)
			: issue.status === 'scheduled'
				? ('warning' as const)
				: issue.status === 'archived'
					? ('neutral' as const)
					: ('outline' as const)
	);

	const hasStats = $derived(issue.stats.totalRecipients > 0);
</script>

<section
	class="bg-white border border-stone-200 rounded-lg shadow-panel overflow-hidden {customClass}"
	aria-label="Issue preview"
>
	<header class="px-5 py-4 border-b border-stone-200 bg-stone-50">
		<div class="flex items-start justify-between gap-3">
			<div class="min-w-0">
				<h2 class="font-serif font-bold text-stone-900 text-lg tracking-tight">
					{issue.title || 'Untitled Dispatch'}
				</h2>
				{#if issue.subtitle}
					<p class="text-sm text-stone-600 mt-0.5">{issue.subtitle}</p>
				{/if}
			</div>
			<Badge variant={statusVariant} size="sm">{issue.status}</Badge>
		</div>

		<p class="text-[11px] font-mono text-stone-500 mt-2">
			/{issue.slug} · {formatAudienceLabel(issue.audience)} · {issue.authorName}
		</p>
	</header>

	<div class="px-5 py-4 border-b border-stone-200 space-y-3">
		{#if issue.coverImageUrl}
			<img
				src={issue.coverImageUrl}
				alt=""
				width="1200"
				height="480"
				class="w-full h-48 object-cover rounded border border-stone-200"
				loading="lazy"
				decoding="async"
			/>
		{/if}

		{#if issue.tags.length > 0}
			<div class="flex flex-wrap gap-1.5">
				{#each issue.tags as tag (tag)}
					<Badge variant="outline" size="sm">{tag}</Badge>
				{/each}
			</div>
		{/if}

		<dl class="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
			<div>
				<dt class="text-stone-500">Created</dt>
				<dd class="font-mono text-stone-900">{formatDate(issue.createdAt)}</dd>
			</div>
			<div>
				<dt class="text-stone-500">Scheduled</dt>
				<dd class="font-mono text-stone-900">{formatDate(issue.scheduledAt)}</dd>
			</div>
			<div>
				<dt class="text-stone-500">Published</dt>
				<dd class="font-mono text-stone-900">{formatDate(issue.publishedAt)}</dd>
			</div>
			<div>
				<dt class="text-stone-500">Recipients</dt>
				<dd class="font-mono text-stone-900 tabular-nums">{issue.stats.totalRecipients}</dd>
			</div>
		</dl>

		{#if hasStats}
			<div class="flex flex-wrap gap-4 text-xs font-mono tabular-nums border-t border-stone-100 pt-3">
				<span class="text-stone-600">
					Open rate <strong class="text-stone-900">
						{formatPercentFixed(
							issue.stats.deliveredCount > 0
								? (issue.stats.openedCount / issue.stats.deliveredCount) * 100
								: 0
						)}
					</strong>
				</span>
				<span class="text-stone-600">
					Delivered <strong class="text-stone-900">{issue.stats.deliveredCount}</strong>
				</span>
				<span class="text-stone-600">
					Bounced <strong class="text-rose-700">{issue.stats.bouncedCount}</strong>
				</span>
			</div>
		{/if}
	</div>

	<div class="px-5 py-4 max-h-[60vh] overflow-y-auto">
		{#if previewHtml.trim().length > 0}
			<div class="editorial-body">
				<!-- Sanitised by the renderer: author input is escaped before markup is produced. -->
				{@html previewHtml}
			</div>
		{:else}
			<div class="py-10 text-center text-sm text-stone-500">
				<p>Nothing to preview yet.</p>
				<p class="text-xs text-stone-400 mt-1">Start writing the body to see it rendered here.</p>
			</div>
		{/if}
	</div>
</section>