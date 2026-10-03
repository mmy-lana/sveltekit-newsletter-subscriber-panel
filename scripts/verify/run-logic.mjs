import { pathToFileURL } from 'node:url';
import path from 'node:path';

/**
 * Node runner for the deterministic logic suite.
 * Mirrors the headless Chrome runner so a failure can be reproduced in either
 * environment with identical output.
 */

const suitePath = path.resolve(process.cwd(), 'verify-artifacts/logic-suite.js');
const { runSuite } = await import(pathToFileURL(suitePath).href);
const summary = runSuite();

console.log(`\n[logic] ${summary.passed}/${summary.total} assertions groups passed`);

if (summary.failed > 0) {
	console.error(`[logic] ${summary.failed} failing group(s):`);
	for (const failure of summary.failures) {
		console.error(`  ✗ ${failure}`);
	}
	process.exit(1);
}

console.log('[logic] all pure-domain checks passed\n');