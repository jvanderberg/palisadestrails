// Minimal offline cache. Vite fingerprints the app bundle, so we cache at
// runtime (stale-while-revalidate for same-origin, cache-first for OSM
// tiles) rather than precaching a hard-coded list.
const APP_CACHE = 'palisades-app-v3';
const TILE_CACHE = 'palisades-tiles-v3';

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => {
	event.waitUntil(
		caches
			.keys()
			.then((keys) =>
				Promise.all(
					keys.filter((k) => k !== APP_CACHE && k !== TILE_CACHE).map((k) => caches.delete(k)),
				),
			)
			.then(() => self.clients.claim()),
	);
});

self.addEventListener('fetch', (event) => {
	const { request } = event;
	if (request.method !== 'GET') return;
	const url = new URL(request.url);

	// Basemap tiles (OSM / OpenTopoMap / USGS): cache-first, keep offline
	// copies of visited areas.
	const isTile =
		/tile\.openstreetmap\.org$|tile\.opentopomap\.org$/.test(url.hostname) ||
		url.hostname === 'basemap.nationalmap.gov';
	if (isTile) {
		event.respondWith(
			caches.open(TILE_CACHE).then(async (cache) => {
				const hit = await cache.match(request);
				if (hit) return hit;
				const res = await fetch(request);
				if (res.ok) cache.put(request, res.clone());
				return res;
			}),
		);
		return;
	}

	if (url.origin !== self.location.origin) return;

	// Navigations (the HTML page): network-first, so a fresh build always
	// loads and we never serve an index that points at deleted JS chunks.
	// Fall back to cache only when offline.
	if (request.mode === 'navigate') {
		event.respondWith(
			fetch(request)
				.then((res) => {
					caches.open(APP_CACHE).then((c) => c.put(request, res.clone()));
					return res;
				})
				.catch(() => caches.match(request).then((hit) => hit ?? Response.error())),
		);
		return;
	}

	// Hashed assets: stale-while-revalidate (safe — filenames are fingerprinted).
	event.respondWith(
		caches.open(APP_CACHE).then(async (cache) => {
			const hit = await cache.match(request);
			const network = fetch(request)
				.then((res) => {
					if (res.ok) cache.put(request, res.clone());
					return res;
				})
				.catch(() => hit);
			return hit || network;
		}),
	);
});
