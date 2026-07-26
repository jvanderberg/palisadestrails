import { strFromU8, strToU8, unzip, zip } from 'fflate';
import { basemapStorage } from '../game/progressStorage';
import { useGame } from '../game/store';
import { loadMarkerPhoto, saveMarkerPhoto } from '../personal/photos';
import {
	type PersonalHike,
	type PersonalMarker,
	personalHikeElapsedMs,
	usePersonal,
} from '../personal/store';

const FORMAT = 'palisades-trails-backup';
const VERSION = 1;
const BASEMAP_KEY = 'palisades-basemap';
const MAX_BACKUP_BYTES = 100 * 1024 * 1024;

interface BackupPhoto {
	markerId: string;
	path: string;
	type: string;
}

interface BackupManifest {
	format: typeof FORMAT;
	version: typeof VERSION;
	exportedAt: string;
	game: {
		name: string;
		collected: Record<string, string>;
		unlocked: boolean;
	};
	personal: {
		hikes: PersonalHike[];
		markers: PersonalMarker[];
	};
	settings: {
		basemap: string | null;
	};
	photos: BackupPhoto[];
}

export interface PreparedBackup {
	manifest: BackupManifest;
	photos: Map<string, Blob>;
}

export interface BackupSummary {
	collected: number;
	hikes: number;
	markers: number;
	photos: number;
	exportedAt: string;
}

function zipFiles(files: Record<string, Uint8Array>): Promise<Uint8Array> {
	return new Promise((resolve, reject) => {
		zip(files, { level: 6 }, (error, data) => {
			if (error) reject(error);
			else resolve(data);
		});
	});
}

function unzipFiles(data: Uint8Array): Promise<Record<string, Uint8Array>> {
	return new Promise((resolve, reject) => {
		unzip(data, (error, files) => {
			if (error) reject(error);
			else resolve(files);
		});
	});
}

function copyBuffer(data: Uint8Array): ArrayBuffer {
	const copy = new Uint8Array(data.byteLength);
	copy.set(data);
	return copy.buffer;
}

async function readBlob(blob: Blob): Promise<Uint8Array> {
	if (typeof blob.arrayBuffer === 'function') return new Uint8Array(await blob.arrayBuffer());
	if (typeof FileReader !== 'undefined') {
		try {
			return await new Promise((resolve, reject) => {
				const reader = new FileReader();
				reader.onload = () => resolve(new Uint8Array(reader.result as ArrayBuffer));
				reader.onerror = () =>
					reject(reader.error ?? new Error('Could not read the selected file.'));
				reader.readAsArrayBuffer(blob);
			});
		} catch {
			// Some test/browser Blob implementations are only readable through Response.
		}
	}
	if (typeof Response !== 'undefined')
		return new Uint8Array(await new Response(blob).arrayBuffer());
	throw new Error('Could not read the selected file.');
}

function pauseForBackup(hike: PersonalHike, now: number): PersonalHike {
	if (hike.status !== 'recording') return structuredClone(hike);
	return {
		...structuredClone(hike),
		status: 'paused',
		elapsedMs: personalHikeElapsedMs(hike, now),
		activeSince: null,
	};
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
	return typeof value === 'number' && Number.isFinite(value);
}

function isTrackPoint(value: unknown): boolean {
	return (
		isRecord(value) &&
		isFiniteNumber(value.lat) &&
		isFiniteNumber(value.lon) &&
		isFiniteNumber(value.accuracy) &&
		isFiniteNumber(value.timestamp)
	);
}

function isHike(value: unknown): value is PersonalHike {
	if (!isRecord(value)) return false;
	return (
		typeof value.id === 'string' &&
		typeof value.name === 'string' &&
		isFiniteNumber(value.startedAt) &&
		(value.finishedAt === null || isFiniteNumber(value.finishedAt)) &&
		(value.status === 'recording' || value.status === 'paused' || value.status === 'finished') &&
		isFiniteNumber(value.elapsedMs) &&
		(value.activeSince === null || isFiniteNumber(value.activeSince)) &&
		Array.isArray(value.segments) &&
		value.segments.every(
			(segment) => Array.isArray(segment) && segment.every((point) => isTrackPoint(point)),
		)
	);
}

function isMarker(value: unknown): value is PersonalMarker {
	if (!isRecord(value)) return false;
	return (
		typeof value.id === 'string' &&
		typeof value.name === 'string' &&
		isFiniteNumber(value.lat) &&
		isFiniteNumber(value.lon) &&
		isFiniteNumber(value.createdAt) &&
		isFiniteNumber(value.updatedAt) &&
		typeof value.hasPhoto === 'boolean'
	);
}

function parseManifest(value: unknown): BackupManifest {
	if (!isRecord(value) || value.format !== FORMAT || value.version !== VERSION)
		throw new Error('This is not a supported Palisades Trails backup.');
	if (!isRecord(value.game) || !isRecord(value.personal) || !isRecord(value.settings))
		throw new Error('The backup is missing required data.');

	const collected = value.game.collected;
	if (
		typeof value.exportedAt !== 'string' ||
		!Number.isFinite(Date.parse(value.exportedAt)) ||
		typeof value.game.name !== 'string' ||
		typeof value.game.unlocked !== 'boolean' ||
		!isRecord(collected) ||
		!Object.values(collected).every((date) => typeof date === 'string') ||
		!Array.isArray(value.personal.hikes) ||
		!value.personal.hikes.every(isHike) ||
		!Array.isArray(value.personal.markers) ||
		!value.personal.markers.every(isMarker) ||
		!(value.settings.basemap === null || typeof value.settings.basemap === 'string') ||
		!Array.isArray(value.photos)
	)
		throw new Error('The backup contains invalid or damaged data.');

	const photos: BackupPhoto[] = value.photos.map((photo) => {
		if (
			!isRecord(photo) ||
			typeof photo.markerId !== 'string' ||
			typeof photo.path !== 'string' ||
			!photo.path.startsWith('photos/') ||
			typeof photo.type !== 'string'
		)
			throw new Error('The backup contains invalid photo information.');
		return { markerId: photo.markerId, path: photo.path, type: photo.type };
	});

	return {
		format: FORMAT,
		version: VERSION,
		exportedAt: value.exportedAt,
		game: {
			name: value.game.name,
			collected: collected as Record<string, string>,
			unlocked: value.game.unlocked,
		},
		personal: {
			hikes: value.personal.hikes,
			markers: value.personal.markers,
		},
		settings: { basemap: value.settings.basemap },
		photos,
	};
}

