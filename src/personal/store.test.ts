import { beforeEach, describe, expect, it, vi } from 'vitest';
import { personalHikeDistanceMetres, personalHikeElapsedMs, usePersonal } from './store';

beforeEach(() => {
	localStorage.clear();
	usePersonal.setState({ hikes: [], markers: [], activeHikeId: null });
	vi.restoreAllMocks();
});

describe('personal hike recording', () => {
	it('starts, records, pauses, resumes in a new segment, finishes, and persists', () => {
		vi.spyOn(crypto, 'randomUUID').mockReturnValue('00000000-0000-4000-8000-000000000001');
		const store = usePersonal.getState();
		const id = store.startHike({ lat: 42, lon: -86, accuracy: 5 }, 1_000);
		expect(id).toBe('hike-00000000-0000-4000-8000-000000000001');
		expect(store.addTrackPoint({ lat: 42, lon: -85.9999, accuracy: 5, timestamp: 6_000 })).toBe(
			true,
		);
		store.pauseHike(11_000);
		store.resumeHike({ lat: 42, lon: -85.9998, accuracy: 6 }, 21_000);
		store.finishHike({ lat: 42, lon: -85.9997, accuracy: 6 }, 31_000);

		const hike = usePersonal.getState().hikes[0];
		expect(hike.status).toBe('finished');
		expect(hike.segments).toHaveLength(2);
		expect(personalHikeElapsedMs(hike, 99_000)).toBe(20_000);
		expect(personalHikeDistanceMetres(hike)).toBeGreaterThan(10);
		expect(localStorage.getItem('palisades-personal/v1')).toContain(hike.id);
	});

	it('rejects inaccurate fixes and avoids connecting long GPS gaps', () => {
		const store = usePersonal.getState();
		store.startHike({ lat: 42, lon: -86, accuracy: 5 }, 1_000);
		expect(store.addTrackPoint({ lat: 42.1, lon: -86.1, accuracy: 150, timestamp: 6_000 })).toBe(
			false,
		);
		expect(store.addTrackPoint({ lat: 42.001, lon: -86.001, accuracy: 5, timestamp: 30_000 })).toBe(
			true,
		);
		expect(usePersonal.getState().hikes[0].segments).toHaveLength(2);
	});

	it('renames and deletes a completed hike', () => {
		const store = usePersonal.getState();
		const id = store.startHike({ lat: 42, lon: -86, accuracy: 5 }, 1_000);
		expect(id).not.toBeNull();
		store.finishHike(null, 2_000);
		store.renameHike(id as string, 'Morning ridge walk');
		expect(usePersonal.getState().hikes[0].name).toBe('Morning ridge walk');
		store.renameHike(id as string, 'Morning ridge walk with friends');
		expect(usePersonal.getState().hikes[0].name).toBe('Morning ridge walk with friends');
		store.deleteHike(id as string);
		expect(usePersonal.getState().hikes).toEqual([]);
	});
});

describe('personal markers', () => {
	it('creates, edits, and deletes marker metadata without storing photo bytes', () => {
		const store = usePersonal.getState();
		const id = store.addMarker('Fallen oak', { lat: 42, lon: -86, accuracy: 6 }, true, 1_000);
		store.updateMarker(id, { name: 'Big fallen oak', hasPhoto: false }, 2_000);
		expect(usePersonal.getState().markers[0]).toMatchObject({
			name: 'Big fallen oak',
			hasPhoto: false,
		});
		expect(localStorage.getItem('palisades-personal/v1')).not.toContain('data:image');
		store.deleteMarker(id);
		expect(usePersonal.getState().markers).toEqual([]);
	});
});
