<script lang="ts">
	import { goto } from '$app/navigation';
	import type { DistributionResult, NewsletterIssue } from '#lib/types/newsletter';
	import type { SelectOption } from '#lib/types/ui';
	import AdminHeader from '#lib/components/panel/AdminHeader.svelte';
	import AdminSidebar from '#lib/components/panel/AdminSidebar.svelte';
	import IssueDeliveryQueueModal from '#lib/components/panel/IssueDeliveryQueueModal.svelte';
	import Badge from '#lib/components/ui/Badge.svelte';
	import Button from '#lib/components/ui/Button.svelte';
	import Pagination from '#lib/components/ui/Pagination.svelte';
	import Select from '#lib/components/ui/Select.svelte';
	import { getIssueState } from '#lib/state/issue.svelte';
	import { getDeliveryQueue } from '#lib/state/queue.svelte';
	import { getSubscriberState } from '#lib/state/subscriber.svelte';
	import { getToastState } from '#lib/state/toast.svelte';
	import { getSettingsState } from '#lib/state/settings.svelte';
	import { formatDate, formatPercentFixed } from '#lib/utils/format';
	import { calculateClickThroughRate, calculateOpenRate, resolveAudienceSubscribers } from '#lib/utils/metrics-calculator';

	const issueStore = getIssueState();
	const subscriberStore = getSubscriberState();
	const queue = getDeliveryQueue();
	const toastStore = getToastState();
	const settingsStore = getSettingsState();

	const settings = $derived(settingsStore.settings);

	let isMobileNavOpen = $state(false);
	let dispatchIssue = $state<NewsletterIssue | null>(null);
	let dispatchStatus = $state<'idle' | 'running' | 'paused' | 'finished'>('idle');
	let dispatchSummary = $state<DistributionResult | null>(null);
	let deleteTarget = $state<NewsletterIssue | null>(null);

	const statusOptions: SelectOption[] = [
		{ value: 'all', label: 'All statuses' },
		{ value: 'draft', label: 'Draft' },
		{ value: 'scheduled', label: 'Scheduled' },
		{ value: 'sent', label: 'Sent' },
		{ value: 'archived', label: 'Archived' }
	];

	const sortOptions: SelectOption[] = [
		{ value: 'createdAt', label: 'Recently created' },
		{ value: 'publishedAt', label: 'Recently published' },
		{ value: 'title', label: 'Title A–Z' },
		{ value: 'totalRecipients', label: 'Recipients' }
	];

	const activeSubscribers = $derived(subscriberStore.activeCount);

	const targetRecipients = $derived(
		dispatchIssue ? resolveAudienceSubscribers(subscriberStore.items, dispatchIssue.audience) : []
	);

	const excludedRecipients = $derived(
		dispatchIssue ? Math.max(0, subscriberStore.totalCount - targetRecipients.length) : 0
	);

	const queuedJobTotal = $derived(queue.totalQueueCount);

	function statusVariant(status: NewsletterIssue['status']) {
		switch (status) {
			case 'sent':
				return 'success' as const;
			case 'scheduled':
				return 'warning' as const;
			case 'archived':
				return 'neutral' as const;
			default:
				return 'outline' as const;
		}
	}

	function openDispatch(issue: NewsletterIssue): void {
		queue.reset();
		dispatchSummary = null;
		dispatchStatus = 'idle';
		dispatchIssue = issue;
	}

	async function startDispatch(): Promise<void> {
		if (!dispatchIssue) return;

		queue.enqueueIssue(dispatchIssue, targetRecipients);
		dispatchStatus = 'running';

		const result = await queue.runDistribution({ batchSize: 20 });

		dispatchSummary = result;
		dispatchStatus = 'finished';

		if (!dispatchIssue) return;

		// Reconcile the run into the issue: status, publication timestamp, statistics.
		issueStore.markAsSentFromJobs(dispatchIssue.id, queue.jobs, targetRecipients.length);

		// One pass over the audience and one storage write, instead of one write per
		// recipient (which was quadratic for a large dispatch).
		subscriberStore.recordDeliveriesBatch(
			queue.jobs
				.filter((job) => job.status === 'delivered')
				.map((job) => ({
					subscriberId: job.subscriberId,
					opened: job.openedAt !== null,
					clicked: job.clickedAt !== null,
					openedAt: job.openedAt
				}))
		);

		if (queue.statusCounts.bounced > 0) {
			const bouncedIds = queue.jobs
				.filter((job) => job.status === 'bounced')
				.map((job) => job.subscriberId);
			subscriberStore.bulkUpdateStatus(bouncedIds, 'bounced');
		}

		if (result.cancelled) {
			toastStore.warning('Distribution halted', `${result.delivered} delivered before the run was stopped.`);
		} else {
			toastStore.success(
				'Dispatch complete',
				`${result.delivered} delivered · ${result.opened} opened · ${result.bounced} bounced.`
			);
		}
	}

	function handleComplete(): void {
		queue.reset();
		dispatchIssue = null;
		dispatchSummary = null;
		dispatchStatus = 'idle';
	}

	function handleClose(): void {
		if (dispatchStatus === 'running' || dispatchStatus === 'paused') return;
		handleComplete();
	}

	// A rejected write (quota exhausted, private mode) is surfaced once, then cleared.
	$effect(() => {
		const message = subscriberStore.persistenceError;
		if (!message) return;
		toastStore.error('Not saved', message);
		subscriberStore.dismissPersistenceError();
	});

	async function createNewDraft(): Promise<void> {
		const draft = issueStore.createDraft();
		await goto(`/admin/issues/${draft.id}`);
	}

	function handleDelete(): void {
		if (!deleteTarget) return;
		issueStore.deleteIssue(deleteTarget.id);
		toastStore.success('Issue deleted', deleteTarget.title);
		deleteTarget = null;
	}
