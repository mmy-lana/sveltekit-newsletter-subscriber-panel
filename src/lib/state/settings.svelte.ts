import type { PublicationSettings } from '#lib/types/newsletter';
import { getSeedSettings, loadSettings, saveSettings } from '#lib/storage/local-storage-client';

/**
 * Reactive publication settings.
 *
 * Seeded from the bundled fixtures so the server render and the first client
 * render match; `hydrate()` then applies anything persisted in LocalStorage.
 */
export class SettingsStore {
	settings = $state<PublicationSettings>(getSeedSettings());
	isHydrated = $state(false);

	hydrate(): void {
		if (typeof window === 'undefined' || this.isHydrated) return;
		this.settings = loadSettings();
		this.isHydrated = true;
	}

	update(patch: Partial<PublicationSettings>): void {
		this.settings = { ...this.settings, ...patch };
		saveSettings(this.settings);
	}

	reset(): void {
		this.settings = getSeedSettings();
		saveSettings(this.settings);
	}
}

let settingsStoreInstance: SettingsStore | null = null;

export function getSettingsState(): SettingsStore {
	if (typeof window === 'undefined') {
		return new SettingsStore();
	}

	if (!settingsStoreInstance) {
		settingsStoreInstance = new SettingsStore();
	}

	return settingsStoreInstance;
}

/**
 * Backwards-compatible shim for existing page imports.
 *
 * NOTE: Svelte 5 fine-grained reactivity ($state/$derived) cannot be statically tracked
 * by the compiler through a dynamic Proxy object. Components must instantiate state via
 * `getSettingsState()` inside component script scopes rather than reading this export directly.
 *
 * @deprecated Use `getSettingsState()` directly in .svelte components.
 */
export const settingsState = new Proxy({} as SettingsStore, {
	get(_target, prop: keyof SettingsStore) {
		const instance = getSettingsState();
		const value = instance[prop];
		return typeof value === 'function' ? value.bind(instance) : value;
	},
	set(_target, prop: keyof SettingsStore, value) {
		const instance = getSettingsState();
		(instance as unknown as Record<string, unknown>)[prop as string] = value;
		return true;
	}
});