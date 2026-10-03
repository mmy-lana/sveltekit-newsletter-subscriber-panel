<script lang="ts">
	type SkeletonVariant = 'text' | 'block' | 'circle';

	interface SkeletonProps {
		variant?: SkeletonVariant;
		/** Tailwind width utility (e.g. `w-full`, `w-32`). */
		width?: string;
		/** Tailwind height utility (e.g. `h-4`, `h-40`). */
		height?: string;
		/** Number of stacked text lines to simulate. */
		lines?: number;
		class?: string;
	}

	let {
		variant = 'text',
		width,
		height,
		lines = 1,
		class: customClass = ''
	}: SkeletonProps = $props();

	const variantStyles: Record<SkeletonVariant, string> = {
		text: 'h-4 rounded',
		block: 'rounded-md',
		circle: 'rounded-full aspect-square'
	};

	const defaultWidths: Record<SkeletonVariant, string> = {
		text: 'w-full',
		block: 'w-full',
		circle: 'w-10'
	};

	const defaultHeights: Record<SkeletonVariant, string> = {
		text: 'h-4',
		block: 'h-24',
		circle: 'h-10'
	};
</script>

{#if variant === 'text' && lines > 1}
	<div class="space-y-2 {customClass}" aria-hidden="true">
		{#each Array.from({ length: lines }) as _, index (index)}
			<div
				class="animate-skeleton-pulse bg-stone-200 {variantStyles.text} {width ??
					defaultWidths.text}"
				style="width: {index === lines - 1 ? '70%' : (width ?? '100%')}"
			></div>
		{/each}
	</div>
{:else}
	<div
		aria-hidden="true"
		class="animate-skeleton-pulse bg-stone-200 {variantStyles[variant]} {width ??
			defaultWidths[variant]} {height ?? defaultHeights[variant]} {customClass}"
	></div>
{/if}