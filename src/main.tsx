import 'leaflet/dist/leaflet.css';
import './index.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';

const rootEl = document.getElementById('root');
if (!rootEl) throw new Error('Missing #root element');

createRoot(rootEl).render(
	<StrictMode>
		<App />
	</StrictMode>,
);

if ('serviceWorker' in navigator) {
	// controllerchange also fires when a first-visit page gains its very first
	// controller via clients.claim() — that is not an update, so remember
	// whether we started controlled and only treat changes as updates if so.
	const hadController = Boolean(navigator.serviceWorker.controller);

	window.addEventListener('load', () => {
		// Always check the worker script itself against the network. The worker
		// handles runtime caching; an HTTP-cached old worker must not delay an
		// app-shell cache upgrade.
		navigator.serviceWorker
			.register(`${import.meta.env.BASE_URL}sw.js`, { updateViaCache: 'none' })
			.then((registration) => {
				// An installed PWA can be resumed from the background for days
				// without navigating, which is what normally triggers a worker
				// re-fetch. Check for a new build whenever we come back.
				document.addEventListener('visibilitychange', () => {
					if (document.visibilityState === 'visible') registration.update().catch(() => {});
				});
			})
			.catch(() => {});
	});

	// When a new worker takes control, pick up the new build by reloading —
	// but only once the app is in the background, never while someone is
	// using it. The flag intentionally stays set until a reload succeeds
	// (the page unloads), so an interrupted reload retries next time.
	let reloadPending = false;
	navigator.serviceWorker.addEventListener('controllerchange', () => {
		if (!hadController || reloadPending) return;
		reloadPending = true;
		if (document.visibilityState === 'hidden') {
			window.location.reload();
			return;
		}
		document.addEventListener('visibilitychange', () => {
			if (reloadPending && document.visibilityState === 'hidden') window.location.reload();
		});
	});
}