</script>

<svelte:head>
	<title>Issues — {settings.publicationName}</title>
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
			title="Newsletter Issues"
			count={issueStore.totalCount}
			subtitle="Drafts {issueStore.draftCount} · Scheduled {issueStore.scheduledCount} · Sent {issueStore.sentCount}"
			ontogglenav={() => (isMobileNavOpen = true)}
		>
			{#snippet actions()}
				<Button variant="primary" size="sm" onclick={createNewDraft}>New Dispatch</Button>
			{/snippet}
		</AdminHeader>

		<main id="main-content" class="flex-1 overflow-y-auto p-4 sm:p-6 pb-24 sm:pb-12">
			<div class="max-w-6xl mx-auto space-y-4">
				<div class="flex flex-col sm:flex-row gap-3">
					<div class="flex-1">
						<label for="issue-search" class="sr-only">Search issues</label>
						<input
							id="issue-search"
							type="search"
							autocomplete="off"
							spellcheck="false"
							value={issueStore.filters.searchQuery}
							oninput={(event) => issueStore.setFilter('searchQuery', event.currentTarget.value)}
							placeholder="Search title, slug or tag…"
							class="w-full min-h-[44px] border border-stone-300 rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-stone-900 focus-visible:ring-offset-1"
						/>
					</div>
					<Select
						class="sm:w-44"
						label="Status"
						hideLabel
						options={statusOptions}
						value={issueStore.filters.status}
						onchange={(event) =>
							issueStore.setFilter('status', event.currentTarget.value as NewsletterIssue['status'] | 'all')}
					/>
					<Select
						class="sm:w-48"
						label="Sort by"
						hideLabel
						options={sortOptions}
						value={issueStore.filters.sortBy}
						onchange={(event) => issueStore.setFilter('sortBy', event.currentTarget.value as never)}
					/>
				</div>

				<div class="bg-white border border-stone-200 rounded-lg overflow-hidden shadow-panel">
					{#if issueStore.filteredItems.length === 0}
						<div class="px-4 py-12 text-center space-y-3">
							<h3 class="font-serif text-lg text-stone-900">
								{issueStore.totalCount === 0 ? 'No issues yet' : 'No issues match the current filters'}
							</h3>
							<p class="text-sm text-stone-500 max-w-md mx-auto">
								{issueStore.totalCount === 0
									? 'Create your first dispatch draft and the editor will open here.'
									: 'Try a different search term or status filter.'}
							</p>
							{#if issueStore.totalCount === 0}
								<Button variant="primary" size="sm" onclick={createNewDraft}>New Dispatch</Button>
							{:else}
								<Button variant="outline" size="sm" onclick={() => issueStore.setFilter('status', 'all')}>
									Clear filters
								</Button>
							{/if}
						</div>
					{:else}
						<ul class="divide-y divide-stone-200">
							{#each issueStore.paginatedItems as item (item.id)}
								<li class="p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
									<div class="space-y-1.5 min-w-0">
										<div class="flex items-center gap-2 flex-wrap">
											<h2 class="font-serif font-bold text-stone-900 text-base truncate">
												{item.title}
											</h2>
											<Badge variant={statusVariant(item.status)} size="sm">{item.status}</Badge>
											{#if item.tags.length > 0}
												<span class="text-[11px] font-mono text-stone-400">{item.tags.join(' · ')}</span>
											{/if}
										</div>

										<p class="text-xs text-stone-500 font-mono break-all">
											/{item.slug} · created {formatDate(item.createdAt)}
											{#if item.scheduledAt}
												· scheduled {formatDate(item.scheduledAt)}
											{/if}
										</p>

										{#if item.excerpt}
											<p class="text-sm text-stone-600 line-clamp-2">{item.excerpt}</p>
										{/if}

										{#if item.status === 'sent'}
											<p class="text-xs text-stone-600 font-mono tabular-nums">
												Delivered {item.stats.deliveredCount}/{item.stats.totalRecipients} · Opens
												{item.stats.openedCount} · Clicks {item.stats.clickedCount} · Bounces
												{item.stats.bouncedCount} · Open rate
												{formatPercentFixed(
													calculateOpenRate(item.stats.openedCount, item.stats.deliveredCount)
												)} · Click-through
												{formatPercentFixed(
													calculateClickThroughRate(item.stats.clickedCount, item.stats.deliveredCount)
												)}
											</p>
										{/if}
									</div>

									<div class="flex items-center gap-2 shrink-0 flex-wrap">
										<a
											href="/admin/issues/{item.id}"
											class="inline-flex items-center justify-center border border-stone-300 rounded px-3 py-1.5 text-xs font-medium text-stone-800 hover:bg-stone-50 min-h-[44px]"
										>
											{item.status === 'sent' ? 'View' : 'Edit'}
										</a>
										<Button
											variant="ghost"
											size="sm"
											class="text-rose-700"
											onclick={() => (deleteTarget = item)}
										>
											Delete
										</Button>
										{#if item.status !== 'sent'}
											<Button
												variant="primary"
												size="sm"
												onclick={() => openDispatch(item)}
												disabled={activeSubscribers === 0}
											>
												Send Issue
											</Button>
										{/if}
									</div>
								</li>
							{/each}
						</ul>
					{/if}
				</div>

				<div class="flex items-center justify-between gap-3 flex-wrap">
					<p class="text-xs font-mono text-stone-500 tabular-nums">
						Page {issueStore.currentPage} of {issueStore.totalPages} · {issueStore.filteredItems.length} of
						{issueStore.totalCount} shown
					</p>
					<Pagination
						page={issueStore.currentPage}
						totalPages={issueStore.totalPages}
						onpagechange={(page) => issueStore.setPage(page)}
					/>
				</div>
			</div>
		</main>
	</div>
</div>

{#if dispatchIssue}
	<IssueDeliveryQueueModal
		isOpen={true}
		issue={dispatchIssue}
		targetRecipients={targetRecipients.length}
		{excludedRecipients}
		status={dispatchStatus}
		progressPercent={queue.progressPercent}
		processedCount={queue.processedCount}
		totalQueueCount={queuedJobTotal}
		summary={dispatchSummary}
		ondispatch={startDispatch}
		onpause={() => queue.pause()}
		onresume={() => queue.resume()}
		onhalt={() => queue.cancelDistribution()}
		oncomplete={handleComplete}
		onclose={handleClose}
	/>
{/if}

{#if deleteTarget}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center p-4"
		role="dialog"
		aria-modal="true"
		aria-labelledby="delete-issue-title"
	>
		<div class="fixed inset-0 bg-stone-900/40 backdrop-blur-sm animate-fade-in" aria-hidden="true"></div>

		<div
			class="relative z-10 w-full max-w-md bg-white rounded-lg shadow-modal border border-stone-200 overflow-hidden animate-sheet-rise"
			role="document"
		>
			<div class="px-6 py-4 border-b border-stone-200">
				<h2 id="delete-issue-title" class="text-lg font-serif font-bold text-stone-900">Delete issue?</h2>
			</div>

			<div class="px-6 py-4 text-sm text-stone-700 space-y-2">
				<p><strong>{deleteTarget.title}</strong> and its delivery statistics will be removed.</p>
				<p class="text-xs text-stone-500">This action cannot be undone.</p>
			</div>

			<div class="px-6 py-3 bg-stone-50 border-t border-stone-200 flex items-center justify-end gap-3 pb-safe-bottom">
				<Button variant="outline" size="sm" onclick={() => (deleteTarget = null)}>Cancel</Button>
				<Button variant="danger" size="sm" onclick={handleDelete}>Delete issue</Button>
			</div>
		</div>
	</div>
{/if}