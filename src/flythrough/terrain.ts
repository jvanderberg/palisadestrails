// Loads the baked terrain (see scripts/build-terrain.mjs) and maps lat/lon
// into the scene's world space.
//
// World space: metres, origin at the park centre, +x east, +z south, +y up.
// y = 0 is the Lake Michigan surface, so heights are "metres above the lake".
import { gunzipSync } from 'fflate';

export interface TerrainLayerMeta {
	cols: number;
	rows: number;
	res: number;
	/** Web Mercator [xmin, ymin, xmax, ymax]. */
	bbox: [number, number, number, number];
	min: number;
	max: number;
	heights: string;
	image: string;
	imageSize: [number, number];
}

export interface TerrainMeta {
	generated: string;
	sources: { elevation: string; imagery: string };
	center: [number, number];
	/** Web Mercator coordinates of the world origin. */
	origin: [number, number];
	/** Mercator → true-metre scale, cos(latitude). */
	k: number;
	base: number;
	heightScale: number;
	lakeLevel: number;
	inner: TerrainLayerMeta;
	outer: TerrainLayerMeta;
}

/** A regular height grid in world space. */
export interface HeightGrid {
	cols: number;
	rows: number;
	res: number;
	/** World x/z of the centre of cell (0, 0) — the north-west corner. */
	x0: number;
	z0: number;
	/** Metres above the lake, row-major from the north edge. */
	data: Float32Array;
}

export interface TerrainLayer {
	meta: TerrainLayerMeta;
	grid: HeightGrid;
	imageUrl: string;
}

export interface Terrain {
	meta: TerrainMeta;
	inner: TerrainLayer;
	outer: TerrainLayer;
}

const R = 6378137;
const DEG = Math.PI / 180;

export function mercator(lat: number, lon: number): [number, number] {
	return [R * lon * DEG, R * Math.log(Math.tan(Math.PI / 4 + (lat * DEG) / 2))];
}

/** Lat/lon → world [x, z] in metres. */
export function toWorld(meta: Pick<TerrainMeta, 'origin' | 'k'>, lat: number, lon: number) {
	const [mx, my] = mercator(lat, lon);
	return [(mx - meta.origin[0]) * meta.k, -(my - meta.origin[1]) * meta.k] as [number, number];
}

/** Undo the bake's per-row delta encoding and convert to metres above the lake. */
export function decodeHeights(
	gz: Uint8Array,
	cols: number,
	rows: number,
	base: number,
	scale: number,
	lakeLevel: number,
): Float32Array {
	const raw = gunzipSync(gz);
	const d = new Uint16Array(raw.buffer, raw.byteOffset, raw.byteLength / 2);
	if (d.length !== cols * rows)
		throw new Error(`Height grid is ${d.length}, expected ${cols * rows}`);
	const out = new Float32Array(d.length);
	const offset = base - lakeLevel;
	for (let r = 0; r < rows; r++) {
		let acc = 0;
		for (let c = 0; c < cols; c++) {
			const i = r * cols + c;
			acc = c === 0 ? d[i] : (acc + d[i]) & 0xffff;
			out[i] = acc * scale + offset;
		}
	}
	return out;
}

/** Bilinear height at world (x, z), or NaN outside the grid. */
export function sampleGrid(g: HeightGrid, x: number, z: number): number {
	const fx = (x - g.x0) / g.res;
	const fz = (z - g.z0) / g.res;
	if (fx < 0 || fz < 0 || fx > g.cols - 1 || fz > g.rows - 1) return Number.NaN;
	const c = Math.min(Math.floor(fx), g.cols - 2);
	const r = Math.min(Math.floor(fz), g.rows - 2);
	const tx = fx - c;
	const tz = fz - r;
	const i = r * g.cols + c;
	const d = g.data;
	const top = d[i] + (d[i + 1] - d[i]) * tx;
	const bottom = d[i + g.cols] + (d[i + g.cols + 1] - d[i + g.cols]) * tx;
	return top + (bottom - top) * tz;
}

/** Height above the lake anywhere: inner grid first, then the outer one. */
export function heightAt(t: Terrain, x: number, z: number): number {
	const h = sampleGrid(t.inner.grid, x, z);
	if (!Number.isNaN(h)) return h;
	const o = sampleGrid(t.outer.grid, x, z);
	return Number.isNaN(o) ? 0 : o;
}

function gridFor(meta: TerrainMeta, layer: TerrainLayerMeta, data: Float32Array): HeightGrid {
	const [xmin, , , ymax] = layer.bbox;
	return {
		cols: layer.cols,
		rows: layer.rows,
		res: layer.res,
		x0: (xmin - meta.origin[0]) * meta.k + layer.res / 2,
		z0: -(ymax - meta.origin[1]) * meta.k + layer.res / 2,
		data,
	};
}

export async function loadTerrain(
	baseUrl: string,
	onProgress?: (msg: string) => void,
): Promise<Terrain> {
	const url = (file: string) => new URL(file, baseUrl).href;
	onProgress?.('Loading terrain…');
	const meta = (await (await fetch(url('terrain.json'))).json()) as TerrainMeta;
	const layer = async (m: TerrainLayerMeta): Promise<TerrainLayer> => {
		const res = await fetch(url(m.heights));
		if (!res.ok) throw new Error(`Failed to load ${m.heights}: HTTP ${res.status}`);
		const data = decodeHeights(
			new Uint8Array(await res.arrayBuffer()),
			m.cols,
			m.rows,
			meta.base,
			meta.heightScale,
			meta.lakeLevel,
		);
		return { meta: m, grid: gridFor(meta, m, data), imageUrl: url(m.image) };
	};
	const [inner, outer] = await Promise.all([layer(meta.inner), layer(meta.outer)]);
	return { meta, inner, outer };
}

/** World x of the lake shore at latitude z (first land, scanning west → east), lightly averaged. */
export function shoreX(t: Terrain, z: number): number {
	const one = (zz: number) => {
		for (let x = -3000; x < 1500; x += 3) if (heightAt(t, x, zz) > 0.5) return x;
		return 0;
	};
	return (one(z - 40) + one(z) + one(z + 40)) / 3;
}
