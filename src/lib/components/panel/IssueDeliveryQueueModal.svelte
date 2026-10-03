<script lang="ts">
	import type { DistributionResult, NewsletterIssue } from '#lib/types/newsletter';
	import Badge from '#lib/components/ui/Badge.svelte';
	import Button from '#lib/components/ui/Button.svelte';
	import Modal from '#lib/components/ui/Modal.svelte';
	import DeliveryProgressBar from '#lib/components/panel/DeliveryProgressBar.svelte';
	import { formatAudienceLabel } from '#lib/utils/format';

	interface Props {
		isOpen?: boolean;
		issue: NewsletterIssue;
		/** Recipients resolved for the issue audience filter. */
		targetRecipients: number;
		/** Recipients excluded because they are inactive or outside the tier filter. */
		excludedRecipients?: number;
		/** Phase of the dispatch run. */
		status: 'idle' | 'running' | 'paused' | 'finished';
		progressPercent: number;
		processedCount: number;
		totalQueueCount: number;
		/** Statistics returned once the run completes or is halted. */
		summary?: DistributionResult | null;
		ondispatch: () => void;
		onpause: () => void;
		onresume: () => void;
		onhalt: () => void;
		oncomplete: () => void;
		onclose: () => void;
	}

	let {
		isOpen = $bindable(false),
		issue,
		targetRecipients,
		excludedRecipients = 0,
		status,
		progressPercent,
		processedCount,
		totalQueueCount,
		summary = null,
		ondispatch,
		onpause,
		onresume,
		onhalt,
		oncomplete,
		onclose
	}: Props = $props();

	const isBusy = $derived(status === 'running' || status === 'paused');
	const isFinished = $derived(status === 'finished');
	const hasRecipients = $derived(targetRecipients > 0);

	const summaryRows = $derived(
		summary
			? [
					{ label: 'Delivered', value: summary.delivered, tone: 'text-emerald-700' },
					{ label: 'Bounced', value: summary.bounced, tone: 'text-rose-700' },
					{ label: 'Simulated opens', value: summary.opened, tone: 'text-stone-900' },
					{ label: 'Simulated clicks', value: summary.clicked, tone: 'text-stone-900' }
				]
			: []
	);

	const openRate = $derived(
		summary && summary.delivered > 0 ? (summary.opened / summary.delivered) * 100 : 0
	);
</script>

<Modal
	bind:isOpen
	title="Dispatch Newsletter"
	description="Messages are processed in bounded asynchronous batches with a full delivery log."
	lockDismiss={isBusy}
	{onclose}
>
	<div class="space-y-4">
		<div class="border-b border-stone-200 pb-3">
			<h3 class="font-serif font-bold text-stone-900 text-base">{issue.title}</h3>
			<p class="text-xs text-stone-500 font-mono mt-1">
				{formatAudienceLabel(issue.audience)} · {targetRecipients} recipient{targetRecipients === 1
					? ''
					: 's'}
				{#if excludedRecipients > 0}
					· {excludedRecipients} excluded
				{/if}
			</p>
		</div>

		{#if !hasRecipients}
			<div class="rounded-md border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900" role="alert">
				<p class="font-semibold">No eligible recipients</p>
				<p class="mt-1">
					This audience filter matches no active subscribers. Widen the audience or add subscribers
					before dispatching.
				</p>
			</div>
		{:else if status === 'idle'}
			<p class="text-stone-700 text-sm leading-relaxed">
				You are about to distribute this issue to <strong>{targetRecipients}</strong> recipient{targetRecipients ===
				1
					? ''
					: 's'}. Delivery is simulated locally: each recipient receives one job, with deterministic
				telemetry recorded for opens and clicks.
			</p>
		{:else}
			<DeliveryProgressBar
				percent={progressPercent}
				processed={processedCount}
				total={totalQueueCount}
				isPaused={status === 'paused'}
				label="Delivery progress"
			/>

			{#if isFinished && summary}
				<div class="bg-stone-50 border border-stone-200 rounded p-3 space-y-2" role="status" aria-live="polite">
					<div class="flex items-center gap-2 flex-wrap">
						<Badge variant={summary.cancelled ? 'warning' : 'success'} size="sm">
							{summary.cancelled ? 'Distribution halted' : 'Distribution complete'}
						</Badge>
						<span class="text-xs font-mono text-stone-600 tabular-nums">
							Open rate {(summary.delivered > 0 ? openRate.toFixed(1) : '0.0')}% · Click-through {(
								summary.opened > 0 ? ((summary.clicked / summary.opened) * 100).toFixed(1) : '0.0'
							)}%
						</span>
					</div>

					<dl class="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono">
						{#each summaryRows as row (row.label)}
							<div>
								<dt class="text-stone-500">{row.label}</dt>
								<dd class="text-base tabular-nums {row.tone}">{row.value}</dd>
							</div>
						{/each}
					</dl>

					{#if summary.cancelled}
						<p class="text-xs text-amber-800">
							Run halted by the operator. {processedCount} of {totalQueueCount} jobs were processed before
							stopping; the remaining jobs stay queued and can be dispatched again.
						</p>
					{/if}
				</div>
			{/if}
		{/if}
	</div>

	{#snippet footer()}
		{#if status === 'idle'}
			<Button variant="outline" size="sm" onclick={onclose}>Cancel</Button>
			<Button variant="primary" size="sm" onclick={ondispatch} disabled={!hasRecipients}>
				Confirm &amp; Send
			</Button>
		{:else if isBusy}
			<Button variant="danger" size="sm" onclick={onhalt}>Halt Distribution</Button>
			{#if status === 'paused'}
				<Button variant="outline" size="sm" onclick={onresume}>Resume</Button>
			{:else}
				<Button variant="outline" size="sm" onclick={onpause}>Pause</Button>
			{/if}
		{:else}
			<Button variant="outline" size="sm" onclick={onclose}>Close</Button>
			<Button variant="primary" size="sm" onclick={oncomplete}>Done</Button>
		{/if}
	{/snippet}
</Modal>