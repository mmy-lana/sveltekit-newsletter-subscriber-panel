<script lang="ts">
	import Button from '#lib/components/ui/Button.svelte';
	import { isNonEmpty, normalizeEmail, validateEmail } from '#lib/utils/validators';

	interface Props {
		/** Publication name shown above the form. */
		publicationName: string;
		supportEmail?: string;
		isSubmitting?: boolean;
		/** Optional externally-owned error message. */
		externalError?: string | null;
		onsubscribe: (email: string) => void;
		class?: string;
	}

	let {
		publicationName,
		supportEmail,
		isSubmitting = false,
		externalError = null,
		onsubscribe,
		class: customClass = ''
	}: Props = $props();

	let email = $state('');
	let error = $state<string | null>(null);
	let touched = $state(false);

	function handleSubmit(): void {
		touched = true;
		const candidate = email.trim();

		if (!isNonEmpty(candidate)) {
			error = 'Enter your email address to subscribe.';
		} else if (!validateEmail(candidate)) {
			error = 'That does not look like a valid email address.';
		} else {
			error = null;
			onsubscribe(normalizeEmail(candidate));
		}
	}

	const message = $derived(touched ? (error ?? externalError) : externalError);
</script>

<section
	class="border border-stone-200 rounded-lg bg-stone-50 p-5 sm:p-6 space-y-4 {customClass}"
	aria-labelledby="subscribe-heading"
>
	<div>
		<h2 id="subscribe-heading" class="font-serif font-bold text-lg text-stone-900 tracking-tight">
			Subscribe to {publicationName}
		</h2>
		<p class="text-sm text-stone-600 mt-1">
			One dispatch each week. No tracking pixels, no syndication, unsubscribe in a click.
		</p>
	</div>

	<form
		class="space-y-2"
		onsubmit={(event) => {
			event.preventDefault();
			handleSubmit();
		}}
		novalidate
	>
		<label for="subscribe-email" class="sr-only">Email address</label>
		<div class="flex flex-col sm:flex-row gap-2">
			<input
				id="subscribe-email"
				type="email"
				bind:value={email}
				placeholder="reader@example.com"
				autocomplete="email"
				inputmode="email"
				aria-invalid={message ? 'true' : undefined}
				aria-describedby={message ? 'subscribe-error' : 'subscribe-hint'}
				class="flex-1 min-h-[44px] rounded-md border bg-white px-3 py-2 text-sm text-stone-900 placeholder:text-stone-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-stone-900 focus-visible:ring-offset-1 {message
					? 'border-rose-400'
					: 'border-stone-300'}"
			/>
			<Button type="submit" variant="primary" size="md" loading={isSubmitting} class="sm:w-auto">
				Subscribe
			</Button>
		</div>

		{#if message}
			<p id="subscribe-error" class="text-xs text-rose-700" role="alert">{message}</p>
		{:else}
			<p id="subscribe-hint" class="text-xs text-stone-500">
				{#if supportEmail}
					Questions? Write to {supportEmail}.
				{:else}
					Double opt-in confirmation is sent immediately.
				{/if}
			</p>
		{/if}
	</form>
</section>