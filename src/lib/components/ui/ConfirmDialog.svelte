<script lang="ts">
	import type { Snippet } from 'svelte';
	import Button from '#lib/components/ui/Button.svelte';
	import Modal from '#lib/components/ui/Modal.svelte';

	/**
	 * Confirmation step for a consequential action.
	 *
	 * Every destructive action in the panel goes through this primitive rather than
	 * an ad-hoc dialog, so one component owns the whole contract:
	 * - `Modal` supplies the body scroll lock, the Tab focus trap, backdrop
	 *   dismissal and Escape handling;
	 * - the dialog is labelled and described, so assistive technology announces
	 *   what is about to happen;
	 * - `lockDismiss` freezes the dialog while the action runs, so a double press
	 *   cannot fire it twice.
	 *
	 * The body copy is a snippet so each caller can state exactly what is affected
	 * (which record, or how many).
	 */
	interface Props {
		isOpen?: boolean;
		title: string;
		/** Supporting copy announced with the title. */
		description?: string;
		/** The affected record or records. */
		children?: Snippet;
		confirmLabel?: string;
		cancelLabel?: string;
		/** Destructive confirmations use the danger variant. */
		variant?: 'danger' | 'primary';
		/** Freezes the dialog while the action runs. */
		isBusy?: boolean;
		onconfirm: () => void;
		oncancel: () => void;
	}

	let {
		isOpen = $bindable(false),
		title,
		description,
		children,
		confirmLabel = 'Confirm',
		cancelLabel = 'Cancel',
		variant = 'danger',
		isBusy = false,
		onconfirm,
		oncancel
	}: Props = $props();
</script>

<Modal bind:isOpen {title} {description} lockDismiss={isBusy} onclose={oncancel}>
	{#if children}
		<div class="space-y-3 text-sm leading-relaxed text-stone-700">{@render children()}</div>
	{/if}

	{#snippet footer()}
		<Button variant="outline" size="sm" onclick={oncancel} disabled={isBusy}>{cancelLabel}</Button>
		<Button {variant} size="sm" onclick={onconfirm} loading={isBusy}>{confirmLabel}</Button>
	{/snippet}
</Modal>
