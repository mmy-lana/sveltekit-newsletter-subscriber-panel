import adapter from '@sveltejs/adapter-node';
import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';
import { defineConfig } from 'vite';

/**
 * SvelteKit 3 configuration lives directly on the Vite plugin:
 * `svelte.config.js` is no longer read by the framework.
 */
export default defineConfig({
	plugins: [tailwindcss(), sveltekit({ adapter: adapter(), preprocess: vitePreprocess() })],
	server: {
		port: 5173,
		strictPort: true
	},
	preview: {
		port: 4173,
		strictPort: true
	}
});