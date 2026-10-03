<script lang="ts">
	import type { Snippet } from 'svelte';
	import { lockBodyScroll, unlockBodyScroll } from '#lib/utils/scroll-lock';

	interface ModalProps {
		isOpen?: boolean;
		title: string;
		/** Optional supporting copy rendered under the title. */
		description?: string;
		/** Prevents backdrop/Escape dismissal while a destructive action runs. */
		lockDismiss?: boolean;
		onclose: () => void;
		children?: Snippet;
		footer?: Snippet;
	}

	let {
		isOpen = $bindable(false),
		title,
		description,
		lockDismiss = false,
		onclose,
		children,
		footer
	}: ModalProps = $props();

	let panel = $state<HTMLDivElement | null>(null);
	let previouslyFocused: HTMLElement | null = null;

	const FOCUSABLE_SELECTOR = [
		'a[href]',
		'button:not([disabled])',
		'input:not([disabled]):not([type="hidden"])',
		'select:not([disabled])',
		'textarea:not([disabled])',
		'[tabindex]:not([tabindex="-1"])'
	].join(',');

	function requestClose(): void {
		if (lockDismiss) return;
		onclose();
	}

	function handleKeydown(event: KeyboardEvent): void {
		if (!isOpen) return;

		if (event.key === 'Escape') {
			event.preventDefault();
			requestClose();
			return;
		}

		if (event.key !== 'Tab' || !panel) return;

		const focusables = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
			(element) => element.offsetParent !== null || element === document.activeElement
		);

		if (focusables.length === 0) {
			event.preventDefault();
			panel.focus();
			return;
		}

		const first = focusables[0];
		const last = focusables[focusables.length - 1];

		// Wrap focus inside the dialog so tabbing never escapes to the page behind.
		if (event.shiftKey && document.activeElement === first) {
			event.preventDefault();
			last.focus();
		} else if (!event.shiftKey && document.activeElement === last) {
			event.preventDefault();
			first.focus();
		}
	}

	// Lock background scrolling and move focus into the dialog while it is open.
	// The lock is reference-counted, so closing this dialog does not release the
	// scroll lock still held by an overlay underneath it (for example the mobile
	// navigation drawer).
	$effect(() => {
		if (typeof document === 'undefined' || !isOpen) return;

		previouslyFocused = document.activeElement as HTMLElement | null;
		lockBodyScroll();

		queueMicrotask(() => {
			if (!panel) return;
			const target = panel.querySelector<HTMLElement>(FOCUSABLE_SELECTOR) ?? panel;
			target.focus();
		});

		return () => {
			unlockBodyScroll();
			previouslyFocused?.focus?.();
			previouslyFocused = null;
		};
	});
</script>

<svelte:window onkeydown={handleKeydown} />

{#if isOpen}
	<div
		class="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-6 md:p-10 h-[100dvh]"
		role="dialog"
		aria-modal="true"
		aria-labelledby="modal-title"
	>
		<div
			class="fixed inset-0 bg-stone-900/40 backdrop-blur-sm animate-fade-in"
			onclick={requestClose}
			aria-hidden="true"
		></div>

		<div
			bind:this={panel}
			class="relative z-10 w-full max-w-xl max-h-[85dvh] sm:max-h-[90dvh] flex flex-col bg-white rounded-t-xl sm:rounded-lg shadow-modal border border-stone-200 overflow-hidden animate-sheet-rise"
			role="document"
			tabindex="-1"
		>
			<div class="flex items-start justify-between gap-4 px-6 py-4 border-b border-stone-200">
				<div class="min-w-0">
					<h2 id="modal-title" class="text-lg font-serif font-bold text-stone-900 tracking-tight">
						{title}
					</h2>
					{#if description}
						<p class="text-xs text-stone-500 mt-1">{description}</p>
					{/if}
				</div>
				<button
					type="button"
					class="p-2 -mr-2 -mt-1 text-stone-400 hover:text-stone-700 min-h-[44px] min-w-[44px] shrink-0 flex items-center justify-center rounded-full hover:bg-stone-100 transition-colors cursor-pointer"
					onclick={requestClose}
					aria-label="Close dialog"
				>
					<svg
						class="w-5 h-5"
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

			<div class="px-6 py-4 overflow-y-auto flex-1 text-stone-700 text-sm overscroll-contain">
				{#if children}
					{@render children()}
				{/if}
			</div>

			{#if footer}
				<div
					class="px-6 py-3 bg-stone-50 border-t border-stone-200 flex items-center justify-end gap-3 pb-safe-bottom"
				>
					{@render footer()}
				</div>
			{/if}
		</div>
	</div>
{/if}