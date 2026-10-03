/**
 * Phase 2 component suite.
 *
 * Every UI primitive is server-rendered with representative props and asserted
 * against its real markup: semantics, accessibility wiring, and the class
 * contract the design system promises. The Node runner also emits a gallery
 * document so the same markup can be measured inside headless Chrome.
 */

import { render } from 'svelte/server';
import { createRawSnippet } from 'svelte';

import Badge from '#lib/components/ui/Badge.svelte';
import Button from '#lib/components/ui/Button.svelte';
import ConfirmDialog from '#lib/components/ui/ConfirmDialog.svelte';
import Dropdown from '#lib/components/ui/Dropdown.svelte';
import Input from '#lib/components/ui/Input.svelte';
import Modal from '#lib/components/ui/Modal.svelte';
import Pagination from '#lib/components/ui/Pagination.svelte';
import Select from '#lib/components/ui/Select.svelte';
import Skeleton from '#lib/components/ui/Skeleton.svelte';
import Textarea from '#lib/components/ui/Textarea.svelte';
import Toast from '#lib/components/ui/Toast.svelte';

// Phase 3 — compound domain components (presentational variants only; the
// AdminSidebar reads `$app/state`, so it is covered by the E2E suite instead).
import ArchiveIssueCard from '#lib/components/editorial/ArchiveIssueCard.svelte';
import ArticleHeader from '#lib/components/editorial/ArticleHeader.svelte';
import ArticleRenderer from '#lib/components/editorial/ArticleRenderer.svelte';
import Byline from '#lib/components/editorial/Byline.svelte';
import PublicNavigation from '#lib/components/editorial/PublicNavigation.svelte';
import SubscribeCard from '#lib/components/editorial/SubscribeCard.svelte';
import CsvImportModal from '#lib/components/panel/CsvImportModal.svelte';
import DeliveryProgressBar from '#lib/components/panel/DeliveryProgressBar.svelte';
import IssueDeliveryQueueModal from '#lib/components/panel/IssueDeliveryQueueModal.svelte';
import IssueEditor from '#lib/components/panel/IssueEditor.svelte';
import IssuePreviewPane from '#lib/components/panel/IssuePreviewPane.svelte';
import MetricCard from '#lib/components/panel/MetricCard.svelte';
import SubscriberFilterBar from '#lib/components/panel/SubscriberFilterBar.svelte';
import SubscriberModal from '#lib/components/panel/SubscriberModal.svelte';
import SubscriberTable from '#lib/components/panel/SubscriberTable.svelte';
import { initialIssues, initialSubscribers } from '#lib/storage/seed-data';
import type { Subscriber } from '#lib/types/newsletter';

export interface SuiteResult {
	passed: number;
	failed: number;
	total: number;
	failures: string[];
	/** Gallery sections keyed by name, rendered for the headless Chrome pass. */
	gallery: Array<{ title: string; html: string }>;
}

interface Case {
	name: string;
	html: string;
	assert: (html: string) => void;
}

function mustInclude(html: string, needle: string, context: string): void {
	if (!html.includes(needle)) {
		throw new Error(`${context}: expected markup to contain ${JSON.stringify(needle)}`);
	}
}

function mustNotInclude(html: string, needle: string, context: string): void {
	if (html.includes(needle)) {
		throw new Error(`${context}: expected markup NOT to contain ${JSON.stringify(needle)}`);
	}
}

function assert(condition: boolean, message: string): void {
	if (!condition) throw new Error(message);
}

/* ------------------------------------------------------------------ */
/* Button                                                              */
/* ------------------------------------------------------------------ */

const buttonPrimary = render(Button, {
	props: { variant: 'primary', size: 'md' }
}).body;

const buttonDanger = render(Button, {
	props: { variant: 'danger', size: 'lg', children: undefined, ariaLabel: 'Halt distribution' }
}).body;

const buttonLoading = render(Button, {
	props: { loading: true, ariaLabel: 'Sending' }
}).body;

/* ------------------------------------------------------------------ */
/* Badge                                                               */
/* ------------------------------------------------------------------ */

const badgeStatic = render(Badge, { props: { variant: 'success' } }).body;
const badgeInteractive = render(Badge, {
	props: { interactive: true, pressed: true, size: 'touch', ariaLabel: 'Filter by active' }
}).body;

/* ------------------------------------------------------------------ */
/* Modal                                                               */
/* ------------------------------------------------------------------ */

/** Builds a static snippet so modal body/footer content can be asserted. */
function staticSnippet(html: string) {
	return createRawSnippet(() => ({
		render: () => html
	}));
}

