// ------------------------------------------------------------------
//  HIKES — maintained by the local trail editor (`npm run editor`). Metadata
//  lives in hikes.json and exact route geometry lives in one JSON file per
//  hike. Vite eagerly includes those files so the deployed app stays static.
// ------------------------------------------------------------------
import { metres } from '../lib/geo';
import { COLLECTIBLES } from './collectibles';
import hikeCatalog from './hikes.json';
import type { LatLng } from './park';

export type Difficulty = 'Easy' | 'Moderate' | 'Hard';

export interface Hike {
	id: string;
	name: string;
	/** Length in miles, summed from the traced geometry. */
	distanceMi: number;
	/** Difficulty-adjusted hiking time, rounded to five minutes. */
	estimatedMinutes: number;
	/** Trail names the route passes through (from the picker Export). */
	trailNames: string[];
	/** The traced route, as one continuous polyline. */
	segments: LatLng[][];
	difficulty?: Difficulty;
	description?: string;
	poiIds?: string[];
}

interface BakedHike {
	id: string;
	name: string;
	routeFile: string;
	difficulty?: Difficulty;
	description?: string;
	poiIds?: string[];
}

interface BakedRoute {
	names: string[];
	coords: number[][];
}

const PACE_MIN_PER_MILE: Record<Difficulty, number> = {
	Easy: 25,
	Moderate: 30,
	Hard: 35,
};

/** Estimate elapsed hiking time from route length and difficulty. */
export function estimateHikeMinutes(
	distanceMi: number,
	difficulty: Difficulty = 'Moderate',
): number {
	return Math.max(5, Math.round((distanceMi * PACE_MIN_PER_MILE[difficulty]) / 5) * 5);
}

export function formatHikeTime(minutes: number): string {
	if (minutes < 60) return `~${minutes} min`;
	const hours = Math.floor(minutes / 60);
	const remainder = minutes % 60;
	return remainder ? `~${hours} hr ${remainder} min` : `~${hours} hr`;
}

const BAKED = hikeCatalog as BakedHike[];
const routeModules = import.meta.glob('./*-*.json', {
	eager: true,
	import: 'default',
}) as Record<string, BakedRoute>;

function trailMetres(coords: LatLng[]): number {
	let m = 0;
	for (let i = 1; i < coords.length; i++) {
		m += metres(coords[i - 1][0], coords[i - 1][1], coords[i][0], coords[i][1]);
	}
	return m;
}

/** A POI counts as "on" a hike only when the traced route passes within this
 *  many metres of it. The route geometry is exact, so this is tight — genuine
 *  on-route POIs sit within a few metres; anything tens of metres off is a
 *  nearby spur, not on the hike. (The 200 ft collect radius is for GPS slop, not
 *  this.) */
const HIKE_CORRIDOR_M = 20;

/**
 * The POIs a traced route actually passes, in hiking order. Distances are
 * computed in a local equirectangular projection (metres) so we can measure
 * point-to-segment gaps, not just point-to-vertex; each match is ordered by
 * how far along the route its closest point falls.
 */
function routePois(coords: LatLng[]): string[] {
	if (coords.length < 2) return [];
	const refLat = coords[0][0];
	const mPerDegLat = 111_320;
	const mPerDegLon = 111_320 * Math.cos((refLat * Math.PI) / 180);
	const pts = coords.map(([lat, lon]): [number, number] => [lon * mPerDegLon, lat * mPerDegLat]);

	// Cumulative route length (metres) at each vertex, for ordering.
	const cum = [0];
	for (let i = 1; i < pts.length; i++) {
		cum[i] = cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
	}

	const near: { id: string; along: number }[] = [];
	for (const poi of COLLECTIBLES) {
		const px = poi.lon * mPerDegLon;
		const py = poi.lat * mPerDegLat;
		let best = Number.POSITIVE_INFINITY;
		let bestAlong = 0;
		for (let i = 1; i < pts.length; i++) {
			const [ax, ay] = pts[i - 1];
			const [bx, by] = pts[i];
			const dx = bx - ax;
			const dy = by - ay;
			const len2 = dx * dx + dy * dy;
			const t = len2 ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2)) : 0;
			const d = Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
			if (d < best) {
				best = d;
				bestAlong = cum[i - 1] + t * Math.sqrt(len2);
			}
		}
		if (best <= HIKE_CORRIDOR_M) near.push({ id: poi.id, along: bestAlong });
	}
	near.sort((a, b) => a.along - b.along);
	return near.map((n) => n.id);
}

/** A lollipop loop's traced end must land within this many metres of an earlier
 *  point (the stem/loop junction) for us to treat it as a loop worth closing. */
const LOOP_CLOSE_TOL_M = 35;

/**
 * The picker can't repeat the entrance segment, so a lollipop loop exports
 * ending at the stem/loop junction instead of back at the trailhead — the
 * route stops short and its length is missing the return leg. If the route's
 * end coincides with an early point (the junction), retrace the stem back to
 * the start, closing the loop exactly as walking the entrance out again would.
 * Point-to-point routes (end nowhere near an early point) are left untouched.
 */
function closeLoop(coords: LatLng[]): LatLng[] {
	if (coords.length < 4) return coords;
	const end = coords[coords.length - 1];
	let junction = 0;
	let best = Number.POSITIVE_INFINITY;
	const limit = Math.floor(coords.length * 0.6);
	for (let i = 0; i < limit; i++) {
		const d = metres(coords[i][0], coords[i][1], end[0], end[1]);
		if (d < best) {
			best = d;
			junction = i;
		}
	}
	if (junction <= 1 || best > LOOP_CLOSE_TOL_M) return coords;
	const ret: LatLng[] = [];
	for (let i = junction - 1; i >= 0; i--) ret.push(coords[i]);
	return coords.concat(ret);
}

export const HIKES: Hike[] = BAKED.map((b) => {
	const route = routeModules[`./${b.routeFile}`];
	if (!route) throw new Error(`Missing route file for hike ${b.id}: ${b.routeFile}`);
	const coords = closeLoop(route.coords as unknown as LatLng[]);
	const distanceMi = Math.round((trailMetres(coords) / 1609.344) * 100) / 100;
	return {
		id: b.id,
		name: b.name,
		distanceMi,
		estimatedMinutes: estimateHikeMinutes(distanceMi, b.difficulty),
		trailNames: [...new Set(route.names)],
		segments: [coords],
		difficulty: b.difficulty,
		description: b.description,
		// Explicit list wins; otherwise derive the POIs the route passes.
		poiIds: b.poiIds ?? routePois(coords),
	};
});

/** The route polyline(s) for a hike. */
export function hikeTrails(hike: Hike): LatLng[][] {
	return hike.segments;
}

/** Start (first point) and finish (last point) of the traced route. */
export function hikeEndpoints(hike: Hike): { start?: LatLng; end?: LatLng } {
	const trail = hike.segments[0];
	if (!trail || trail.length === 0) return {};
	return { start: trail[0], end: trail[trail.length - 1] };
}
