<script lang="ts">
	import type { CsvImportResult, Subscriber, SubscriberStatus } from '#lib/types/newsletter';
	import AdminHeader from '#lib/components/panel/AdminHeader.svelte';
	import AdminSidebar from '#lib/components/panel/AdminSidebar.svelte';
	import CsvImportModal from '#lib/components/panel/CsvImportModal.svelte';
	import SubscriberFilterBar from '#lib/components/panel/SubscriberFilterBar.svelte';
	import SubscriberModal from '#lib/components/panel/SubscriberModal.svelte';
	import SubscriberTable from '#lib/components/panel/SubscriberTable.svelte';
	import Button from '#lib/components/ui/Button.svelte';
	import Pagination from '#lib/components/ui/Pagination.svelte';
	import { getSubscriberState } from '#lib/state/subscriber.svelte';
	import { getToastState } from '#lib/state/toast.svelte';
	import { parseSubscribersCsv } from '#lib/utils/csv-parser';
	import { getSettingsState } from '#lib/state/settings.svelte';

	const subscriberStore = getSubscriberState();
	const toastStore = getToastState();
	const settingsStore = getSettingsState();

	const settings = $derived(settingsStore.settings);

	let isMobileNavOpen = $state(false);
	let selectedIds = $state<string[]>([]);
	let isSubscriberModalOpen = $state(false);
	let isImportModalOpen = $state(false);
	let editingSubscriber = $state<Subscriber | null>(null);
	let deleteTarget = $state<Subscriber | null>(null);
	let csvResult = $state<CsvImportResult | null>(null);
	let isSaving = $state(false);

	const filters = $derived(subscriberStore.filters);
	const selectedOnPage = $derived(
		subscriberStore.paginatedItems.filter((subscriber) => selectedIds.includes(subscriber.id))
	);

	function openCreateModal(): void {
		editingSubscriber = null;
		isSubscriberModalOpen = true;
	}

	function openEditModal(subscriber: Subscriber): void {
		editingSubscriber = subscriber;
		isSubscriberModalOpen = true;
	}

	function handleSave(draft: {
		id?: string;
		email: string;
		firstName: string;
		lastName: string;
		status: SubscriberStatus;
		tier: Subscriber['tier'];
		tags: string[];
		notes: string;
	}): void {
		isSaving = true;

		const payload = {
			email: draft.email,
			firstName: draft.firstName,
			lastName: draft.lastName,
			status: draft.status,
			tier: draft.tier,
			tags: draft.tags,
			notes: draft.notes
		};

		if (draft.id) {
			// An edit must not collide with a different record: the email is the
			// identity used for delivery and suppression.
			const collision = subscriberStore.items.find(
				(subscriber) => subscriber.id !== draft.id && subscriber.email === draft.email
			);

			if (collision) {
				isSaving = false;
				toastStore.error('Duplicate address', 'This email is already in use by another subscriber.');
				return;
			}

			subscriberStore.updateSubscriber(draft.id, payload);
			toastStore.success('Subscriber updated', draft.email);
		} else {
			const existing = subscriberStore.getByEmail(draft.email);
			if (existing) {
				toastStore.error('Duplicate address', `${draft.email} is already in the audience.`);
				isSaving = false;
				return;
			}
			subscriberStore.addSubscriber(payload);
			toastStore.success('Subscriber added', draft.email);
		}

		isSaving = false;
		isSubscriberModalOpen = false;
		editingSubscriber = null;
	}

	function handleCsvImport(csvText: string): void {
		const existing = new Set(subscriberStore.existingEmails);
		const { imported, summary } = parseSubscribersCsv(csvText, existing);

		if (summary.totalRows === 0) {
			toastStore.warning('Nothing to import', 'No data rows were found below the header.');
			csvResult = summary;
			return;
		}

		if (imported.length === 0) {
			toastStore.error('Import failed', `${summary.failedImports} row(s) rejected. See the report for details.`);
			csvResult = summary;
			return;
		}

		subscriberStore.addBatch(imported);
		csvResult = summary;
		toastStore.success(
			'Import complete',
			`${summary.successfulImports} subscriber(s) added${summary.failedImports > 0 ? `, ${summary.failedImports} rejected` : ''}.`
		);
	}

	function handleToggleSelect(id: string): void {
		selectedIds = selectedIds.includes(id)
			? selectedIds.filter((selectedId) => selectedId !== id)
			: [...selectedIds, id];
	}

	function handleToggleSelectAll(ids: string[]): void {
		const allSelected = ids.every((id) => selectedIds.includes(id));
		selectedIds = allSelected
			? selectedIds.filter((id) => !ids.includes(id))
			: Array.from(new Set([...selectedIds, ...ids]));
	}

	function handleBulkStatus(status: SubscriberStatus): void {
		const changed = subscriberStore.bulkUpdateStatus(selectedIds, status);
		const skipped = selectedIds.length - changed;
		toastStore.success(
			'Status updated',
			skipped > 0
				? `${changed} updated, ${skipped} skipped (bounced addresses are protected).`
				: `${changed} subscriber(s) marked ${status}.`
		);
		selectedIds = [];
	}

	function handleBulkDelete(): void {
		const count = selectedIds.length;
		subscriberStore.bulkDelete(selectedIds);
		selectedIds = [];
		toastStore.success('Subscribers deleted', `${count} record(s) removed from the audience.`);
	}

	// A rejected write (quota exhausted, private mode) is surfaced once, then cleared.
	$effect(() => {
		const message = subscriberStore.persistenceError;
		if (!message) return;
		toastStore.error('Not saved', message);
		subscriberStore.dismissPersistenceError();
	});

	function handleDelete(): void {
		if (!deleteTarget) return;
		subscriberStore.deleteSubscriber(deleteTarget.id);
		selectedIds = selectedIds.filter((id) => id !== deleteTarget?.id);
		toastStore.success('Subscriber deleted', deleteTarget.email);
		deleteTarget = null;
	}
