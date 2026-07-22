import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Position } from '../game/useGeolocation';
import { metres } from '../lib/geo';

export interface TrackPoint extends Position {
	timestamp: number;
}

export interface PersonalHike {
	id: string;
	name: string;
	startedAt: number;
	finishedAt: number | null;
	status: 'recording' | 'paused' | 'finished';
	elapsedMs: number;
	activeSince: number | null;
	segments: TrackPoint[][];
}

export interface PersonalMarker {
	id: string;
	name: string;
	lat: number;
	lon: number;
	createdAt: number;
	updatedAt: number;
	hasPhoto: boolean;
}

interface PersonalState {
	hikes: PersonalHike[];
	markers: PersonalMarker[];
	activeHikeId: string | null;
	startHike: (position: Position | null, now?: number) => string | null;
	addTrackPoint: (point: TrackPoint) => boolean;
	pauseHike: (now?: number) => void;
	resumeHike: (position: Position | null, now?: number) => void;
	finishHike: (position: Position | null, now?: number) => void;
	renameHike: (id: string, name: string) => void;
	deleteHike: (id: string) => void;
	addMarker: (name: string, position: Position, hasPhoto: boolean, now?: number) => string;
	updateMarker: (
		id: string,
		changes: Partial<Pick<PersonalMarker, 'name' | 'hasPhoto'>>,
		now?: number,
	) => void;
	deleteMarker: (id: string) => void;
}

function id(prefix: string): string {
	const value = crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
	return `${prefix}-${value}`;
}

export function defaultHikeName(now: number): string {
	return `Hike · ${new Intl.DateTimeFormat(undefined, {
		month: 'short',
		day: 'numeric',
		year: 'numeric',
	}).format(new Date(now))}`;
}

function appendPoint(hike: PersonalHike, point: TrackPoint): boolean {
	if (hike.status !== 'recording' || point.accuracy > 100) return false;
	let segment = hike.segments.at(-1);
	const previous = segment?.at(-1);
	if (previous && point.timestamp <= previous.timestamp) return false;
	const followsGap = Boolean(previous && point.timestamp - previous.timestamp > 20_000);
	if (followsGap) {
		segment = [];
		hike.segments.push(segment);
	}
	if (
		previous &&
		!followsGap &&
		point.timestamp - previous.timestamp < 60_000 &&
		metres(previous.lat, previous.lon, point.lat, point.lon) < 1
	)
		return false;
	if (!segment) {
		segment = [];
		hike.segments.push(segment);
	}
	segment.push(point);
	return true;
}

export function personalHikeDistanceMetres(hike: PersonalHike): number {
	return hike.segments.reduce((total, segment) => {
		for (let index = 1; index < segment.length; index++) {
			total += metres(
				segment[index - 1].lat,
				segment[index - 1].lon,
				segment[index].lat,
				segment[index].lon,
			);
		}
		return total;
	}, 0);
}

export function personalHikeElapsedMs(hike: PersonalHike, now = Date.now()): number {
	return (
		hike.elapsedMs +
		(hike.status === 'recording' && hike.activeSince != null
			? Math.max(0, now - hike.activeSince)
			: 0)
	);
}

export function formatPersonalDuration(milliseconds: number): string {
	const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
	const hours = Math.floor(totalSeconds / 3600);
	const minutes = Math.floor((totalSeconds % 3600) / 60);
	const seconds = totalSeconds % 60;
	return hours
		? `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
		: `${minutes}:${String(seconds).padStart(2, '0')}`;
}

export const usePersonal = create<PersonalState>()(
	persist(
		(set, get) => ({
			hikes: [],
			markers: [],
			activeHikeId: null,
			startHike: (position, now = Date.now()) => {
				if (get().activeHikeId) return get().activeHikeId;
				if (!position) return null;
				const hikeId = id('hike');
				const point: TrackPoint = { ...position, timestamp: now };
				set((state) => ({
					activeHikeId: hikeId,
					hikes: [
						{
							id: hikeId,
							name: defaultHikeName(now),
							startedAt: now,
							finishedAt: null,
							status: 'recording',
							elapsedMs: 0,
							activeSince: now,
							segments: [[point]],
						},
						...state.hikes,
					],
				}));
				return hikeId;
			},
			addTrackPoint: (point) => {
				let added = false;
				set((state) => ({
					hikes: state.hikes.map((hike) => {
						if (hike.id !== state.activeHikeId) return hike;
						const next = structuredClone(hike);
						added = appendPoint(next, point);
						return added ? next : hike;
					}),
				}));
				return added;
			},
			pauseHike: (now = Date.now()) =>
				set((state) => ({
					hikes: state.hikes.map((hike) =>
						hike.id === state.activeHikeId && hike.status === 'recording'
							? {
									...hike,
									status: 'paused',
									elapsedMs: hike.elapsedMs + Math.max(0, now - (hike.activeSince ?? now)),
									activeSince: null,
								}
							: hike,
					),
				})),
			resumeHike: (position, now = Date.now()) =>
				set((state) => ({
					hikes: state.hikes.map((hike) =>
						hike.id === state.activeHikeId && hike.status === 'paused'
							? {
									...hike,
									status: 'recording',
									activeSince: now,
									segments: [
										...hike.segments,
										...(position ? [[{ ...position, timestamp: now }]] : [[]]),
									],
								}
							: hike,
					),
				})),
			finishHike: (position, now = Date.now()) =>
				set((state) => ({
					activeHikeId: null,
					hikes: state.hikes.map((hike) => {
						if (hike.id !== state.activeHikeId) return hike;
						const next = structuredClone(hike);
						if (position)
							appendPoint(next, {
								...position,
								timestamp: now,
							});
						next.elapsedMs +=
							next.status === 'recording' ? Math.max(0, now - (next.activeSince ?? now)) : 0;
						next.status = 'finished';
						next.activeSince = null;
						next.finishedAt = now;
						return next;
					}),
				})),
			renameHike: (hikeId, name) => {
				set((state) => ({
					hikes: state.hikes.map((hike) => (hike.id === hikeId ? { ...hike, name } : hike)),
				}));
			},
			deleteHike: (hikeId) =>
				set((state) => ({
					activeHikeId: state.activeHikeId === hikeId ? null : state.activeHikeId,
					hikes: state.hikes.filter((hike) => hike.id !== hikeId),
				})),
			addMarker: (name, position, hasPhoto, now = Date.now()) => {
				const markerId = id('marker');
				set((state) => ({
					markers: [
						{
							id: markerId,
							name: name.trim() || 'My marker',
							lat: position.lat,
							lon: position.lon,
							createdAt: now,
							updatedAt: now,
							hasPhoto,
						},
						...state.markers,
					],
				}));
				return markerId;
			},
			updateMarker: (markerId, changes, now = Date.now()) =>
				set((state) => ({
					markers: state.markers.map((marker) =>
						marker.id === markerId
							? {
									...marker,
									...changes,
									name: changes.name?.trim() || marker.name,
									updatedAt: now,
								}
							: marker,
					),
				})),
			deleteMarker: (markerId) =>
				set((state) => ({ markers: state.markers.filter((marker) => marker.id !== markerId) })),
		}),
		{ name: 'palisades-personal/v1', version: 1 },
	),
);
