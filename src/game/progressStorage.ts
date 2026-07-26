import type { StateStorage } from 'zustand/middleware';

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

function readCookie(cookieName: string): string | null {
	const prefix = `${cookieName}=`;
	const cookie = document.cookie
		.split(';')
		.map((part) => part.trim())
		.find((part) => part.startsWith(prefix));
	if (!cookie) return null;

	try {
		return decodeURIComponent(cookie.slice(prefix.length));
	} catch {
		return null;
	}
}

function writeCookie(cookieName: string, value: string): void {
	const secure = window.location.protocol === 'https:' ? '; Secure' : '';
	// WebKit's Cookie Store API support is not broad enough for our iOS baseline.
	// biome-ignore lint/suspicious/noDocumentCookie: required for older iOS Safari
	document.cookie = `${cookieName}=${encodeURIComponent(value)}; Path=/; Max-Age=${ONE_YEAR_SECONDS}; SameSite=Lax${secure}`;
}

function deleteCookie(cookieName: string): void {
	const secure = window.location.protocol === 'https:' ? '; Secure' : '';
	// biome-ignore lint/suspicious/noDocumentCookie: required for older iOS Safari
	document.cookie = `${cookieName}=; Path=/; Max-Age=0; SameSite=Lax${secure}`;
}

/**
 * Keep a small install-transfer record in both localStorage and a cookie.
 *
 * iOS/iPadOS copies cookies into a newly installed Home Screen web app, but
 * deliberately does not copy localStorage. Reading the cookie only when the
 * new app has no local record transfers progress on its first launch without
 * making a cookie the primary store.
 */
export function createCookieBridgeStorage(cookieName: string): StateStorage {
	return {
		getItem: (name) => {
			const local = localStorage.getItem(name);
			if (local !== null) {
				// Backfill a transfer cookie for people who saved data before
				// this storage adapter shipped.
				writeCookie(cookieName, local);
				return local;
			}

			const transferred = readCookie(cookieName);
			if (transferred !== null) localStorage.setItem(name, transferred);
			return transferred;
		},
		setItem: (name, value) => {
			localStorage.setItem(name, value);
			writeCookie(cookieName, value);
		},
		removeItem: (name) => {
			localStorage.removeItem(name);
			deleteCookie(cookieName);
		},
	};
}

export const progressStorage = createCookieBridgeStorage('palisades-progress-v1');
export const basemapStorage = createCookieBridgeStorage('palisades-basemap-v1');
