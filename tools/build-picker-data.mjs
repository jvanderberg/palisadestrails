// Node the trail network for the segment picker: split every trail at each
// intersection (where another trail's endpoint touches it, or where two
// trails cross). Writes tools/park-data.js. Production park.json is untouched.
//   node tools/build-picker-data.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const park = JSON.parse(readFileSync(resolve(here, '../src/data/park.json'), 'utf8'));
const trails = park.trails;

const rad = Math.PI / 180;
const lat0 = park.center[0];
const kx = Math.cos(lat0 * rad) * 111320;
const ky = 110540;
const XY = ([lat, lon]) => [lon * kx, lat * ky];
const dist = (a, b) => { const [ax, ay] = XY(a), [bx, by] = XY(b); return Math.hypot(ax - bx, ay - by); };

const TOL = 8; // metres: a point this close to a trail counts as touching it

// nearest vertex index on trail t to point p
function nearestIdx(coords, p) {
	let bi = 0, bd = Infinity;
	for (let i = 0; i < coords.length; i++) { const d = dist(coords[i], p); if (d < bd) { bd = d; bi = i; } }
	return { bi, bd };
}

// proper crossing of segments a1a2 and b1b2 -> intersection point or null
function cross(a1, a2, b1, b2) {
	const [x1, y1] = XY(a1), [x2, y2] = XY(a2), [x3, y3] = XY(b1), [x4, y4] = XY(b2);
	const d = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
	if (Math.abs(d) < 1e-6) return null;
	const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / d;
	const u = ((x1 - x3) * (y1 - y2) - (y1 - y3) * (x1 - x2)) / d;
	if (t >= 0 && t <= 1 && u >= 0 && u <= 1) return [a1[0] + (a2[0] - a1[0]) * t, a1[1] + (a2[1] - a1[1]) * t];
	return null;
}

// collect split vertex indices per trail
const splits = trails.map((t) => new Set([0, t.coords.length - 1]));

// endpoints of every trail
const endpoints = [];
trails.forEach((t) => { endpoints.push(t.coords[0]); endpoints.push(t.coords[t.coords.length - 1]); });

trails.forEach((t, i) => {
	// T-junctions: another trail's endpoint lies on this trail
	for (const ep of endpoints) {
		const { bi, bd } = nearestIdx(t.coords, ep);
		if (bd <= TOL && bi > 0 && bi < t.coords.length - 1) splits[i].add(bi);
	}
});

// X-crossings between every pair
for (let i = 0; i < trails.length; i++) {
	for (let j = i + 1; j < trails.length; j++) {
		const ci = trails[i].coords, cj = trails[j].coords;
		for (let a = 0; a < ci.length - 1; a++) {
			for (let b = 0; b < cj.length - 1; b++) {
				const X = cross(ci[a], ci[a + 1], cj[b], cj[b + 1]);
				if (!X) continue;
				const ni = nearestIdx(ci, X); if (ni.bi > 0 && ni.bi < ci.length - 1) splits[i].add(ni.bi);
				const nj = nearestIdx(cj, X); if (nj.bi > 0 && nj.bi < cj.length - 1) splits[j].add(nj.bi);
			}
		}
	}
}

// split trails at their split indices
const out = [];
trails.forEach((t, i) => {
	const idx = [...splits[i]].sort((a, b) => a - b);
	for (let k = 0; k < idx.length - 1; k++) {
		const coords = t.coords.slice(idx[k], idx[k + 1] + 1);
		if (coords.length >= 2) {
			let len = 0;
			for (let m = 1; m < coords.length; m++) len += dist(coords[m - 1], coords[m]);
			if (len >= 3) out.push({ name: t.name, color: t.color, coords });
		}
	}
});

writeFileSync(
	resolve(here, 'park-data.js'),
	`window.PARK=${JSON.stringify({ trails: out, bounds: park.bounds })};`,
);
console.log(`Noded ${trails.length} trails -> ${out.length} pickable segments (split at intersections).`);
