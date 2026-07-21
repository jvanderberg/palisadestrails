import type { LatLng } from '../data/park';
import type { EditorProject, EditorTrail, ImportedLine, ImportedPoint } from './types';

const RAD = Math.PI / 180;

export function clone<T>(value: T): T {
	return JSON.parse(JSON.stringify(value)) as T;
}

export function slugify(value: string, fallback = 'item'): string {
	return (
		value
			.normalize('NFKD')
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, '-')
			.replace(/^-+|-+$/g, '') || fallback
	);
}

export function uniqueId(prefix: string, used: Set<string>): string {
	let n = 1;
	let id = `${prefix}-${n}`;
	while (used.has(id)) id = `${prefix}-${++n}`;
	return id;
}

export function pointMetres(a: LatLng, b: LatLng): number {
	const lat = ((a[0] + b[0]) / 2) * RAD;
	return Math.hypot((b[1] - a[1]) * Math.cos(lat) * 111_320, (b[0] - a[0]) * 110_540);
}

export function lineMetres(coords: LatLng[]): number {
	let total = 0;
	for (let i = 1; i < coords.length; i++) total += pointMetres(coords[i - 1], coords[i]);
	return total;
}

function localXY(point: LatLng, lat0: number): [number, number] {
	return [point[1] * Math.cos(lat0 * RAD) * 111_320, point[0] * 110_540];
}

export function nearestPoint(
	coords: LatLng[],
	point: LatLng,
): { index: number; point: LatLng; distance: number } | null {
	if (coords.length < 2) return null;
	const [px, py] = localXY(point, point[0]);
	let best: { index: number; point: LatLng; distance: number } | null = null;
	for (let i = 0; i < coords.length - 1; i++) {
		const [ax, ay] = localXY(coords[i], point[0]);
		const [bx, by] = localXY(coords[i + 1], point[0]);
		const dx = bx - ax;
		const dy = by - ay;
		const len2 = dx * dx + dy * dy;
		const t = len2 ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2)) : 0;
		const projected: LatLng = [
			coords[i][0] + (coords[i + 1][0] - coords[i][0]) * t,
			coords[i][1] + (coords[i + 1][1] - coords[i][1]) * t,
		];
		const distance = pointMetres(point, projected);
		if (!best || distance < best.distance) best = { index: i, point: projected, distance };
	}
	return best;
}

function splitId(base: string, suffix: string, trails: EditorTrail[]): string {
	const used = new Set(trails.map((trail) => trail.id));
	let id = `${base}-${suffix}`;
	let n = 2;
	while (used.has(id)) id = `${base}-${suffix}${n++}`;
	return id;
}

export function splitTrail(
	trails: EditorTrail[],
	id: string,
	point: LatLng,
): { trails: EditorTrail[]; ids: [string, string] } {
	const index = trails.findIndex((trail) => trail.id === id);
	if (index < 0) throw new Error(`Unknown trail: ${id}`);
	const trail = trails[index];
	const nearest = nearestPoint(trail.coords, point);
	if (!nearest) throw new Error('A trail needs at least two vertices to split.');
	const left = [...trail.coords.slice(0, nearest.index + 1), nearest.point];
	const right = [nearest.point, ...trail.coords.slice(nearest.index + 1)];
	if (lineMetres(left) < 1 || lineMetres(right) < 1)
		throw new Error('Split too close to an endpoint.');
	const first = { ...clone(trail), id: splitId(id, 'a', trails), coords: left };
	const second = { ...clone(trail), id: splitId(id, 'b', [...trails, first]), coords: right };
	return {
		trails: [...trails.slice(0, index), first, second, ...trails.slice(index + 1)],
		ids: [first.id, second.id],
	};
}

export function splitTrailAtVertex(
	trails: EditorTrail[],
	id: string,
	vertexIndex: number,
): { trails: EditorTrail[]; ids: [string, string] } {
	const index = trails.findIndex((trail) => trail.id === id);
	if (index < 0) throw new Error(`Unknown trail: ${id}`);
	const trail = trails[index];
	if (vertexIndex <= 0 || vertexIndex >= trail.coords.length - 1)
		throw new Error('Choose an interior vertex, not a trail endpoint.');
	const first = {
		...clone(trail),
		id: splitId(id, 'a', trails),
		coords: trail.coords.slice(0, vertexIndex + 1),
	};
	const second = {
		...clone(trail),
		id: splitId(id, 'b', [...trails, first]),
		coords: trail.coords.slice(vertexIndex),
	};
	return {
		trails: [...trails.slice(0, index), first, second, ...trails.slice(index + 1)],
		ids: [first.id, second.id],
	};
}

