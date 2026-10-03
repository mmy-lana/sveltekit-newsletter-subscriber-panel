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
import Dropdown from '#lib/components/ui/Dropdown.svelte';
import Input from '#lib/components/ui/Input.svelte';
import Modal from '#lib/components/ui/Modal.svelte';
import Pagination from '#lib/components/ui/Pagination.svelte';
import Select from '#lib/components/ui/Select.svelte';
import Skeleton from '#lib/components/ui/Skeleton.svelte';
import Textarea from '#lib/components/ui/Textarea.svelte';
import Toast from '#lib/components/ui/Toast.svelte';

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
			{ title: 'Modal', html: modalOpen }
		]
	};
}