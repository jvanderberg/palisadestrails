import { describe, expect, it } from 'vitest';
import type { Collectible } from '../data/collectibles';
import { annotate } from './proximity';

const POIS: Collectible[] = [
	{ id: 'a', name: 'A', emoji: '🅰️', lat: 42.3, lon: -86.3, hint: '' },
	{ id: 'b', name: 'B', emoji: '🅱️', lat: 42.31, lon: -86.31, hint: '' },
];

describe('annotate', () => {
	it('marks everything locked with unknown position', () => {
		const info = annotate(POIS, {}, null, 60);
		expect(info.map((i) => i.state)).toEqual(['locked', 'locked']);
		expect(info[0].distance).toBeNull();
	});

	it('marks a POI near when within the radius', () => {
		// ~9 m north of A -> within 60 m.
		const info = annotate(POIS, {}, { lat: 42.30008, lon: -86.3, accuracy: 5 }, 60);
		expect(info[0].state).toBe('near');
		expect(info[1].state).toBe('locked');
		expect(info[0].distance).toBeLessThan(60);
	});

	it('respects the radius boundary', () => {
		const near = annotate(POIS, {}, { lat: 42.3, lon: -86.3, accuracy: 5 }, 60);
		expect(near[0].state).toBe('near');
		const tight = annotate(POIS, {}, { lat: 42.30008, lon: -86.3, accuracy: 5 }, 5);
		expect(tight[0].state).toBe('locked');
	});

	it('keeps collected POIs collected even when far away', () => {
		const info = annotate(POIS, { a: '2026-07-15T00:00:00Z' }, null, 60);
		expect(info[0].state).toBe('collected');
	});
});
