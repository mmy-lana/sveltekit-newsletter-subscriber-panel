<script lang="ts">
	interface TextareaProps {
		value?: string;
		label?: string;
		hideLabel?: boolean;
		name?: string;
		id?: string;
		placeholder?: string;
		hint?: string;
		error?: string;
		rows?: number;
		disabled?: boolean;
		readonly?: boolean;
		required?: boolean;
		/** Renders the monospace face used for the markdown editor and CSV input. */
		mono?: boolean;
		maxlength?: number;
		class?: string;
		oninput?: (event: Event & { currentTarget: HTMLTextAreaElement }) => void;
		onkeydown?: (event: KeyboardEvent) => void;
	}

	let {
		value = $bindable(''),
		label,
		hideLabel = false,
		name,
		id,
		placeholder,
		hint,
		error,
		rows = 5,
		disabled = false,
		readonly = false,
		required = false,
		mono = false,
		maxlength,
		class: customClass = '',
		oninput,
		onkeydown
	}: TextareaProps = $props();

	const generatedId = $props.id();
	const textareaId = $derived(id ?? generatedId);
	const hintId = $derived(hint ? `${textareaId}-hint` : undefined);
	const errorId = $derived(error ? `${textareaId}-error` : undefined);
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
			for={textareaId}
			class="block text-xs font-mono uppercase tracking-wider text-stone-600 {hideLabel
				? 'sr-only'
				: ''}"
		>
			{label}{#if required}<span class="text-rose-600" aria-hidden="true">*</span>{/if}
		</label>
	{/if}

	<textarea
		id={textareaId}
		name={name ?? textareaId}
		bind:value
		{rows}
		{placeholder}
		{disabled}
		{readonly}
		{required}
		{maxlength}
		aria-invalid={error ? 'true' : undefined}
		aria-describedby={describedBy}
		aria-required={required ? 'true' : undefined}
		{oninput}
		{onkeydown}
		class="w-full rounded-md border bg-white p-3 text-sm text-stone-900 placeholder:text-stone-400 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 disabled:bg-stone-100 disabled:text-stone-500 disabled:cursor-not-allowed readonly:bg-stone-50 resize-y {mono
			? 'font-mono text-xs leading-relaxed'
			: 'font-sans leading-relaxed'} {stateStyles}"
	></textarea>

	{#if error}
		<p id={errorId} class="text-xs text-rose-700">{error}</p>
	{:else if hint}
		<p id={hintId} class="text-xs text-stone-500">{hint}</p>
	{/if}

	{#if maxlength}
		<p class="text-[11px] text-stone-400 font-mono tabular-nums text-right">
			{value.length} / {maxlength}
		</p>
	{/if}
</div>