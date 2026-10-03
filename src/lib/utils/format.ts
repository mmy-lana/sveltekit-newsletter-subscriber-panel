/**
 * Locale-aware presentation helpers.
 *
 * Every function is SSR-safe: formatting is deterministic across server and
 * client because an explicit locale and time zone are always supplied.
 */

/** Fixed locale + time zone so SSR and CSR output byte-for-byte match. */
export const FORMAT_LOCALE = 'en-US';
export const FORMAT_TIME_ZONE = 'UTC';

const numberFormatter = new Intl.NumberFormat(FORMAT_LOCALE);
const compactNumberFormatter = new Intl.NumberFormat(FORMAT_LOCALE, {
	notation: 'compact',
	maximumFractionDigits: 1
});
const currencyFormatter = new Intl.NumberFormat(FORMAT_LOCALE, {
	style: 'currency',
	currency: 'USD',
	maximumFractionDigits: 0
});
const percentFormatter = new Intl.NumberFormat(FORMAT_LOCALE, {
	style: 'percent',
	minimumFractionDigits: 1,
	maximumFractionDigits: 1
});
const dateFormatter = new Intl.DateTimeFormat(FORMAT_LOCALE, {
	year: 'numeric',
	month: 'short',
	day: 'numeric',
	timeZone: FORMAT_TIME_ZONE
});
const dateTimeFormatter = new Intl.DateTimeFormat(FORMAT_LOCALE, {
	year: 'numeric',
	month: 'short',
	day: 'numeric',
	hour: '2-digit',
	minute: '2-digit',
	hour12: false,
	timeZone: FORMAT_TIME_ZONE
});

/** 12345 → "12,345" */
export function formatNumber(value: number): string {
	return numberFormatter.format(value);
}

/** 12345 → "12.3K" */
export function formatCompactNumber(value: number): string {
	return compactNumberFormatter.format(value);
}

/** 248 → "$248" */
export function formatCurrency(value: number): string {
	return currencyFormatter.format(value);
}

/** 42.86 → "42.9%" (input is a percentage number, not a 0-1 ratio). */
export function formatPercent(value: number): string {
	return percentFormatter.format(value / 100);
}

/** Fixed-decimal percentage, e.g. 42.857 → "42.9%". */
export function formatPercentFixed(value: number, decimals = 1): string {
	return `${value.toFixed(decimals)}%`;
}

/** "Sep 20, 2026" — returns an em dash for missing timestamps. */
export function formatDate(iso: string | null): string {
	if (!iso) return '—';
	const date = new Date(iso);
	if (Number.isNaN(date.getTime())) return '—';
	return dateFormatter.format(date);
}

/** "Sep 20, 2026, 10:00" — returns an em dash for missing timestamps. */
export function formatDateTime(iso: string | null): string {
	if (!iso) return '—';
	const date = new Date(iso);
	if (Number.isNaN(date.getTime())) return '—';
	return dateTimeFormatter.format(date);
}

/** ISO input for `<input type="datetime-local">`, always in UTC. */
export function toDateTimeLocalValue(iso: string | null): string {
	if (!iso) return '';
	const date = new Date(iso);
	if (Number.isNaN(date.getTime())) return '';
	return date.toISOString().slice(0, 16);
}

/** Inverse of {@link toDateTimeLocalValue}: interprets the value as UTC. */
export function fromDateTimeLocalValue(value: string): string | null {
	if (!value) return null;
	const parsed = new Date(`${value}:00.000Z`);
	if (Number.isNaN(parsed.getTime())) return null;
	return parsed.toISOString();
}

/** "3 days ago" / "in 2 hours", or an absolute date beyond a year. */
export function formatRelativeTime(iso: string | null, now: Date = new Date()): string {
	if (!iso) return '—';
	const date = new Date(iso);
	if (Number.isNaN(date.getTime())) return '—';

	const deltaSeconds = Math.round((date.getTime() - now.getTime()) / 1000);
	const absolute = Math.abs(deltaSeconds);

	if (absolute < 45) return 'just now';

	const units: Array<{ label: string; seconds: number }> = [
		{ label: 'year', seconds: 31_536_000 },
		{ label: 'month', seconds: 2_592_000 },
		{ label: 'day', seconds: 86_400 },
		{ label: 'hour', seconds: 3_600 },
		{ label: 'minute', seconds: 60 }
	];

	for (const unit of units) {
		const value = Math.round(absolute / unit.seconds);
		if (value >= 1) {
			const plural = value === 1 ? '' : 's';
			return deltaSeconds < 0 ? `${value} ${unit.label}${plural} ago` : `in ${value} ${unit.label}${plural}`;
		}
	}

	return 'just now';
}

/** Human label for an audience filter token. */
export function formatAudienceLabel(audience: string): string {
	switch (audience) {
		case 'free_only':
			return 'Free tier';
		case 'paid_only':
			return 'Paid tier';
		case 'founding_only':
			return 'Founding members';
		default:
			return 'All subscribers';
	}
}

/** Truncates a string, appending an ellipsis when it had to cut. */
export function truncate(value: string, maxLength: number): string {
	if (value.length <= maxLength) return value;
	return `${value.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}

/** Initials for an avatar fallback ("Sarah Connor" → "SC"). */
export function toInitials(firstName: string, lastName: string): string {
	const first = firstName.trim().charAt(0);
	const last = lastName.trim().charAt(0);
	const initials = `${first}${last}`.toUpperCase();
	return initials.length > 0 ? initials : '—';
}