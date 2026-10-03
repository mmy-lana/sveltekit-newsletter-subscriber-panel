import {
	clickButton,
	fillInput,
	goto,
	isVisible,
	pageContains,
	screenshot,
	waitForHydration
} from '../helpers.mjs';

/**
 * Phase 2 security and hydration boundaries.
 *
 * These scenarios assert behaviour that cannot be observed through the pure
 * suites: the editor never flashes a false "not found" state while the store
 * hydrates, and author-supplied image URLs are dropped rather than rendered.
 */

/** Seeds a LocalStorage document that contains exactly the supplied issues. */
async function seedIssues(page, origin, issues) {
	await goto(page, '/admin', origin);
	await page.evaluate((payload) => {
		localStorage.setItem('snsp_issues_v1', JSON.stringify(payload));
	}, issues);
}

const baseIssue = {
	id: 'e2e-deep-link',
	slug: 'e2e-deep-link',
	title: 'E2E Deep Link Issue',
	subtitle: 'Seeded into LocalStorage before navigation.',
	excerpt: 'Seeded excerpt.',
	contentMarkdown: '# E2E Deep Link Issue\n\nBody.',
	contentHtml: '<h1>E2E Deep Link Issue</h1><p>Body.</p>',
	coverImageUrl: null,
	authorName: 'Julian Sterling',
	authorAvatarUrl: null,
	status: 'draft',
	audience: 'all',
	tags: [],
	scheduledAt: null,
	publishedAt: null,
	createdAt: '2026-10-05T09:00:00Z',
	updatedAt: '2026-10-05T09:00:00Z',
	stats: {
		totalRecipients: 0,
		deliveredCount: 0,
		openedCount: 0,
		clickedCount: 0,
		bouncedCount: 0,
		unsubscribedCount: 0,
		deliveryCompletedAt: null
	}
};

