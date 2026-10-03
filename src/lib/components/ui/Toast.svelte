<script lang="ts">
	import type { ToastMessage } from '#lib/types/ui';

	interface ToastProps {
		toasts: ToastMessage[];
		/** How long a toast stays visible, in milliseconds. */
		duration?: number;
		ondismiss: (id: string) => void;
		class?: string;
	}

	let { toasts, duration = 5000, ondismiss, class: customClass = '' }: ToastProps = $props();

	const variantStyles: Record<ToastMessage['variant'], string> = {
		success: 'bg-stone-900 text-stone-50 border-stone-900',
		error: 'bg-rose-700 text-white border-rose-700',
		warning: 'bg-amber-50 text-amber-900 border-amber-300',
		info: 'bg-white text-stone-900 border-stone-200'
	};

	const variantIcons: Record<ToastMessage['variant'], string> = {
		success: 'M5 13l4 4L19 7',
		error: 'M6 18L18 6M6 6l12 12',
		warning: 'M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z',
		info: 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z'
	};

	const destructiveVariant = $derived(
		new Set<ToastMessage['variant']>(['error', 'warning'])
	);

	// Auto-dismiss every visible toast after `duration`; the timer restarts
	// whenever the list changes so a new toast is never dismissed early.
	$effect(() => {
		if (typeof window === 'undefined' || toasts.length === 0) return;

		const timer = window.setTimeout(() => {
			for (const toast of toasts) {
				ondismiss(toast.id);
			}
		}, duration);

		return () => window.clearTimeout(timer);
	});
</script>

<!--
	The region is always mounted so assistive technology registers it before the
	first message arrives; `aria-live` then announces newly injected toasts.
-->
<div
	aria-live="polite"
	aria-atomic="false"
	class="fixed z-[60] bottom-4 left-1/2 -translate-x-1/2 w-[calc(100%-2rem)] max-w-sm space-y-2 pointer-events-none {customClass}"
>
	{#each toasts as toast (toast.id)}
		<div
			data-variant={toast.variant}
			class="pointer-events-auto flex items-start gap-3 rounded-lg px-4 py-3 shadow-float border animate-fade-in {variantStyles[
				toast.variant
			]}"
		>
			<svg
				class="w-5 h-5 mt-px shrink-0"
				fill="none"
				viewBox="0 0 24 24"
				stroke="currentColor"
				aria-hidden="true"
				focusable="false"
			>
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d={variantIcons[toast.variant]}
				></path>
			</svg>

			<div class="flex-1 min-w-0">
				<p class="text-sm font-medium break-words">{toast.title}</p>
				{#if toast.message}
					<p
						class="text-xs mt-0.5 break-words {destructiveVariant.has(toast.variant)
							? 'text-white/80'
							: 'text-stone-500'}"
					>
						{toast.message}
					</p>
				{/if}
			</div>

			<button
				type="button"
				onclick={() => ondismiss(toast.id)}
				aria-label="Dismiss notification"
				class="-mr-2 -mt-2 -mb-2 shrink-0 inline-flex items-center justify-center min-h-[44px] min-w-[44px] rounded-full hover:bg-black/10 transition-colors cursor-pointer"
			>
				<svg
					class="w-4 h-4"
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
					aria-hidden="true"
					focusable="false"
				>
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"
					></path>
				</svg>
			</button>
		</div>
	{/each}
</div>