</script>

<svelte:head>
	<title>Subscribers — {settings.publicationName}</title>
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
			title="Subscribers"
			count={subscriberStore.totalCount}
			subtitle="Active {subscriberStore.activeCount} · Paid {subscriberStore.paidCount} · Bounced {subscriberStore.bouncedCount}"
			ontogglenav={() => (isMobileNavOpen = true)}
		>
			{#snippet actions()}
				<Button variant="outline" size="sm" onclick={() => (isImportModalOpen = true)}>
					Import CSV
				</Button>
				<Button variant="primary" size="sm" onclick={openCreateModal}>Add Subscriber</Button>
			{/snippet}
		</AdminHeader>

		<main id="main-content" class="flex-1 overflow-y-auto p-4 sm:p-6 pb-24 sm:pb-12">
			<div class="max-w-6xl mx-auto space-y-4">
				<SubscriberFilterBar
					{filters}
					availableTags={subscriberStore.allTags}
					resultCount={subscriberStore.filteredItems.length}
					selectedCount={selectedIds.length}
					onfilterchange={(key, value) => subscriberStore.setFilter(key, value)}
					onbulkstatus={handleBulkStatus}
					onbulkdelete={handleBulkDelete}
					onclearselection={() => (selectedIds = [])}
				/>

				<div class="bg-white border border-stone-200 rounded-lg overflow-hidden shadow-panel">
					<SubscriberTable
						subscribers={subscriberStore.paginatedItems}
						{selectedIds}
						sortBy={subscriberStore.filters.sortBy}
						sortDirection={subscriberStore.filters.sortDirection}
						emptyMessage={
							subscriberStore.totalCount === 0
								? 'No subscribers yet. Add the first reader or import a CSV.'
								: 'No subscribers match the current filters.'
						}
						ontoggleSelect={handleToggleSelect}
						ontoggleselectall={handleToggleSelectAll}
						onsortchange={(field) => subscriberStore.setSort(field)}
						onedit={openEditModal}
						ondelete={(subscriber) => (deleteTarget = subscriber)}
					>
						{#snippet emptyAction()}
							{#if subscriberStore.totalCount === 0}
								<Button variant="primary" size="sm" onclick={openCreateModal}>Add Subscriber</Button>
							{:else}
								<Button
									variant="outline"
									size="sm"
									onclick={() => subscriberStore.resetFilters()}
								>
									Clear filters
								</Button>
							{/if}
						{/snippet}
					</SubscriberTable>
				</div>

				<div class="flex items-center justify-between gap-3 flex-wrap">
					<p class="text-xs font-mono text-stone-500 tabular-nums">
						Page {subscriberStore.currentPage} of {subscriberStore.totalPages} ·
						{subscriberStore.filteredItems.length} of {subscriberStore.totalCount} shown
					</p>
					<Pagination
						page={subscriberStore.currentPage}
						totalPages={subscriberStore.totalPages}
						onpagechange={(page) => subscriberStore.setPage(page)}
					/>
				</div>

				{#if selectedOnPage.length > 0}
					<p class="text-xs font-mono text-stone-500" aria-live="polite">
						{selectedOnPage.length} record(s) selected on this page.
					</p>
				{/if}
			</div>
		</main>
	</div>
</div>

<SubscriberModal
	bind:isOpen={isSubscriberModalOpen}
	subscriber={editingSubscriber}
	existingEmails={subscriberStore.existingEmails}
	{isSaving}
	onsave={handleSave}
	onclose={() => {
		isSubscriberModalOpen = false;
		editingSubscriber = null;
	}}
/>

<CsvImportModal
	bind:isOpen={isImportModalOpen}
	existingEmails={subscriberStore.existingEmails}
	result={csvResult}
	onimport={handleCsvImport}
	onreset={() => (csvResult = null)}
	onclose={() => (isImportModalOpen = false)}
/>

{#if deleteTarget}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center p-4"
		role="dialog"
		aria-modal="true"
		aria-labelledby="delete-subscriber-title"
	>
		<div class="fixed inset-0 bg-stone-900/40 backdrop-blur-sm animate-fade-in" aria-hidden="true"></div>

		<div
			class="relative z-10 w-full max-w-md bg-white rounded-lg shadow-modal border border-stone-200 overflow-hidden animate-sheet-rise"
			role="document"
		>
			<div class="px-6 py-4 border-b border-stone-200">
				<h2 id="delete-subscriber-title" class="text-lg font-serif font-bold text-stone-900">
					Delete subscriber?
				</h2>
			</div>

			<div class="px-6 py-4 text-sm text-stone-700 space-y-2">
				<p>
					<strong class="break-all">{deleteTarget.email}</strong> will be removed from the audience
					along with its engagement history.
				</p>
				<p class="text-xs text-stone-500">This action cannot be undone.</p>
			</div>

			<div class="px-6 py-3 bg-stone-50 border-t border-stone-200 flex items-center justify-end gap-3 pb-safe-bottom">
				<Button variant="outline" size="sm" onclick={() => (deleteTarget = null)}>Cancel</Button>
				<Button variant="danger" size="sm" onclick={handleDelete}>Delete subscriber</Button>
			</div>
		</div>
	</div>
{/if}