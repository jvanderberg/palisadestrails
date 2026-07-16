// ------------------------------------------------------------------
//  HIKES — traced by hand in the segment picker (tools/segment-picker.html)
//  and baked here as exact geometry. Each hike's coordinates come straight
//  from the picker Export, so the route on the map is exactly what was
//  traced — no name-resolution guessing.
//
//  To add a hike: trace it in the picker, Export, save the JSON under
//  src/data/, and add an entry to BAKED below.
// ------------------------------------------------------------------
import { metres } from '../lib/geo';
import bigPineLoop from './big-pine-loop.json';
import bigPineRidge from './big-pine-ridge.json';
import { COLLECTIBLES } from './collectibles';
import fernLoop from './fern-loop.json';
import grandTour from './grand-tour.json';
import hemlockLoop from './hemlock-loop.json';
import longestTrek from './longest-trek.json';
import northEndLoop from './north-end-loop.json';
import northernLowerLoop from './northern-lower-loop.json';
import oakLoop from './oak-loop.json';
import type { LatLng } from './park';
import southEndLoop from './south-end-loop.json';
import thunderSugarBowl from './thunder-sugar-bowl.json';

export type Difficulty = 'Easy' | 'Moderate' | 'Hard';

export interface Hike {
	id: string;
	name: string;
	/** Length in miles, summed from the traced geometry. */
	distanceMi: number;
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
	route: { names: string[]; coords: number[][] };
	difficulty?: Difficulty;
	description?: string;
	poiIds?: string[];
}

// distanceMi and poiIds are derived from the geometry below. The newer loops
// (no difficulty/description yet) get those filled in per hike after review.
const BAKED: BakedHike[] = [
	{
		id: 'fern-loop',
		name: 'Fern Loop',
		route: fernLoop,
		difficulty: 'Easy',
		description:
			'Start at the meadow entrance to the Brandywine Trail, go left at the Fern Loop sign, and go right at the next intersection to take the Brandywine Trail back out.',
	},
	{
		id: 'grand-tour',
		name: 'The Grand Tour',
		route: grandTour,
		difficulty: 'Hard',
		description:
			'The full external loop around the park — from the boardwalk by the soda bar, around the lake bluff and sugar bowl rim, up the east side and across the north-end loops, finishing at the Brandywine bridge.',
	},
	{
		id: 'longest-trek',
		name: 'The Longest Trek',
		route: longestTrek,
		difficulty: 'Hard',
		description:
			'The everything hike — the grand loop plus the sugar bowl ridge, big pine, and high-point spurs. Bring water.',
	},
	{
		id: 'big-pine-ridge',
		name: 'Big Pine Ridge Loop',
		route: bigPineRidge,
		difficulty: 'Moderate',
		description:
			'From the Jack Gardner trailhead around the Red Pine loop, past Big Pine and up the Big Pine Ridge.',
	},
	{
		id: 'thunder-sugar-bowl',
		name: 'Thunder Mountain → Sugar Bowl',
		route: thunderSugarBowl,
		difficulty: 'Moderate',
		description:
			'Down off Thunder Mountain, past the Jack Gardner trailhead and along the east sugar bowl and ridge into the Sugar Bowl.',
	},
	{
		id: 'oak-loop',
		name: 'Oak Loop',
		route: oakLoop,
		difficulty: 'Moderate',
		description:
			"Start at the trail entrance across from the softball field, cross the Wood Bridge, and turn right. Stay on the Brandywine Trail. Follow the 'To Oak Loop' signs up the ridge. Turn right at the top, then left at the next intersection. Hike the Oak Loop until you come out on Edgewater Road. Take the short connector behind the cottage back to the Brandywine Trail.",
	},
	{
		id: 'north-end-loop',
		name: 'North End Loop Tour',
		route: northEndLoop,
		difficulty: 'Moderate',
		description:
			'Start at the meadow entrance to the Brandywine Trail. Take the Brandywine Trail to Sassafras Trail, then to Upper Sassafras Loop. Follow Oak Loop out to Edgewater Road. Take the Brandywine Connector to the left of the cottage, then turn right on the Brandywine Trail back to the meadow.',
	},
	{
		id: 'northern-lower-loop',
		name: 'The Northern Lower Loop',
		route: northernLowerLoop,
		difficulty: 'Moderate',
		description:
			'Start at the trail entrance across from the softball field. Cross the Wood Bridge and turn right. Take the Brandywine Trail to Sassafras Trail, then follow the signs to Lower Maple Loop. At the next intersection, follow the sign to High Point and hike up the ridge. Follow the signs to Oak Ridge. Take Oak Ridge out to Edgewater Road. Take the connector to the left of the cottage back to the Brandywine Trail. Turn left at the Brandywine Trail, cross the bridge, and you are done.',
	},
	{
		id: 'hemlock-loop',
		name: 'Hemlock Loop',
		route: hemlockLoop,
		difficulty: 'Easy',
		description:
			"Start at Ravine Road by the tennis courts. To the right of the cottage, you'll find Stagecoach Trail. Hike up and turn left at the intersection. Enjoy the rolling route through the hemlocks. At the next intersection, follow the signs to Stagecoach Trail, then turn right on Stagecoach Trail to exit.",
	},
	{
		id: 'big-pine-loop',
		name: 'Big Pine Loop',
		route: bigPineLoop,
		difficulty: 'Easy',
		description:
			'Start at the Jack Gardner Trailhead sign. Hike in and follow the signs to Big Pine Ridge Trail. Hike the ridge, noting how steep it is off to the left. At the next intersection, follow the sign to Big Pine. Take Big Pine Trail to Red Pine Loop, then head back out to the Gardner Trailhead.',
	},
	{
		id: 'south-end-loop',
		name: 'South End Loop Tour',
		route: southEndLoop,
		difficulty: 'Moderate',
		description:
			'Start at the Gardner Trailhead. Follow the signs to Big Pine Ridge Trail. Hike the ridge and, at the next two intersections, follow the signs to the Sugar Bowl. Summit the East Sugar Bowl and enjoy the view. Go right, following North Ridge Trail. Take a short detour to the best view in the park. Continue on North Ridge Trail out to the Sugar Bowl.',
	},
];

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
 *  nearby spur, not on the hike. (The 40 m collect radius is for GPS slop, not
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
	const coords = closeLoop(b.route.coords as unknown as LatLng[]);
	return {
		id: b.id,
		name: b.name,
		distanceMi: Math.round((trailMetres(coords) / 1609.344) * 100) / 100,
		trailNames: [...new Set(b.route.names)],
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
