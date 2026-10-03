<script lang="ts">
	interface Props {
		/** Completion ratio expressed as an integer 0-100. */
		percent: number;
		processed: number;
		total: number;
		/** True while the engine is between batches. */
		isPaused?: boolean;
		label?: string;
		class?: string;
	}

	let { percent, processed, total, isPaused = false, label = 'Dispatch progress', class: customClass = '' }: Props =
		$props();

	const safePercent = $derived(Math.min(100, Math.max(0, Math.round(percent))));
	const isComplete = $derived(total > 0 && processed >= total);
	const statusText = $derived(
		total === 0 ? 'Queued' : isComplete ? 'Completed' : isPaused ? 'Paused' : 'Processing'
	);
</script>

<div class="space-y-2 {customClass}">
	<div class="flex items-center justify-between gap-3 text-xs font-mono text-stone-600">
		<span class="tabular-nums">{label}</span>
		<span class="flex items-center gap-2">
			{#if isPaused}
				<span class="text-amber-700" data-state="paused">Paused</span>
			{:else if isComplete}
				<span class="text-emerald-700" data-state="completed">Completed</span>
			{/if}
			<span class="tabular-nums">{processed} / {total}</span>
			<span class="tabular-nums font-semibold text-stone-900">{safePercent}%</span>
		</span>
	</div>

	<div
		class="w-full bg-stone-100 rounded-full h-3 overflow-hidden border border-stone-200"
		role="progressbar"
		aria-valuenow={safePercent}
		aria-valuemin="0"
		aria-valuemax="100"
		aria-valuetext={statusText}
		aria-label={label}
	>
		<div
			data-state={statusText.toLowerCase()}
			class="h-full transition-all duration-150 ease-out {isPaused
				? 'bg-amber-600'
				: isComplete
					? 'bg-emerald-700'
					: 'bg-stone-900'}"
			style="width: {safePercent}%"
		></div>
	</div>

	</div>