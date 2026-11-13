// Bake the 3D fly-through terrain from public-domain USGS sources.
//
//   npm run terrain
//
// Elevation: USGS 3DEP (1 m lidar here — MI_13County_2015), via the
//   3DEPElevation ImageServer.
// Imagery:   USDA NAIP (2022, 0.6 m), via the USGS NAIP ImageServer.
//
// Two layers are written to tools/flythrough/public/terrain/:
//   inner — the trail network plus a margin, at 2 m elevation / ~0.75 m imagery
//   outer — a 16 km context square at 20 m, so the horizon isn't a cliff edge
//
// Every raster is requested in Web Mercator (EPSG:3857) with an exact
// pixel-aligned bbox, so the elevation grid and the photo line up 1:1. The
// browser converts lat/lon to the same Mercator space and rescales by
// cos(lat) to true metres (accurate to <0.01% over a park this size).
//
// Heights are stored as uint16 centimetres above `base`, delta-encoded along
// each row and gzipped (decoded in the browser with fflate).
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
import { fromArrayBuffer } from 'geotiff';

const here = dirname(fileURLToPath(import.meta.url));
const dataDir = resolve(here, '../src/data');
const outDir = resolve(here, '../tools/flythrough/public/terrain');

const DEM_URL =
	'https://elevation.nationalmap.gov/arcgis/rest/services/3DEPElevation/ImageServer/exportImage';
const NAIP_URL =
	'https://imagery.nationalmap.gov/arcgis/rest/services/USGSNAIPImagery/ImageServer/exportImage';

const R = 6378137;
const DEG = Math.PI / 180;

const park = JSON.parse(await readFile(resolve(dataDir, 'park.json'), 'utf8'));
const pois = JSON.parse(await readFile(resolve(dataDir, 'pois.json'), 'utf8'));

const pts = [
	...park.trails.flatMap((t) => t.coords),
	...pois.map((p) => [p.lat, p.lon]),
	...park.points.map((p) => [p.lat, p.lon]),
];
const lats = pts.map((p) => p[0]);
const lons = pts.map((p) => p[1]);
const minLat = Math.min(...lats);
const maxLat = Math.max(...lats);
const minLon = Math.min(...lons);
const maxLon = Math.max(...lons);
const lat0 = (minLat + maxLat) / 2;
const lon0 = (minLon + maxLon) / 2;
// Mercator → true-metre scale at the park's latitude.
const k = Math.cos(lat0 * DEG);

const mercX = (lon) => R * lon * DEG;
const mercY = (lat) => R * Math.log(Math.tan(Math.PI / 4 + (lat * DEG) / 2));
const cx = mercX(lon0);
const cy = mercY(lat0);

// Trail extent in true metres around the centre.
const halfW = ((mercX(maxLon) - mercX(minLon)) * k) / 2;
const halfH = ((mercY(maxLat) - mercY(minLat)) * k) / 2;

/** A pixel-aligned Mercator bbox of cols × rows cells of `res` true metres. */
function grid(halfWm, halfHm, res) {
	const cols = Math.round((2 * halfWm) / res);
	const rows = Math.round((2 * halfHm) / res);
	const w = (cols * res) / k;
	const h = (rows * res) / k;
	return { cols, rows, res, bbox: [cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2] };
}

async function fetchRetry(url, tries = 4) {
	for (let i = 1; ; i++) {
		try {
			const res = await fetch(url);
			if (!res.ok) throw new Error(`HTTP ${res.status}`);
			return res;
		} catch (err) {
			if (i >= tries) throw new Error(`${err.message} for ${url}`);
			console.warn(`  retry ${i} (${err.message})`);
			await new Promise((r) => setTimeout(r, 1500 * i));
		}
	}
}

/** exportImage → JSON (to verify the served extent), then download it. */
async function exportImage(base, g, cols, rows, params) {
	const q = new URLSearchParams({
		bbox: g.bbox.join(','),
		bboxSR: '3857',
		imageSR: '3857',
		size: `${cols},${rows}`,
		...params,
		f: 'json',
	});
	const meta = await (await fetchRetry(`${base}?${q}`)).json();
	if (!meta.href) throw new Error(`exportImage failed: ${JSON.stringify(meta)}`);
	const e = meta.extent;
	const tol = (g.bbox[2] - g.bbox[0]) / cols / 2;
	if (
		meta.width !== cols ||
		meta.height !== rows ||
		Math.abs(e.xmin - g.bbox[0]) > tol ||
		Math.abs(e.ymax - g.bbox[3]) > tol
	) {
		throw new Error(`Server adjusted the extent: ${JSON.stringify(meta)}`);
	}
	return new Uint8Array(await (await fetchRetry(meta.href)).arrayBuffer());
}