export function joinTrails(
	trails: EditorTrail[],
	firstId: string,
	secondId: string,
): { trails: EditorTrail[]; id: string; gapMetres: number } {
	if (firstId === secondId) throw new Error('Choose two different trail segments.');
	const first = trails.find((trail) => trail.id === firstId);
	const second = trails.find((trail) => trail.id === secondId);
	if (!first || !second) throw new Error('A selected segment no longer exists.');
	const firstEnd = first.coords[first.coords.length - 1];
	const secondEnd = second.coords[second.coords.length - 1];
	const options = [
		{ d: pointMetres(firstEnd, second.coords[0]), ar: false, br: false },
		{ d: pointMetres(firstEnd, secondEnd), ar: false, br: true },
		{ d: pointMetres(first.coords[0], second.coords[0]), ar: true, br: false },
		{ d: pointMetres(first.coords[0], secondEnd), ar: true, br: true },
	].sort((a, b) => a.d - b.d);
	const option = options[0];
	const a = option.ar ? first.coords.toReversed() : first.coords.slice();
	const b = option.br ? second.coords.toReversed() : second.coords.slice();
	const coords = [...a];
	if (pointMetres(a[a.length - 1], b[0]) > 0.25) coords.push(b[0]);
	coords.push(...b.slice(1));
	const joined = { ...clone(first), coords };
	const insertion = Math.min(trails.indexOf(first), trails.indexOf(second));
	const result = trails.filter((trail) => trail.id !== firstId && trail.id !== secondId);
	result.splice(insertion, 0, joined);
	return { trails: result, id: joined.id, gapMetres: option.d };
}

function endpointPair(a: LatLng[], b: LatLng[]) {
	const endpointsA = [a[0], a[a.length - 1]];
	const endpointsB = [b[0], b[b.length - 1]];
	let best = { ai: 0, bi: 0, distance: Number.POSITIVE_INFINITY };
	for (let ai = 0; ai < 2; ai++) {
		for (let bi = 0; bi < 2; bi++) {
			const distance = pointMetres(endpointsA[ai], endpointsB[bi]);
			if (distance < best.distance) best = { ai, bi, distance };
		}
	}
	return best;
}

export function buildRoute(trails: EditorTrail[], ids: string[]) {
	const chosen = ids
		.map((id) => trails.find((trail) => trail.id === id))
		.filter((trail): trail is EditorTrail => Boolean(trail));
	if (!chosen.length)
		return { names: [] as string[], coords: [] as LatLng[], gaps: [] as number[] };
	const arrays = chosen.map((trail) => trail.coords.slice());
	const pairs = arrays.slice(0, -1).map((coords, index) => endpointPair(coords, arrays[index + 1]));
	const oriented = arrays.map((coords, index) => {
		const entry = index > 0 ? pairs[index - 1].bi : arrays.length > 1 ? 1 - pairs[0].ai : 0;
		return entry === 1 ? coords.toReversed() : coords;
	});
	const coords = oriented[0].slice();
	for (const part of oriented.slice(1)) {
		if (pointMetres(coords[coords.length - 1], part[0]) > 0.25) coords.push(part[0]);
		coords.push(...part.slice(1));
	}
	const names: string[] = [];
	for (const trail of chosen) if (names.at(-1) !== trail.name) names.push(trail.name);
	return { names, coords, gaps: pairs.map((pair) => pair.distance) };
}

function text(block: string, tag: string): string {
	const match = block.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, 'i'));
	return (match?.[1] ?? '')
		.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
		.replaceAll('&amp;', '&')
		.replaceAll('&lt;', '<')
		.replaceAll('&gt;', '>')
		.trim();
}

function coordinateText(value: string): LatLng[] {
	return value
		.trim()
		.split(/\s+/)
		.map((tuple) => tuple.split(',').map(Number))
		.filter(([lon, lat]) => Number.isFinite(lat) && Number.isFinite(lon))
		.map(([lon, lat]) => [lat, lon]);
}

