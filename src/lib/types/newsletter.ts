export type SubscriberStatus = 'active' | 'unsubscribed' | 'bounced' | 'pending';
export type SubscriberTier = 'free' | 'paid' | 'founding';

export interface SubscriberMetrics {
  emailsReceivedCount: number;
  emailsOpenedCount: number;
  linksClickedCount: number;
  lastOpenedAt: string | null;
  openRatePercent: number;
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

export interface SubscriberFilterOptions {
  searchQuery: string;
  status: SubscriberStatus | 'all';
  tier: SubscriberTier | 'all';
  tag: string | 'all';
  sortBy: 'subscribedAt' | 'email' | 'openRatePercent' | 'lastOpenedAt';
  sortDirection: 'asc' | 'desc';
  page: number;
  pageSize: number;
}

export interface IssueFilterOptions {
  status: IssueStatus | 'all';
  searchQuery: string;
  sortBy: 'createdAt' | 'publishedAt' | 'totalRecipients';
  sortDirection: 'asc' | 'desc';
  page: number;
  pageSize: number;
}
