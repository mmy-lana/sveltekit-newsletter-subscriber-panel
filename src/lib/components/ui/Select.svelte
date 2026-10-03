<script lang="ts">
	import type { SelectOption } from '#lib/types/ui';

	interface SelectProps {
		value?: string;
		options: SelectOption[];
		label?: string;
		hideLabel?: boolean;
		name?: string;
		id?: string;
		hint?: string;
		error?: string;
		disabled?: boolean;
		required?: boolean;
		class?: string;
		onchange?: (event: Event & { currentTarget: HTMLSelectElement }) => void;
	}

	let {
		value = $bindable(''),
		options,
		label,
		hideLabel = false,
		name,
		id,
		hint,
		error,
		disabled = false,
		required = false,
		class: customClass = '',
		onchange
	}: SelectProps = $props();

	const generatedId = $props.id();
	const selectId = $derived(id ?? generatedId);
	const hintId = $derived(hint ? `${selectId}-hint` : undefined);
	const errorId = $derived(error ? `${selectId}-error` : undefined);
	const describedBy = $derived([hintId, errorId].filter(Boolean).join(' ') || undefined);

	const stateStyles = $derived(
		error
			? 'border-rose-400 focus-visible:ring-rose-700'
			: 'border-stone-300 focus-visible:ring-stone-900'
	);
</script>

<div class="space-y-1.5 {customClass}">
	{#if label}
		<label
			for={selectId}
			class="block text-xs font-mono uppercase tracking-wider text-stone-600 {hideLabel
				? 'sr-only'
				: ''}"
		>
			{label}{#if required}<span class="text-rose-600" aria-hidden="true">*</span>{/if}
		</label>
	{/if}

	<div class="relative">
		<select
			id={selectId}
			name={name ?? selectId}
			bind:value
			{disabled}
			{required}
			aria-invalid={error ? 'true' : undefined}
			aria-describedby={describedBy}
			aria-required={required ? 'true' : undefined}
			{onchange}
			class="w-full min-h-[44px] appearance-none rounded-md border bg-white pl-3 pr-9 py-2 text-sm text-stone-900 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 disabled:bg-stone-100 disabled:text-stone-500 disabled:cursor-not-allowed cursor-pointer {stateStyles}"
		>
			{#each options as option (option.value)}
				<option value={option.value} disabled={option.disabled}>{option.label}</option>
			{/each}
		</select>

		<svg
			class="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-500"
			fill="none"
			viewBox="0 0 24 24"
			stroke="currentColor"
			aria-hidden="true"
			focusable="false"
		>
			<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"
			></path>
		</svg>
	</div>

	{#if error}
		<p id={errorId} class="text-xs text-rose-700">{error}</p>
	{:else if hint}
		<p id={hintId} class="text-xs text-stone-500">{hint}</p>
	{/if}
</div>