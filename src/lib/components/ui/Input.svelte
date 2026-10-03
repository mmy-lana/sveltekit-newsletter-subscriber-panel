<script lang="ts">
	import type { HTMLInputAttributes } from 'svelte/elements';

	interface InputProps {
		value?: string;
		label?: string;
		/** Visually hides the label while keeping it available to screen readers. */
		hideLabel?: boolean;
		type?: 'text' | 'email' | 'search' | 'password' | 'url' | 'tel' | 'number';
		name?: string;
		id?: string;
		placeholder?: string;
		hint?: string;
		error?: string;
		disabled?: boolean;
		readonly?: boolean;
		required?: boolean;
		autocomplete?: HTMLInputAttributes['autocomplete'];
		inputmode?: HTMLInputAttributes['inputmode'];
		minlength?: number;
		maxlength?: number;
		min?: string | number;
		max?: string | number;
		step?: string | number;
		class?: string;
		oninput?: (event: Event & { currentTarget: HTMLInputElement }) => void;
		onblur?: (event: FocusEvent & { currentTarget: HTMLInputElement }) => void;
		onkeydown?: (event: KeyboardEvent) => void;
	}

	let {
		value = $bindable(''),
		label,
		hideLabel = false,
		type = 'text',
		name,
		id,
		placeholder,
		hint,
		error,
		disabled = false,
		readonly = false,
		required = false,
		autocomplete,
		inputmode,
		minlength,
		maxlength,
		min,
		max,
		step,
		class: customClass = '',
		oninput,
		onblur,
		onkeydown
	}: InputProps = $props();

	const generatedId = $props.id();
	const inputId = $derived(id ?? generatedId);
	const hintId = $derived(hint ? `${inputId}-hint` : undefined);
	const errorId = $derived(error ? `${inputId}-error` : undefined);
	const describedBy = $derived([hintId, errorId].filter(Boolean).join(' ') || undefined);

	const baseControlStyles =
		'w-full min-h-[44px] rounded-md border bg-white px-3 py-2 text-sm text-stone-900 placeholder:text-stone-400 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-stone-900 focus-visible:ring-offset-1 disabled:bg-stone-100 disabled:text-stone-500 disabled:cursor-not-allowed readonly:bg-stone-50';

	const stateStyles = $derived(
		error
			? 'border-rose-400 focus-visible:ring-rose-700'
			: 'border-stone-300 focus-visible:ring-stone-900'
	);
</script>

<div class="space-y-1.5 {customClass}">
	{#if label}
		<label
			for={inputId}
			class="block text-xs font-mono uppercase tracking-wider text-stone-600 {hideLabel
				? 'sr-only'
				: ''}"
		>
			{label}{#if required}<span class="text-rose-600" aria-hidden="true">*</span>{/if}
		</label>
	{/if}

	<input
		id={inputId}
		name={name ?? inputId}
		{type}
		bind:value
		{placeholder}
		{disabled}
		{readonly}
		{required}
		{autocomplete}
		{inputmode}
		{minlength}
		{maxlength}
		{min}
		{max}
		{step}
		aria-invalid={error ? 'true' : undefined}
		aria-describedby={describedBy}
		aria-required={required ? 'true' : undefined}
		spellcheck={type === 'email' || type === 'url' ? 'false' : undefined}
		{oninput}
		{onblur}
		{onkeydown}
		class="{baseControlStyles} {stateStyles}"
	/>

	{#if error}
		<p id={errorId} class="text-xs text-rose-700 flex items-start gap-1">
			<svg
				class="w-3.5 h-3.5 mt-px shrink-0"
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
					d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
				></path>
			</svg>
			<span>{error}</span>
		</p>
	{:else if hint}
		<p id={hintId} class="text-xs text-stone-500">{hint}</p>
	{/if}
</div>