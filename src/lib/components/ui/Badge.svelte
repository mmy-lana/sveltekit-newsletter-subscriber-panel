<script lang="ts">
	import type { Snippet } from 'svelte';

	type BadgeVariant = 'neutral' | 'success' | 'warning' | 'error' | 'outline';
	type BadgeSize = 'sm' | 'md' | 'touch';

	interface BadgeProps {
		variant?: BadgeVariant;
		size?: BadgeSize;
		/** Renders the badge as a filter toggle button instead of a static pill. */
		interactive?: boolean;
		/** Visual pressed state for the interactive variant. */
		pressed?: boolean;
		disabled?: boolean;
		onclick?: () => void;
		ariaLabel?: string;
		children?: Snippet;
		class?: string;
	}

	let {
		variant = 'neutral',
		size = 'sm',
		interactive = false,
		pressed = false,
		disabled = false,
		onclick,
		ariaLabel,
		children,
		class: customClass = ''
	}: BadgeProps = $props();

	const variantStyles: Record<BadgeVariant, string> = {
		neutral: 'bg-stone-100 text-stone-800 border-stone-200',
		success: 'bg-emerald-50 text-emerald-800 border-emerald-200',
		warning: 'bg-amber-50 text-amber-800 border-amber-200',
		error: 'bg-rose-50 text-rose-800 border-rose-200',
		outline: 'bg-transparent text-stone-700 border-stone-300'
	};

	const sizeStyles: Record<BadgeSize, string> = {
		sm: 'text-[11px] px-2 py-0.5 leading-tight',
		md: 'text-xs px-2.5 py-1 leading-normal',
		touch: 'text-xs px-3 min-h-[44px] min-w-[44px] leading-normal'
	};

	const pressedStyles = 'bg-stone-900 text-stone-50 border-stone-900';
</script>

{#if interactive}
	<button
		type="button"
		{onclick}
		{disabled}
		aria-label={ariaLabel}
		aria-pressed={pressed}
		class="inline-flex items-center justify-center font-medium border rounded-full font-mono uppercase tracking-wider transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed hover:bg-stone-200 active:bg-stone-300 {sizeStyles[
			size
		]} {variantStyles[variant]} {pressed ? pressedStyles : ''} {customClass}"
	>
		{#if children}
			{@render children()}
		{/if}
	</button>
{:else}
	<span
		class="inline-flex items-center font-medium border rounded-full font-mono uppercase tracking-wider {sizeStyles[
			size
		]} {variantStyles[variant]} {customClass}"
	>
		{#if children}
			{@render children()}
		{/if}
	</span>
{/if}