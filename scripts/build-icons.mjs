// Rasterizes the PWA icon set from the committed SVG sources in public/icons/.
// Run with `npm run icons`. Requires `rsvg-convert` (librsvg) on PATH:
//   brew install librsvg   /   apt-get install librsvg2-bin
//
// Sources (edit these, then re-run):
//   icon.svg          rounded-square, purpose "any"
//   icon-maskable.svg full-bleed, artwork inside the 80% safe zone (maskable)
//   icon-apple.svg    full-bleed square (iOS applies its own corner mask)
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ICONS = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'icons');

/** source svg -> [ [outName, size], ... ] */
const TARGETS = {
	'icon.svg': [
		['icon-192.png', 192],
		['icon-512.png', 512],
	],
	'icon-maskable.svg': [
		['maskable-192.png', 192],
		['maskable-512.png', 512],
	],
	'icon-apple.svg': [['apple-touch-icon.png', 180]],
};

for (const [src, outs] of Object.entries(TARGETS)) {
	for (const [out, size] of outs) {
		execFileSync('rsvg-convert', [
			'-w',
			String(size),
			'-h',
			String(size),
			join(ICONS, src),
			'-o',
			join(ICONS, out),
		]);
		console.log(`${src} -> ${out} (${size}px)`);
	}
}
