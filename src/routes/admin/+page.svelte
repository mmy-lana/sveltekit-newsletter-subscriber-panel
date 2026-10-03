<script lang="ts">
	import AdminSidebar from '#lib/components/panel/AdminSidebar.svelte';
	import MetricCard from '#lib/components/panel/MetricCard.svelte';
	import Badge from '#lib/components/ui/Badge.svelte';
	import { getIssueState } from '#lib/state/issue.svelte';
	import { getSubscriberState } from '#lib/state/subscriber.svelte';
	import { getSettingsState } from '#lib/state/settings.svelte';
	import { calculateDashboardMetrics } from '#lib/utils/metrics-calculator';
	import {
		formatCurrency,
		formatDate,
		formatNumber,
		formatPercentFixed,
		formatRelativeTime
	} from '#lib/utils/format';

	const subscriberStore = getSubscriberState();
	const issueStore = getIssueState();
	const settingsStore = getSettingsState();

	let isMobileNavOpen = $state(false);

	const settings = $derived(settingsStore.settings);

	/**
	 * Metrics are a pure derivation of the two collections, so the dashboard can
	 * never drift from the data shown on the other screens.
	 */
	const summary = $derived(calculateDashboardMetrics(subscriberStore.items, issueStore.items));

	const recentIssues = $derived(
		[...issueStore.items]
			.sort((a, b) => Date.parse(b.publishedAt ?? b.createdAt) - Date.parse(a.publishedAt ?? a.createdAt))
			.slice(0, 5)
	);

	const recentSubscribers = $derived(
		[...subscriberStore.items]
			.sort((a, b) => Date.parse(b.subscribedAt) - Date.parse(a.subscribedAt))
			.slice(0, 5)
	);

	const growthTrend = $derived(
		summary.thirtyDayGrowthCount > 0
			? ({ direction: 'up', label: `+${summary.thirtyDayGrowthCount} in 30 days` } as const)
			: undefined
	);
</script>

<svelte:head>
	<title>Dashboard — {settings.publicationName}</title>
</svelte:head>

<div class="flex h-[100dvh] bg-paper overflow-hidden">
	<a
	href="#main-content"
	class="sr-only focus:not-sr-only focus:absolute focus:z-[70] focus:top-3 focus:left-3 focus:px-4 focus:py-2 focus:rounded-md focus:bg-stone-900 focus:text-stone-50 text-sm font-medium"
>
	Skip to main content
