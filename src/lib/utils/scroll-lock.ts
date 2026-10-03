/**
 * Coordinated body scroll lock.
 *
 * Overlays in this application can legitimately overlap: the mobile drawer may
 * still be open behind a modal, and a confirmation dialog can stack on top of
 * another. Mutating `document.body.style.overflow` directly means the first
 * overlay to close restores `overflow` while another is still on screen,
 * letting the page scroll behind a live overlay.
 *
 * This module reference-counts the locks: the body is only released when the
 * last holder unlocks, and the value present before the first lock is restored
 * verbatim (the body may legitimately have had `overflow` set by the host page).
 */

let lockCount = 0;
let originalOverflow = '';

/** Freezes background scrolling for one holder. */
export function lockBodyScroll(): void {
	if (typeof document === 'undefined') return;

	if (lockCount === 0) {
		originalOverflow = document.body.style.overflow;
		document.body.style.overflow = 'hidden';
	}

	lockCount++;
}

/** Releases one lock; the body is restored only when no holders remain. */
export function unlockBodyScroll(): void {
	if (typeof document === 'undefined') return;

	lockCount = Math.max(0, lockCount - 1);

	if (lockCount === 0) {
		document.body.style.overflow = originalOverflow;
	}
}

/** Number of holders currently freezing the body — exposed for assertions. */
export function getBodyScrollLockCount(): number {
	return lockCount;
}

/**
 * Drops every outstanding lock and restores the pre-lock overflow value.
 * Used when a route change tears down an overlay tree mid-transition.
 */
export function resetBodyScrollLock(): void {
	if (typeof document === 'undefined') return;

	lockCount = 0;
	document.body.style.overflow = originalOverflow;
}