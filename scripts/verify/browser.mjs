import { createServer } from 'node:http';
import { createReadStream, existsSync, mkdirSync, rmSync, statSync } from 'node:fs';
import path from 'node:path';
import { launch } from 'puppeteer-core';

/**
 * Shared headless-Chrome harness for all verification runs.
 *
 * Safety: it always launches a *headless* browser with a throwaway profile
 * directory inside `verify-artifacts/`, so no interactive browser session
 * (including any of the user's own browser) is read, reused or closed.
 */

const MIME_TYPES = {
	'.html': 'text/html; charset=utf-8',
	'.js': 'text/javascript; charset=utf-8',
	'.mjs': 'text/javascript; charset=utf-8',
	'.css': 'text/css; charset=utf-8',
	'.json': 'application/json; charset=utf-8',
	'.svg': 'image/svg+xml',
	'.png': 'image/png',
	'.jpg': 'image/jpeg',
	'.woff2': 'font/woff2',
	'.ico': 'image/x-icon'
};

const PLAYWRIGHT_CACHE = path.join(process.env.HOME ?? '', 'Library/Caches/ms-playwright');

/**
 * Resolves a Chromium binary without downloading anything.
 *
 * `chrome-headless-shell` is preferred: it is the purpose-built headless binary
 * and starts reliably inside a container sandbox, where the full Chrome
 * singleton/GPU processes are not available.
 *
 * Order: explicit env var → Playwright headless shell → Playwright full Chrome → system Chrome.
 */
export function resolveChromiumPath() {
	const fromEnv = process.env.PUPPETEER_EXECUTABLE_PATH;
	if (fromEnv && existsSync(fromEnv)) return fromEnv;

	const candidates = [
		path.join(
			PLAYWRIGHT_CACHE,
			'chromium_headless_shell-1243/chrome-headless-shell-mac-arm64/chrome-headless-shell'
		),
		path.join(
			PLAYWRIGHT_CACHE,
			'chromium_headless_shell-1234/chrome-headless-shell-mac-arm64/chrome-headless-shell'
		),
		path.join(
			PLAYWRIGHT_CACHE,
			'chromium-1243/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing'
		),
		'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
		'/Applications/Chromium.app/Contents/MacOS/Chromium'
	];

	const found = candidates.find((candidate) => existsSync(candidate));
	if (!found) {
		throw new Error(
			'No Chromium binary found. Set PUPPETEER_EXECUTABLE_PATH to a Chrome/Chromium executable.'
		);
	}
	return found;
}

/** Launches a headless browser with an isolated, disposable profile. */
export async function launchHeadlessChrome({ viewport = { width: 1280, height: 900 }, profileName = 'chrome-profile' } = {}) {
	const executablePath = resolveChromiumPath();
	const userDataDir = path.resolve(process.cwd(), 'verify-artifacts', profileName);
	rmSync(userDataDir, { recursive: true, force: true });
	mkdirSync(userDataDir, { recursive: true });

	return launch({
		executablePath,
		headless: 'shell',
		userDataDir,
		protocolTimeout: 120_000,
		args: [
			// The verification sandbox forbids nested OS sandboxes; a disposable
			// throwaway profile keeps this safe and isolated from real browsers.
			'--no-sandbox',
			'--disable-gpu',
			'--disable-dev-shm-usage',
			'--no-first-run',
			'--no-default-browser-check',
			'--disable-background-networking',
			'--disable-sync',
			'--disable-extensions',
			'--hide-scrollbars',
			'--mute-audio'
		],
		defaultViewport: viewport
	});
}

/** Serves a directory over loopback HTTP on an ephemeral port. */
export function startStaticServer(rootDir) {
	const root = path.resolve(rootDir);

	const server = createServer((request, response) => {
		const requestUrl = new URL(request.url ?? '/', 'http://127.0.0.1');
		const relativePath = decodeURIComponent(requestUrl.pathname).replace(/^\/+/, '');
		let filePath = path.join(root, relativePath);

		if (!filePath.startsWith(root)) {
			response.writeHead(403).end('Forbidden');
			return;
		}

		if (existsSync(filePath) && statSync(filePath).isDirectory()) {
			filePath = path.join(filePath, 'index.html');
		}

		if (!existsSync(filePath)) {
			response.writeHead(404, { 'content-type': 'text/plain' }).end('Not found');
			return;
		}

		response.writeHead(200, {
			'content-type': MIME_TYPES[path.extname(filePath)] ?? 'application/octet-stream',
			'cache-control': 'no-store'
		});
		createReadStream(filePath).pipe(response);
	});

	return new Promise((resolve, reject) => {
		server.on('error', reject);
		server.listen(0, '127.0.0.1', () => {
			const address = server.address();
			resolve({
				origin: `http://127.0.0.1:${address.port}`,
				close: () =>
					new Promise((done) => {
						server.closeAllConnections?.();
						server.close(() => done());
					})
			});
		});
	});
}

/** Waits until a page-level promise resolves to a truthy value, or times out. */
export async function waitForWindowFlag(page, expression, timeout = 15000) {
	await page.waitForFunction(expression, { timeout, polling: 100 });
	return page.evaluate(expression);
}

/** Collects console errors and uncaught exceptions for the lifetime of a page. */
export function attachDiagnostics(page, sink) {
	page.on('console', (message) => {
		if (message.type() === 'error') sink.push(`console.error: ${message.text()}`);
		if (message.type() === 'warning' && /svelte|unhandled/i.test(message.text())) {
			sink.push(`console.warn: ${message.text()}`);
		}
	});
	page.on('pageerror', (error) => sink.push(`pageerror: ${error.message}`));
	// Surface the URL behind any 4xx/5xx so a failure is actionable without a
	// second debugging pass.
	page.on('response', (response) => {
		if (response.status() >= 400) {
			sink.push(`http ${response.status()}: ${response.url()}`);
		}
	});
	page.on('requestfailed', (request) => {
		const failure = request.failure();
		if (failure && !/net::ERR_ABORTED/.test(failure.errorText)) {
			sink.push(`requestfailed: ${request.url()} (${failure.errorText})`);
		}
	});
}