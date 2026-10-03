import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import {
	attachDiagnostics,
	launchHeadlessChrome,
	resolveChromiumPath,
	startStaticServer
} from './browser.mjs';

/**
 * Executes the deterministic logic suite inside a real headless Chrome page.
 *
 * The suite bundle is served over loopback HTTP (module scripts are blocked on
 * file://) and evaluated in the page, proving the pure domain layer behaves
 * identically outside Node.
 */

const artifactsDir = path.resolve(process.cwd(), 'verify-artifacts');
mkdirSync(artifactsDir, { recursive: true });

const runnerHtml = `<!doctype html>
<html lang="en">
	<head>
		<meta charset="utf-8" />
		<title>SNSP logic suite</title>
	</head>
	<body>
		<pre id="output">running…</pre>
		<script type="module">
			import { runSuite } from '/logic-suite.js';

			const startedAt = performance.now();
			const summary = await runSuite();
			summary.durationMs = Math.round(performance.now() - startedAt);
			window.__LOGIC_RESULT__ = summary;
			document.getElementById('output').textContent = JSON.stringify(summary, null, 2);
		</script>
	</body>
</html>
`;

writeFileSync(path.join(artifactsDir, 'logic-runner.html'), runnerHtml, 'utf8');

const server = await startStaticServer(artifactsDir);
const diagnostics = [];
const browser = await launchHeadlessChrome();
let exitCode = 0;

try {
	const page = await browser.newPage();
	attachDiagnostics(page, diagnostics);

	await page.goto(`${server.origin}/logic-runner.html`, { waitUntil: 'load' });
	await page.waitForFunction(() => Boolean(window.__LOGIC_RESULT__), { timeout: 20000 });

	const summary = await page.evaluate(() => window.__LOGIC_RESULT__);

	console.log(`\n[chrome] binary: ${resolveChromiumPath()}`);
	console.log(`[chrome] user agent: ${await browser.version()}`);
	console.log(`[chrome] ${summary.passed}/${summary.total} logic groups passed in ${summary.durationMs}ms`);

	if (summary.failed > 0) {
		exitCode = 1;
		console.error(`[chrome] ${summary.failed} failing group(s):`);
		for (const failure of summary.failures) {
			console.error(`  ✗ ${failure}`);
		}
	}

	// A blank page that logs errors would mask real problems: assert a clean console.
	if (diagnostics.length > 0) {
		exitCode = 1;
		console.error('[chrome] browser diagnostics reported problems:');
		for (const diagnostic of diagnostics) {
			console.error(`  ! ${diagnostic}`);
		}
	}

	await page.screenshot({ path: path.join(artifactsDir, 'phase1-logic-suite.png'), fullPage: true });
} catch (error) {
	exitCode = 1;
	console.error('[chrome] logic suite execution failed:', error);
} finally {
	await browser.close();
	await server.close();
}

if (exitCode === 0) {
	console.log('[chrome] headless verification passed\n');
}

process.exit(exitCode);