import tailwindcss from '@tailwindcss/vite';
import basicSsl from '@vitejs/plugin-basic-ssl';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
	// Relative base so the build works at any mount path (GitHub Pages
	// serves this under /palisadestrails/).
	base: './',
	// HTTPS + LAN binding so a phone on the same network can load it and use
	// geolocation (a secure origin is required off localhost).
	plugins: [react(), tailwindcss(), basicSsl()],
	server: { host: true },
	preview: { host: true },
});