const modalOpen = render(Modal, {
	props: {
		isOpen: true,
		title: 'Add New Subscriber',
		description: 'Create a reader record in the audience.',
		onclose: () => {},
		children: staticSnippet('<p class="text-sm">Form body</p>'),
		footer: staticSnippet(
			'<button type="button" class="inline-flex items-center justify-center min-h-[44px] px-4 rounded-md bg-stone-900 text-stone-50">Save</button>'
		)
	}
}).body;

const modalClosed = render(Modal, {
	props: { isOpen: false, title: 'Hidden dialog', onclose: () => {} }
}).body;

/* ------------------------------------------------------------------ */
/* ConfirmDialog                                                       */
/* ------------------------------------------------------------------ */

/**
 * [HIGH-03 / HIGH-04] The confirmation step is the single primitive behind every
 * destructive action, so it is asserted as such: full dialog semantics inherited
 * from Modal, an explicit affected-record body, and a danger-styled confirm.
 */
const confirmDialogOpen = render(ConfirmDialog, {
	props: {
		isOpen: true,
		title: 'Delete selected subscribers?',
		description: 'Bulk deletion is immediate and cannot be undone.',
		confirmLabel: 'Delete 3 subscribers',
		children: staticSnippet(
			'<p class="text-sm">3 subscribers will be permanently removed from the audience.</p>'
		),
		onconfirm: () => {},
		oncancel: () => {}
	}
}).body;

const confirmDialogClosed = render(ConfirmDialog, {
	props: {
		isOpen: false,
		title: 'Delete issue?',
		confirmLabel: 'Delete issue',
		onconfirm: () => {},
		oncancel: () => {}
	}
}).body;

/* ------------------------------------------------------------------ */
/* Form controls                                                       */
/* ------------------------------------------------------------------ */

const inputDefault = render(Input, {
	props: { label: 'Email', hint: 'reader@example.com', value: '' }
}).body;

const inputInvalid = render(Input, {
	props: { label: 'Email', value: 'not-an-email', error: 'Enter a valid email address.', required: true }
}).body;

const textareaDefault = render(Textarea, {
	props: { label: 'Issue body', value: '# Hello', rows: 8, mono: true, maxlength: 500 }
}).body;

const selectDefault = render(Select, {
	props: {
		label: 'Status',
		value: 'active',
		options: [
			{ value: 'all', label: 'All statuses' },
			{ value: 'active', label: 'Active' },
			{ value: 'bounced', label: 'Bounced', disabled: true }
		]
	}
}).body;

const dropdownDefault = render(Dropdown, {
	props: {
		label: 'Sort by',
		value: 'recent',
		items: [
			{ value: 'recent', label: 'Most recent' },
			{ value: 'rate', label: 'Open rate' },
			{ value: 'remove', label: 'Remove', danger: true }
		],
		onselect: () => {}
	}
}).body;

/* ------------------------------------------------------------------ */
/* Feedback + navigation                                               */
/* ------------------------------------------------------------------ */

const skeletonText = render(Skeleton, { props: { lines: 3 } }).body;
const skeletonCircle = render(Skeleton, { props: { variant: 'circle' } }).body;

const paginationMiddle = render(Pagination, {
	props: { page: 5, totalPages: 12, onpagechange: () => {} }
}).body;

const paginationSingle = render(Pagination, {
	props: { page: 1, totalPages: 1, onpagechange: () => {} }
}).body;

const toastStack = render(Toast, {
	props: {
		toasts: [
			{ id: 't1', variant: 'success', title: 'Subscriber saved', message: 'Added to the audience.', createdAt: 0 },
			{ id: 't2', variant: 'error', title: 'Import failed', message: '3 rows rejected.', createdAt: 0 }
		],
		ondismiss: () => {}
	}
}).body;

/* ------------------------------------------------------------------ */
/* Phase 3 — compound domain components                                 */
/* ------------------------------------------------------------------ */

const noop = (): void => {};

const sampleSubscriber = initialSubscribers[0] as Subscriber;
const sampleIssue = initialIssues[0];

const metricCard = render(MetricCard, {
	props: {
		title: 'Active Audience',
		value: '10',
		subtitle: 'Total active subscribers',
		trend: { direction: 'up', label: '+2 this month' }
	}
}).body;

