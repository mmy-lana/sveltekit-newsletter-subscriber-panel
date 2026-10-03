import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

/**
 * Builds the deterministic logic suite into a browser-safe ES module.
 *
 * The suite is shared by the Node runner (`run-logic.mjs`) and the headless
 * Chrome runner (`chrome-logic.mjs`), so every pure rule in `#lib/utils` and
 * `#lib/storage` is verified twice — once in Node, once inside a real browser.
 */
export default defineConfig({
	root,
	resolve: {
		alias: {
			'#lib': path.resolve(root, 'src/lib')
		}
	},
	build: {
		outDir: path.resolve(root, 'verify-artifacts'),
		emptyOutDir: false,
		minify: false,
		target: 'es2022',
		lib: {
			entry: path.resolve(root, 'scripts/verify/logic-suite.ts'),
			formats: ['es'],
			fileName: () => 'logic-suite.js'
		}
	}
});