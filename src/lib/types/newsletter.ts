/**
 * Pure data contracts for the newsletter publication and subscriber domain.
 *
 * Every interface in this module is transport-agnostic: it is serialisable to
 * JSON, safe to persist in LocalStorage, and free of class instances or DOM
 * references so that the same shape can travel across SSR and CSR boundaries.
 */

export type SubscriberStatus = 'active' | 'unsubscribed' | 'bounced' | 'pending';
export type SubscriberTier = 'free' | 'paid' | 'founding';

export interface SubscriberMetrics {
  emailsReceivedCount: number;
  emailsOpenedCount: number;
  linksClickedCount: number;
  lastOpenedAt: string | null;
  /** Open rate = opens / received. */
  openRatePercent: number;
  /**
   * Click-to-open rate (CTOR) = clicks / opens.
   *
   * The field name is retained for storage compatibility; it is *not* the
   * click-through rate (clicks / delivered), which is calculated per issue.
   */
  clickRatePercent: number;
}

export interface Subscriber {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  status: SubscriberStatus;
  tier: SubscriberTier;
  tags: string[];
  metrics: SubscriberMetrics;
  subscribedAt: string;
  updatedAt: string;
  notes: string;
}

export type IssueStatus = 'draft' | 'scheduled' | 'sending' | 'sent' | 'archived';
export type AudienceFilter = 'all' | 'free_only' | 'paid_only' | 'founding_only';

export interface IssueDeliveryStats {
  totalRecipients: number;
  deliveredCount: number;
  openedCount: number;
  clickedCount: number;
  bouncedCount: number;
  unsubscribedCount: number;
  deliveryCompletedAt: string | null;
}

export interface NewsletterIssue {
  id: string;
  slug: string;
  title: string;
  subtitle: string;
  excerpt: string;
  contentMarkdown: string;
  contentHtml: string;
  coverImageUrl: string | null;
  authorName: string;
  authorAvatarUrl: string | null;
  status: IssueStatus;
  audience: AudienceFilter;
  tags: string[];
  scheduledAt: string | null;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  stats: IssueDeliveryStats;
}

export type DeliveryJobStatus = 'queued' | 'in_transit' | 'delivered' | 'failed' | 'bounced';

export interface DeliveryJobLog {
  id: string;
  issueId: string;
  subscriberId: string;
  subscriberEmail: string;
  status: DeliveryJobStatus;
  attemptCount: number;
  errorMessage: string | null;
  queuedAt: string;
  processedAt: string | null;
  openedAt: string | null;
  clickedAt: string | null;
}

export interface DistributionResult {
  delivered: number;
  bounced: number;
  opened: number;
  clicked: number;
  cancelled: boolean;
}

export interface PublicationSettings {
  publicationName: string;
  tagline: string;
  description: string;
  supportEmail: string;
  accentColor: string;
  fontFamily: 'serif' | 'sans';
  defaultAudience: AudienceFilter;
  enablePublicArchive: boolean;
  enableComments: boolean;
}

export type SubscriberSortField =
  | 'subscribedAt'
  | 'email'
  | 'openRatePercent'
  | 'lastOpenedAt'
  | 'tier'
  | 'status';

export interface SubscriberFilterOptions {
  searchQuery: string;
  status: SubscriberStatus | 'all';
  tier: SubscriberTier | 'all';
  tag: string | 'all';
  sortBy: SubscriberSortField;
  sortDirection: 'asc' | 'desc';
  page: number;
  pageSize: number;
}

export type IssueSortField = 'createdAt' | 'publishedAt' | 'totalRecipients' | 'title' | 'status';

export interface IssueFilterOptions {
  status: IssueStatus | 'all';
  searchQuery: string;
  sortBy: IssueSortField;
  sortDirection: 'asc' | 'desc';
  page: number;
  pageSize: number;
}

export interface DashboardMetricsSummary {
  totalSubscribers: number;
  activeSubscribers: number;
  paidSubscribers: number;
  monthlyRevenueEst: number;
  /** Open rate = opens / delivered, averaged across sent issues. */
  averageOpenRatePercent: number;
  /** Click-through rate (CTR) = clicks / delivered, averaged across sent issues. */
  averageClickThroughRatePercent: number;
  thirtyDayGrowthCount: number;
  issuesSentCount: number;
}

export interface CsvImportError {
  row: number;
  email: string;
  reason: string;
}

export interface CsvImportResult {
  totalRows: number;
  successfulImports: number;
  failedImports: number;
  errors: CsvImportError[];
}

/** Fields a caller must supply when creating a subscriber; identity + telemetry are derived. */
export type SubscriberDraft = Omit<Subscriber, 'id' | 'subscribedAt' | 'updatedAt' | 'metrics'>;

/** Fields a caller must supply when creating an issue; identity + stats are derived. */
export type IssueDraft = Omit<
  NewsletterIssue,
  'id' | 'createdAt' | 'updatedAt' | 'contentHtml' | 'stats'
>;