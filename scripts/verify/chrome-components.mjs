import path from 'node:path';
import { attachDiagnostics, launchHeadlessChrome, resolveChromiumPath, startStaticServer } from './browser.mjs';

/**
 * Measures the rendered component gallery inside headless Chrome.
 *
 * The markup is produced by the SSR suite (`run-components.mjs`) and styled with
 * the real production stylesheet, so this pass proves the design tokens actually
 * reach the browser: correct fonts, correct colours, 44px touch targets, and no
 * horizontal overflow at the narrowest supported viewport.
 */

const artifactsDir = path.resolve(process.cwd(), 'verify-artifacts');
const galleryPath = path.join(artifactsDir, 'component-gallery.html');

const VIEWPORTS = [
	{ name: 'mobile-360', width: 360, height: 780 },
	{ name: 'tablet-768', width: 768, height: 1024 },
	{ name: 'desktop-1440', width: 1440, height: 900 }
];

const failures = [];
let passed = 0;

function check(condition, message) {
	if (condition) {
		passed++;
	} else {
		failures.push(message);
	}
}

const server = await startStaticServer(artifactsDir);
const diagnostics = [];
const browser = await launchHeadlessChrome({ profileName: 'chrome-profile-components' });
let exitCode = 0;

try {
	const page = await browser.newPage();
	attachDiagnostics(page, diagnostics);

	for (const viewport of VIEWPORTS) {
		await page.setViewport({ width: viewport.width, height: viewport.height });
		await page.goto(`${server.origin}/component-gallery.html`, { waitUntil: 'load' });

		// 1. The theme reached the browser.
		const theme = await page.evaluate(() => {
			const body = getComputedStyle(document.body);
			const primaryButton = document.querySelector('[data-section="Buttons"] button');
			return {
				background: body.backgroundColor,
				fontFamily: body.fontFamily,
				buttonBackground: primaryButton ? getComputedStyle(primaryButton).backgroundColor : ''
			};
		});

		check(
			theme.background === 'rgb(252, 251, 249)',
			`${viewport.name}: body background should use the paper token (got ${theme.background})`
		);
		check(
			/-apple-system|system-ui/.test(theme.fontFamily),
			`${viewport.name}: sans font token should be applied (got ${theme.fontFamily})`
		);
		check(
			theme.buttonBackground === 'rgb(28, 25, 23)',
			`${viewport.name}: primary button should use the stone-900 token (got ${theme.buttonBackground})`
		);

		// 2. Touch targets: 44px below the sm breakpoint, 32px on pointer devices.
		const undersized = await page.evaluate((minimumHeight) => {
			const problems = [];
			const selectors = ['button', 'input', 'select', 'textarea', 'a[href]', '[role="option"]'];

			const describe = (element) =>
				`${element.tagName.toLowerCase()} "${(element.textContent ?? element.getAttribute('aria-label') ?? '').trim().slice(0, 24)}"`;

			for (const selector of selectors) {
				for (const element of document.querySelectorAll(selector)) {
					const rect = element.getBoundingClientRect();
					const style = getComputedStyle(element);

					// Visually hidden controls (sr-only file inputs, decorative nodes)
					// are activated through a visible sibling and are not hit targets.
					if (rect.width < 2 || rect.height < 2) continue;
					if (style.visibility === 'hidden' || style.display === 'none') continue;
					if (style.clipPath === 'inset(50%)' || style.clip === 'rect(0px, 0px, 0px, 0px)') continue;
					if (element.type === 'file') continue;

					// A checkbox/radio inherits the hit box of the label wrapping it.
					if (element.type === 'checkbox' || element.type === 'radio') {
						const label = element.closest('label');
						const labelRect = label?.getBoundingClientRect();
						if (labelRect && labelRect.height >= 44 && labelRect.width >= 44) continue;
					}

					if (rect.height < minimumHeight) {
						problems.push(`${describe(element)} height ${Math.round(rect.height)}px`);
					}
				}
			}
			return problems;
		}, viewport.width < 640 ? 44 : 32);

		check(
			undersized.length === 0,
			`${viewport.name}: touch targets below ${viewport.width < 640 ? 44 : 32}px — ${undersized.join(', ')}`
		);

		// 3. Nothing overflows horizontally.
		const overflow = await page.evaluate(() => ({
			scrollWidth: document.documentElement.scrollWidth,
			clientWidth: document.documentElement.clientWidth
		}));

		check(
			overflow.scrollWidth <= overflow.clientWidth + 1,
			`${viewport.name}: gallery overflows horizontally (${overflow.scrollWidth} > ${overflow.clientWidth})`
		);
	}

	// 4. The modal sheet is fixed to the viewport and stays readable.
	await page.setViewport({ width: 390, height: 844 });
	await page.goto(`${server.origin}/component-gallery.html`, { waitUntil: 'load' });

	const modal = await page.evaluate(() => {
		const dialog = document.querySelector('[role="dialog"]');
		if (!dialog) return null;
		const rect = dialog.getBoundingClientRect();
		const panel = dialog.querySelector('[role="document"]');
		const panelStyle = panel ? getComputedStyle(panel) : null;
		return {
			width: rect.width,
			top: rect.top,
			viewportWidth: window.innerWidth,
			viewportHeight: window.innerHeight,
			background: panelStyle?.backgroundColor ?? ''
		};
	});

	check(modal !== null, 'modal dialog should be present in the gallery');
	if (modal) {
		check(modal.width <= modal.viewportWidth, `modal must fit the viewport (${modal.width} > ${modal.viewportWidth})`);
		check(modal.top >= 0, 'modal sheet must be anchored inside the viewport');
		check(modal.background === 'rgb(255, 255, 255)', 'modal panel should paint an opaque surface');
	}

	await page.screenshot({ path: path.join(artifactsDir, 'screens', 'phase2-components-390.png') });

	if (diagnostics.length > 0) {
		failures.push(...diagnostics.map((diagnostic) => `browser diagnostic: ${diagnostic}`));
	}

	console.log(`\n[chrome] binary: ${resolveChromiumPath()}`);
	console.log(`[chrome] component gallery: ${passed} checks passed, ${failures.length} failed`);

	if (failures.length > 0) {
		exitCode = 1;
		console.error('[chrome] failures:');
		for (const failure of failures) {
			console.error(`  ✗ ${failure}`);
		}
	} else {
		console.log('[chrome] component rendering verification passed\n');
	}
} catch (error) {
	exitCode = 1;
	console.error('[chrome] component verification aborted:', error);
} finally {
	await browser.close();
	await server.close();
}

process.exit(exitCode);