export async function createBackupFile(now = Date.now()): Promise<File> {
	const game = useGame.getState();
	const personal = usePersonal.getState();
	const files: Record<string, Uint8Array> = {};
	const photos: BackupPhoto[] = [];
	const markers = structuredClone(personal.markers);

	for (const marker of markers) {
		if (!marker.hasPhoto) continue;
		const photo = await loadMarkerPhoto(marker.id).catch(() => undefined);
		if (!photo) {
			marker.hasPhoto = false;
			continue;
		}
		const path = `photos/${encodeURIComponent(marker.id)}`;
		files[path] = await readBlob(photo);
		photos.push({ markerId: marker.id, path, type: photo.type || 'application/octet-stream' });
	}

	const manifest: BackupManifest = {
		format: FORMAT,
		version: VERSION,
		exportedAt: new Date(now).toISOString(),
		game: {
			name: game.name,
			collected: structuredClone(game.collected),
			unlocked: game.unlocked,
		},
		personal: {
			hikes: personal.hikes.map((hike) => pauseForBackup(hike, now)),
			markers,
		},
		settings: { basemap: (basemapStorage.getItem(BASEMAP_KEY) as string | null) ?? null },
		photos,
	};
	files['backup.json'] = strToU8(JSON.stringify(manifest));

	const archive = await zipFiles(files);
	const date = new Date(now).toISOString().slice(0, 10);
	return new File([copyBuffer(archive)], `palisades-trails-backup-${date}.zip`, {
		type: 'application/zip',
	});
}

export async function readBackupFile(file: File): Promise<PreparedBackup> {
	if (file.size > MAX_BACKUP_BYTES) throw new Error('That backup is too large to open.');
	const files = await unzipFiles(await readBlob(file)).catch(() => {
		throw new Error('The selected file is not a readable backup.');
	});
	const manifestBytes = files['backup.json'];
	if (!manifestBytes) throw new Error('The backup is missing backup.json.');

	let parsed: unknown;
	try {
		parsed = JSON.parse(strFromU8(manifestBytes));
	} catch {
		throw new Error('The backup information is damaged.');
	}
	const manifest = parseManifest(parsed);
	const photos = new Map<string, Blob>();
	for (const photo of manifest.photos) {
		const bytes = files[photo.path];
		if (bytes) photos.set(photo.markerId, new Blob([copyBuffer(bytes)], { type: photo.type }));
	}
	return { manifest, photos };
}

export function summarizeBackup(backup: PreparedBackup): BackupSummary {
	return {
		collected: Object.keys(backup.manifest.game.collected).length,
		hikes: backup.manifest.personal.hikes.length,
		markers: backup.manifest.personal.markers.length,
		photos: backup.photos.size,
		exportedAt: backup.manifest.exportedAt,
	};
}

function mergeCollected(
	current: Record<string, string>,
	incoming: Record<string, string>,
): Record<string, string> {
	const merged = { ...incoming, ...current };
	for (const [id, date] of Object.entries(incoming)) {
		if (current[id] && date < current[id]) merged[id] = date;
	}
	return merged;
}

export async function restoreBackup(backup: PreparedBackup): Promise<void> {
	const currentGame = useGame.getState();
	const nextGame = {
		name: currentGame.name.trim() || backup.manifest.game.name,
		collected: mergeCollected(currentGame.collected, backup.manifest.game.collected),
		unlocked: currentGame.unlocked || backup.manifest.game.unlocked,
	};

	const currentPersonal = usePersonal.getState();
	const hikes = new Map(
		backup.manifest.personal.hikes.map((hike) => [
			hike.id,
			pauseForBackup(hike, Date.parse(backup.manifest.exportedAt)),
		]),
	);
	for (const hike of currentPersonal.hikes) hikes.set(hike.id, hike);

	const markers = new Map(currentPersonal.markers.map((marker) => [marker.id, marker]));
	const restoredPhotoIds: string[] = [];
	for (const incoming of backup.manifest.personal.markers) {
		const current = markers.get(incoming.id);
		if (!current || incoming.updatedAt > current.updatedAt) {
			const hasPhoto = incoming.hasPhoto && backup.photos.has(incoming.id);
			markers.set(incoming.id, { ...incoming, hasPhoto });
			if (hasPhoto) restoredPhotoIds.push(incoming.id);
		}
	}
	for (const markerId of restoredPhotoIds) {
		const photo = backup.photos.get(markerId);
		if (photo) await saveMarkerPhoto(markerId, photo);
	}

	useGame.setState(nextGame);
	usePersonal.setState({
		hikes: [...hikes.values()].sort((a, b) => b.startedAt - a.startedAt),
		markers: [...markers.values()].sort((a, b) => b.createdAt - a.createdAt),
		activeHikeId: currentPersonal.activeHikeId,
	});
	if (!basemapStorage.getItem(BASEMAP_KEY) && backup.manifest.settings.basemap)
		basemapStorage.setItem(BASEMAP_KEY, backup.manifest.settings.basemap);
}
