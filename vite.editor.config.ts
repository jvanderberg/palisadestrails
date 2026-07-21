import { randomBytes } from 'node:crypto';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { basename, resolve } from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';

const root = import.meta.dirname;
const dataDir = resolve(root, 'src/data');
const backupRoot = resolve(root, '.trail-editor-backups');
const token = randomBytes(24).toString('hex');
const coreFiles = {
	park: resolve(dataDir, 'park.json'),
	pois: resolve(dataDir, 'pois.json'),
	hikes: resolve(dataDir, 'hikes.json'),
};

interface CatalogHike {
	id: string;
	name: string;
	routeFile: string;
	difficulty: 'Easy' | 'Moderate' | 'Hard';
	description: string;
	poiIds?: string[];
	route?: { names: string[]; coords: [number, number][] };
}

interface EditorPayload {
	park: {
		signs: unknown[];
		trails: Array<{
			id: string;
			name: string;
			color: string;
			folder: string | null;
			coords: [number, number][];
		}>;
		points: Array<{ name: string; lat: number; lon: number }>;
		center: [number, number];
		bounds: [[number, number], [number, number]];
	};
	pois: Array<{
		id: string;
		name: string;
		emoji: string;
		lat: number;
		lon: number;
		hint: string;
		color?: string;
	}>;
	hikes: CatalogHike[];
}

function routePath(routeFile: string): string {
	if (!/^[a-z0-9][a-z0-9-]*\.json$/.test(routeFile))
		throw new Error(`Unsafe route filename: ${routeFile}`);
	return resolve(dataDir, routeFile);
}

async function readJson<T>(path: string): Promise<T> {
	return JSON.parse(await readFile(path, 'utf8')) as T;
}

async function loadProject(): Promise<EditorPayload> {
	const [park, pois, catalog] = await Promise.all([
		readJson<EditorPayload['park']>(coreFiles.park),
		readJson<EditorPayload['pois']>(coreFiles.pois),
		readJson<CatalogHike[]>(coreFiles.hikes),
	]);
	park.trails = park.trails.map((trail, index) => ({
		...trail,
		id: trail.id || `trail-${index + 1}`,
	}));
	const hikes = await Promise.all(
		catalog.map(async (hike) => ({
			...hike,
			route: await readJson<NonNullable<CatalogHike['route']>>(routePath(hike.routeFile)),
		})),
	);
	return { park, pois, hikes };
}

function finite(value: unknown): value is number {
	return typeof value === 'number' && Number.isFinite(value);
}