</a>
	<AdminSidebar
		isMobileOpen={isMobileNavOpen}
		subscriberCount={subscriberStore.totalCount}
		onclose={() => (isMobileNavOpen = false)}
	/>

	<div class="flex-1 flex flex-col min-w-0 overflow-hidden">
		<header
			class="h-16 flex items-center justify-between gap-3 px-4 sm:px-6 border-b border-stone-200 bg-white shrink-0"
		>
			<div class="flex items-center gap-3 min-w-0">
				<button
					type="button"
					class="lg:hidden p-2 -ml-2 text-stone-600 hover:text-stone-900 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-md shrink-0 cursor-pointer"
					onclick={() => (isMobileNavOpen = true)}
					aria-label="Open navigation"
				>
					<svg
						class="w-6 h-6"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
						aria-hidden="true"
						focusable="false"
					>
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"
						></path>
					</svg>
				</button>
				<h1 class="font-serif font-bold text-stone-900 text-base sm:text-lg truncate">Dashboard</h1>
			</div>

			<a
				href="/"
				class="text-xs font-mono uppercase tracking-wider px-3 min-h-[44px] inline-flex items-center border border-stone-300 rounded text-stone-700 hover:bg-stone-100 transition-colors"
			>
				View site
			</a>
		</header>

		<main id="main-content" class="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 pb-24 lg:pb-12">
			<div class="max-w-6xl mx-auto space-y-8">
				<section class="space-y-1">
					<h2 class="text-2xl md:text-3xl font-serif font-bold text-stone-900 tracking-tight">
						Overview
					</h2>
					<p class="text-sm text-stone-500">
						Audience health and distribution telemetry for {settings.publicationName}.
					</p>
				</section>

				<section aria-label="Key metrics" class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
					<MetricCard
						title="Active Audience"
						value={formatNumber(summary.activeSubscribers)}
						subtitle={`of ${formatNumber(summary.totalSubscribers)} total`}
						trend={growthTrend}
					/>
					<MetricCard
						title="Paid Members"
						value={formatNumber(summary.paidSubscribers)}
						subtitle="paid + founding tiers"
					/>
					<MetricCard
						title="Avg Open Rate"
						value={formatPercentFixed(summary.averageOpenRatePercent)}
						subtitle="issue-weighted"
					/>
					<MetricCard
						title="Est. Monthly Revenue"
						value={formatCurrency(summary.monthlyRevenueEst)}
						subtitle="active paid tiers"
					/>
				</section>

				<section class="grid grid-cols-1 xl:grid-cols-2 gap-6">
					<div class="bg-white border border-stone-200 rounded-lg shadow-panel overflow-hidden">
						<div class="px-5 py-3 border-b border-stone-200 flex items-center justify-between">
							<h3 class="text-sm font-semibold text-stone-900">Latest dispatches</h3>
							<a
								href="/admin/issues"
								class="text-xs font-mono text-stone-600 hover:text-stone-900 min-h-[44px] inline-flex items-center"
							>
								View all
							</a>
						</div>

						{#if recentIssues.length === 0}
							<p class="px-5 py-10 text-center text-sm text-stone-500">
								No issues yet. Create your first draft from the issues screen.
							</p>
						{:else}
							<ul class="divide-y divide-stone-200">
								{#each recentIssues as issue (issue.id)}
									<li class="px-5 py-3">
										<div class="flex items-center justify-between gap-3">
											<a
												href="/admin/issues/{issue.id}"
												class="text-sm font-medium text-stone-900 hover:underline underline-offset-4 truncate"
											>
												{issue.title}
											</a>
											<Badge
												variant={issue.status === 'sent'
													? 'success'
													: issue.status === 'scheduled'
														? 'warning'
														: issue.status === 'archived'
															? 'neutral'
															: 'outline'}
												size="sm"
											>
												{issue.status}
											</Badge>
										</div>
										<p class="text-[11px] font-mono text-stone-500 mt-1">
											{issue.status === 'sent'
												? `Published ${formatDate(issue.publishedAt)} · ${issue.stats.deliveredCount}/${issue.stats.totalRecipients} delivered`
												: `Updated ${formatRelativeTime(issue.updatedAt)}`}
										</p>
									</li>
								{/each}
							</ul>
						{/if}
					</div>

					<div class="bg-white border border-stone-200 rounded-lg shadow-panel overflow-hidden">
						<div class="px-5 py-3 border-b border-stone-200 flex items-center justify-between">
							<h3 class="text-sm font-semibold text-stone-900">Newest readers</h3>
							<a
								href="/admin/subscribers"
								class="text-xs font-mono text-stone-600 hover:text-stone-900 min-h-[44px] inline-flex items-center"
							>
								View all
							</a>
						</div>

						{#if recentSubscribers.length === 0}
							<p class="px-5 py-10 text-center text-sm text-stone-500">
								No subscribers yet. Import a CSV or add a reader manually.
							</p>
						{:else}
							<ul class="divide-y divide-stone-200">
								{#each recentSubscribers as subscriber (subscriber.id)}
									<li class="px-5 py-3 flex items-center justify-between gap-3">
										<div class="min-w-0">
											<p class="text-sm text-stone-900 truncate">{subscriber.email}</p>
											<p class="text-[11px] font-mono text-stone-500">
												Joined {formatRelativeTime(subscriber.subscribedAt)}
											</p>
										</div>
										<Badge
											variant={subscriber.status === 'active'
												? 'success'
												: subscriber.status === 'bounced'
													? 'error'
													: subscriber.status === 'unsubscribed'
														? 'neutral'
														: 'warning'}
											size="sm"
										>
											{subscriber.status}
										</Badge>
									</li>
								{/each}
							</ul>
						{/if}
					</div>
				</section>

				<section class="bg-white border border-stone-200 rounded-lg shadow-panel p-5">
					<h3 class="text-sm font-semibold text-stone-900 mb-3">List health</h3>
					<div class="grid grid-cols-2 sm:grid-cols-4 gap-4">
						<div>
							<p class="text-[11px] font-mono uppercase tracking-wider text-stone-500">Active</p>
							<p class="text-xl font-serif font-bold tabular-nums">{summary.activeSubscribers}</p>
						</div>
						<div>
							<p class="text-[11px] font-mono uppercase tracking-wider text-stone-500">Unsubscribed</p>
							<p class="text-xl font-serif font-bold tabular-nums">
								{subscriberStore.items.filter((subscriber) => subscriber.status === 'unsubscribed').length}
							</p>
						</div>
						<div>
							<p class="text-[11px] font-mono uppercase tracking-wider text-stone-500">Bounced</p>
							<p class="text-xl font-serif font-bold tabular-nums text-rose-700">
								{subscriberStore.bouncedCount}
							</p>
						</div>
						<div>
							<p class="text-[11px] font-mono uppercase tracking-wider text-stone-500">Issues sent</p>
							<p class="text-xl font-serif font-bold tabular-nums">{summary.issuesSentCount}</p>
						</div>
					</div>
				</section>
			</div>
		</main>
	</div>
</div>