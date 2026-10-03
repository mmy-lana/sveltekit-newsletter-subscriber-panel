<script lang="ts">
	import type { CsvImportResult } from '#lib/types/newsletter';
	import Badge from '#lib/components/ui/Badge.svelte';
	import Button from '#lib/components/ui/Button.svelte';
	import Modal from '#lib/components/ui/Modal.svelte';
	import Textarea from '#lib/components/ui/Textarea.svelte';

	interface Props {
		isOpen?: boolean;
		/** Emails already stored, used for duplicate detection during preview. */
		existingEmails: string[];
		/** Result of the last executed import, rendered as the completion report. */
		result?: CsvImportResult | null;
		isImporting?: boolean;
		onimport: (csvText: string) => void;
		onreset: () => void;
		onclose: () => void;
	}

	let {
		isOpen = $bindable(false),
		existingEmails,
		result = null,
		isImporting = false,
		onimport,
		onreset,
		onclose
	}: Props = $props();

	let csvText = $state('');
	let fileName = $state<string | null>(null);
	let readError = $state<string | null>(null);

	const SAMPLE = `email,firstname,lastname,tags
ada@example.com,Ada,Lovelace,analytics; sre
grace@example.com,Grace,Hopper,compilers`;

	const hasContent = $derived(csvText.trim().length > 0);
	const estimatedRows = $derived(
		hasContent ? Math.max(0, csvText.trim().split(/\r?\n/).filter((line) => line.trim().length > 0).length - 1) : 0
	);

	async function handleFile(event: Event & { currentTarget: HTMLInputElement }): Promise<void> {
		const file = event.currentTarget.files?.[0];
		if (!file) return;

		readError = null;
		fileName = file.name;

		try {
			csvText = await file.text();
		} catch (error) {
			csvText = '';
			readError = error instanceof Error ? error.message : 'The file could not be read.';
		}
	}

	function handleSubmit(): void {
		if (!hasContent) return;
		onimport(csvText);
	}

	function handleReset(): void {
		csvText = '';
		fileName = null;
		readError = null;
		onreset();
	}
</script>

<Modal
	bind:isOpen
	title="Import Subscribers from CSV"
	description="Paste RFC 4180 CSV content or choose a file from disk."
	{onclose}
>
	<div class="space-y-4">
		<div class="flex flex-col sm:flex-row sm:items-center gap-3">
			<label
				for="csv-file"
				class="inline-flex items-center justify-center gap-2 px-4 py-2 min-h-[44px] rounded-md border border-stone-300 text-sm text-stone-900 hover:bg-stone-100 transition-colors cursor-pointer"
			>
				<svg
					class="w-4 h-4"
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
					aria-hidden="true"
					focusable="false"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M12 16V4m0 0L8 8m4-4l4 4M4 17v2a2 2 0 002 2h12a2 2 0 002-2v-2"
					></path>
				</svg>
				Choose CSV file
			</label>
			<input
				id="csv-file"
				type="file"
				accept=".csv,text/csv"
				class="sr-only"
				onchange={handleFile}
			/>
			{#if fileName}
				<span class="text-xs font-mono text-stone-500 truncate">{fileName}</span>
			{/if}
		</div>

		{#if readError}
			<p class="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded p-2">{readError}</p>
		{/if}

		<Textarea
			label="CSV content"
			bind:value={csvText}
			mono
			rows={8}
			placeholder={SAMPLE}
			hint="Required column: email. Optional: firstname, lastname, tags (semicolon separated), tier, status, notes."
		/>

		<div class="flex items-center justify-between gap-3 text-xs font-mono text-stone-500">
			<span>{hasContent ? `${estimatedRows} data rows detected` : 'Awaiting CSV content'}</span>
			<span>{existingEmails.length} existing subscribers will be checked for duplicates</span>
		</div>

		{#if result}
			<div class="rounded-md border border-stone-200 bg-stone-50 p-3 space-y-3" role="status" aria-live="polite">
				<p class="text-sm font-medium text-stone-900">
					Imported {result.successfulImports} of {result.totalRows} rows
				</p>

				<div class="flex flex-wrap gap-2">
					<Badge variant="success" size="sm">{result.successfulImports} imported</Badge>
					{#if result.failedImports > 0}
						<Badge variant="error" size="sm">{result.failedImports} rejected</Badge>
					{:else}
						<Badge variant="neutral" size="sm">0 rejected</Badge>
					{/if}
				</div>

				{#if result.errors.length > 0}
					<div class="max-h-40 overflow-y-auto rounded border border-stone-200 bg-white">
						<table class="w-full text-left text-xs">
							<thead class="bg-stone-100 text-stone-500 font-mono sticky top-0">
								<tr>
									<th scope="col" class="px-2 py-1.5">Row</th>
									<th scope="col" class="px-2 py-1.5">Email</th>
									<th scope="col" class="px-2 py-1.5">Reason</th>
								</tr>
							</thead>
							<tbody class="divide-y divide-stone-100">
								{#each result.errors.slice(0, 25) as error (error.row + error.email + error.reason)}
									<tr>
										<td class="px-2 py-1.5 font-mono tabular-nums text-stone-400">{error.row}</td>
										<td class="px-2 py-1.5 break-all">{error.email || '—'}</td>
										<td class="px-2 py-1.5 text-rose-700">{error.reason}</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>

					{#if result.errors.length > 25}
						<p class="text-[11px] font-mono text-stone-500">
							Showing the first 25 of {result.errors.length} rejected rows.
						</p>
					{/if}
				{/if}
			</div>
		{/if}
	</div>

	{#snippet footer()}
		<Button variant="ghost" size="sm" onclick={handleReset} disabled={isImporting}>Reset</Button>
		<Button variant="outline" size="sm" onclick={onclose} disabled={isImporting}>Cancel</Button>
		<Button
			variant="primary"
			size="sm"
			onclick={handleSubmit}
			disabled={!hasContent}
			loading={isImporting}
		>
			{result ? 'Import More Rows' : 'Execute Import'}
		</Button>
	{/snippet}
</Modal>