function validate(project: EditorPayload): EditorPayload {
	if (!project?.park || !Array.isArray(project.park.trails)) throw new Error('Missing trail data.');
	if (
		!Array.isArray(project.park.points) ||
		!Array.isArray(project.pois) ||
		!Array.isArray(project.hikes)
	) {
		throw new Error('Markers, POIs, and hikes must be arrays.');
	}
	const trailIds = new Set<string>();
	for (const trail of project.park.trails) {
		if (!trail.id || trailIds.has(trail.id))
			throw new Error(`Duplicate or missing trail ID: ${trail.id}`);
		trailIds.add(trail.id);
		if (!trail.name || !/^#[0-9a-f]{6}$/i.test(trail.color))
			throw new Error(`Invalid trail: ${trail.id}`);
		if (
			trail.coords.length < 2 ||
			trail.coords.some(([lat, lon]) => !finite(lat) || !finite(lon))
		) {
			throw new Error(`Trail ${trail.name} needs at least two valid coordinates.`);
		}
	}
	for (const point of project.park.points) {
		if (!point.name || !finite(point.lat) || !finite(point.lon))
			throw new Error(`Invalid marker: ${point.name || 'unnamed'}`);
	}
	const poiIds = new Set<string>();
	for (const poi of project.pois) {
		if (!/^[a-z0-9][a-z0-9-]*$/.test(poi.id) || poiIds.has(poi.id))
			throw new Error(`Duplicate or invalid POI ID: ${poi.id}`);
		poiIds.add(poi.id);
		if (!poi.name || !poi.emoji || !finite(poi.lat) || !finite(poi.lon))
			throw new Error(`Invalid POI: ${poi.id}`);
	}
	const hikeIds = new Set<string>();
	for (const hike of project.hikes) {
		if (!/^[a-z0-9][a-z0-9-]*$/.test(hike.id) || hikeIds.has(hike.id))
			throw new Error(`Duplicate or invalid hike ID: ${hike.id}`);
		hikeIds.add(hike.id);
		if (!hike.name || !['Easy', 'Moderate', 'Hard'].includes(hike.difficulty))
			throw new Error(`Invalid hike: ${hike.id}`);
		if (
			!hike.route ||
			!Array.isArray(hike.route.names) ||
			!Array.isArray(hike.route.coords) ||
			hike.route.coords.length < 2 ||
			hike.route.coords.some(([lat, lon]) => !finite(lat) || !finite(lon))
		)
			throw new Error(`Hike ${hike.name} needs a route.`);
		hike.routeFile = `${hike.id}.json`;
	}
	return project;
}

function computeExtent(project: EditorPayload) {
	const coords: [number, number][] = project.park.trails.flatMap((trail) => trail.coords);
	coords.push(...project.park.points.map((point) => [point.lat, point.lon] as [number, number]));
	coords.push(...project.pois.map((point) => [point.lat, point.lon] as [number, number]));
	const lats = coords.map(([lat]) => lat);
	const lons = coords.map(([, lon]) => lon);
	if (!coords.length)
		return {
			center: [0, 0] as [number, number],
			bounds: [
				[0, 0],
				[0, 0],
			] as [[number, number], [number, number]],
		};
	const bounds: [[number, number], [number, number]] = [
		[Math.min(...lats), Math.min(...lons)],
		[Math.max(...lats), Math.max(...lons)],
	];
	return {
		center: [(bounds[0][0] + bounds[1][0]) / 2, (bounds[0][1] + bounds[1][1]) / 2] as [
			number,
			number,
		],
		bounds,
	};
}

async function atomicWrite(path: string, contents: string) {
	const temp = `${path}.${process.pid}.tmp`;
	await writeFile(temp, contents);
	await rename(temp, path);
}

async function backup(files: string[]) {
	const dir = resolve(backupRoot, new Date().toISOString().replace(/[:.]/g, '-'));
	await mkdir(dir, { recursive: true });
	for (const file of files) {
		try {
			await writeFile(resolve(dir, basename(file)), await readFile(file));
		} catch (error) {
			if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
		}
	}
	return dir.slice(root.length + 1);
}

async function saveProject(input: EditorPayload) {
	const before = await loadProject();
	const project = validate(input);
	const oldRoutes = before.hikes.map((hike) => routePath(hike.routeFile));
	const newRoutes = project.hikes.map((hike) => routePath(hike.routeFile));
	const backupPath = await backup([
		coreFiles.park,
		coreFiles.pois,
		coreFiles.hikes,
		...new Set([...oldRoutes, ...newRoutes]),
	]);
	Object.assign(project.park, computeExtent(project));
	const encode = (value: unknown) => `${JSON.stringify(value)}\n`;
	await atomicWrite(coreFiles.park, encode(project.park));
	await atomicWrite(coreFiles.pois, encode(project.pois));
	await atomicWrite(
		coreFiles.hikes,
		encode(
			project.hikes.map((hike) => ({
				id: hike.id,
				name: hike.name,
				routeFile: hike.routeFile,
				difficulty: hike.difficulty,
				description: hike.description,
				...(hike.poiIds ? { poiIds: hike.poiIds } : {}),
			})),
		),
	);
	for (const hike of project.hikes)
		await atomicWrite(routePath(hike.routeFile), encode(hike.route));
	const retained = new Set(newRoutes);
	for (const file of oldRoutes) if (!retained.has(file)) await rm(file, { force: true });
	return { backup: backupPath, files: 3 + project.hikes.length };
}

async function requestJson(req: IncomingMessage): Promise<unknown> {
	let body = '';
	for await (const chunk of req) {
		body += chunk;
		if (body.length > 50_000_000) throw new Error('Request too large.');
	}
	return JSON.parse(body);
}

function respond(res: ServerResponse, status: number, value: unknown) {
	res.statusCode = status;
	res.setHeader('Content-Type', 'application/json; charset=utf-8');
	res.setHeader('Cache-Control', 'no-store');
	res.end(JSON.stringify(value));
}

function editorApi(): Plugin {
	return {
		name: 'palisades-editor-api',
		configureServer(server) {
			server.middlewares.use(async (req, res, next) => {
				if (req.url === '/api/editor/data' && req.method === 'GET') {
					try {
						respond(res, 200, { token, project: await loadProject() });
					} catch (error) {
						respond(res, 500, { error: (error as Error).message });
					}
					return;
				}
				if (req.url === '/api/editor/save' && req.method === 'POST') {
					try {
						if (req.headers['x-editor-token'] !== token) throw new Error('Invalid editor token.');
						respond(res, 200, await saveProject((await requestJson(req)) as EditorPayload));
					} catch (error) {
						respond(res, 400, { error: (error as Error).message });
					}
					return;
				}
				next();
			});
		},
	};
}

export default defineConfig({
	plugins: [react(), editorApi()],
	server: { host: '127.0.0.1', port: 4174, strictPort: true, open: '/tools/editor/' },
	build: {
		outDir: '.editor-dist',
		emptyOutDir: true,
		rollupOptions: { input: resolve(root, 'tools/editor/index.html') },
	},
});
