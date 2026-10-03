<script lang="ts">
	import '../app.css';
	import type { Snippet } from 'svelte';
	import Toast from '#lib/components/ui/Toast.svelte';
	import { getIssueState } from '#lib/state/issue.svelte';
	import { getSettingsState } from '#lib/state/settings.svelte';
	import { getSubscriberState } from '#lib/state/subscriber.svelte';
	import { getToastState } from '#lib/state/toast.svelte';

	interface LayoutProps {
		children?: Snippet;
	}

	let { children }: LayoutProps = $props();

	const subscriberStore = getSubscriberState();
	const issueStore = getIssueState();
	const settingsStore = getSettingsState();
	const toastStore = getToastState();

	// Stores are seeded with the canonical fixtures so SSR and the first client
	// render agree; persisted LocalStorage data is merged in after mount.
	$effect(() => {
		subscriberStore.hydrate();
		issueStore.hydrate();
		settingsStore.hydrate();
	});

</script>

<svelte:head>
	<title>Newsletter Distribution & Subscriber Panel</title>
	<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0" />
	<meta
		name="description"
		content="Publish newsletters, manage subscribers, and run dispatch campaigns from a single editorial panel."
	/>
	<meta name="theme-color" content="#fcfbf9" />
</svelte:head>

<div
	class="min-h-screen bg-paper text-stone-900 selection:bg-stone-900 selection:text-stone-50 flex flex-col font-sans antialiased"
>
	{#if children}
		{@render children()}
	{/if}
</div>

<!-- Confirmation for both the panel and the public reader. -->
<Toast toasts={toastStore.visibleToasts} ondismiss={(id) => toastStore.dismiss(id)} />