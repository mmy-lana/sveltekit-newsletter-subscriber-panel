import type { ToastMessage, ToastVariant } from '#lib/types/ui';
import { generateUuid } from '#lib/utils/uuid';

/** Default time a toast stays on screen before it auto-dismisses. */
export const TOAST_DURATION_MS = 5000;

/** Keeps the stack readable by capping how many messages can be visible at once. */
const MAX_VISIBLE_TOASTS = 4;

/**
 * Transient notification queue.
 *
 * Auto-dismissal is scheduled here (not in the view) so a toast survives route
 * changes and page composition stays trivial for consumers.
 */
export class ToastStore {
	toasts = $state<ToastMessage[]>([]);

	private timers = new Map<string, ReturnType<typeof setTimeout>>();

	/**
	 * Number of auto-dismiss timers currently armed.
	 *
	 * [MED-02] It must never exceed `visibleToasts.length`: a timer without a toast
	 * is a pending timeout that would fire later and mutate an unrelated queue.
	 * Exposed so the cleanup invariant can be asserted rather than assumed.
	 */
	get pendingTimerCount(): number {
		return this.timers.size;
	}

	visibleToasts = $derived(this.toasts.slice(0, MAX_VISIBLE_TOASTS));

	push(variant: ToastVariant, title: string, message?: string, duration = TOAST_DURATION_MS): ToastMessage {
		const toast: ToastMessage = {
			id: generateUuid(),
			variant,
			title,
			message,
			createdAt: Date.now()
		};

		const nextQueue = [toast, ...this.toasts].slice(0, MAX_VISIBLE_TOASTS);

		// [MED-02] Slicing silently evicted the oldest messages while their
		// auto-dismiss timers stayed armed: every evicted toast held a handle in
		// `this.timers` until it fired, so the map grew past the visible cap and
		// leaked a pending timeout per dropped message.
		const retainedIds = new Set(nextQueue.map((entry) => entry.id));
		for (const id of this.timers.keys()) {
			if (retainedIds.has(id)) continue;
			const timer = this.timers.get(id);
			if (timer !== undefined) clearTimeout(timer);
			this.timers.delete(id);
		}

		this.toasts = nextQueue;

		if (typeof window !== 'undefined' && duration > 0) {
			this.timers.set(
				toast.id,
				window.setTimeout(() => this.dismiss(toast.id), duration)
			);
		}

		return toast;
	}

	success(title: string, message?: string): ToastMessage {
		return this.push('success', title, message);
	}

	error(title: string, message?: string): ToastMessage {
		return this.push('error', title, message, 8000);
	}

	warning(title: string, message?: string): ToastMessage {
		return this.push('warning', title, message);
	}

	info(title: string, message?: string): ToastMessage {
		return this.push('info', title, message);
	}

	dismiss(id: string): void {
		const timer = this.timers.get(id);
		if (timer !== undefined) {
			clearTimeout(timer);
			this.timers.delete(id);
		}
		this.toasts = this.toasts.filter((toast) => toast.id !== id);
	}

	clear(): void {
		for (const timer of this.timers.values()) clearTimeout(timer);
		this.timers.clear();
		this.toasts = [];
	}
}

let toastStoreInstance: ToastStore | null = null;

export function getToastState(): ToastStore {
	if (typeof window === 'undefined') {
		return new ToastStore();
	}

	if (!toastStoreInstance) {
		toastStoreInstance = new ToastStore();
	}

	return toastStoreInstance;
}

/**
 * Backwards-compatible shim for existing page imports.
 *
 * NOTE: Svelte 5 fine-grained reactivity ($state/$derived) cannot be statically tracked
 * by the compiler through a dynamic Proxy object. Components must instantiate state via
 * `getToastState()` inside component script scopes rather than reading this export directly.
 *
 * @deprecated Use `getToastState()` directly in .svelte components.
 */
export const toastState = new Proxy({} as ToastStore, {
	get(_target, prop: keyof ToastStore) {
		const instance = getToastState();
		const value = instance[prop];
		return typeof value === 'function' ? value.bind(instance) : value;
	},
	set(_target, prop: keyof ToastStore, value) {
		const instance = getToastState();
		(instance as unknown as Record<string, unknown>)[prop as string] = value;
		return true;
	}
});