async function bakeDem(name, g) {
	console.log(`${name}: DEM ${g.cols}×${g.rows} @ ${g.res} m`);
	const buf = await exportImage(DEM_URL, g, g.cols, g.rows, {
		format: 'tiff',
		pixelType: 'F32',
		interpolation: 'RSP_BilinearInterpolation',
	});
	const tiff = await fromArrayBuffer(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.length));
	const img = await tiff.getImage();
	const [band] = await img.readRasters();
	if (img.getWidth() !== g.cols || img.getHeight() !== g.rows) throw new Error('DEM size mismatch');
	const valid = (v) => Number.isFinite(v) && v > -1000 && v < 10000;
	let min = Infinity;
	let max = -Infinity;
	for (const v of band) {
		if (!valid(v)) continue;
		if (v < min) min = v;
		if (v > max) max = v;
	}
	console.log(`  elevation ${min.toFixed(2)}–${max.toFixed(2)} m`);
	return { band, min, max, valid };
}

function encodeHeights(dem, base) {
	const { band, valid } = dem;
	const n = band.length;
	const q = new Uint16Array(n);
	for (let i = 0; i < n; i++) {
		const v = valid(band[i]) ? band[i] : base;
		q[i] = Math.max(0, Math.min(65535, Math.round((v - base) * 100)));
	}
	return q;
}

function deltaGzip(q, cols) {
	const d = new Uint16Array(q.length);
	for (let i = 0; i < q.length; i++) d[i] = i % cols === 0 ? q[i] : (q[i] - q[i - 1]) & 0xffff;
	return gzipSync(Buffer.from(d.buffer), { level: 9 });
}

async function bakeImage(name, g, px) {
	const cols = px;
	const rows = Math.round((px * g.rows) / g.cols);
	console.log(`${name}: imagery ${cols}×${rows}`);
	const jpg = await exportImage(NAIP_URL, g, cols, rows, {
		format: 'jpg',
		compressionQuality: '82',
		bandIds: '0,1,2',
		interpolation: 'RSP_BilinearInterpolation',
	});
	return { jpg, cols, rows };
}

const MARGIN_M = 350;
const inner = grid(halfW + MARGIN_M, halfH + MARGIN_M, 2);
// Big enough that its edges sit ~8 km out, deep in the haze, from anywhere a
// fly-through goes.
const outer = grid(8000, 8000, 20);

const [innerDem, outerDem] = [await bakeDem('inner', inner), await bakeDem('outer', outer)];
// Lake Michigan is hydro-flattened in the DEM — every lake cell holds the same
// value — and it covers much of the outer square, so the lake surface is the
// most common elevation there (to the centimetre). Robust to inland pits below
// lake level and to odd values far offshore.
function modalElevation(dem) {
	const counts = new Map();
	for (const v of dem.band) {
		if (!dem.valid(v)) continue;
		const cm = Math.round(v * 100);
		counts.set(cm, (counts.get(cm) ?? 0) + 1);
	}
	let best = 0;
	let bestCount = 0;
	for (const [cm, n] of counts) {
		if (n > bestCount) {
			best = cm;
			bestCount = n;
		}
	}
	return best / 100;
}
const lakeLevel = modalElevation(outerDem);
console.log(`  lake level ${lakeLevel.toFixed(2)} m`);
const base = Math.floor(Math.min(innerDem.min, outerDem.min)) - 1;

const innerImg = await bakeImage('inner', inner, Math.min(4000, Math.round((inner.cols * 2) / 0.75)));
const outerImg = await bakeImage('outer', outer, 3200);

await mkdir(outDir, { recursive: true });
const files = {
	'inner-heights.bin': deltaGzip(encodeHeights(innerDem, base), inner.cols),
	'outer-heights.bin': deltaGzip(encodeHeights(outerDem, base), outer.cols),
	'inner.jpg': innerImg.jpg,
	'outer.jpg': outerImg.jpg,
};
for (const [file, bytes] of Object.entries(files)) {
	await writeFile(resolve(outDir, file), bytes);
	console.log(`  wrote ${file} (${(bytes.length / 1024).toFixed(0)} KiB)`);
}

const layer = (g, dem, img, stem) => ({
	cols: g.cols,
	rows: g.rows,
	res: g.res,
	bbox: g.bbox,
	min: dem.min,
	max: dem.max,
	heights: `${stem}-heights.bin`,
	image: `${stem}.jpg`,
	imageSize: [img.cols, img.rows],
});

const meta = {
	generated: new Date().toISOString().slice(0, 10),
	sources: {
		elevation: 'USGS 3DEP 1 m lidar DEM (MI 13 County 2015)',
		imagery: 'USDA NAIP 2022 via USGS The National Map',
	},
	center: [lat0, lon0],
	origin: [cx, cy],
	k,
	base,
	heightScale: 0.01,
	lakeLevel,
	inner: layer(inner, innerDem, innerImg, 'inner'),
	outer: layer(outer, outerDem, outerImg, 'outer'),
};
await writeFile(resolve(outDir, 'terrain.json'), `${JSON.stringify(meta, null, '\t')}\n`);
console.log('  wrote terrain.json');
