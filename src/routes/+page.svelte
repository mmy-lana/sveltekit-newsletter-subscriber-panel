<script lang="ts">
	import ArchiveIssueCard from '#lib/components/editorial/ArchiveIssueCard.svelte';
	import PublicNavigation from '#lib/components/editorial/PublicNavigation.svelte';
	import SubscribeCard from '#lib/components/editorial/SubscribeCard.svelte';
	import { getIssueState } from '#lib/state/issue.svelte';
	import { getSubscriberState } from '#lib/state/subscriber.svelte';
	import { getToastState } from '#lib/state/toast.svelte';
	import { getSettingsState } from '#lib/state/settings.svelte';
	import { toPlainText } from '#lib/utils/validators';

	const issueStore = getIssueState();
	const subscriberStore = getSubscriberState();
	const toastStore = getToastState();
	const settingsStore = getSettingsState();

	const settings = $derived(settingsStore.settings);
	const publishedIssues = $derived(issueStore.publishedIssues);

	const subscriberCount = $derived(subscriberStore.activeCount);

	/** Reading time from the markdown body, so the archive stays honest. */
	function readingMinutes(markdown: string): number {
		const words = toPlainText(markdown.replace(/[#*>`\-]/g, ' '))
			.split(/\s+/)
			.filter(Boolean).length;
		return Math.max(1, Math.ceil(words / 220));
	}

	function handleSubscribe(email: string): void {
		if (subscriberStore.getByEmail(email)) {
			toastStore.info('Already subscribed', `${email} is already in the audience.`);
			return;
		}

		subscriberStore.addSubscriber({
			email,
			firstName: '',
			lastName: '',
			status: 'pending',
			tier: 'free',
			tags: ['public-form'],
			notes: 'Subscribed from the public archive'
		});

		toastStore.success('Confirmation sent', `Check ${email} to confirm your subscription.`);
	}
</script>

<svelte:head>
	<title>{settings.publicationName} — {settings.tagline}</title>
	<meta name="description" content={settings.description} />
</svelte:head>

<div class="min-h-screen flex flex-col bg-paper">
	<a
	href="#main-content"
	class="sr-only focus:not-sr-only focus:absolute focus:z-[70] focus:top-3 focus:left-3 focus:px-4 focus:py-2 focus:rounded-md focus:bg-stone-900 focus:text-stone-50 text-sm font-medium"
>
	Skip to main content
</a>
	<PublicNavigation publicationName={settings.publicationName} isArchiveActive />

	<main id="main-content" class="flex-1 w-full">
		<section class="max-w-3xl mx-auto px-4 sm:px-6 pt-12 pb-10 text-center space-y-4 border-b border-stone-200">
			<h1 class="text-3xl sm:text-4xl md:text-5xl font-serif font-bold text-stone-900 tracking-tight text-balance">
				{settings.publicationName}
			</h1>
			<p class="text-stone-600 text-lg sm:text-xl max-w-xl mx-auto font-serif leading-relaxed">
				{settings.tagline}
			</p>
			<p class="text-xs font-mono text-stone-500">
				{subscriberCount} active reader{subscriberCount === 1 ? '' : 's'} · {publishedIssues.length}
				published dispatch{publishedIssues.length === 1 ? '' : 'es'}
			</p>
		</section>

		<div class="max-w-3xl mx-auto px-4 sm:px-6 py-10 space-y-12">
			<section aria-labelledby="archive-heading" class="space-y-2">
				<h2
					id="archive-heading"
					class="text-xs font-mono uppercase tracking-wider text-stone-500"
				>
					Archive
				</h2>

				{#if publishedIssues.length === 0}
					<div class="py-16 text-center border border-dashed border-stone-300 rounded-lg">
						<h3 class="font-serif text-lg text-stone-900">No dispatches published yet</h3>
						<p class="text-sm text-stone-500 mt-1">
							The first issue is on its way. Subscribe below and it will land in your inbox.
						</p>
					</div>
				{:else}
					<div class="divide-y divide-stone-200">
						{#each publishedIssues as issue, index (issue.id)}
							<ArchiveIssueCard
								{issue}
								issueNumber={publishedIssues.length - index}
							/>
						{/each}
					</div>
				{/if}
			</section>

			<SubscribeCard
				publicationName={settings.publicationName}
				supportEmail={settings.supportEmail}
				onsubscribe={handleSubscribe}
			/>
		</div>
	</main>

	<footer class="border-t border-stone-200 py-6 px-4 text-center">
		<p class="text-xs font-mono text-stone-500">
			{settings.publicationName} · Editor {settings.supportEmail}
		</p>
	</footer>
</div>