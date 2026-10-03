import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { svelte, vitePreprocess } from '@sveltejs/vite-plugin-svelte';
import { defineConfig } from 'vite';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

/**
 * Builds the component suite as an SSR bundle so every UI primitive can be
 * server-rendered and asserted against real markup.
 */
export default defineConfig({
	root,
	plugins: [
		svelte({
			configFile: false,
			preprocess: vitePreprocess()
		})
	],
	resolve: {
		alias: {
			'#lib': path.resolve(root, 'src/lib')
		}
	},
	ssr: {
		noExternal: ['svelte']
	},
	build: {
		ssr: true,
		outDir: path.resolve(root, 'verify-artifacts'),
		emptyOutDir: false,
		minify: false,
		target: 'es2022',
		lib: {
			entry: path.resolve(root, 'scripts/verify/component-suite.ts'),
			formats: ['es'],
			fileName: () => 'component-suite.js'
		}
	}
});