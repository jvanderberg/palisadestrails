import type { Collectible } from '../data/collectibles';
import type { Difficulty } from '../data/hikes';
import type { Landmark, LatLng, ParkData, Trail } from '../data/park';

export interface EditorTrail extends Trail {
	id: string;
}

export interface HikeRoute {
	names: string[];
	coords: LatLng[];
}

export interface EditorHike {
	id: string;
	name: string;
	routeFile: string;
	difficulty: Difficulty;
	description: string;
	poiIds?: string[];
	route: HikeRoute;
}

export interface EditorPark extends Omit<ParkData, 'trails'> {
	trails: EditorTrail[];
	points: Landmark[];
}

export interface EditorProject {
	park: EditorPark;
	pois: Collectible[];
	hikes: EditorHike[];
}

export type EditorTab = 'trails' | 'markers' | 'pois' | 'hikes';

export type Interaction =
	| { type: 'draw-trail'; trailId: string }
	| { type: 'split-trail'; trailId: string }
	| { type: 'join-trail'; firstId: string }
	| { type: 'add-marker' }
	| { type: 'add-poi' }
	| { type: 'pick-hike' }
	| null;

export interface ImportedLine {
	name: string;
	coords: LatLng[];
}

export interface ImportedPoint {
	name: string;
	lat: number;
	lon: number;
}