export function parseGeoFile(
	source: string,
	filename: string,
): { lines: ImportedLine[]; points: ImportedPoint[] } {
	const lines: ImportedLine[] = [];
	const points: ImportedPoint[] = [];
	if (/\.gpx$/i.test(filename) || /<gpx[\s>]/i.test(source)) {
		for (const [index, match] of [
			...source.matchAll(/<trkseg(?:\s[^>]*)?>([\s\S]*?)<\/trkseg>/gi),
		].entries()) {
			const coords = [
				...match[1].matchAll(
					/<trkpt\b[^>]*\blat=["']([^"']+)["'][^>]*\blon=["']([^"']+)["'][^>]*>/gi,
				),
			]
				.map((point): LatLng => [Number(point[1]), Number(point[2])])
				.filter(([lat, lon]) => Number.isFinite(lat) && Number.isFinite(lon));
			if (coords.length > 1) lines.push({ name: `GPX track ${index + 1}`, coords });
		}
		for (const [index, match] of [
			...source.matchAll(/<rte(?:\s[^>]*)?>([\s\S]*?)<\/rte>/gi),
		].entries()) {
			const coords = [
				...match[1].matchAll(
					/<rtept\b[^>]*\blat=["']([^"']+)["'][^>]*\blon=["']([^"']+)["'][^>]*>/gi,
				),
			]
				.map((point): LatLng => [Number(point[1]), Number(point[2])])
				.filter(([lat, lon]) => Number.isFinite(lat) && Number.isFinite(lon));
			if (coords.length > 1) {
				lines.push({ name: text(match[1], 'name') || `GPX route ${index + 1}`, coords });
			}
		}
		for (const match of source.matchAll(
			/<wpt\b[^>]*\blat=["']([^"']+)["'][^>]*\blon=["']([^"']+)["'][^>]*>([\s\S]*?)<\/wpt>/gi,
		)) {
			points.push({
				name: text(match[3], 'name') || 'GPX waypoint',
				lat: Number(match[1]),
				lon: Number(match[2]),
			});
		}
	} else {
		for (const [index, match] of [
			...source.matchAll(/<Placemark(?:\s[^>]*)?>([\s\S]*?)<\/Placemark>/gi),
		].entries()) {
			const block = match[1];
			const name = text(block, 'name') || `KML item ${index + 1}`;
			for (const line of block.matchAll(/<LineString(?:\s[^>]*)?>([\s\S]*?)<\/LineString>/gi)) {
				const coords = coordinateText(text(line[1], 'coordinates'));
				if (coords.length > 1) lines.push({ name, coords });
			}
			const track = [...block.matchAll(/<(?:gx:)?coord>([^<]+)<\/(?:gx:)?coord>/gi)]
				.map((coord) => coord[1].trim().split(/\s+/).map(Number))
				.filter(([lon, lat]) => Number.isFinite(lat) && Number.isFinite(lon))
				.map(([lon, lat]): LatLng => [lat, lon]);
			if (track.length > 1) lines.push({ name, coords: track });
			const point = block.match(/<Point(?:\s[^>]*)?>([\s\S]*?)<\/Point>/i);
			const coords = point ? coordinateText(text(point[1], 'coordinates'))[0] : null;
			if (coords) points.push({ name, lat: coords[0], lon: coords[1] });
		}
	}
	if (!lines.length && !points.length) throw new Error('No GPX/KML routes or points were found.');
	return { lines, points };
}

export function computeExtent(
	project: EditorProject,
): Pick<EditorProject['park'], 'center' | 'bounds'> {
	const coords: LatLng[] = project.park.trails.flatMap((trail) => trail.coords);
	coords.push(...project.park.points.map((point) => [point.lat, point.lon] as LatLng));
	coords.push(...project.pois.map((point) => [point.lat, point.lon] as LatLng));
	if (!coords.length)
		return {
			center: [0, 0],
			bounds: [
				[0, 0],
				[0, 0],
			],
		};
	const lats = coords.map(([lat]) => lat);
	const lons = coords.map(([, lon]) => lon);
	const bounds: [LatLng, LatLng] = [
		[Math.min(...lats), Math.min(...lons)],
		[Math.max(...lats), Math.max(...lons)],
	];
	return { center: [(bounds[0][0] + bounds[1][0]) / 2, (bounds[0][1] + bounds[1][1]) / 2], bounds };
}
