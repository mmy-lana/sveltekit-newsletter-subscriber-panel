import type {
	DeliveryJobLog,
	DeliveryJobStatus,
	DistributionResult,
	NewsletterIssue,
	Subscriber
} from '#lib/types/newsletter';
import { generateUuid } from '#lib/utils/uuid';

/** Tunable simulation parameters; injectable so tests run deterministically. */
export interface DispatchSimulationOptions {
	/** Recipients processed concurrently before yielding back to the event loop. */
	batchSize?: number;
	/** Probability that a delivery hard-bounces. */
	bounceRate?: number;
	/** Probability that a delivered message is opened. */
	openRate?: number;
	/** Probability that an opened message records a click. */
	clickRate?: number;
	/** Per-job simulated latency, in milliseconds. */
	minLatencyMs?: number;
	maxLatencyMs?: number;
	/** Injects a deterministic random source; used by the verification suite. */
	randomSource?: () => number;
}

/** Resolved simulation parameters (the random source stays optional). */
type ResolvedOptions = Omit<Required<DispatchSimulationOptions>, 'randomSource'>;

const DEFAULT_OPTIONS: ResolvedOptions = {
	batchSize: 20,
	bounceRate: 0.03,
	openRate: 0.48,
	clickRate: 0.22,
	minLatencyMs: 60,
	maxLatencyMs: 160
};

/**
 * Abortable, pausable batch dispatcher.
 *
 * The engine never mutates an issue or a subscriber itself: it produces a
 * `DeliveryJobLog` stream plus a `DistributionResult`, and the caller reconciles
 * those into the stores. That keeps the simulation pure with respect to the domain.
 */
export class DeliveryQueueManager {
	jobs = $state<DeliveryJobLog[]>([]);
	isProcessing = $state(false);
	isPaused = $state(false);
	processedCount = $state(0);
	totalQueueCount = $state(0);
	currentIssueId = $state<string | null>(null);
	/** Thrown by {@link runDistribution} when the queue is already running. */
	lastError = $state<string | null>(null);

	private abortController: AbortController | null = null;
	private randomSource: () => number = Math.random;

	/** 0-100, floored for display. */
	progressPercent = $derived.by(() => {
		if (this.totalQueueCount === 0) return 0;
		return Math.floor((this.processedCount / this.totalQueueCount) * 100);
	});

	statusCounts = $derived.by(() => {
		const counts: Record<DeliveryJobStatus, number> = {
			queued: 0,
			in_transit: 0,
			delivered: 0,
			failed: 0,
			bounced: 0
		};
		for (const job of this.jobs) counts[job.status]++;
		return counts;
	});

	/** Seeds the queue with one job per recipient. Replaces any previous run. */
	enqueueIssue(issue: NewsletterIssue, targetSubscribers: Subscriber[]): number {
		if (this.isProcessing) {
			throw new Error('A delivery distribution job is currently running.');
		}

		const now = new Date().toISOString();
		this.currentIssueId = issue.id;
		this.processedCount = 0;
		this.isPaused = false;
		this.lastError = null;

		this.jobs = targetSubscribers.map((subscriber) => ({
			id: generateUuid(),
			issueId: issue.id,
			subscriberId: subscriber.id,
			subscriberEmail: subscriber.email,
			status: 'queued',
			attemptCount: 0,
			errorMessage: null,
			queuedAt: now,
			processedAt: null,
			openedAt: null,
			clickedAt: null
		}));

		this.totalQueueCount = this.jobs.length;
		return this.jobs.length;
	}

	/** Aborts the active run; the engine stops at the next safe batch boundary. */
	cancelDistribution(): void {
		if (this.abortController && this.isProcessing) {
			this.abortController.abort();
		}
		this.isPaused = false;
	}

	pause(): void {
		if (this.isProcessing) this.isPaused = true;
	}

	resume(): void {
		this.isPaused = false;
	}

	reset(): void {
		if (this.isProcessing) this.cancelDistribution();
		this.jobs = [];
		this.isProcessing = false;
		this.isPaused = false;
		this.processedCount = 0;
		this.totalQueueCount = 0;
		this.currentIssueId = null;
		this.lastError = null;
	}

