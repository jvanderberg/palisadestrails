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
	window.addEventListener('load', () => {
		// Always check the worker script itself against the network. The worker
		// handles runtime caching; an HTTP-cached old worker must not delay an
		// app-shell cache upgrade.
		navigator.serviceWorker
			.register(`${import.meta.env.BASE_URL}sw.js`, { updateViaCache: 'none' })
			.catch(() => {});
	});
}
