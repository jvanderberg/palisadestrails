import { describe, expect, it } from 'vitest';
import { COLLECTIBLES } from '../data/collectibles';
import { FERN_LOOP_WAYPOINTS } from '../data/fernLoopWaypoints';
import { PLACES, placeFromSearch, resolvePlace } from './places';

describe('place registry', () => {
	it('covers p0001–p0031 with no gaps', () => {
		expect(PLACES.size).toBe(31);
		for (let n = 1; n <= 31; n++) {
			expect(PLACES.has(`p${String(n).padStart(4, '0')}`)).toBe(true);
		}
	});

	it('maps p0001–p0018 to existing POIs in data order', () => {
		expect(COLLECTIBLES).toHaveLength(18);
		const first = resolvePlace('p0001');
		const last = resolvePlace('p0018');
		expect(first).toMatchObject({ kind: 'poi', poi: { id: COLLECTIBLES[0].id } });
		expect(last).toMatchObject({ kind: 'poi', poi: { id: COLLECTIBLES[17].id } });
	});

	it('maps p0019–p0031 to Fern Loop waypoints 1–13 in display order', () => {
		expect(FERN_LOOP_WAYPOINTS).toHaveLength(13);
		FERN_LOOP_WAYPOINTS.forEach((wp, i) => {
			expect(wp.number).toBe(i + 1);
			expect(wp.placeId).toBe(`p${String(19 + i).padStart(4, '0')}`);
			const place = resolvePlace(wp.placeId);
			expect(place).toMatchObject({ kind: 'fern-loop', waypoint: { number: wp.number } });
		});
	});

	it('fern loop waypoints are not collectable POIs', () => {
		const poiIds = new Set(COLLECTIBLES.map((p) => p.id));
		for (const wp of FERN_LOOP_WAYPOINTS) expect(poiIds.has(wp.placeId)).toBe(false);
	});

	it('resolves the ?p= query parameter case-insensitively', () => {
		expect(placeFromSearch('?p=p0019')).toMatchObject({ placeId: 'p0019' });
		expect(placeFromSearch('?p=P0019')).toMatchObject({ placeId: 'p0019' });
		expect(placeFromSearch('?p=p9999')).toBeNull();
		expect(placeFromSearch('?other=1')).toBeNull();
		expect(placeFromSearch('')).toBeNull();
	});
});
