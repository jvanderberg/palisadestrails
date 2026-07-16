// Typed accessor over the baked park data (parsed offline from the
// Sign-Locations CSV + Palisades_Park.kml CalTopo export into park.json).
import raw from './park.json';

export type LatLng = [number, number];

export interface Sign {
	text: string;
	color: string | null;
	shape: string | null;
	notes: string | null;
}

export interface SignPost {
	num: string;
	lat: number;
	lon: number;
	desc: string;
	signs: Sign[];
}

export interface Trail {
	name: string;
	color: string;
	/** CalTopo folder this trail belongs to (used to group hikes), if any. */
	folder: string | null;
	coords: LatLng[];
}

export interface Landmark {
	name: string;
	lat: number;
	lon: number;
}

export interface ParkData {
	signs: SignPost[];
	trails: Trail[];
	points: Landmark[];
	center: LatLng;
	bounds: [LatLng, LatLng];
}

// JSON imports widen fixed-length arrays to `number[]`, so the coord tuples
// don't structurally match LatLng — assert at this single boundary.
export const park = raw as unknown as ParkData;