const subscriberTableDesktop = render(SubscriberTable, {
	props: {
		// Deliberately mixes a reader with telemetry and one that never opened an issue.
		subscribers: [initialSubscribers[0], initialSubscribers[8], initialSubscribers[4]],
		selectedIds: [initialSubscribers[0].id],
		sortBy: 'openRatePercent',
		sortDirection: 'desc',
		ontoggleSelect: noop,
		ontoggleselectall: noop,
		onsortchange: noop,
		onedit: noop,
		ondelete: noop
	}
}).body;

const subscriberTableEmpty = render(SubscriberTable, {
	props: {
		subscribers: [],
		selectedIds: [],
		emptyMessage: 'No subscribers match the current filters.',
		ontoggleSelect: noop,
		onedit: noop,
		ondelete: noop
	}
}).body;

const subscriberTableLoading = render(SubscriberTable, {
	props: { subscribers: [], selectedIds: [], isLoading: true, ontoggleSelect: noop, onedit: noop, ondelete: noop }
}).body;

const filterBar = render(SubscriberFilterBar, {
	props: {
		filters: {
			searchQuery: 'sarah',
			status: 'active',
			tier: 'all',
			tag: 'all',
			sortBy: 'subscribedAt',
			sortDirection: 'desc',
			page: 1,
			pageSize: 10
		},
		availableTags: ['architect', 'systems'],
		resultCount: 3,
		selectedCount: 2,
		onfilterchange: noop,
		onbulkstatus: noop,
		onrequestbulkdelete: noop,
		onclearselection: noop
	}
}).body;

const subscriberModalCreate = render(SubscriberModal, {
	props: { isOpen: true, subscriber: null, existingEmails: [], onsave: noop, onclose: noop }
}).body;

const subscriberModalEdit = render(SubscriberModal, {
	props: {
		isOpen: true,
		subscriber: sampleSubscriber,
		existingEmails: [sampleSubscriber.email],
		onsave: noop,
		onclose: noop
	}
}).body;

const csvImportModal = render(CsvImportModal, {
	props: {
		isOpen: true,
		existingEmails: ['taken@example.com'],
		result: {
			totalRows: 3,
			successfulImports: 2,
			failedImports: 1,
			errors: [{ row: 4, email: 'taken@example.com', reason: 'Already subscribed to this publication.' }]
		},
		onimport: noop,
		onreset: noop,
		onclose: noop
	}
}).body;

const progressBar = render(DeliveryProgressBar, {
	props: { percent: 42.7, processed: 42, total: 100 }
}).body;

const progressBarPaused = render(DeliveryProgressBar, {
	props: { percent: 42.7, processed: 42, total: 100, isPaused: true }
}).body;

const dispatchModalIdle = render(IssueDeliveryQueueModal, {
	props: {
		isOpen: true,
		issue: sampleIssue,
		targetRecipients: 10,
		excludedRecipients: 4,
		status: 'idle',
		progressPercent: 0,
		processedCount: 0,
		totalQueueCount: 0,
		ondispatch: noop,
		onpause: noop,
		onresume: noop,
		onhalt: noop,
		oncomplete: noop,
		onclose: noop
	}
}).body;

const dispatchModalRunning = render(IssueDeliveryQueueModal, {
	props: {
		isOpen: true,
		issue: sampleIssue,
		targetRecipients: 10,
		status: 'running',
		progressPercent: 30,
		processedCount: 3,
		totalQueueCount: 10,
		ondispatch: noop,
		onpause: noop,
		onresume: noop,
		onhalt: noop,
		oncomplete: noop,
		onclose: noop
	}
}).body;

const dispatchModalEmpty = render(IssueDeliveryQueueModal, {
	props: {
		isOpen: true,
		issue: sampleIssue,
		targetRecipients: 0,
		status: 'idle',
		progressPercent: 0,
		processedCount: 0,
		totalQueueCount: 0,
		ondispatch: noop,
		onpause: noop,
		onresume: noop,
		onhalt: noop,
		oncomplete: noop,
		onclose: noop
	}
}).body;

const dispatchModalFinished = render(IssueDeliveryQueueModal, {
	props: {
		isOpen: true,
		issue: sampleIssue,
		targetRecipients: 10,
		status: 'finished',
		progressPercent: 100,
		processedCount: 10,
		totalQueueCount: 10,
		summary: { delivered: 9, bounced: 1, opened: 5, clicked: 2, cancelled: true },
		ondispatch: noop,
		onpause: noop,
		onresume: noop,
		onhalt: noop,
		oncomplete: noop,
		onclose: noop
	}
}).body;

