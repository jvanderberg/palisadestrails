import tailwindcss from '@tailwindcss/vite';
import basicSsl from '@vitejs/plugin-basic-ssl';
import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';

// Node 22.21's http server calls `server.shouldUpgradeCallback(req)` on every
// WebSocket upgrade. A normal Node server defines it as an own property
// (`function () { return this.listenerCount('upgrade') > 0 }`), but the dev
// server this project ends up with reaches that path missing the method — so
// any upgrade, including the HMR client's on page load, throws
// "server.shouldUpgradeCallback is not a function" and crashes the whole
// process. (Plain GETs survive, which is why `curl /` looks fine while the
// browser kills it.) Restore Node's default so HMR works and the server stays
// up. Remove once Node/Vite no longer need it.
interface UpgradableServer {
	shouldUpgradeCallback?: (req: unknown) => boolean;
	listenerCount(event: string): number;
}
function restoreUpgradeCallback(): Plugin {
	return {
		name: 'restore-upgrade-callback',
		configureServer(server) {
			const s = server.httpServer as unknown as UpgradableServer | null;
			if (s && typeof s.shouldUpgradeCallback !== 'function') {
				s.shouldUpgradeCallback = function (this: UpgradableServer) {
					return this.listenerCount('upgrade') > 0;
				};
			}
		},
	};
}

export default defineConfig({
	// Relative base so the build works at any mount path (GitHub Pages
	// serves this under /palisadestrails/).
	base: './',
	// HTTPS + LAN binding so a phone on the same network can load it and use
	// geolocation (a secure origin is required off localhost).
	plugins: [react(), tailwindcss(), basicSsl(), restoreUpgradeCallback()],
	server: { host: true },
	preview: { host: true },
});
