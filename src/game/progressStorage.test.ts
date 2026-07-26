import { beforeEach, describe, expect, it } from 'vitest';
import { basemapStorage, progressStorage } from './progressStorage';

const KEY = 'palisades-trails/v1';

beforeEach(() => {
	progressStorage.removeItem(KEY);
	basemapStorage.removeItem('palisades-basemap');
});

describe('progressStorage', () => {
	it('backfills a transfer cookie from existing local progress', () => {
		const progress = '{"state":{"collected":{"big-pine":"now"}},"version":0}';
		localStorage.setItem(KEY, progress);

		expect(progressStorage.getItem(KEY)).toBe(progress);
		expect(decodeURIComponent(document.cookie)).toContain(progress);
	});

	it('restores copied cookie progress into an empty installed app store', () => {
		const progress = '{"state":{"collected":{"big-pine":"now"}},"version":0}';
		progressStorage.setItem(KEY, progress);
		localStorage.clear();

		expect(progressStorage.getItem(KEY)).toBe(progress);
		expect(localStorage.getItem(KEY)).toBe(progress);
	});

	it('prefers an existing local record over a cookie', () => {
		progressStorage.setItem(KEY, 'cookie progress');
		localStorage.setItem(KEY, 'newer local progress');

		expect(progressStorage.getItem(KEY)).toBe('newer local progress');
	});

	it('uses a separate cookie to transfer the basemap setting', () => {
		basemapStorage.setItem('palisades-basemap', 'OpenTopoMap');
		localStorage.clear();

		expect(basemapStorage.getItem('palisades-basemap')).toBe('OpenTopoMap');
	});
});
