<script lang="ts">
	import { page } from '$app/state';
	import { untrack } from 'svelte';
	import type { NewsletterIssue } from '#lib/types/newsletter';
	import AdminHeader from '#lib/components/panel/AdminHeader.svelte';
	import AdminSidebar from '#lib/components/panel/AdminSidebar.svelte';
	import IssueEditor from '#lib/components/panel/IssueEditor.svelte';
	import IssuePreviewPane from '#lib/components/panel/IssuePreviewPane.svelte';
	import Button from '#lib/components/ui/Button.svelte';
	import Skeleton from '#lib/components/ui/Skeleton.svelte';
	import { getIssueState } from '#lib/state/issue.svelte';
	import { getSubscriberState } from '#lib/state/subscriber.svelte';
	import { getToastState } from '#lib/state/toast.svelte';
	import { getSettingsState } from '#lib/state/settings.svelte';
	import type { IssueEditorDraft } from '#lib/components/panel/IssueEditor.svelte';
	import { isNonEmpty } from '#lib/utils/validators';

	const issueStore = getIssueState();
	const subscriberStore = getSubscriberState();
	const toastStore = getToastState();
	const settingsStore = getSettingsState();

	const settings = $derived(settingsStore.settings);
	const issueId = $derived(page.params.id ?? '');

	const issue = $derived(issueStore.getById(issueId));

	/**
	 * [UX-01] The store is seeded with fixtures so the server render and the first
	 * client render agree; persisted data arrives during hydration. Until then the
	 * route must not claim the issue is missing, which would flash a false 404 on a
	 * direct URL visit and then swap to the editor.
	 */
	const isReady = $derived(issueStore.isHydrated);

	let isMobileNavOpen = $state(false);

	/** Draft overlay: edits stay local until the operator saves them. */
	let draft = $state<IssueEditorDraft | null>(null);
	let savedAt = $state<string | null>(null);
	let isSaving = $state(false);

	/** Stored issue with the unsaved draft layered on top, for the live preview. */
	const previewIssue = $derived.by<NewsletterIssue | null>(() => {
		if (!issue) return null;
		return draft ? { ...issue, ...draft } : issue;
	});

	const validationError = $derived(
		draft && !isNonEmpty(draft.title) ? 'A title is required before an issue can be dispatched.' : null
	);

	const isDirty = $derived.by(() => {
		if (!issue || !draft) return false;
		return (
			draft.title !== issue.title ||
			draft.subtitle !== issue.subtitle ||
			draft.excerpt !== issue.excerpt ||
			draft.contentMarkdown !== issue.contentMarkdown ||
			draft.audience !== issue.audience ||
			draft.authorName !== issue.authorName ||
			draft.coverImageUrl !== (issue.coverImageUrl ?? '') ||
			(draft.scheduledAt ?? '') !== (issue.scheduledAt ?? '') ||
			draft.tags.join(',') !== issue.tags.join(',')
		);
	});

	/**
	 * Seeds the local draft whenever a different issue is opened. Server render and
	 * first client render agree because the draft starts from the stored values.
	 */
	let loadedIssueId = $state<string | null>(untrack(() => issue?.id ?? null));

	$effect(() => {
		if (!issue) return;
		if (issue.id === loadedIssueId && draft) return;
		loadedIssueId = issue.id;
		draft = {
			title: issue.title,
			subtitle: issue.subtitle,
			excerpt: issue.excerpt,
			contentMarkdown: issue.contentMarkdown,
			audience: issue.audience,
			tags: [...issue.tags],
			authorName: issue.authorName,
			coverImageUrl: issue.coverImageUrl ?? '',
			scheduledAt: issue.scheduledAt
		};
		savedAt = issue.updatedAt;
	});

	function handleChange(patch: Partial<IssueEditorDraft>): void {
		if (!draft || !issue) return;
		draft = { ...draft, ...patch };
	}

	function handleSave(): void {
		if (!issue || !draft || validationError) return;

		isSaving = true;
		issueStore.updateIssue(issue.id, {
			...draft,
			coverImageUrl: draft.coverImageUrl === '' ? null : draft.coverImageUrl,
			scheduledAt: draft.scheduledAt ? new Date(`${draft.scheduledAt}:00Z`).toISOString() : null
		});
		savedAt = new Date().toISOString();
		isSaving = false;
		toastStore.success('Issue saved', issue.title);
	}

	function handleDelete(): void {
		if (!issue) return;
		issueStore.deleteIssue(issue.id);
		toastStore.success('Issue deleted', issue.title);
	}
