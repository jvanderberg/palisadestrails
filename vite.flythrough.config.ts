import { resolve } from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// The 3D fly-through is a separate web app: its page and baked terrain live
// in tools/flythrough/, its code in src/flythrough/, and it reads trail and
// hike data straight from src/data so editor changes flow through.
//
// It ships with the main site at /3dtour/: `npm run build` builds the PWA into
// dist/ first (which empties dist/), then this app into dist/3dtour/.
const root = import.meta.dirname;

export default defineConfig({
	root: resolve(root, 'tools/flythrough'),
	base: './',
	plugins: [react()],
	// index.html loads /src/flythrough/main.tsx; map /src to the repo's src.
	resolve: { alias: [{ find: /^\/src\//, replacement: `${resolve(root, 'src')}/` }] },
	server: { host: true, port: 4175, strictPort: true, fs: { allow: [root] } },
	preview: { host: true, port: 4176 },
	build: {
		outDir: resolve(root, 'dist/3dtour'),
		emptyOutDir: true,
		chunkSizeWarningLimit: 1200,
	},
});
