/**
 * Presentation-layer contracts shared by the UI primitives.
 *
 * Keeping these in one typed module (instead of exporting types out of
 * individual components) prevents circular imports between a component and its
 * consumers, and keeps every consumer on one identical union type.
 */

export interface SelectOption {
	value: string;
	label: string;
	disabled?: boolean;
}

export interface DropdownItem {
	value: string;
	label: string;
	disabled?: boolean;
	/** Renders the item in a destructive tone. */
	danger?: boolean;
}

export type ToastVariant = 'success' | 'error' | 'warning' | 'info';

export interface ToastMessage {
	id: string;
	variant: ToastVariant;
	title: string;
	/** Optional supporting line rendered under the title. */
	message?: string;
	/** Epoch milliseconds; rendered as an optional relative timestamp. */
	createdAt: number;
}

export type BadgeVariant = 'neutral' | 'success' | 'warning' | 'error' | 'outline';
export type BadgeSize = 'sm' | 'md' | 'touch';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

/** Breakpoints from the responsive specification. */
export const BREAKPOINTS = {
	mobile: 639,
	tablet: 1023,
	desktop: 1024
} as const;

export type BreakpointName = keyof typeof BREAKPOINTS;