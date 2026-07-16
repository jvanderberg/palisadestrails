import { readFile, writeFile } from 'node:fs/promises';

const marker = '__PALISADES_BUILD_ID__';
const buildId = process.env.GITHUB_SHA?.slice(0, 12) ?? Date.now().toString(36);
const workerUrl = new URL('../dist/sw.js', import.meta.url);
const worker = await readFile(workerUrl, 'utf8');

if (!worker.includes(marker)) {
	throw new Error(`Service-worker build marker ${marker} was not found`);
}

await writeFile(workerUrl, worker.replaceAll(marker, buildId));
console.log(`Stamped service worker with build ${buildId}`);