const issueEditor = render(IssueEditor, {
	props: {
		issue: sampleIssue,
		isDirty: true,
		savedAt: '2026-10-05T12:00:00Z',
		onchange: noop,
		onsave: noop,
		ondelete: noop
	}
}).body;

const previewPane = render(IssuePreviewPane, { props: { issue: sampleIssue } }).body;

const publicNavigation = render(PublicNavigation, {
	props: { publicationName: 'The Margins & Letters', isArchiveActive: true }
}).body;

const byline = render(Byline, {
	props: {
		authorName: 'Julian Sterling',
		publishedAt: '2026-09-20T10:00:00Z',
		readingMinutes: 6,
		issueNumber: 12
	}
}).body;

const articleHeader = render(ArticleHeader, {
	props: { issue: sampleIssue, readingMinutes: 6, issueNumber: 12 }
}).body;

const articleRenderer = render(ArticleRenderer, {
	props: { contentMarkdown: sampleIssue.contentMarkdown }
}).body;

const articleRendererHostile = render(ArticleRenderer, {
	props: { contentMarkdown: '<script>alert(1)</script>\n\n[x](javascript:alert(1))' }
}).body;

const archiveCard = render(ArchiveIssueCard, {
	props: { issue: sampleIssue, issueNumber: 12 }
}).body;

const subscribeCard = render(SubscribeCard, {
	props: { publicationName: 'The Margins & Letters', supportEmail: 'editor@themargins.example', onsubscribe: noop }
}).body;

/* ------------------------------------------------------------------ */
/* Cases                                                               */
/* ------------------------------------------------------------------ */

