<script lang="ts">
	import type { Snippet } from 'svelte';

	type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
	type ButtonSize = 'sm' | 'md' | 'lg';

	interface ButtonProps {
		variant?: ButtonVariant;
		size?: ButtonSize;
		type?: 'button' | 'submit' | 'reset';
		disabled?: boolean;
		loading?: boolean;
		onclick?: (event: MouseEvent) => void;
		/** Accessible name for icon-only buttons. */
		ariaLabel?: string;
		/** Native tooltip, also exposed to assistive technology as the title. */
		title?: string;
		children?: Snippet;
		class?: string;
	}

	let {
		variant = 'primary',
		size = 'md',
		type = 'button',
		disabled = false,
		loading = false,
		onclick,
		ariaLabel,
		title,
		children,
		class: customClass = ''
	}: ButtonProps = $props();

	const isInert = $derived(disabled || loading);

	const baseStyles =
		'inline-flex items-center justify-center font-medium transition-colors select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-stone-900 focus-visible:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation cursor-pointer';

	const sizeStyles: Record<ButtonSize, string> = {
		sm: 'text-xs px-2.5 py-1.5 min-h-[36px] rounded',
		md: 'text-sm px-4 py-2 min-h-[44px] rounded-md',
		lg: 'text-base px-6 py-3 min-h-[48px] rounded-md font-semibold'
	};

	const variantStyles: Record<ButtonVariant, string> = {
		primary: 'bg-stone-900 text-stone-50 hover:bg-stone-800 active:bg-black',
		secondary: 'bg-stone-100 text-stone-900 hover:bg-stone-200 active:bg-stone-300',
		outline:
			'border border-stone-300 text-stone-900 bg-transparent hover:bg-stone-100 active:bg-stone-200',
		ghost:
			'text-stone-700 bg-transparent hover:bg-stone-100 hover:text-stone-900 active:bg-stone-200',
		danger: 'bg-red-700 text-white hover:bg-red-800 active:bg-red-900'
	};

	function handleClick(event: MouseEvent): void {
		if (isInert) {
			event.preventDefault();
			return;
		}
		onclick?.(event);
	}
</script>

<button
	{type}
	disabled={isInert}
	aria-label={ariaLabel}
	{title}
	aria-busy={loading}
	onclick={handleClick}
	class="{baseStyles} {sizeStyles[size]} {variantStyles[variant]} {customClass}"
>
	{#if loading}
		<svg
			class="animate-spin -ml-1 mr-2 h-4 w-4 text-current"
			fill="none"
			viewBox="0 0 24 24"
			aria-hidden="true"
			focusable="false"
		>
			<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"
			></circle>
			<path
				class="opacity-75"
				fill="currentColor"
				d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
			></path>
		</svg>
	{/if}
	{#if children}
		{@render children()}
	{/if}
</button>