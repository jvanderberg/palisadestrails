// Regenerate src/data/park.json from a CalTopo GeoJSON export.
//
//   node scripts/build-park.mjs "~/Downloads/Palisades_Park (21).json"
//   npm run map -- "~/Downloads/Palisades_Park (21).json"
//
// Captures each trail's folder so hikes can be grouped by folder (see
// src/data/hikes.ts). CalTopo coords are [lon, lat, ...]; Leaflet wants
// [lat, lon].
import { readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const out = resolve(here, '../src/data/park.json');

const argPath = process.argv[2];
const src = (argPath ?? `${homedir()}/Downloads/Palisades_Park (20).json`).replace(/^~/, homedir());

const gj = JSON.parse(readFileSync(src, 'utf8'));
const feats = gj.features.filter((f) => f.geometry || f.properties?.class === 'Folder');

const folderName = new Map();
for (const f of feats) {
	if (f.properties?.class === 'Folder') folderName.set(f.id, f.properties.title || 'Folder');
}

const lines = feats.filter((f) => f.geometry?.type === 'LineString');
const pts = feats.filter((f) => f.geometry?.type === 'Point');

const rawTrails = lines.map((f) => ({
	name: f.properties.title || 'Trail',
	color: (f.properties.stroke || '#000000').toUpperCase(),
	folder: folderName.get(f.properties.folderId) ?? null,
	coords: f.geometry.coordinates.map(([lon, lat]) => [lat, lon]),
}));

// --- Deterministic merge of segments that share a trail name ---
// Greedy endpoint-stitching: only join two segments when their nearest
// endpoints are within MERGE_TOLERANCE_M (genuine split pieces sit ~0 m
// apart; unrelated same-named trails, e.g. two "Connector"s, sit far
// apart and stay separate). No heuristics/judgement — pure geometry.
const MERGE_TOLERANCE_M = 20;

function metresBetween(a, b) {
	const R = 6371000;
	const d = Math.PI / 180;
	const dLat = (b[0] - a[0]) * d;
	const dLon = (b[1] - a[1]) * d;
	const s =
		Math.sin(dLat / 2) ** 2 + Math.cos(a[0] * d) * Math.cos(b[0] * d) * Math.sin(dLon / 2) ** 2;
	return 2 * R * Math.asin(Math.sqrt(s));
}

// Stitch a list of coordinate arrays into as few chains as possible.
function stitch(segments, tol) {
	const remaining = segments.map((s) => s.slice());
	const chains = [];
	while (remaining.length > 0) {
		let chain = remaining.shift();
		let grew = true;
		while (grew) {
			grew = false;
			const head = chain[0];
			const tail = chain[chain.length - 1];
			let best = { d: tol, i: -1, make: null };
			for (let i = 0; i < remaining.length; i++) {
				const seg = remaining[i];
				const s0 = seg[0];
				const s1 = seg[seg.length - 1];
				const opts = [
					{ d: metresBetween(tail, s0), make: (c, x) => [...c, ...x.slice(1)] },
					{ d: metresBetween(tail, s1), make: (c, x) => [...c, ...x.slice().reverse().slice(1)] },
					{ d: metresBetween(head, s1), make: (c, x) => [...x.slice(0, -1), ...c] },
					{
						d: metresBetween(head, s0),
						make: (c, x) => [...x.slice().reverse().slice(0, -1), ...c],
					},
				];
				for (const o of opts) {
					if (o.d <= best.d) best = { d: o.d, i, make: o.make };
				}
			}
			if (best.i >= 0 && best.make) {
				const [seg] = remaining.splice(best.i, 1);
				chain = best.make(chain, seg);
				grew = true;
			}
		}
		chains.push(chain);
	}
	return chains;
}

// Group by name (first-seen order), stitch each group, flatten.
const nameOrder = [];
const byName = new Map();
for (const t of rawTrails) {
	const g = byName.get(t.name);
	if (g) g.push(t);
	else {
		byName.set(t.name, [t]);
		nameOrder.push(t.name);
	}
}
const trails = [];
const mergeReport = [];
for (const name of nameOrder) {
	const group = byName.get(name);
	if (group.length === 1) {
		trails.push(group[0]);
		continue;
	}
	const chains = stitch(
		group.map((t) => t.coords),
		MERGE_TOLERANCE_M,
	);
	for (const coords of chains) {
		trails.push({ name, color: group[0].color, folder: group[0].folder, coords });
	}
	mergeReport.push(`${name}: ${group.length} segs -> ${chains.length}`);
}

const points = pts.map((f) => ({
	name: f.properties.title || 'Point',
	lat: f.geometry.coordinates[1],
	lon: f.geometry.coordinates[0],
}));

// Editor identities are persisted in park.json. They are deliberately separate
// from trail names so renaming a segment in the editor does not break selection.
const trailIdCounts = new Map();
for (const trail of trails) {
	const base =
		trail.name
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, '-')
			.replace(/^-|-$/g, '') || 'trail';
	const count = (trailIdCounts.get(base) ?? 0) + 1;
	trailIdCounts.set(base, count);
	trail.id = `trail-${base}-${count}`;
}

let minLat = 90;
let minLon = 180;
let maxLat = -90;
let maxLon = -180;
const bump = (lat, lon) => {
	minLat = Math.min(minLat, lat);
	maxLat = Math.max(maxLat, lat);
	minLon = Math.min(minLon, lon);
	maxLon = Math.max(maxLon, lon);
};
for (const t of trails) for (const [lat, lon] of t.coords) bump(lat, lon);
for (const p of points) bump(p.lat, p.lon);

const park = {
	signs: [],
	trails,
	points,
	center: [(minLat + maxLat) / 2, (minLon + maxLon) / 2],
	bounds: [
		[minLat, minLon],
		[maxLat, maxLon],
	],
};
writeFileSync(out, JSON.stringify(park));

const folders = [...new Set(trails.map((t) => t.folder).filter(Boolean))];
console.log(
	`Wrote ${trails.length} trails (from ${rawTrails.length} segments), ${points.length} points -> src/data/park.json`,
);
console.log(`Folders (${folders.length}): ${folders.join(', ') || '(none)'}`);
if (mergeReport.length > 0)
	console.log(`Merged same-named segments:\n  ${mergeReport.join('\n  ')}`);