	/**
	 * Processes the queue in bounded batches.
	 *
	 * @param options Simulation tuning; `random` makes a run fully deterministic in tests.
	 * @param onJobProcessed Invoked once per completed job, for live logging.
	 */
	async runDistribution(
		options: DispatchSimulationOptions = {},
		onJobProcessed?: (job: DeliveryJobLog) => void
	): Promise<DistributionResult> {
		const config = { ...DEFAULT_OPTIONS, ...options };
		if (options.randomSource) this.randomSource = options.randomSource;

		this.isProcessing = true;
		this.isPaused = false;
		this.abortController = new AbortController();
		const signal = this.abortController.signal;

		const result: DistributionResult = { delivered: 0, bounced: 0, opened: 0, clicked: 0, cancelled: false };

		try {
			for (let index = 0; index < this.jobs.length; index += Math.max(1, config.batchSize)) {
				if (signal.aborted) {
					result.cancelled = true;
					break;
				}

				// A paused run parks here instead of spinning the event loop.
				while (this.isPaused && !signal.aborted) {
					await delay(80);
				}

				if (signal.aborted) {
					result.cancelled = true;
					break;
				}

				const batch = this.jobs.slice(index, index + Math.max(1, config.batchSize));

				await Promise.all(
					batch.map(async (job) => {
						if (signal.aborted) return;

						job.status = 'in_transit';
						job.attemptCount += 1;

						await delay(
							randomBetween(this.randomSource, config.minLatencyMs, config.maxLatencyMs)
						);

						if (signal.aborted) return;

						const processedAt = new Date().toISOString();
						job.processedAt = processedAt;

						if (this.randomSource() < config.bounceRate) {
							job.status = 'bounced';
							job.errorMessage = 'Mailbox unavailable or invalid destination.';
							result.bounced++;
							this.processedCount++;
							onJobProcessed?.(job);
							return;
						}

						job.status = 'delivered';
						result.delivered++;

						if (this.randomSource() < config.openRate) {
							job.openedAt = new Date(Date.parse(processedAt) + 500).toISOString();
							result.opened++;

							if (this.randomSource() < config.clickRate) {
								job.clickedAt = new Date(Date.parse(processedAt) + 1000).toISOString();
								result.clicked++;
							}
						}

						this.processedCount++;
						onJobProcessed?.(job);
					})
				);
			}
		} catch (error) {
			this.lastError = error instanceof Error ? error.message : String(error);
			result.cancelled = true;
		} finally {
			this.isProcessing = false;
			this.isPaused = false;
			this.abortController = null;
		}

		return result;
	}
}

function delay(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

function randomBetween(random: () => number, min: number, max: number): number {
	const span = Math.max(0, max - min);
	return min + random() * span;
}

let queueInstance: DeliveryQueueManager | null = null;

export function getDeliveryQueue(): DeliveryQueueManager {
	if (typeof window === 'undefined') {
		return new DeliveryQueueManager();
	}

	if (!queueInstance) {
		queueInstance = new DeliveryQueueManager();
	}

	return queueInstance;
}

/**
 * Backwards-compatible shim for existing page imports.
 *
 * NOTE: Svelte 5 fine-grained reactivity ($state/$derived) cannot be statically tracked
 * by the compiler through a dynamic Proxy object. Components must instantiate state via
 * `getDeliveryQueue()` inside component script scopes rather than reading this export directly.
 *
 * The set trap uses an unchecked cast for shim compatibility and is not type-enforced at compile time.
 * @deprecated Use `getDeliveryQueue()` directly in .svelte components.
 */
export const deliveryQueue = new Proxy({} as DeliveryQueueManager, {
	get(_target, prop: keyof DeliveryQueueManager) {
		const instance = getDeliveryQueue();
		const value = instance[prop];
		return typeof value === 'function' ? value.bind(instance) : value;
	},
	set(_target, prop: keyof DeliveryQueueManager, value) {
		const instance = getDeliveryQueue();
		(instance as unknown as Record<string, unknown>)[prop as string] = value;
		return true;
	}
});