</script>

<svelte:head>
	<title>{issue ? `${issue.title} — Editor` : 'Issue not found'}</title>
</svelte:head>

<div class="flex h-[100dvh] bg-paper overflow-hidden">
	<a
	href="#main-content"
	class="sr-only focus:not-sr-only focus:absolute focus:z-[70] focus:top-3 focus:left-3 focus:px-4 focus:py-2 focus:rounded-md focus:bg-stone-900 focus:text-stone-50 text-sm font-medium"
>
	Skip to main content
</a>
	<AdminSidebar
		isMobileOpen={isMobileNavOpen}
		subscriberCount={subscriberStore.totalCount}
		onclose={() => (isMobileNavOpen = false)}
	/>

	<div class="flex-1 flex flex-col min-w-0 overflow-hidden">
		<AdminHeader
			title={issue?.title ?? 'Issue not found'}
			subtitle={issue ? `/${issue.slug}` : undefined}
			ontogglenav={() => (isMobileNavOpen = true)}
		>
			{#snippet actions()}
				<a
					href="/admin/issues"
					class="inline-flex items-center justify-center min-h-[44px] px-3 border border-stone-300 rounded text-xs font-medium text-stone-700 hover:bg-stone-100 transition-colors"
				>
					Back
				</a>
				{#if issue && issue.status === 'sent'}
					<a
						href="/p/{issue.slug}"
						class="inline-flex items-center justify-center min-h-[44px] px-3 border border-stone-300 rounded text-xs font-medium text-stone-700 hover:bg-stone-100 transition-colors"
					>
						View live
					</a>
				{/if}
			{/snippet}
		</AdminHeader>

		<main id="main-content" class="flex-1 overflow-y-auto p-4 sm:p-6 pb-24 sm:pb-12">
			<div class="max-w-6xl mx-auto">
				{#if !isReady}
					<!-- Placeholder mirrors the editor layout so the layout does not jump. -->
					<div
						class="bg-white border border-stone-200 rounded-lg shadow-panel p-5 space-y-5"
						role="status"
						aria-live="polite"
					>
						<span class="sr-only">Loading issue…</span>
						<Skeleton variant="text" width="w-32" height="h-3" />
						<Skeleton variant="block" height="h-12" />
						<Skeleton variant="block" height="h-9" />
						<Skeleton lines={3} />
						<div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
							<Skeleton variant="block" height="h-11" />
							<Skeleton variant="block" height="h-11" />
						</div>
						<Skeleton variant="block" height="h-64" />
					</div>
				{:else if issue && draft}
					<div class="grid grid-cols-1 xl:grid-cols-2 gap-6">
						<div class="bg-white border border-stone-200 rounded-lg shadow-panel p-5">
							<IssueEditor
								{issue}
								{isDirty}
								{isSaving}
								{savedAt}
								{validationError}
								onchange={handleChange}
								onsave={handleSave}
								ondelete={handleDelete}
							/>
						</div>

						<div class="xl:sticky xl:top-0 xl:self-start">
							<IssuePreviewPane
								issue={previewIssue ?? issue}
								class="xl:max-h-[calc(100dvh-8rem)]"
							/>
						</div>
					</div>
				{:else}
					<div class="bg-white border border-stone-200 rounded-lg shadow-panel px-6 py-16 text-center space-y-4">
						<h2 class="font-serif text-2xl font-bold text-stone-900">Issue not found</h2>
						<p class="text-sm text-stone-600 max-w-md mx-auto">
							No issue exists with the id <span class="font-mono">{issueId}</span>. It may have been
							deleted from this browser.
						</p>
						<Button variant="primary" size="sm" onclick={() => history.back()}>
							Go back
						</Button>
					</div>
				{/if}
			</div>
		</main>
	</div>
</div>