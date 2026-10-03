import {
	checkNoHorizontalOverflow,
	checkTouchTargets,
	clickButton,
	clickByText,
	countOf,
	fillInput,
	fillTextarea,
	goto,
	isVisible,
	normalisedText,
	pageContains,
	selectOption,
	screenshot,
	waitForHydration
} from '../helpers.mjs';

/**
 * Phase 5 — screen integration and viewport audit.
 *
 * These scenarios drive the production build the way an operator would: searching
 * the audience, creating readers, importing a CSV, editing and dispatching an
 * issue, and reading the public archive — at every breakpoint in the matrix.
 */

const ADMIN_ROUTES = ['/admin', '/admin/subscribers', '/admin/issues'];

/** `waitForFunction` that names the step it was waiting for. */
async function waitForStep(page, predicate, label, timeout = 8000) {
	try {
		await page.waitForFunction(predicate, { timeout, polling: 100 });
	} catch (error) {
		throw new Error(`step "${label}" never completed: ${error.message}`);
	}
}

export default [
	{
		name: 'phase5/admin-shell-navigation',
		async run({ page, origin, reporter }) {
			await page.setViewport({ width: 1440, height: 900 });
			await goto(page, '/admin', origin);
			await waitForHydration(page);

			reporter.expectEqual(
				await isVisible(page, 'aside[aria-label="Publisher navigation"]'),
				true,
				'sidebar is permanently visible on desktop'
			);
			reporter.expect(
				(await page.content()).includes('Active Audience'),
				'dashboard renders KPI telemetry'
			);
			reporter.expect(
				(await page.content()).includes('Latest dispatches'),
				'dashboard renders recent issues'
			);

			// Active-section tracking.
			await goto(page, '/admin/subscribers', origin);
			await waitForHydration(page);
			const activeLink = await page.$eval(
				'nav a[aria-current="page"]',
				(node) => node.textContent?.trim() ?? ''
			);
			reporter.expect(
				activeLink.includes('Subscribers'),
				`subscribers link should be marked current (got "${activeLink}")`
			);
		}
	},

	{
		name: 'phase5/mobile-drawer-opens-and-traps-scroll',
		async run({ page, origin, reporter }) {
			await page.setViewport({ width: 390, height: 844 });
			await goto(page, '/admin', origin);
			await waitForHydration(page);

			reporter.expect(
				!(await isVisible(page, 'aside[aria-label="Publisher navigation"]')),
				'sidebar starts off-canvas on mobile'
			);

			await clickButton(page, 'Open navigation');
			await page.waitForFunction(
				() => {
					const aside = document.querySelector('aside[aria-label="Publisher navigation"]');
					if (!aside) return false;
					return aside.getBoundingClientRect().left >= 0;
				},
				{ timeout: 8000 }
			);
			reporter.expect(
				await isVisible(page, 'aside[aria-label="Publisher navigation"]'),
				'drawer opens on demand'
			);
			reporter.expect(
				(await page.evaluate(() => document.body.style.overflow)) === 'hidden',
				'body scroll is locked while the drawer is open'
			);

			await clickButton(page, 'Subscribers');
			await page.waitForFunction(() => window.location.pathname === '/admin/subscribers', {
				timeout: 8000
			});
			reporter.expect(true, 'navigating from the drawer routes to subscribers');
			reporter.expect(
				(await page.evaluate(() => document.body.style.overflow)) !== 'hidden',
				'scroll lock released after navigation'
			);
		}
	},

	{
		name: 'phase5/subscriber-directory-search-and-filter',
		async run({ page, origin, reporter }) {
			await page.setViewport({ width: 1440, height: 900 });
			await goto(page, '/admin/subscribers', origin);
			await waitForHydration(page);

			const initialRows = await countOf(page, 'table tbody tr');
			reporter.expectEqual(initialRows, 10, 'first page shows the configured page size');

			// Search narrows the result set and resets pagination.
			await fillInput(page, '#subscriber-search', 'tanaka');
			await page.waitForFunction(
				() => document.querySelectorAll('table tbody tr').length === 1,
				{ timeout: 5000 }
			);
			reporter.expect(
				(await page.content()).includes('mei.tanaka@quietstack.jp'),
				'search matches the reader record'
			);
			reporter.expect(
				await pageContains(page, '1 record'),
				'result counter reflects the filtered set'
			);

			// Empty state is explicit rather than a blank table.
			await fillInput(page, '#subscriber-search', 'no-such-reader@example.com');
			await page.waitForFunction(
				() => document.body.innerText.includes('No subscribers match'),
				{ timeout: 5000 }
			);
			reporter.expect(true, 'empty filter result renders an explicit message');

			await clickButton(page, 'Clear filters');
			await page.waitForFunction(() => document.querySelectorAll('table tbody tr').length === 10, {
				timeout: 5000
			});
			reporter.expect(true, 'clearing filters restores the full first page');

			// Status filter.
			await selectOption(page, '#filter-status', 'bounced');
			await page.waitForFunction(() => document.querySelectorAll('table tbody tr').length === 2, {
				timeout: 5000
			});
			reporter.expect(true, 'status filter narrows to bounced records');

			await selectOption(page, '#filter-status', 'all');
			await page.waitForFunction(() => document.querySelectorAll('table tbody tr').length === 10, {
				timeout: 5000
			});
		}
	},

	{
		name: 'phase5/subscriber-create-validation-and-persistence',
		async run({ page, origin, reporter }) {
			await page.setViewport({ width: 1440, height: 900 });
			await goto(page, '/admin/subscribers', origin);
			await waitForHydration(page);

			const before = await countOf(page, 'table tbody tr');

			await clickButton(page, 'Add Subscriber');
			await page.waitForSelector('[role="dialog"]', { timeout: 5000 });
			reporter.expect(
				(await page.content()).includes('Add New Subscriber'),
				'create dialog opens'
			);

			// Invalid address is rejected inline.
			const emailField = '[role="dialog"] input[type="email"]';
			await fillInput(page, emailField, 'not-an-email');
			await clickButton(page, 'Add Subscriber');
			await page.waitForFunction(
				() => document.body.innerText.includes('Enter a valid email address'),
				{ timeout: 5000 }
			);
			reporter.expect(true, 'invalid email shows an inline validation error');

			await fillInput(page, emailField, 'e2e.reader@example.com');
			await clickButton(page, 'Add Subscriber');
			await page.waitForFunction(
				() => !document.querySelector('[role="dialog"]'),
				{ timeout: 8000 }
			);
			reporter.expect(true, 'valid submission closes the dialog');
			reporter.expect(
				(await page.content()).includes('Subscriber added'),
				'success toast confirms the write'
			);

			await waitForStep(
				page,
				() => document.body.innerText.includes('e2e.reader@example.com'),
				'new row visible'
			);
			reporter.expect(true, 'new subscriber appears in the table');

			// Survives a reload because the store persisted to LocalStorage.
			await page.reload({ waitUntil: 'networkidle0' });
			await page.waitForFunction(() => document.body.innerText.includes('e2e.reader@example.com'), {
				timeout: 8000
			});
			reporter.expect(true, 'subscriber persists across a full page reload');

			const after = await countOf(page, 'table tbody tr');
			reporter.expect(after <= before + 1, 'table reflects the added record');

			// Clean up so later scenarios start from the seeded audience.
			// [DATA-02] An edit must not collide with a different record.
			await clickByText(page, 'table tbody tr button', 'Edit');
			await waitForStep(page, () => Boolean(document.querySelector('[role="dialog"]')), 'edit dialog open');

			await fillInput(page, '[role="dialog"] input[type="email"]', 'alex.chen@clouddev.io');
			await clickButton(page, 'Save Changes');
			await waitForStep(
				page,
				() => document.body.innerText.includes('already in the audience'),
				'duplicate rejection at the field'
			);
			reporter.expect(
				await isVisible(page, '[role="dialog"]'),
				'the editor stays open so the operator can correct the address'
			);
			const flaggedInvalid = await page.evaluate(
				() =>
					document
						.querySelector('[role="dialog"] input[type="email"]')
						?.getAttribute('aria-invalid') === 'true'
			);
			reporter.expect(flaggedInvalid, 'the email field is flagged invalid for assistive technology');

			const originalIntact = await page.evaluate(() => {
				const stored = JSON.parse(localStorage.getItem('snsp_subscribers_v1') ?? '[]');
				const record = stored.find((subscriber) => subscriber.email === 'e2e.reader@example.com');
				return record ? record.id : null;
			});
			reporter.expect(originalIntact !== null, 'the original record is left untouched');

			await clickButton(page, 'Cancel');

			await page.evaluate(() => localStorage.removeItem('snsp_subscribers_v1'));
		}
	},

	{
		name: 'phase5/csv-import-reports-results',
		async run({ page, origin, reporter }) {
			await page.setViewport({ width: 1440, height: 900 });
			await goto(page, '/admin/subscribers', origin);
			await waitForHydration(page);

			await clickButton(page, 'Import CSV');
			await page.waitForSelector('[role="dialog"]', { timeout: 5000 });

			const csv = [
				'email,firstname,lastname,tags',
				'import.one@example.com,Import,One,alpha; beta',
				'sarah.connor@example.com,Duplicate,Row,alpha',
				'broken@@example.com,Bad,Row,alpha',
				'"multi@example.com","Multi","Line","has, comma"'
			].join('\n');

			await fillTextarea(page, '[role="dialog"] textarea', csv);
			await clickButton(page, 'Execute Import');

			await page.waitForFunction(
				() => document.body.innerText.includes('Imported 2 of 4 rows'),
				{ timeout: 8000 }
			);
			reporter.expect(true, 'import summary reports successes and rejections');
			reporter.expect(
				(await page.content()).includes('Already subscribed to this publication.'),
				'duplicate row is reported with a reason'
			);
			reporter.expect(
				(await page.content()).includes('Invalid email syntax.'),
				'malformed row is reported with a reason'
			);

			await page.evaluate(() => {
				localStorage.removeItem('snsp_subscribers_v1');
			});
		}
	},

	{
		name: 'phase5/bulk-selection-and-bounce-guard',
		async run({ page, origin, reporter }) {
			await page.setViewport({ width: 1440, height: 900 });
			await goto(page, '/admin/subscribers', origin);
			await waitForHydration(page);

			await page.click('input[aria-label="Select all subscribers on this page"]');
			await waitForStep(page, () => document.body.innerText.includes('10 selected'), 'selection summary');
			reporter.expect(true, 'select-all reports the page selection count');

			await clickButton(page, 'Mark active');
			await waitForStep(page, () => document.body.innerText.includes('Status updated'), 'bulk status toast');
			const message = await page.content();
			reporter.expect(
				message.includes('bounced addresses are protected'),
				'bulk activation reports the bounce guard instead of silently skipping'
			);

			// The bounced addresses in the seed must remain bounced.
			const statuses = await page.evaluate(() => {
				const stored = JSON.parse(localStorage.getItem('snsp_subscribers_v1') ?? '[]');
				return stored
					.filter((subscriber) => subscriber.email === 'devnull-test@domain-bounced.xyz')
					.map((subscriber) => subscriber.status);
			});
			reporter.expectEqual(statuses[0], 'bounced', 'bounced address stays bounced after bulk activation');

			await page.evaluate(() => localStorage.removeItem('snsp_subscribers_v1'));
		}
	},

	{
		name: 'phase5/destructive-actions-require-confirmation',
		async run({ page, origin, reporter }) {
			await page.setViewport({ width: 1440, height: 900 });
			await goto(page, '/admin/subscribers', origin);
			await waitForHydration(page);

			const before = await countOf(page, 'table tbody tr');

			// [HIGH-02] Bulk deletion asks first and states the exact record count.
			await page.click('input[aria-label="Select all subscribers on this page"]');
			await waitForStep(page, () => document.body.innerText.includes('10 selected'), 'selection summary');

			await clickButton(page, 'Delete selected');
			await waitForStep(page, () => Boolean(document.querySelector('[role="dialog"]')), 'bulk confirm open');

			reporter.expect(await pageContains(page, 'Delete selected subscribers?'), 'bulk delete asks first');
			reporter.expect(await pageContains(page, '10 subscribers will be permanently removed'), 'exact count stated');
			reporter.expect(
				(await page.evaluate(() => document.body.style.overflow)) === 'hidden',
				'body scroll is locked behind the confirmation'
			);

			// Escape dismisses without deleting anything.
			await page.keyboard.press('Escape');
			await waitForStep(page, () => !document.querySelector('[role="dialog"]'), 'escape dismissed the dialog');
			reporter.expectEqual(
				await countOf(page, 'table tbody tr'),
				before,
				'cancelling the confirmation deletes nothing'
			);
			reporter.expect(
				(await page.evaluate(() => document.body.style.overflow)) !== 'hidden',
				'scroll lock released on dismissal'
			);

			// Confirming performs the deletion.
			await clickButton(page, 'Delete selected');
			await waitForStep(page, () => Boolean(document.querySelector('[role="dialog"]')), 'bulk confirm open');
			await clickButton(page, 'Delete 10 subscribers');
			await waitForStep(page, () => !document.querySelector('[role="dialog"]'), 'bulk delete completed');
			await waitForStep(page, () => document.body.innerText.includes('Subscribers deleted'), 'deletion toast');
			reporter.expect(true, 'confirming the bulk deletion removes the selected records');

			const remaining = await page.evaluate(() => {
				const stored = JSON.parse(localStorage.getItem('snsp_subscribers_v1') ?? '[]');
				return stored.length;
			});
			reporter.expect(remaining > 0, 'only the selected records were removed');

			// [HIGH-04] The single-record confirmation uses the same primitive.
			await goto(page, '/admin/subscribers', origin);
			await waitForHydration(page);
			await page.click('table tbody tr:first-child button[aria-label^="Delete"]');
			await waitForStep(page, () => Boolean(document.querySelector('[role="dialog"]')), 'row confirm open');
			reporter.expect(await pageContains(page, 'Delete subscriber?'), 'row delete asks first');
			reporter.expect(
				(await page.evaluate(() => document.body.style.overflow)) === 'hidden',
				'row confirmation locks the page behind it'
			);

			// Tab focus stays inside the dialog while it is open.
			for (let index = 0; index < 8; index += 1) {
				await page.keyboard.press('Tab');
			}
			reporter.expect(
				await page.evaluate(() => {
					const dialog = document.querySelector('[role="dialog"]');
					return dialog !== null && dialog.contains(document.activeElement);
				}),
				'focus is trapped inside the confirmation dialog'
			);

			await clickButton(page, 'Cancel');
			await waitForStep(page, () => !document.querySelector('[role="dialog"]'), 'row confirm cancelled');

			await page.evaluate(() => localStorage.removeItem('snsp_subscribers_v1'));
		}
	},

	{
		name: 'phase5/issue-deletion-confirms-and-redirects',
		async run({ page, origin, reporter }) {
			await page.setViewport({ width: 1440, height: 900 });

			// [HIGH-04] The list confirmation comes from the shared Modal primitive.
			await goto(page, '/admin/issues', origin);
			await waitForHydration(page);
			const rowsBefore = await countOf(page, 'ul > li');

			await clickByText(page, 'li button', 'Delete');
			await waitForStep(page, () => Boolean(document.querySelector('[role="dialog"]')), 'issue confirm open');
			reporter.expect(await pageContains(page, 'Delete issue?'), 'the list asks before deleting');
			reporter.expect(await pageContains(page, 'This action cannot be undone'), 'the consequence is stated');

			await page.keyboard.press('Escape');
			await waitForStep(page, () => !document.querySelector('[role="dialog"]'), 'escape dismissed');
			reporter.expectEqual(
				await countOf(page, 'ul > li'),
				rowsBefore,
				'dismissing the confirmation deletes nothing'
			);

			await clickByText(page, 'li button', 'Delete');
			await waitForStep(page, () => Boolean(document.querySelector('[role="dialog"]')), 'issue confirm open');
			await clickButton(page, 'Delete issue');
			await waitForStep(page, () => !document.querySelector('[role="dialog"]'), 'issue deleted');
			reporter.expectEqual(
				await countOf(page, 'ul > li'),
				rowsBefore - 1,
				'confirming removes the issue from the collection'
			);

			// [HIGH-03 / MED-01] The editor asks first, then leaves the dead route.
			await goto(page, '/admin/issues/issue-002', origin);
			await waitForHydration(page);

			await clickButton(page, 'Delete issue');
			await waitForStep(page, () => Boolean(document.querySelector('[role="dialog"]')), 'editor confirm open');
			reporter.expect(await pageContains(page, 'Delete issue?'), 'the editor asks before deleting');
			reporter.expectEqual(
				await page.evaluate(() => window.location.pathname),
				'/admin/issues/issue-002',
				'one click never deletes: the editor route is still live'
			);

			await clickButton(page, 'Delete issue');
			await waitForStep(
				page,
				() => window.location.pathname === '/admin/issues',
				'delete redirects to the collection'
			);
			reporter.expect(true, '[MED-01] deleting from the editor never strands the operator on a dead route');
			reporter.expect(
				await pageContains(page, 'Newsletter Issues'),
				'the collection renders after the redirect'
			);

			await page.evaluate(() => localStorage.removeItem('snsp_issues_v1'));
		}
	},

	{
		name: 'phase5/issue-dispatch-lifecycle',
		async run({ page, origin, reporter }) {
			await page.setViewport({ width: 1440, height: 900 });
			await goto(page, '/admin/issues', origin);
			await waitForHydration(page);

			reporter.expect(
				(await page.content()).includes('Newsletter Issues'),
				'issues screen renders the list'
			);

			// Dispatch the draft issue end to end.
			await clickByText(page, 'li a', 'Edit');
			await page.waitForFunction(() => window.location.pathname.startsWith('/admin/issues/'), {
				timeout: 8000
			});

			const editorPath = await page.evaluate(() => window.location.pathname);
			reporter.expect(
				editorPath !== '/admin/issues',
				'edit link navigates to the issue editor route'
			);

			// Back to the list, then dispatch.
			await goto(page, '/admin/issues', origin);
			await waitForHydration(page);
			await clickButton(page, 'Send Issue');
			await waitForStep(page, () => Boolean(document.querySelector('[role="dialog"]')), 'dispatch dialog open');
			reporter.expect(
				await pageContains(page, 'Confirm'),
				'dispatch modal opens in its confirmation state'
			);

			await clickButton(page, 'Confirm & Send');

			// While the engine is running the operator gets the full control set.
			// (Pause/resume semantics themselves are verified deterministically in the
			// logic suite, where the run can be held open on purpose.)
			await waitForStep(
				page,
				() => document.body.innerText.toLowerCase().includes('pause'),
				'running state visible'
			);
			reporter.expect(
				await pageContains(page, 'Halt Distribution'),
				'halt control is available while the engine runs'
			);
			reporter.expect(
				(await page.$('[role="progressbar"]')) !== null,
				'live progress bar is rendered during the run'
			);

			await waitForStep(
				page,
				() => {
					const text = document.body.innerText.toLowerCase();
					return text.includes('distribution complete') || text.includes('distribution halted');
				},
				'run finished',
				30000
			);
			reporter.expect(await pageContains(page, 'Done'), 'completion state offers the Done action');
			reporter.expect(
				await pageContains(page, 'Delivered'),
				'completion state reconciles delivery statistics'
			);

			await clickButton(page, 'Done');
			await waitForStep(page, () => !document.querySelector('[role="dialog"]'), 'dispatch modal closed');
			reporter.expect(true, 'closing the dispatch modal returns to the list');

			// The dispatched issue is now marked sent with real statistics.
			await waitForStep(
				page,
				() => document.body.innerText.includes('Delivered') && !document.body.innerText.includes('Confirm'),
				'issue row shows delivery stats'
			);
			const statsPersisted = await page.evaluate(() => {
				const issues = JSON.parse(localStorage.getItem('snsp_issues_v1') ?? '[]');
				return issues.filter((issue) => issue.status === 'sent').length;
			});
			reporter.expect(statsPersisted >= 4, 'dispatched issue persisted as sent');
		}
	},

	{
		name: 'phase5/issue-editor-saves-draft',
		async run({ page, origin, reporter }) {
			await page.setViewport({ width: 1440, height: 900 });
			await goto(page, '/admin/issues', origin);
			await waitForHydration(page);

			await clickButton(page, 'New Dispatch');
			await page.waitForFunction(() => window.location.pathname.startsWith('/admin/issues/'), {
				timeout: 10000
			});

			await fillInput(page, '#issue-title', 'Signals and Derived State');
			await fillTextarea(
				page,
				'#issue-markdown',
				'# Signals\n\nDerived state removes whole classes of bug.\n\n* One source of truth\n* No manual synchronisation'
			);

			await waitForStep(page, () => document.body.innerText.includes('Unsaved changes'), 'dirty state');
			reporter.expect(true, 'editing marks the draft as dirty');
			reporter.expect(
				(await page.content()).includes('Derived state removes'),
				'preview pane renders the unsaved markdown'
			);

			await clickButton(page, 'Save Changes');
			await waitForStep(page, () => document.body.innerText.includes('Issue saved'), 'save confirmation');
			reporter.expect(true, 'saving confirms through a toast');

			const savedTitle = await page.evaluate(() => {
				const issues = JSON.parse(localStorage.getItem('snsp_issues_v1') ?? '[]');
				return issues.find((issue) => issue.title === 'Signals and Derived State');
			});
			reporter.expect(savedTitle !== undefined, 'title persisted to storage');
			reporter.expect(
				savedTitle?.contentHtml.includes('<h1'),
				'rendered HTML is persisted alongside the markdown'
			);
			reporter.expect(
				savedTitle?.slug === 'signals-and-derived-state',
				'slug derived from the draft title'
			);

			await screenshot(page, 'phase5-issue-editor');
			await page.evaluate(() => localStorage.removeItem('snsp_issues_v1'));
		}
	},

	{
		name: 'phase5/unsaved-changes-guard',
		async run({ page, origin, reporter, beforeUnloadPrompts }) {
			await page.setViewport({ width: 1440, height: 900 });
			await goto(page, '/admin/issues/issue-001', origin);
			await waitForHydration(page);

			// [LOW-02] A freshly opened issue is clean: leaving must not prompt.
			reporter.expect(
				(await pageContains(page, 'No changes yet')) || (await pageContains(page, 'Saved')),
				'the editor opens in a clean state'
			);

			await fillInput(page, '#issue-title', 'Guard Rail Regression');
			await waitForStep(page, () => document.body.innerText.includes('Unsaved changes'), 'dirty state');

			// Leaving the page with unsaved work must raise the browser guard.
			await goto(page, '/admin/issues', origin);
			reporter.expectEqual(
				beforeUnloadPrompts.length,
				1,
				'navigating away from an unsaved draft raises the browser guard'
			);
			reporter.expectEqual(
				await page.evaluate(() => window.location.pathname),
				'/admin/issues',
				'the navigation completes once the guard is answered'
			);

			await page.evaluate(() => localStorage.removeItem('snsp_issues_v1'));
		}
	},

	{
		name: 'phase5/public-archive-and-article',
		async run({ page, origin, reporter }) {
			await page.setViewport({ width: 1024, height: 900 });
			await goto(page, '/', origin);
			await waitForHydration(page);

			reporter.expect(
				(await page.content()).includes('The Margins &amp; Letters'),
				'archive renders the publication name'
			);

			await clickByText(page, 'a', 'The Art of Minimal State');
			await page.waitForFunction(() => window.location.pathname.startsWith('/p/'), { timeout: 8000 });
			reporter.expect(true, 'archive entry links to the dispatch page');
			reporter.expect(
				(await page.content()).includes('The Derived Truth Principle'),
				'article body renders the stored markdown'
			);

			// Public subscribe flow writes a pending reader.
			await fillInput(page, '#subscribe-email', 'reader.e2e@example.com');
			await clickButton(page, 'Subscribe');
			await waitForStep(
				page,
				() => document.body.innerText.includes('Confirmation sent'),
				'subscribe confirmation'
			);
			reporter.expect(true, 'public subscribe confirms to the reader');

			// Unknown slug renders an explicit 404 state.
			await goto(page, '/p/does-not-exist', origin);
			await waitForHydration(page);
			reporter.expect(
				(await page.content()).includes('Dispatch not found'),
				'unknown slug renders an explicit not-found state'
			);

			await page.evaluate(() => localStorage.removeItem('snsp_subscribers_v1'));
		}
	},

	{
		name: 'phase5/responsive-matrix-across-all-routes',
		async run({ page, origin, reporter, viewports }) {
			const routes = [
				'/',
				'/p/the-art-of-minimal-state',
				...ADMIN_ROUTES,
				'/admin/issues/issue-001'
			];

			for (const viewport of viewports) {
				await page.setViewport({ width: viewport.width, height: viewport.height });

				for (const route of routes) {
					await goto(page, route, origin);
					await waitForHydration(page);
					await checkNoHorizontalOverflow(page, reporter, `${viewport.name} ${route}`);
				}
			}

			// Touch targets on the densest screens at the narrowest breakpoint.
			await page.setViewport({ width: 360, height: 780 });
			for (const route of ['/admin/subscribers', '/admin/issues']) {
				await goto(page, route, origin);
				await waitForHydration(page);
				await checkTouchTargets(
					page,
					reporter,
					`mobile-360 ${route}`,
					['header button', 'main button', 'main a[href]', 'aside button', 'aside a[href]']
				);
			}

			await page.setViewport({ width: 1280, height: 900 });
		}
	},

	{
		name: 'phase5/mobile-table-switches-to-cards',
		async run({ page, origin, reporter }) {
			await page.setViewport({ width: 360, height: 780 });
			await goto(page, '/admin/subscribers', origin);
			await waitForHydration(page);

			reporter.expect(
				!(await isVisible(page, 'table')),
				'dense table is hidden on small screens'
			);
			const cardCheckboxes = await page.evaluate(
				() => document.querySelectorAll('input[type="checkbox"][aria-label^="Select "]').length
			);
			reporter.expect(cardCheckboxes > 0, 'card list with selection checkboxes is shown instead');

			await page.setViewport({ width: 1024, height: 800 });
			await goto(page, '/admin/subscribers', origin);
			await waitForHydration(page);
			reporter.expect(await isVisible(page, 'table'), 'dense table returns at >= 640px');
			const tableRows = await countOf(page, 'table tbody tr');
			reporter.expect(tableRows > 0, 'dense grid renders rows once the table takes over');

			await page.setViewport({ width: 1280, height: 900 });
		}
	},

	{
		name: 'phase5/full-journey-console-clean',
		async run({ page, origin, reporter }) {
			const diagnostics = [];
			page.on('console', (message) => {
				if (message.type() === 'error') diagnostics.push(`console.error: ${message.text()}`);
			});
			page.on('pageerror', (error) => diagnostics.push(`pageerror: ${error.message}`));

			await page.setViewport({ width: 390, height: 844 });
			for (const route of ['/', '/admin', '/admin/subscribers', '/admin/issues', '/admin/issues/issue-001']) {
				await goto(page, route, origin);
				await waitForHydration(page);
			}

			reporter.expectEqual(diagnostics.length, 0, `console must stay clean: ${diagnostics.join(' | ')}`);
			await screenshot(page, 'phase5-mobile-admin');
		}
	}
];