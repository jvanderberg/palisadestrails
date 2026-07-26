import { beforeEach, describe, expect, it, vi } from 'vitest';
import { basemapStorage, progressStorage } from '../game/progressStorage';
import { useGame } from '../game/store';
import { deleteMarkerPhoto, loadMarkerPhoto, saveMarkerPhoto } from '../personal/photos';
import { usePersonal } from '../personal/store';
import { createBackupFile, readBackupFile, restoreBackup, summarizeBackup } from './backup';

const photoStore = vi.hoisted(() => new Map<string, Blob>());
vi.mock('../personal/photos', () => ({
	deleteMarkerPhoto: async (id: string) => {
		photoStore.delete(id);
	},
	loadMarkerPhoto: async (id: string) => photoStore.get(id),
	saveMarkerPhoto: async (id: string, photo: Blob) => {
		photoStore.set(id, photo);
		return id;
	},
}));

const GAME_KEY = 'palisades-trails/v1';

beforeEach(async () => {
	progressStorage.removeItem(GAME_KEY);
	basemapStorage.removeItem('palisades-basemap');
	localStorage.clear();
	useGame.setState({ name: '', collected: {}, unlocked: false });
	usePersonal.setState({ hikes: [], markers: [], activeHikeId: null });
	await deleteMarkerPhoto('marker-photo');
});

describe('offline backup', () => {
	it('round-trips and merges mastery, hikes, markers, and settings', async () => {
		useGame.setState({
			name: 'Ada',
			collected: { 'big-pine': '2026-07-20T12:00:00.000Z' },
			unlocked: true,
		});
		usePersonal.setState({
			activeHikeId: null,
			hikes: [
				{
					id: 'hike-1',
					name: 'Morning hike',
					startedAt: 1_000,
					finishedAt: 2_000,
					status: 'finished',
					elapsedMs: 1_000,
					activeSince: null,
					segments: [[{ lat: 42, lon: -86, accuracy: 5, timestamp: 1_000 }]],
				},
			],
			markers: [
				{
					id: 'marker-1',
					name: 'Big tree',
					lat: 42,
					lon: -86,
					createdAt: 1_000,
					updatedAt: 1_000,
					hasPhoto: false,
				},
			],
		});
		localStorage.setItem('palisades-basemap', 'OpenTopoMap');

		const file = await createBackupFile(Date.parse('2026-07-26T00:00:00.000Z'));
		expect(file.name).toBe('palisades-trails-backup-2026-07-26.zip');

		progressStorage.removeItem(GAME_KEY);
		basemapStorage.removeItem('palisades-basemap');
		localStorage.clear();
		useGame.setState({ name: '', collected: {}, unlocked: false });
		usePersonal.setState({ hikes: [], markers: [], activeHikeId: null });

		const prepared = await readBackupFile(file);
		expect(summarizeBackup(prepared)).toMatchObject({
			collected: 1,
			hikes: 1,
			markers: 1,
			photos: 0,
		});
		await restoreBackup(prepared);

		expect(useGame.getState()).toMatchObject({
			name: 'Ada',
			collected: { 'big-pine': '2026-07-20T12:00:00.000Z' },
			unlocked: true,
		});
		expect(usePersonal.getState().hikes[0].name).toBe('Morning hike');
		expect(usePersonal.getState().markers[0].name).toBe('Big tree');
		expect(localStorage.getItem('palisades-basemap')).toBe('OpenTopoMap');
	});

	it('rejects a file that is not a backup archive', async () => {
		const file = new File(['not a zip'], 'notes.txt', { type: 'text/plain' });
		await expect(readBackupFile(file)).rejects.toThrow('not a readable backup');
	});

	it('includes marker photos from IndexedDB and restores them', async () => {
		usePersonal.setState({
			activeHikeId: null,
			hikes: [],
			markers: [
				{
					id: 'marker-photo',
					name: 'Photo marker',
					lat: 42,
					lon: -86,
					createdAt: 1_000,
					updatedAt: 1_000,
					hasPhoto: true,
				},
			],
		});
		await saveMarkerPhoto('marker-photo', new Blob(['photo'], { type: 'image/jpeg' }));

		const file = await createBackupFile(Date.parse('2026-07-26T00:00:00.000Z'));
		await deleteMarkerPhoto('marker-photo');
		usePersonal.setState({ hikes: [], markers: [], activeHikeId: null });

		const prepared = await readBackupFile(file);
		expect(summarizeBackup(prepared).photos).toBe(1);
		expect(prepared.photos.get('marker-photo')).toMatchObject({ size: 5, type: 'image/jpeg' });
		await restoreBackup(prepared);

		const restored = await loadMarkerPhoto('marker-photo');
		expect(restored).toBeDefined();
		expect(usePersonal.getState().markers[0]).toMatchObject({
			id: 'marker-photo',
			hasPhoto: true,
		});
	});
});
