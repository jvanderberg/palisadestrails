import type { Hike } from '../data/hikes';
import { type ElevationStats, elevationStats, type Path, resample, smooth } from './path';
import { heightAt, type Terrain, toWorld } from './terrain';

export interface Route {
	hike: Hike;
	path: Path;
	/** Ground height (metres above the lake, unexaggerated) at each sample. */
	heights: Float32Array;
	stats: ElevationStats;
}

/** Sample spacing for hike routes, metres. */
export const ROUTE_STEP = 2;

export function buildRoute(terrain: Terrain, hike: Hike): Route {
	const pts = hike.segments.flat().map(([lat, lon]) => toWorld(terrain.meta, lat, lon));
	const path = resample(pts, ROUTE_STEP);
	const heights = new Float32Array(path.xs.length);
	for (let i = 0; i < heights.length; i++) heights[i] = heightAt(terrain, path.xs[i], path.zs[i]);
	// Stats on a lightly smoothed profile so 1 m lidar texture (roots,
	// steps, trail edges) doesn't count as climbing.
	return { hike, path, heights, stats: elevationStats(smooth(heights, 3)) };
}

export const M_TO_FT = 3.28084;
export const M_PER_MI = 1609.344;
