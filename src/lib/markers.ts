// Leaflet divIcon factories. Kept out of components so the same markup is
// reused across the map without re-instantiating icon classes per render.
import L from 'leaflet';
import type { Collectible } from '../data/collectibles';
import type { PoiState } from '../game/proximity';

export function poiIcon(poi: Collectible, state: PoiState): L.DivIcon {
	const glyph = state === 'collected' ? '★' : poi.emoji;
	const style = poi.color && state !== 'collected' ? ` style="color:${poi.color}"` : '';
	return L.divIcon({
		className: '',
		html: `<div class="poi-badge ${state}"><span${style}>${glyph}</span></div>`,
		iconSize: [34, 34],
		iconAnchor: [17, 17],
		popupAnchor: [0, -18],
	});
}

export function landmarkIcon(): L.DivIcon {
	return L.divIcon({
		className: '',
		html: '<div class="poi-dot"></div>',
		iconSize: [10, 10],
		iconAnchor: [5, 5],
	});
}

export function personalMarkerIcon(): L.DivIcon {
	return L.divIcon({
		className: '',
		html: '<div class="personal-marker"><span></span></div>',
		iconSize: [28, 36],
		iconAnchor: [14, 34],
		popupAnchor: [0, -34],
	});
}

export function endpointIcon(kind: 'start' | 'end' | 'startfinish'): L.DivIcon {
	const label = kind === 'start' ? 'Start' : kind === 'end' ? 'Finish' : 'Start / Finish';
	// The combined marker needs a wider pill to fit its label.
	const w = kind === 'startfinish' ? 84 : 52;
	return L.divIcon({
		className: '',
		html: `<div class="hike-endpoint ${kind}">${label}</div>`,
		iconSize: [w, 22],
		iconAnchor: [w / 2, 26],
		popupAnchor: [0, -24],
	});
}
