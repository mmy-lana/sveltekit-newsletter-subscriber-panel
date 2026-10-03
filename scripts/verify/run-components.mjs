import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

/**
 * Node runner for the SSR component suite.
 * Also writes the gallery document consumed by `chrome-components.mjs`, so the
 * exact same markup is measured inside a real browser.
 */

const cwd = process.cwd();
const artifactsDir = path.resolve(cwd, 'verify-artifacts');
mkdirSync(artifactsDir, { recursive: true });

const suitePath = path.resolve(artifactsDir, 'component-suite.js');
const { runComponentSuite } = await import(pathToFileURL(suitePath).href);

const summary = runComponentSuite();

/** Locates the hashed stylesheet emitted by the production build. */
function readProductionCss() {
	const candidates = [
		path.resolve(cwd, '.svelte-kit/output/client/_app/immutable/assets'),
		path.resolve(cwd, '.svelte-kit/output/server/_app/immutable/assets')
	];

	for (const assetsDir of candidates) {
		try {
			const cssFile = readdirSync(assetsDir).find((file) => file.endsWith('.css'));
			if (cssFile) return readFileSync(path.join(assetsDir, cssFile), 'utf8');
		} catch {
			// try the next candidate
		}
	}

	return '';
}

const css = readProductionCss();

const galleryHtml = `<!doctype html>
<html lang="en">
	<head>
		<meta charset="utf-8" />
		<meta name="viewport" content="width=device-width, initial-scale=1" />
		<title>SNSP component gallery</title>
		<style>${css}</style>
	</head>
	<body class="bg-paper text-stone-900 font-sans p-6">
		${summary.gallery
			.map(
				(section) => `
		<section data-section="${section.title}">
			<h2 class="text-xs font-mono uppercase tracking-wider text-stone-500 mb-3">${section.title}</h2>
			<div class="space-y-3">${section.html}</div>
		</section>`
			)
			.join('\n')}
	</body>
</html>
`;

writeFileSync(path.join(artifactsDir, 'component-gallery.html'), galleryHtml, 'utf8');

console.log(`\n[components] ${summary.passed}/${summary.total} primitives verified`);
console.log(`[components] gallery written with ${css.length} bytes of production CSS`);

if (summary.failed > 0) {
	console.error(`[components] ${summary.failed} failing primitive(s):`);
	for (const failure of summary.failures) {
		console.error(`  ✗ ${failure}`);
	}
	process.exit(1);
}

console.log('[components] all primitive checks passed\n');