const cases: Case[] = [
	{
		name: 'Button renders a real button with the primary variant',
		html: buttonPrimary,
		assert: (html) => {
			mustInclude(html, '<button', 'button element');
			mustInclude(html, 'type="button"', 'default type');
			mustInclude(html, 'bg-stone-900', 'primary variant class');
			mustInclude(html, 'min-h-[44px]', 'touch-sized minimum height');
			mustInclude(html, 'cursor-pointer', 'pointer affordance');
			mustInclude(html, 'focus-visible:ring-2', 'visible focus ring');
		}
	},
	{
		name: 'Button exposes an accessible name for icon-only usage',
		html: buttonDanger,
		assert: (html) => {
			mustInclude(html, 'aria-label="Halt distribution"', 'aria label');
			mustInclude(html, 'bg-red-700', 'danger variant');
			mustInclude(html, 'min-h-[48px]', 'large size');
		}
	},
	{
		name: 'Button marks loading state as busy and inert',
		html: buttonLoading,
		assert: (html) => {
			mustInclude(html, 'aria-busy="true"', 'busy attribute');
			mustInclude(html, 'disabled', 'disabled while loading');
			mustInclude(html, 'animate-spin', 'spinner');
		}
	},
	{
		name: 'Badge renders a static pill by default',
		html: badgeStatic,
		assert: (html) => {
			mustInclude(html, '<span', 'static badge element');
			mustInclude(html, 'bg-emerald-50', 'success variant');
			mustNotInclude(html, '<button', 'static badge must not be a button');
		}
	},
	{
		name: 'Badge renders an accessible toggle in its interactive branch',
		html: badgeInteractive,
		assert: (html) => {
			mustInclude(html, '<button', 'interactive badge element');
			mustInclude(html, 'aria-pressed="true"', 'pressed state');
			mustInclude(html, 'aria-label="Filter by active"', 'toggle label');
			mustInclude(html, 'min-h-[44px]', 'touch size');
		}
	},
	{
		name: 'Modal exposes dialog semantics and labelled title',
		html: modalOpen,
		assert: (html) => {
			mustInclude(html, 'role="dialog"', 'dialog role');
			mustInclude(html, 'aria-modal="true"', 'modal flag');
			mustInclude(html, 'aria-labelledby="modal-title"', 'labelled by title');
			mustInclude(html, 'id="modal-title"', 'title id present');
			mustInclude(html, 'Add New Subscriber', 'title text');
			mustInclude(html, 'aria-label="Close dialog"', 'close control label');
			mustInclude(html, 'pb-safe-bottom', 'safe-area aware footer padding');
			mustInclude(html, '100dvh', 'dynamic viewport height');
			mustInclude(html, 'Form body', 'body snippet rendered');
			mustInclude(html, 'Save', 'footer snippet rendered');
		}
	},
	{
		name: 'Modal renders nothing while closed',
		html: modalClosed,
		assert: (html) => {
			mustNotInclude(html, 'role="dialog"', 'closed modal must not render a dialog');
		}
	},
	{
		name: 'ConfirmDialog inherits full dialog semantics from Modal',
		html: confirmDialogOpen,
		assert: (html) => {
			// [HIGH-04] Scroll lock, focus trap, Escape and backdrop dismissal all come
			// from Modal, so the primitive's markup must be the dialog's markup.
			mustInclude(html, 'role="dialog"', 'dialog role');
			mustInclude(html, 'aria-modal="true"', 'modal flag');
			mustInclude(html, 'aria-labelledby="modal-title"', 'labelled by title');
			mustInclude(html, 'Delete selected subscribers?', 'title text');
			mustInclude(html, 'Bulk deletion is immediate and cannot be undone.', 'description text');
			mustInclude(html, '3 subscribers will be permanently removed', 'affected records stated');
			mustInclude(html, 'aria-label="Close dialog"', 'close control label');
			mustInclude(html, '100dvh', 'dynamic viewport height');
			mustInclude(html, 'pb-safe-bottom', 'safe-area aware footer padding');
		}
	},
	{
		name: 'ConfirmDialog offers a cancel and a danger-styled confirm',
		html: confirmDialogOpen,
		assert: (html) => {
			mustInclude(html, 'Cancel', 'cancel action');
			mustInclude(html, 'Delete 3 subscribers', 'confirm label states the count');
			mustInclude(html, 'bg-red-700', 'danger confirm variant');
			mustInclude(html, 'min-h-[44px]', 'touch-sized controls');
		}
	},
	{
		name: 'ConfirmDialog renders nothing until it is requested',
		html: confirmDialogClosed,
		assert: (html) => {
			mustNotInclude(html, 'role="dialog"', 'a confirmation must not exist before it is asked for');
		}
	},
	{
		name: 'Input wires label, hint and error to the control',
		html: inputDefault,
		assert: (html) => {
			assert(/<label[^>]*for="([^"]+)"/.test(html), 'label must reference an input id');
			const inputId = html.match(/<label[^>]*for="([^"]+)"/)?.[1];
			mustInclude(html, `id="${inputId}"`, 'control carries the referenced id');
			mustInclude(html, 'aria-describedby', 'hint association');
			mustInclude(html, 'reader@example.com', 'hint text');
		}
	},
	{
		name: 'Input flags invalid state accessibly',
		html: inputInvalid,
		assert: (html) => {
			mustInclude(html, 'aria-invalid="true"', 'invalid flag');
			mustInclude(html, 'aria-required="true"', 'required flag');
			mustInclude(html, 'Enter a valid email address.', 'error message');
			mustInclude(html, 'border-rose-400', 'error styling');
		}
	},
	{
		name: 'Textarea renders editor affordances and a character counter',
		html: textareaDefault,
		assert: (html) => {
			mustInclude(html, '<textarea', 'textarea element');
			mustInclude(html, 'rows="8"', 'row count');
			mustInclude(html, 'font-mono', 'monospace editing face');
			mustInclude(html, '7 / 500', 'character counter');
		}
	},
	{
		name: 'Select renders every option and marks the selected value',
		html: selectDefault,
		assert: (html) => {
			mustInclude(html, '<select', 'select element');
			mustInclude(html, 'value="active"', 'bound value');
			mustInclude(html, 'All statuses', 'option label');
			mustInclude(html, 'disabled', 'disabled option');
			mustInclude(html, 'appearance-none', 'custom chevron styling');
		}
	},
	{
		name: 'Dropdown exposes listbox semantics while collapsed',
		html: dropdownDefault,
		assert: (html) => {
			mustInclude(html, 'aria-haspopup="listbox"', 'has popup');
			mustInclude(html, 'aria-expanded="false"', 'collapsed state');
			mustInclude(html, 'Most recent', 'selected label');
			mustNotInclude(html, 'role="listbox"', 'menu must stay closed until toggled');
		}
	},
	{
		name: 'Skeleton placeholders are hidden from assistive technology',
		html: `${skeletonText}${skeletonCircle}`,
		assert: (html) => {
			mustInclude(html, 'aria-hidden="true"', 'decorative placeholder');
			mustInclude(html, 'animate-skeleton-pulse', 'pulse animation');
			mustInclude(html, 'rounded-full', 'circle variant');
		}
	},
	{
		name: 'Pagination renders windowed pages with ellipsis and current marker',
		html: paginationMiddle,
		assert: (html) => {
			mustInclude(html, 'aria-label="Pagination"', 'navigation label');
			mustInclude(html, 'aria-current="page"', 'current page marker');
			mustInclude(html, 'aria-label="Previous page"', 'previous control');
			mustInclude(html, 'aria-label="Next page"', 'next control');
			mustInclude(html, '…', 'ellipsis gap marker');
			mustInclude(html, 'min-h-[44px]', 'touch sized controls');
			assert(!html.includes('>7</button>'), 'pages far from the window must be omitted');
		}
	},
	{
		name: 'Pagination hides itself when a single page exists',
		html: paginationSingle,
		assert: (html) => {
			mustNotInclude(html, 'aria-label="Pagination"', 'single page needs no pagination');
		}
	},
	{
		name: 'Toast renders a live region with variant styling',
		html: toastStack,
		assert: (html) => {
			mustInclude(html, 'aria-live="polite"', 'live region');
			mustInclude(html, 'data-variant="success"', 'success toast');
			mustInclude(html, 'data-variant="error"', 'error toast');
			mustInclude(html, 'aria-label="Dismiss notification"', 'dismiss control');
			mustInclude(html, 'Subscriber saved', 'toast title');
		}
	},

	/* ---------------------------- Phase 3 ---------------------------- */

	{
		name: 'MetricCard renders telemetry with trend and subtitle',
		html: metricCard,
		assert: (html) => {
			mustInclude(html, 'Active Audience', 'card title');
			mustInclude(html, 'tabular-nums', 'tabular numerals');
			mustInclude(html, '+2 this month', 'trend label');
			mustInclude(html, 'Total active subscribers', 'subtitle');
		}
	},
	{
		name: 'SubscriberTable renders both mobile cards and a dense desktop grid',
		html: subscriberTableDesktop,
		assert: (html) => {
			mustInclude(html, 'sm:hidden', 'mobile card branch');
			mustInclude(html, 'hidden sm:block', 'desktop table branch');
			mustInclude(html, 'aria-sort="descending"', 'sorted column state');
			mustInclude(html, 'aria-checked="mixed"', 'indeterminate select-all state');
			mustInclude(html, 'Select all subscribers on this page', 'select-all control');
			mustInclude(html, initialSubscribers[0].email, 'subscriber email rendered');
			mustInclude(html, 'Select all', 'header checkbox label');
			mustInclude(html, 'Never opened', 'empty telemetry fallback');
		}
	},
	{
		name: 'SubscriberTable renders a distinct empty state',
		html: subscriberTableEmpty,
		assert: (html) => {
			mustInclude(html, 'No subscribers match the current filters.', 'empty message');
			mustNotInclude(html, '<table', 'no table shell without data');
		}
	},
	{
		name: 'SubscriberTable announces the loading state',
		html: subscriberTableLoading,
		assert: (html) => {
			mustInclude(html, 'aria-live="polite"', 'polite live region');
			mustInclude(html, 'Loading subscribers', 'loading copy');
		}
	},
	{
		name: 'SubscriberFilterBar wires search, filters and bulk actions',
		html: filterBar,
		assert: (html) => {
			mustInclude(html, 'id="subscriber-search"', 'search input');
			mustInclude(html, 'All statuses', 'status filter option');
			mustInclude(html, 'All tags', 'tag filter option');
			mustInclude(html, 'architect', 'tag option from data');
			mustInclude(html, 'aria-live="polite"', 'result count announcement');
			mustInclude(html, 'Bulk actions', 'bulk action region');
			mustInclude(html, '2 selected', 'selection summary');
			mustInclude(html, 'Mark active', 'bulk status action');
			// [HIGH-02] The destructive control states what it acts on; it does not
			// delete anything on its own.
			mustInclude(html, 'Delete selected', 'bulk delete requests a confirmation');
		}
	},
	{
		name: 'SubscriberModal creates a new record',
		html: subscriberModalCreate,
		assert: (html) => {
			mustInclude(html, 'Add New Subscriber', 'create title');
			mustInclude(html, 'Add Subscriber', 'create submit label');
			mustInclude(html, 'type="email"', 'email field type');
			mustNotInclude(html, 'Engagement', 'no telemetry block when creating');
		}
	},
	{
		name: 'SubscriberModal pre-fills an existing record with telemetry',
		html: subscriberModalEdit,
		assert: (html) => {
			mustInclude(html, 'Edit Subscriber', 'edit title');
			mustInclude(html, 'Save Changes', 'edit submit label');
			mustInclude(html, 'Engagement', 'telemetry block');
			mustInclude(html, sampleSubscriber.email, 'existing email prefilled');
			mustInclude(html, 'founding', 'existing tier prefilled');
		}
	},
	{
		name: 'CsvImportModal renders the importer and its error report',
		html: csvImportModal,
		assert: (html) => {
			mustInclude(html, 'type="file"', 'file picker');
			mustInclude(html, 'accept=".csv,text/csv"', 'csv accept filter');
			mustInclude(html, 'Imported 2 of 3 rows', 'summary line');
			mustInclude(html, 'Already subscribed to this publication.', 'row-level error');
			mustInclude(html, 'aria-live="polite"', 'import result announcement');
			mustInclude(html, 'existing subscribers will be checked', 'duplicate guidance');
		}
	},
	{
		name: 'DeliveryProgressBar exposes progressbar semantics',
		html: progressBar,
		assert: (html) => {
			mustInclude(html, 'role="progressbar"', 'progressbar role');
			mustInclude(html, 'aria-valuenow="43"', 'rounded percentage');
			mustInclude(html, 'aria-valuemax="100"', 'upper bound');
			mustInclude(html, '42 / 100', 'processed counter');
		}
	},
	{
		name: 'DeliveryProgressBar distinguishes the paused state',
		html: progressBarPaused,
		assert: (html) => {
			mustInclude(html, 'aria-valuetext="Paused"', 'paused announcement');
			mustInclude(html, 'data-state="paused"', 'paused styling hook');
			mustInclude(html, 'bg-amber-600', 'paused colour');
		}
	},
	{
		name: 'Dispatch modal confirms before sending and blocks empty audiences',
		html: dispatchModalIdle,
		assert: (html) => {
			mustInclude(html, 'Confirm &amp; Send', 'confirm action');
			mustInclude(html, 'All subscribers', 'audience label');
			mustInclude(html, '10 recipients', 'recipient count');
			mustInclude(html, '4 excluded', 'excluded count');
		}
	},
	{
		name: 'Dispatch modal blocks an audience with no eligible recipients',
		html: dispatchModalEmpty,
		assert: (html) => {
			mustInclude(html, 'No eligible recipients', 'empty audience warning');
			mustInclude(html, 'role="alert"', 'alert semantics');
			mustInclude(html, 'disabled', 'send button disabled');
		}
	},
	{
		name: 'Dispatch modal exposes pause and halt while running',
		html: dispatchModalRunning,
		assert: (html) => {
			mustInclude(html, 'Halt Distribution', 'halt action');
			mustInclude(html, 'Pause', 'pause action');
			mustNotInclude(html, 'Confirm &amp; Send', 'send action hidden during a run');
		}
	},
	{
		name: 'Dispatch modal reconciles statistics after a halted run',
		html: dispatchModalFinished,
		assert: (html) => {
			mustInclude(html, 'Distribution halted', 'halted status');
			mustInclude(html, 'Delivered', 'delivered row');
			mustInclude(html, 'Simulated opens', 'open row');
			mustInclude(html, 'Done', 'completion action');
			mustInclude(html, 'remaining jobs stay queued', 'honest partial-run copy');
		}
	},
	{
		name: 'IssueEditor exposes every metadata field and dirty state',
		html: issueEditor,
		assert: (html) => {
			mustInclude(html, 'data-state="dirty"', 'dirty indicator');
			mustInclude(html, 'id="issue-markdown"', 'markdown editor');
			mustInclude(html, 'Audience', 'audience selector');
			mustInclude(html, 'All subscribers', 'audience option');
			mustInclude(html, 'Schedule for', 'scheduler field');
			mustInclude(html, 'Save Changes', 'save action');
			mustInclude(html, 'min read', 'reading time estimate');
		}
	},
	{
		name: 'IssuePreviewPane renders sanitised HTML with delivery stats',
		html: previewPane,
		assert: (html) => {
			mustInclude(html, 'aria-label="Issue preview"', 'labelled region');
			mustInclude(html, '<h1 class="text-3xl', 'rendered markdown heading');
			mustInclude(html, 'Open rate', 'delivery stats');
			mustNotInclude(html, '<script', 'no script markup');
		}
	},
	{
		name: 'Public navigation marks the active section',
		html: publicNavigation,
		assert: (html) => {
			mustInclude(html, 'The Margins &amp; Letters', 'publication name');
			mustInclude(html, 'aria-current="page"', 'active link');
			mustInclude(html, 'aria-label="Publication"', 'navigation label');
			mustInclude(html, 'href="/admin"', 'publisher link');
		}
	},
	{
		name: 'Byline renders dateline, issue number and initials fallback',
		html: byline,
		assert: (html) => {
			mustInclude(html, 'Julian Sterling', 'author name');
			mustInclude(html, 'JS', 'initials fallback');
			mustInclude(html, 'No. 12', 'issue serial');
			mustInclude(html, '6 min read', 'reading time');
			mustInclude(html, '<time', 'machine readable dateline');
		}
	},
	{
		name: 'ArticleHeader composes tags, headline and byline',
		html: articleHeader,
		assert: (html) => {
			mustInclude(html, sampleIssue.title, 'headline');
			mustInclude(html, 'architecture', 'tag pill');
			mustInclude(html, 'Julian Sterling', 'byline');
		}
	},
	{
		name: 'ArticleRenderer renders markdown into the editorial body',
		html: articleRenderer,
		assert: (html) => {
			mustInclude(html, 'editorial-body', 'editorial typography hook');
			mustInclude(html, '<h1', 'rendered heading');
			mustInclude(html, '<blockquote', 'rendered quote');
			mustInclude(html, '<li', 'rendered list');
		}
	},
	{
		name: 'ArticleRenderer neutralises hostile markdown',
		html: articleRendererHostile,
		assert: (html) => {
			mustNotInclude(html, '<script', 'script tags stripped');
			mustNotInclude(html, 'javascript:', 'javascript scheme stripped');
			mustInclude(html, '#blocked-uri', 'blocked href sentinel');
		}
	},
	{
		name: 'ArchiveIssueCard links to the public article route',
		html: archiveCard,
		assert: (html) => {
			mustInclude(html, `href="/p/${sampleIssue.slug}"`, 'article link');
			mustInclude(html, 'Read dispatch', 'read call to action');
			mustInclude(html, 'No. 12', 'serial number');
		}
	},
	{
		name: 'SubscribeCard renders an accessible subscription form',
		html: subscribeCard,
		assert: (html) => {
			mustInclude(html, 'subscribe-heading', 'labelled section');
			mustInclude(html, 'id="subscribe-email"', 'email field');
			mustInclude(html, 'type="submit"', 'submit control');
			mustInclude(html, 'editor@themargins.example', 'support contact');
		}
	}
];

