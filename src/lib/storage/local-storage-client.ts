import type { Subscriber, NewsletterIssue, PublicationSettings } from '$lib/types/newsletter';
import { initialSubscribers, initialIssues, initialSettings } from './seed-data';

const STORAGE_KEYS = {
  SUBSCRIBERS: 'snsp_subscribers_v1',
  ISSUES: 'snsp_issues_v1',
  SETTINGS: 'snsp_settings_v1'
} as const;

function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof localStorage !== 'undefined';
}

export function loadSubscribers(): Subscriber[] {
  if (!isBrowser()) return initialSubscribers;
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.SUBSCRIBERS);
    if (!raw) {
      saveSubscribers(initialSubscribers);
      return initialSubscribers;
    }
    return JSON.parse(raw) as Subscriber[];
  } catch {
    return initialSubscribers;
  }
}

export function saveSubscribers(subscribers: Subscriber[]): void {
  if (!isBrowser()) return;
  try {
    localStorage.setItem(STORAGE_KEYS.SUBSCRIBERS, JSON.stringify(subscribers));
  } catch (error) {
    console.error('Failed to persist subscribers to localStorage', error);
  }
}

export function loadIssues(): NewsletterIssue[] {
  if (!isBrowser()) return initialIssues;
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.ISSUES);
    if (!raw) {
      saveIssues(initialIssues);
      return initialIssues;
    }
    return JSON.parse(raw) as NewsletterIssue[];
  } catch {
    return initialIssues;
  }
}

export function saveIssues(issues: NewsletterIssue[]): void {
  if (!isBrowser()) return;
  try {
    localStorage.setItem(STORAGE_KEYS.ISSUES, JSON.stringify(issues));
  } catch (error) {
    console.error('Failed to persist issues to localStorage', error);
  }
}

export function loadSettings(): PublicationSettings {
  if (!isBrowser()) return initialSettings;
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.SETTINGS);
    if (!raw) {
      saveSettings(initialSettings);
      return initialSettings;
    }
    return JSON.parse(raw) as PublicationSettings;
  } catch {
    return initialSettings;
  }
}

export function saveSettings(settings: PublicationSettings): void {
  if (!isBrowser()) return;
  try {
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
  } catch (error) {
    console.error('Failed to persist settings to localStorage', error);
  }
}
