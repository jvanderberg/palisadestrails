// Record the scripted 3D fly-through to an MP4.
//
//   npm run record
//   npm run record -- --hike big-pine-ridge --relief 1.5 --fps 30 --size 1920x1080
//   npm run record -- --stills 0,6,12,18,26     # quick PNG stills to check framing
//
// Starts its own Vite server for the fly-through app, opens it headless with
// `?record` (UI hidden; see src/flythrough/recorder.ts), renders the camera
// move from src/flythrough/cinematic.ts one exact frame at a time, and pipes
// the frames into ffmpeg (must be on PATH). Rendering is frame-by-frame, so
// the video is perfectly smooth however slow the browser is.
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { chromium } from 'playwright';
import { createServer } from 'vite';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const { values: args } = parseArgs({
	options: {
		hike: { type: 'string', default: 'big-pine-ridge' },
		relief: { type: 'string', default: '1.5' },
		fps: { type: 'string', default: '30' },
		size: { type: 'string', default: '1920x1080' },
		out: { type: 'string' },
		stills: { type: 'string' },
		gl: { type: 'string', default: 'gpu' },
	},
});
const fps = Number(args.fps);
const [width, height] = args.size.split('x').map(Number);
const out = resolve(root, args.out ?? `output/video/flythrough-${args.hike}.mp4`);

const GL_ARGS = {
	// macOS: render through Metal on the real GPU.
	gpu: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'],
	// Anywhere: slow but dependable CPU rendering.
	swiftshader: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
};

const server = await createServer({
	configFile: resolve(root, 'vite.flythrough.config.ts'),
	server: { port: 4185, strictPort: false, host: '127.0.0.1' },
	logLevel: 'warn',
});
await server.listen();
const base = server.resolvedUrls?.local[0];
if (!base) throw new Error('Vite did not report a local URL');

const browser = await chromium.launch({ args: GL_ARGS[args.gl] ?? GL_ARGS.gpu });
try {
	const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
	page.on('pageerror', (err) => console.error('page error:', err.message));
	page.on('console', (msg) => {
		if (msg.type() === 'error') console.error('console:', msg.text());
	});
	// Skip the access gate for the recording session.
	await page.addInitScript(() => localStorage.setItem('palisades-flythrough-unlocked', '1'));
	await page.goto(`${base}?record&relief=${args.relief}#hike=${args.hike}`);
	await page.waitForFunction(() => window.__flyRecorder, null, { timeout: 120_000 });
	const { duration } = await page.evaluate(() => window.__flyRecorder.prepare());
	const renderer = await page.evaluate(() => {
		const gl = document.querySelector('canvas')?.getContext('webgl2');
		const info = gl?.getExtension('WEBGL_debug_renderer_info');
		return info && gl ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL) : 'unknown';
	});
	console.log(`Shot is ${duration.toFixed(1)} s · ${width}×${height} @ ${fps} fps · GL: ${renderer}`);

	const frame = async (t) => {
		const url = await page.evaluate(([time, dt]) => window.__flyRecorder.frame(time, dt), [t, 1 / fps]);
		return Buffer.from(url.slice(url.indexOf(',') + 1), 'base64');
	};

	if (args.stills) {
		const dir = resolve(root, 'output/video/stills');
		await mkdir(dir, { recursive: true });
		for (const t of args.stills.split(',').map(Number)) {
			const file = resolve(dir, `still-${t.toFixed(1)}s.jpg`);
			await writeFile(file, await frame(t));
			console.log(`  ${file}`);
		}
	} else {
		await mkdir(dirname(out), { recursive: true });
		const ffmpeg = spawn(
			'ffmpeg',
			[
				...['-y', '-loglevel', 'error'],
				...['-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'mjpeg', '-i', '-'],
				// Short fade in from / out to black.
				...['-vf', `fade=t=in:st=0:d=0.6,fade=t=out:st=${(duration - 1).toFixed(2)}:d=1`],
				...['-c:v', 'libx264', '-preset', 'slow', '-crf', '20', '-pix_fmt', 'yuv420p'],
				...['-movflags', '+faststart', out],
			],
			{ stdio: ['pipe', 'inherit', 'inherit'] },
		);
		const total = Math.round(duration * fps) + 1;
		const started = Date.now();
		for (let i = 0; i < total; i++) {
			const jpg = await frame(i / fps);
			if (!ffmpeg.stdin.write(jpg)) await once(ffmpeg.stdin, 'drain');
			if (i % fps === 0 || i === total - 1) {
				const per = (Date.now() - started) / (i + 1);
				const eta = Math.round(((total - i - 1) * per) / 1000);
				console.log(`  frame ${i + 1}/${total} · ${Math.round(per)} ms/frame · ~${eta}s left`);
			}
		}
		ffmpeg.stdin.end();
		const [code] = await once(ffmpeg, 'close');
		if (code !== 0) throw new Error(`ffmpeg exited with ${code}`);
		console.log(`Wrote ${out}`);
	}
} finally {
	await browser.close();
	await server.close();
}
