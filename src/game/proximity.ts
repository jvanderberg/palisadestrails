// Derives each POI's collectible state from the player's position.
import type { Collectible } from '../data/collectibles';
import { metres } from '../lib/geo';
import type { Position } from './useGeolocation';

export type PoiState = 'collected' | 'near' | 'locked';

export interface PoiInfo {
	poi: Collectible;
	/** Metres from the player, or null when position is unknown. */
	distance: number | null;
	state: PoiState;
}

/**
 * Annotate every POI with distance + state. `near` means not-yet-collected
 * and within `radiusM` — i.e. collectable right now.
 */
export function annotate(
	pois: Collectible[],
	collected: Record<string, string>,
	pos: Position | null,
	radiusM: number,
): PoiInfo[] {
	return pois.map((poi) => {
		const distance = pos ? metres(pos.lat, pos.lon, poi.lat, poi.lon) : null;
		let state: PoiState;
		if (collected[poi.id]) state = 'collected';
		else if (distance != null && distance <= radiusM) state = 'near';
		else state = 'locked';
		return { poi, distance, state };
	});
}
