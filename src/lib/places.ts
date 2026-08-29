// Permanent place-ID registry backing the printed QR deep links:
//   https://palisadestrails.com/?p={placeId}
// Contract: every public park place gets one immutable `p####` ID,
// assigned sequentially and never reused. Existing POIs reserve
// p0001–p0018 in their data order; Fern Loop interpretive waypoints
// reserve p0019–p0031 in display order 1–13. Printed signs exist for
// the Fern Loop range, so these mappings must never be re-shuffled.
import { COLLECTIBLES, type Collectible } from '../data/collectibles';
import { FERN_LOOP_WAYPOINTS, type FernLoopWaypoint } from '../data/fernLoopWaypoints';

export type Place =
	| { kind: 'poi'; placeId: string; poi: Collectible }
	| { kind: 'fern-loop'; placeId: string; waypoint: FernLoopWaypoint };

function pad(n: number): string {
	return `p${String(n).padStart(4, '0')}`;
}

/** placeId → place, covering p0001–p0018 (POIs) and p0019–p0031 (Fern Loop). */
export const PLACES: ReadonlyMap<string, Place> = new Map<string, Place>([
	...COLLECTIBLES.map((poi, i): [string, Place] => [
		pad(i + 1),
		{ kind: 'poi', placeId: pad(i + 1), poi },
	]),
	...FERN_LOOP_WAYPOINTS.map((waypoint): [string, Place] => [
		waypoint.placeId,
		{ kind: 'fern-loop', placeId: waypoint.placeId, waypoint },
	]),
]);

/** Resolve a `?p=` query value (e.g. "p0019") to a place, or null. */
export function resolvePlace(param: string | null): Place | null {
	if (!param) return null;
	return PLACES.get(param.trim().toLowerCase()) ?? null;
}

/** Pull the `?p=` place from a URL search string ("?p=p0019"). */
export function placeFromSearch(search: string): Place | null {
	return resolvePlace(new URLSearchParams(search).get('p'));
}