/** Runs every component assertion and returns the gallery markup for Chrome. */
export function runComponentSuite(): SuiteResult {
	const failures: string[] = [];
	let passed = 0;

	for (const testCase of cases) {
		try {
			testCase.assert(testCase.html);
			passed++;
		} catch (error) {
			failures.push(`${testCase.name}: ${error instanceof Error ? error.message : String(error)}`);
		}
	}

	return {
		passed,
		failed: failures.length,
		total: cases.length,
		failures,
		gallery: [
			{ title: 'Buttons', html: buttonPrimary + buttonDanger + buttonLoading },
			{ title: 'Badges', html: badgeStatic + badgeInteractive },
			{
				title: 'Form controls',
				html: inputDefault + inputInvalid + textareaDefault + selectDefault + dropdownDefault
			},
			{ title: 'Feedback', html: skeletonText + skeletonCircle + toastStack },
			{ title: 'Pagination', html: paginationMiddle },
			{ title: 'Modal', html: modalOpen },
			// [HIGH-02 / HIGH-03 / HIGH-04] Every destructive confirmation renders
			// here, so the Chrome pass measures its touch targets and its fit inside
			// the narrowest supported viewport.
			{ title: 'Confirmation dialog', html: confirmDialogOpen },
			{ title: 'Metrics', html: metricCard },
			{ title: 'Subscriber table', html: subscriberTableDesktop },
			{
				title: 'Subscriber table (empty)',
				html: subscriberTableEmpty + subscriberTableLoading
			},
			{ title: 'Filter bar', html: filterBar },
			{ title: 'Subscriber modal', html: subscriberModalEdit },
			{ title: 'CSV import modal', html: csvImportModal },
			{ title: 'Delivery progress', html: progressBar + progressBarPaused },
			{ title: 'Dispatch modal', html: dispatchModalIdle },
			{ title: 'Issue editor', html: issueEditor },
			{ title: 'Issue preview', html: previewPane },
			{ title: 'Editorial navigation', html: publicNavigation },
			{ title: 'Article header', html: articleHeader },
			{ title: 'Article body', html: articleRenderer },
			{ title: 'Archive card', html: archiveCard },
			{ title: 'Subscribe card', html: subscribeCard }
		]
	};
}