/**
 * Interaction helpers shared by every E2E scenario.
 * They drive the page the way a person would (real clicks, real keystrokes) and
 * read state back out of the live DOM.
 */

import path from 'node:path';

const SCREENSHOT_DIR = path.resolve(process.cwd(), 'verify-artifacts/screens');

export async function goto(page, routePath, origin) {
	await page.goto(`${origin}${routePath}`, { waitUntil: 'networkidle0' });
}

/** Waits until the SvelteKit app has hydrated and rendered its page content. */
export async function waitForHydration(page, selector = 'body') {
	await page.waitForSelector(selector, { timeout: 15000 });
	await page.waitForFunction(() => document.readyState === 'complete', { timeout: 15000 });
}

/** Clicks the first element matching `selector` whose text contains `text`. */
export async function clickByText(page, selector, text) {
	const handle = await page.evaluateHandle(
		(sel, needle) => {
			const elements = Array.from(document.querySelectorAll(sel));
			return elements.find((element) => element.textContent?.includes(needle)) ?? null;
		},
		selector,
		text
	);

	const element = handle.asElement();
	if (!element) throw new Error(`No ${selector} containing "${text}"`);

	await element.evaluate((node) => node.scrollIntoView({ block: 'center' }));
	await element.click();
	return element;
}

/** Clicks a button/link by its accessible label text. */
export async function clickButton(page, text) {
	return clickByText(page, 'button, a[href], [role="button"]', text);
}

/** Replaces the value of a form control and fires the events Svelte listens to. */
export async function fillInput(page, selector, value) {
	await page.waitForSelector(selector, { timeout: 10000 });
	await page.click(selector, { clickCount: 3 });
	await page.keyboard.press('Backspace');
	if (value.length > 0) {
		await page.type(selector, value);
	}
	// Guarantee the Svelte-bound value is committed even for exotic inputs.
	await page.$eval(
		selector,
		(node, next) => {
			node.value = next;
			node.dispatchEvent(new Event('input', { bubbles: true }));
			node.dispatchEvent(new Event('change', { bubbles: true }));
		},
		value
	);
}

/** Types multi-line content into a textarea. */
export async function fillTextarea(page, selector, value) {
	await page.waitForSelector(selector, { timeout: 10000 });
	await page.$eval(
		selector,
		(node, next) => {
			node.value = next;
			node.dispatchEvent(new Event('input', { bubbles: true }));
		},
		value
	);
}

/** Selects an option by value inside a native <select>. */
export async function selectOption(page, selector, value) {
	await page.waitForSelector(selector, { timeout: 10000 });
	await page.$eval(
		selector,
		(node, next) => {
			node.value = next;
			node.dispatchEvent(new Event('change', { bubbles: true }));
		},
		value
	);
}

export async function textOf(page, selector) {
	return page.$eval(selector, (node) => node.textContent?.trim() ?? '');
}

export async function textOfAll(page, selector) {
	return page.$$eval(selector, (nodes) => nodes.map((node) => node.textContent?.trim() ?? ''));
}

export async function countOf(page, selector) {
	return page.$$eval(selector, (nodes) => nodes.length);
}

/** True when any element matching the selector is visible to the user. */
export async function isVisible(page, selector) {
	return page.evaluate((sel) => {
		const element = document.querySelector(sel);
		if (!element) return false;
		const rect = element.getBoundingClientRect();
		const style = window.getComputedStyle(element);
		return (
			rect.width > 0 &&
			rect.height > 0 &&
			style.visibility !== 'hidden' &&
			style.display !== 'none' &&
			Number(style.opacity) > 0
		);
	}, selector);
}

/** Asserts the document never scrolls horizontally at the current viewport. */
export async function checkNoHorizontalOverflow(page, reporter, label) {
	const overflow = await page.evaluate(() => ({
		scrollWidth: document.documentElement.scrollWidth,
		clientWidth: document.documentElement.clientWidth,
		innerWidth: window.innerWidth
	}));

	reporter.expect(
		overflow.scrollWidth <= overflow.clientWidth + 1,
		`${label}: horizontal overflow (scrollWidth ${overflow.scrollWidth} > clientWidth ${overflow.clientWidth})`
	);
}

/** Asserts no interactive control is smaller than the 44px touch guideline. */
export async function checkTouchTargets(page, reporter, label, selectors) {
	const tooSmall = await page.evaluate((cssSelectors) => {
		const problems = [];
		for (const selector of cssSelectors) {
			for (const element of document.querySelectorAll(selector)) {
				const rect = element.getBoundingClientRect();
				if (rect.width === 0 || rect.height === 0) continue;
				const style = window.getComputedStyle(element);
				if (style.visibility === 'hidden' || style.display === 'none') continue;
				if (rect.height < 44 || rect.width < 44) {
					problems.push(
						`${selector} "${(element.textContent ?? element.getAttribute('aria-label') ?? '').trim().slice(0, 28)}" ${Math.round(rect.width)}x${Math.round(rect.height)}`
					);
				}
			}
		}
		return problems;
	}, selectors);

	for (const problem of tooSmall) {
		reporter.expect(false, `${label}: touch target under 44px — ${problem}`);
	}
}

export async function screenshot(page, name) {
	await page.screenshot({ path: path.join(SCREENSHOT_DIR, `${name}.png`), fullPage: false });
}

/** Clears persisted LocalStorage so each scenario starts from seed fixtures. */
export async function resetAppStorage(page, origin) {
	await page.goto(`${origin}/`, { waitUntil: 'domcontentloaded' });
	await page.evaluate(() => localStorage.clear());
}