export default [
	{
		name: 'phase2/editor-hydration-gate',
		async run({ page, origin, reporter }) {
			await page.setViewport({ width: 1280, height: 900 });
			await seedIssues(page, origin, [baseIssue]);

			// Record the visible state sequence from the very first byte, so the
			// transient hydration states are captured rather than sampled away.
			await page.evaluateOnNewDocument(() => {
				window.__snspStates = [];

				const classify = () => {
					const text = document.body?.innerText ?? '';
					if (text.includes('Loading issue')) return 'loading';
					if (text.includes('Issue not found')) return 'not-found';
					if (text.includes('E2E Deep Link Issue')) return 'editor';
					return 'other';
				};

				const observer = new MutationObserver(() => {
					const state = classify();
					if (state === 'other') return;
					const states = window.__snspStates;
					if (states[states.length - 1] !== state) states.push(state);
				});

				observer.observe(document, {
					childList: true,
					subtree: true,
					characterData: true
				});
			});

			await page.goto(`${origin}/admin/issues/e2e-deep-link`, { waitUntil: 'networkidle0' });
			await waitForHydration(page);

			reporter.expect(
				await pageContains(page, 'E2E Deep Link Issue'),
				'the deep-linked issue renders in the editor'
			);

			const states = await page.evaluate(() => window.__snspStates ?? []);
			reporter.expect(
				states.includes('loading'),
				`a loading state is shown while the store hydrates (observed: ${JSON.stringify(states)})`
			);
			reporter.expectEqual(
				states[states.length - 1],
				'editor',
				'the editor is the final state'
			);

			const loadingIndex = states.indexOf('loading');
			const notFoundAfterLoading = states
				.slice(loadingIndex + 1)
				.includes('not-found');
			reporter.expect(
				!notFoundAfterLoading,
				`the false "not found" state never appears after hydration starts (observed: ${JSON.stringify(states)})`
			);

			// An id that genuinely does not exist must still report the empty state.
			await goto(page, '/admin/issues/does-not-exist', origin);
			await waitForHydration(page);
			reporter.expect(
				await pageContains(page, 'Issue not found'),
				'a genuinely missing issue still reports the empty state'
			);

			await page.evaluate(() => localStorage.removeItem('snsp_issues_v1'));
		}
	},

	{
		name: 'phase2/image-url-protocol-boundary',
		async run({ page, origin, reporter }) {
			await page.setViewport({ width: 1280, height: 900 });

			const hostile = {
				...baseIssue,
				id: 'e2e-hostile-image',
				slug: 'e2e-hostile-image',
				title: 'Hostile Image Issue',
				// Scriptable URI plus a protocol-relative tracker.
				coverImageUrl: 'javascript:alert(1)',
				authorAvatarUrl: '//evil.example.com/track.png'
			};

			await seedIssues(page, origin, [
				hostile,
				{
					...baseIssue,
					id: 'issue-safe-image',
					slug: 'issue-safe-image',
					title: 'Safe Image Issue',
					// Same-origin path: allowed by the allow-list and served locally.
					coverImageUrl: '/cover-placeholder.png'
				}
			]);

			await goto(page, '/admin/issues/e2e-hostile-image', origin);
			await waitForHydration(page);

			const renderedSources = await page.evaluate(() =>
				Array.from(document.querySelectorAll('img')).map((image) => image.getAttribute('src'))
			);

			reporter.expect(
				!renderedSources.some((src) => (src ?? '').includes('javascript:')),
				`no scriptable URI reaches an image attribute (rendered: ${JSON.stringify(renderedSources)})`
			);
			reporter.expect(
				!renderedSources.some((src) => (src ?? '').includes('evil.example.com')),
				`no protocol-relative tracker reaches an image attribute (rendered: ${JSON.stringify(renderedSources)})`
			);

			// A legitimate remote URL is still honoured.
			await goto(page, '/admin/issues/issue-safe-image', origin);
			await waitForHydration(page);
			const safeSources = await page.evaluate(() =>
				Array.from(document.querySelectorAll('img')).map((image) => image.getAttribute('src'))
			);
			reporter.expect(
				safeSources.includes('/cover-placeholder.png'),
				`a same-origin cover path is rendered (rendered: ${JSON.stringify(safeSources)})`
			);

			// The editor rejects an invalid URL inline and blocks the save.
			await fillInput(page, '#issue-cover', 'javascript:alert(1)');
			await page.waitForFunction(
				() => document.body.innerText.includes('Enter an https:// image URL'),
				{ timeout: 5000 }
			);
			reporter.expect(true, 'the editor reports an invalid cover URL inline');

			const saveDisabled = await page.evaluate(() => {
				const button = Array.from(document.querySelectorAll('button')).find((element) =>
					element.textContent?.includes('Save Changes')
				);
				return button instanceof HTMLButtonElement && button.disabled;
			});
			reporter.expect(saveDisabled, 'saving is blocked while the cover URL is invalid');
			reporter.expect(
				await isVisible(page, '#issue-cover'),
				'the offending field stays visible for correction'
			);

			await page.evaluate(() => localStorage.removeItem('snsp_issues_v1'));
		}
	},

	{
		name: 'phase2/scroll-lock-coordination',
		async run({ page, origin, reporter }) {
			await page.setViewport({ width: 390, height: 844 });

			// The drawer holds a scroll lock; layering a dialog on top and closing
			// it must not release the lock the drawer still needs.
			await goto(page, '/admin/subscribers', origin);
			await waitForHydration(page);

			await clickButton(page, 'Open navigation');
			await page.waitForFunction(
				() => document.body.style.overflow === 'hidden',
				{ timeout: 5000 }
			);
			reporter.expect(true, 'the drawer freezes background scrolling');

			await clickButton(page, 'Add Subscriber');
			await page.waitForSelector('[role="dialog"]', { timeout: 5000 });
			reporter.expect(
				(await page.evaluate(() => document.body.style.overflow)) === 'hidden',
				'the dialog layers on top of the existing lock'
			);

			await clickButton(page, 'Cancel');
			await page.waitForFunction(() => !document.querySelector('[role="dialog"]'), {
				timeout: 5000
			});
			reporter.expect(
				(await page.evaluate(() => document.body.style.overflow)) === 'hidden',
				'closing the dialog leaves the drawer lock intact'
			);

			await clickButton(page, 'Close navigation');
			await page.waitForFunction(() => document.body.style.overflow !== 'hidden', {
				timeout: 5000
			});
			reporter.expect(
				(await page.evaluate(() => document.body.style.overflow)) !== 'hidden',
				'the body is released only once the last holder closes'
			);

			await screenshot(page, 'phase2-scroll-lock');
		}
	}
];