import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { attachDiagnostics, launchHeadlessChrome } from './browser.mjs';

/**
 * End-to-end verification in headless Chrome.
 *
 * Boots the *built* application (adapter-node output), drives it with a real
 * Chromium instance, and asserts behaviour at the mobile/tablet/desktop matrix.
 * Any console error, page exception or failed request fails the run.
 */

const PORT = Number(process.env.VERIFY_PORT ?? 4188);
const ORIGIN = `http://127.0.0.1:${PORT}`;
const SCREENSHOT_DIR = path.resolve(process.cwd(), 'verify-artifacts/screens');

const ALL_SCENARIOS = await loadScenarios();

/** Viewport matrix from the specification (width x height). */
export const VIEWPORTS = [
	{ name: 'mobile-360', width: 360, height: 780 },
	{ name: 'mobile-390', width: 390, height: 844 },
	{ name: 'mobile-430', width: 430, height: 932 },
	{ name: 'tablet-768', width: 768, height: 1024 },
	{ name: 'laptop-1024', width: 1024, height: 800 },
	{ name: 'desktop-1440', width: 1440, height: 900 }
];

/**
 * Loads every scenario module from `scripts/verify/scenarios/`.
 * Each module default-exports an array of `{ name, run({ page, origin, reporter, viewports }) }`.
 */
async function loadScenarios() {
	const scenariosDir = path.resolve(process.cwd(), 'scripts/verify/scenarios');
	const files = readdirSync(scenariosDir)
		.filter((file) => file.endsWith('.mjs'))
		.sort();

	const scenarios = [];
	for (const file of files) {
		const module = await import(pathToFileURL(path.join(scenariosDir, file)).href);
		scenarios.push(...module.default);
	}
	return scenarios;
}

async function startServer() {
	if (!existsSync(path.resolve(process.cwd(), 'build/index.js'))) {
		throw new Error('Production build missing. Run `pnpm run build` first.');
	}

	const child = spawn(process.execPath, ['build'], {
		env: {
			...process.env,
			PORT: String(PORT),
			HOST: '127.0.0.1',
			ORIGIN,
			BODY_SIZE_LIMIT: '4M'
		},
		stdio: ['ignore', 'pipe', 'pipe']
	});

	let output = '';
	child.stdout.on('data', (chunk) => (output += chunk.toString()));
	child.stderr.on('data', (chunk) => (output += chunk.toString()));

	const deadline = Date.now() + 30_000;
	while (Date.now() < deadline) {
		if (child.exitCode !== null) {
			throw new Error(`Server exited early (code ${child.exitCode}):\n${output}`);
		}
		try {
			const response = await fetch(ORIGIN, { signal: AbortSignal.timeout(2000) });
			if (response.ok) return child;
		} catch {
			// not listening yet
		}
		await delay(250);
	}

	child.kill('SIGTERM');
	throw new Error(`Server did not become ready within 30s:\n${output}`);
}

function createReporter() {
	const failures = [];
	let passed = 0;

	return {
		expect(condition, message) {
			if (condition) {
				passed++;
			} else {
				failures.push(message);
			}
		},
		expectEqual(actual, expected, message) {
			this.expect(
				Object.is(actual, expected),
				`${message} — expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}`
			);
		},
		failures,
		get passed() {
			return passed;
		}
	};
}

async function main() {
	mkdirSync(SCREENSHOT_DIR, { recursive: true });

	const server = await startServer();
	const browser = await launchHeadlessChrome();
	const diagnostics = [];
	const reporter = createReporter();

	let exitCode = 0;

	try {
		for (const scenario of ALL_SCENARIOS) {
			const page = await browser.newPage();
			const scenarioDiagnostics = [];
			attachDiagnostics(page, scenarioDiagnostics);

			try {
				await scenario.run({ page, origin: ORIGIN, reporter, viewports: VIEWPORTS });
			} catch (error) {
				const url = page.url();
				reporter.expect(false, `${scenario.name}: threw ${error.message} (at ${url})`);
			}

			// A scenario that itself asserts "no console errors" already covers this;
			// otherwise any page error still fails the whole run.
			if (scenario.name !== 'phase1/no-console-errors') {
				for (const diagnostic of scenarioDiagnostics) {
					reporter.expect(false, `${scenario.name}: ${diagnostic}`);
				}
			}
			diagnostics.push(...scenarioDiagnostics);

			await page.close();
			console.log(`  • ${scenario.name}`);
		}

		console.log(`\n[e2e] ${reporter.passed} assertions passed, ${reporter.failures.length} failed`);

		if (reporter.failures.length > 0) {
			exitCode = 1;
			console.error('[e2e] failures:');
			for (const failure of reporter.failures) {
				console.error(`  ✗ ${failure}`);
			}
		} else {
			console.log('[e2e] headless Chrome end-to-end verification passed\n');
		}
	} catch (error) {
		exitCode = 1;
		console.error('[e2e] run aborted:', error);
	} finally {
		await browser.close();
		server.kill('SIGTERM');
		await delay(200);
	}

	process.exit(exitCode);
}

main();