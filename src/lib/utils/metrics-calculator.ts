import type {
	AudienceFilter,
	DashboardMetricsSummary,
	DeliveryJobLog,
	IssueDeliveryStats,
	NewsletterIssue,
	Subscriber,
	SubscriberMetrics
} from '#lib/types/newsletter';
import { parseTimestamp, roundTo } from '#lib/utils/validators';

/** Monthly list price per tier, used for the revenue estimate on the dashboard. */
export const TIER_MONTHLY_PRICE: Readonly<Record<Subscriber['tier'], number>> = {
	free: 0,
	paid: 8,
	founding: 15
};

/** Window (in days) used by the "recent growth" dashboard metric. */
export const GROWTH_WINDOW_DAYS = 30;

/** Builds a zeroed telemetry block for a newly created subscriber. */
export function createEmptyMetrics(): SubscriberMetrics {
	return {
		emailsReceivedCount: 0,
		emailsOpenedCount: 0,
		linksClickedCount: 0,
		lastOpenedAt: null,
		openRatePercent: 0,
		clickRatePercent: 0
	};
}

/** Builds a zeroed delivery-statistics block for a newly created issue. */
export function createEmptyIssueStats(): IssueDeliveryStats {
	return {
		totalRecipients: 0,
		deliveredCount: 0,
		openedCount: 0,
		clickedCount: 0,
		bouncedCount: 0,
		unsubscribedCount: 0,
		deliveryCompletedAt: null
	};
}

/**
 * Open rate: opens / delivered.
 * [MED-03] Named explicitly so callers cannot confuse it with a click rate.
 */
export function calculateOpenRate(openedCount: number, deliveredCount: number): number {
	if (deliveredCount <= 0) return 0;
	return roundTo((openedCount / deliveredCount) * 100, 1);
}

/**
 * Click-to-open rate (CTOR): clicks / opens.
 *
 * [MED-03] This is the share of *engaged* readers who clicked. It is a different
 * number from the click-through rate below; the two were previously presented
 * under the same "Click-through" label.
 */
export function calculateClickToOpenRate(clickedCount: number, openedCount: number): number {
	if (openedCount <= 0) return 0;
	return roundTo((clickedCount / openedCount) * 100, 1);
}

/**
 * Click-through rate (CTR): clicks / delivered.
 *
 * [MED-03] This is the share of *delivered messages* that produced a click.
 */
export function calculateClickThroughRate(clickedCount: number, deliveredCount: number): number {
	if (deliveredCount <= 0) return 0;
	return roundTo((clickedCount / deliveredCount) * 100, 1);
}

/**
 * Recomputes the cached engagement percentages from raw counters.
 * Guards against division by zero and against clicks exceeding opens.
 *
 * [MED-03] `openRatePercent` is opens / received; `clickRatePercent` is the
 * click-to-open rate (clicks / opens), not the click-through rate.
 */
export function recalculateEngagement(metrics: SubscriberMetrics): SubscriberMetrics {
	const received = Math.max(0, metrics.emailsReceivedCount);
	const opened = Math.min(Math.max(0, metrics.emailsOpenedCount), received);
	const clicked = Math.min(Math.max(0, metrics.linksClickedCount), opened);

	return {
		...metrics,
		emailsReceivedCount: received,
		emailsOpenedCount: opened,
		linksClickedCount: clicked,
		openRatePercent: received > 0 ? roundTo((opened / received) * 100, 1) : 0,
		clickRatePercent: calculateClickToOpenRate(clicked, opened)
	};
}

/**
 * Issue-weighted open rate: the mean of each sent issue's open rate (opens /
 * delivered). An issue that delivered nothing contributes a hard 0.0% rather than
 * being excluded, so the average never inflates itself.
 */
export function calculateIssueWeightedOpenRate(issues: NewsletterIssue[]): number {
	const sentIssues = issues.filter((issue) => issue.status === 'sent');
	if (sentIssues.length === 0) return 0;

	const total = sentIssues.reduce(
		(accumulator, issue) => accumulator + calculateOpenRate(issue.stats.openedCount, issue.stats.deliveredCount),
		0
	);

	return roundTo(total / sentIssues.length, 1);
}

/**
 * Issue-weighted click-through rate (CTR): the mean of each sent issue's clicks /
 * delivered. Mean across issues, not weighted by delivery volume.
 *
 * [MED-03] Renamed from `calculateIssueWeightedClickRate`: the previous name (and
 * its doc comment, which described an open rate) invited the confusion between
 * clicks / delivered (CTR) and clicks / opens (CTOR).
 */
