import {
	checkNoHorizontalOverflow,
	goto,
	screenshot,
	waitForHydration
} from '../helpers.mjs';

/**
 * Phase 1 — foundation, types and deterministic base logic.
 *
 * Verifies the app boots from the production build, the LocalStorage adapter
 * seeds and persists in a real browser, the markdown renderer output reaches the
 * DOM, and no viewport in the matrix overflows horizontally.
 */
export default [
	{
		name: 'phase1/public-archive-ssr',
		async run({ page, origin, reporter }) {
			await goto(page, '/', origin);
			await waitForHydration(page);

			reporter.expect(
				(await page.content()).includes('The Margins &amp; Letters'),
				'public archive should server-render the publication name'
			);

			const issueTitles = await page.$$eval('article h3', (nodes) =>
				nodes.map((node) => node.textContent?.trim() ?? '')
			);
			reporter.expectEqual(issueTitles.length, 3, 'three sent issues listed in the archive');
			reporter.expect(
				issueTitles.some((title) => title.includes('Minimal State')),
				'archive should include the seeded issue'
			);
		}
	},

	{
		name: 'phase1/storage-adapter-seeds-and-normalises',
		async run({ page, origin, reporter }) {
			await goto(page, '/', origin);
			await waitForHydration(page);

			const storage = await page.evaluate(() => {
				const issues = JSON.parse(localStorage.getItem('snsp_issues_v1') ?? '[]');
				const settings = JSON.parse(localStorage.getItem('snsp_settings_v1') ?? '{}');
				return {
					issueCount: issues.length,
					publicationName: settings.publicationName ?? '',
					firstContentHtml: issues[0]?.contentHtml ?? '',
					firstSlug: issues[0]?.slug ?? ''
				};
			});

			reporter.expectEqual(storage.issueCount, 6, 'seed issues persisted');
			reporter.expectEqual(storage.publicationName, 'The Margins & Letters', 'settings persisted');
			reporter.expectEqual(storage.firstSlug, 'the-art-of-minimal-state', 'issue slug persisted');
			reporter.expect(
				storage.firstContentHtml.includes('<h1 class="text-3xl'),
				'markdown should be rendered to sanitised HTML on load'
			);
			reporter.expect(
				!storage.firstContentHtml.includes('<script'),
				'rendered HTML must not contain script markup'
			);
		}
	},

	{
		name: 'phase1/routes-respond',
		async run({ page, origin, reporter }) {
			const routes = ['/', '/admin', '/admin/subscribers', '/admin/issues', '/admin/issues/issue-001', '/p/the-art-of-minimal-state'];

			for (const route of routes) {
				const response = await page.goto(`${origin}${route}`, { waitUntil: 'domcontentloaded' });
				const status = response?.status() ?? 0;
				// Conditional requests legitimately answer 304 from the ETag cache.
				reporter.expect(
					status < 400,
					`route ${route} should respond with a success status (received ${status})`
				);
			}
		}
	},

	{
		name: 'phase1/responsive-matrix-no-overflow',
		async run({ page, origin, reporter, viewports }) {
			for (const viewport of viewports) {
				await page.setViewport({ width: viewport.width, height: viewport.height });
				await goto(page, '/', origin);
				await waitForHydration(page);
				await checkNoHorizontalOverflow(page, reporter, `${viewport.name} /`);
			}
			await page.setViewport({ width: 1280, height: 900 });
		}
	},

	{
		name: 'phase1/no-console-errors',
		async run({ page, origin, reporter }) {
			const diagnostics = [];
			page.on('console', (message) => {
				if (message.type() === 'error') diagnostics.push(`console.error: ${message.text()}`);
			});
			page.on('pageerror', (error) => diagnostics.push(`pageerror: ${error.message}`));

			for (const route of ['/', '/admin', '/admin/subscribers', '/admin/issues']) {
				await goto(page, route, origin);
				await waitForHydration(page);
			}

			reporter.expectEqual(diagnostics.length, 0, `console must stay clean: ${diagnostics.join(' | ')}`);
			await screenshot(page, 'phase1-shell');
		}
	}
];