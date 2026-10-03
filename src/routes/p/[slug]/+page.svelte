<script lang="ts">
	import { page } from '$app/state';
	import ArticleHeader from '#lib/components/editorial/ArticleHeader.svelte';
	import ArticleRenderer from '#lib/components/editorial/ArticleRenderer.svelte';
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
	const slug = $derived(page.params.slug ?? '');

	/** Only published issues are readable in the public archive. */
	const issue = $derived(issueStore.getBySlug(slug));

	const publishedIssues = $derived(issueStore.publishedIssues);
	const currentIndex = $derived(publishedIssues.findIndex((entry) => entry.slug === slug));
	const nextIssue = $derived(
		currentIndex >= 0 ? (publishedIssues[currentIndex + 1] ?? publishedIssues[currentIndex - 1]) : undefined
	);

	const readingMinutes = $derived.by(() => {
		if (!issue) return 1;
		const words = toPlainText(issue.contentMarkdown.replace(/[#*>`\-]/g, ' '))
			.split(/\s+/)
			.filter(Boolean).length;
		return Math.max(1, Math.ceil(words / 220));
	});

	const issueNumber = $derived(currentIndex >= 0 ? publishedIssues.length - currentIndex : null);

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
			notes: 'Subscribed from a dispatch page'
		});

		toastStore.success('Confirmation sent', `Check ${email} to confirm your subscription.`);
	}
</script>

<svelte:head>
	<title>{issue ? `${issue.title} — ${settings.publicationName}` : settings.publicationName}</title>
	<meta name="description" content={issue?.excerpt ?? settings.description} />
</svelte:head>

<div class="min-h-screen flex flex-col bg-paper">
	<a
	href="#main-content"
	class="sr-only focus:not-sr-only focus:absolute focus:z-[70] focus:top-3 focus:left-3 focus:px-4 focus:py-2 focus:rounded-md focus:bg-stone-900 focus:text-stone-50 text-sm font-medium"
>
	Skip to main content
</a>
	<PublicNavigation publicationName={settings.publicationName} />

	<main id="main-content" class="flex-1 w-full">
		{#if issue}
			<article class="max-w-2xl mx-auto px-4 sm:px-6 py-10 sm:py-14 space-y-8">
				<ArticleHeader {issue} {readingMinutes} {issueNumber} />

				<hr class="border-stone-200" />

				<ArticleRenderer
					contentMarkdown={issue.contentMarkdown}
					contentHtml={issue.contentHtml}
				/>

				<footer class="pt-6 border-t border-stone-200 space-y-6">
					{#if nextIssue && nextIssue.id !== issue.id}
						<a
							href="/p/{nextIssue.slug}"
							class="group block rounded-lg border border-stone-200 p-5 hover:bg-stone-50 transition-colors"
						>
							<span class="text-xs font-mono uppercase tracking-wider text-stone-500">
								Read next
							</span>
							<span class="block font-serif font-bold text-stone-900 mt-1 group-hover:underline underline-offset-4">
								{nextIssue.title}
							</span>
						</a>
					{/if}

					<SubscribeCard
						publicationName={settings.publicationName}
						supportEmail={settings.supportEmail}
						onsubscribe={handleSubscribe}
					/>
				</footer>
			</article>
		{:else}
			<section class="max-w-2xl mx-auto px-4 sm:px-6 py-20 text-center space-y-4">
				<p class="text-xs font-mono uppercase tracking-wider text-stone-500">404</p>
				<h1 class="text-3xl font-serif font-bold text-stone-900 tracking-tight text-balance">
					Dispatch not found
				</h1>
				<p class="text-stone-600">
					There is no published dispatch at <span class="font-mono">/{slug}</span>. It may have been
					renamed, or it has not been sent yet.
				</p>
				<div class="pt-2 flex items-center justify-center gap-3">
					<a
						href="/"
						class="inline-flex items-center justify-center min-h-[44px] px-5 rounded-md bg-stone-900 text-stone-50 text-sm font-medium hover:bg-stone-800 transition-colors"
					>
						Back to the archive
					</a>
					<a
						href="/admin/issues"
						class="inline-flex items-center justify-center min-h-[44px] px-5 rounded-md border border-stone-300 text-stone-800 text-sm font-medium hover:bg-stone-100 transition-colors"
					>
						Open publisher panel
					</a>
				</div>
			</section>
		{/if}
	</main>

	<footer class="border-t border-stone-200 py-6 px-4 text-center">
		<p class="text-xs font-mono text-stone-500">
			{settings.publicationName} · Editor {settings.supportEmail}
		</p>
	</footer>
</div>