export function calculateIssueWeightedClickThroughRate(issues: NewsletterIssue[]): number {
	const sentIssues = issues.filter((issue) => issue.status === 'sent');
	if (sentIssues.length === 0) return 0;

	const total = sentIssues.reduce(
		(accumulator, issue) =>
			accumulator + calculateClickThroughRate(issue.stats.clickedCount, issue.stats.deliveredCount),
		0
	);

	return roundTo(total / sentIssues.length, 1);
}

/** Mean open rate across subscribers that have received at least one issue. */
export function calculateAudienceOpenRate(subscribers: Subscriber[]): number {
	const engaged = subscribers.filter((subscriber) => subscriber.metrics.emailsReceivedCount > 0);
	if (engaged.length === 0) return 0;

	const total = engaged.reduce((sum, subscriber) => sum + subscriber.metrics.openRatePercent, 0);
	return roundTo(total / engaged.length, 1);
}

/** Mean click-to-open rate (CTOR: clicks / opens) across subscribers that received at least one issue. */
export function calculateAudienceClickToOpenRate(subscribers: Subscriber[]): number {
	const engaged = subscribers.filter((subscriber) => subscriber.metrics.emailsReceivedCount > 0);
	if (engaged.length === 0) return 0;

	const total = engaged.reduce((sum, subscriber) => sum + subscriber.metrics.clickRatePercent, 0);
	return roundTo(total / engaged.length, 1);
}

/**
 * Selects the recipients for an issue audience filter.
 * Only `active` subscribers can ever receive a dispatch.
 */
export function resolveAudienceSubscribers(
	subscribers: Subscriber[],
	audience: AudienceFilter
): Subscriber[] {
	return subscribers.filter((subscriber) => {
		if (subscriber.status !== 'active') return false;

		switch (audience) {
			case 'free_only':
				return subscriber.tier === 'free';
			case 'paid_only':
				return subscriber.tier === 'paid';
			case 'founding_only':
				return subscriber.tier === 'founding';
			default:
				return true;
		}
	});
}

/** Aggregates the delivery-job log into the statistics persisted on an issue. */
export function summarizeDeliveryJobs(
	jobs: DeliveryJobLog[],
	completionIso: string | null
): IssueDeliveryStats {
	const stats = createEmptyIssueStats();
	stats.totalRecipients = jobs.length;

	for (const job of jobs) {
		if (job.status === 'delivered') stats.deliveredCount++;
		if (job.status === 'bounced') stats.bouncedCount++;
		if (job.openedAt) stats.openedCount++;
		if (job.clickedAt) stats.clickedCount++;
	}

	stats.deliveryCompletedAt = completionIso;
	return stats;
}

/**
 * Builds the dashboard summary.
 *
 * @param now Reference instant for the rolling growth window; injectable for tests.
 */
export function calculateDashboardMetrics(
	subscribers: Subscriber[],
	issues: NewsletterIssue[],
	now: Date = new Date()
): DashboardMetricsSummary {
	const activeSubscribers = subscribers.filter((subscriber) => subscriber.status === 'active');
	const paidSubscribers = activeSubscribers.filter((subscriber) => subscriber.tier !== 'free');

	const monthlyRevenueEst = activeSubscribers.reduce(
		(sum, subscriber) => sum + TIER_MONTHLY_PRICE[subscriber.tier],
		0
	);

	const growthThreshold = now.getTime() - GROWTH_WINDOW_DAYS * 24 * 60 * 60 * 1000;
	const thirtyDayGrowthCount = subscribers.filter((subscriber) => {
		const subscribedAt = parseTimestamp(subscriber.subscribedAt);
		return subscribedAt !== null && subscribedAt.getTime() >= growthThreshold;
	}).length;

	return {
		totalSubscribers: subscribers.length,
		activeSubscribers: activeSubscribers.length,
		paidSubscribers: paidSubscribers.length,
		monthlyRevenueEst,
		averageOpenRatePercent: calculateIssueWeightedOpenRate(issues),
		averageClickThroughRatePercent: calculateIssueWeightedClickThroughRate(issues),
		thirtyDayGrowthCount,
		issuesSentCount: issues.filter((issue) => issue.status === 'sent').length
	};
}

/** Total messages successfully delivered across every sent issue. */
export function calculateLifetimeDeliveries(issues: NewsletterIssue[]): number {
	return issues
		.filter((issue) => issue.status === 'sent')
		.reduce((sum, issue) => sum + issue.stats.deliveredCount, 0);
}