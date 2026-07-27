// Generates the topo-contour concept: nested organic rings from a fixed
// radial harmonic (deterministic, no RNG) so the file is reproducible.
import { writeFileSync } from 'node:fs';

const CX = 500;
const CY = 390;

// Harmonics shaping the landform. Identical at every elevation, so the rings
// nest without ever crossing.
const HARM = [
	{ k: 2, amp: 0.13, ph: 0.6 },
	{ k: 3, amp: 0.085, ph: 2.1 },
	{ k: 5, amp: 0.042, ph: 4.4 },
	{ k: 7, amp: 0.022, ph: 1.2 },
];

function ring(r0, steps = 240) {
	const pts = [];
	for (let i = 0; i < steps; i++) {
		const a = (i / steps) * Math.PI * 2;
		let f = 1;
		for (const { k, amp, ph } of HARM) f += amp * Math.sin(k * a + ph);
		pts.push([CX + r0 * f * Math.cos(a), CY + r0 * f * 0.74 * Math.sin(a)]);
	}
	return pts;
}

// Closed Catmull-Rom through the samples, emitted as cubic beziers.
function toPath(pts) {
	const n = pts.length;
	const at = (i) => pts[(i + n) % n];
	const f = (v) => v.toFixed(1);
	let d = `M${f(at(0)[0])} ${f(at(0)[1])}`;
	for (let i = 0; i < n; i++) {
		const [x0, y0] = at(i - 1);
		const [x1, y1] = at(i);
		const [x2, y2] = at(i + 1);
		const [x3, y3] = at(i + 2);
		d += `C${f(x1 + (x2 - x0) / 6)} ${f(y1 + (y2 - y0) / 6)}`;
		d += ` ${f(x2 - (x3 - x1) / 6)} ${f(y2 - (y3 - y1) / 6)}`;
		d += ` ${f(x2)} ${f(y2)}`;
	}
	return `${d}Z`;
}

const RINGS = [];
for (let r = 62; r <= 580; r += 34) RINGS.push(r);

// Every fourth line is an index contour: heavier, gold.
const contours = RINGS.map((r, i) => {
	const index = i % 4 === 2;
	return `      <path d="${toPath(ring(r))}" stroke="${index ? '#D8B444' : '#F6F3E9'}" stroke-width="${index ? 7 : 3.2}"/>`;
}).join('\n');

const ROUTE =
	'M150 618 C 268 570, 286 452, 386 402 C 486 352, 534 448, 622 392 C 710 336, 742 232, 858 214';

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1120" width="1000" height="1120"
     role="img" aria-label="Palisades Trailblazer topographic">
  <title>Palisades Trailblazer — Topographic</title>
  <!-- 2 spot colors on a forest-green shirt.
       cream #F6F3E9 · gold #D8B444 · knockout (bare shirt) #1D4524 -->
  <defs>
    <clipPath id="panel"><rect x="84" y="74" width="832" height="632" rx="26"/></clipPath>
  </defs>

  <g clip-path="url(#panel)">
    <!-- ── contour field ── -->
    <g fill="none" stroke-linejoin="round">
${contours}
    </g>

    <!-- ── route: knocked out of the contours, dashed in gold ── -->
    <path d="${ROUTE}" fill="none" stroke="#1D4524" stroke-width="34"
          stroke-linecap="round" stroke-linejoin="round"/>
    <path d="${ROUTE}" fill="none" stroke="#D8B444" stroke-width="13"
          stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="3 32"/>
    <g fill="#D8B444" stroke="#1D4524" stroke-width="9">
      <circle cx="150" cy="618" r="22"/>
      <circle cx="858" cy="214" r="22"/>
    </g>
  </g>
  <rect x="84" y="74" width="832" height="632" rx="26" fill="none"
        stroke="#D8B444" stroke-width="7"/>

  <!-- ── wordmark ── -->
  <g text-anchor="middle" font-family="Helvetica Neue, Helvetica, Arial, sans-serif">
    <text x="500" y="822" fill="#D8B444" font-size="48" font-weight="700"
          letter-spacing="28">PALISADES PARK</text>
    <rect x="110" y="864" width="780" height="5" fill="#D8B444"/>
    <text x="500" y="1000" fill="#F6F3E9" font-size="124" font-weight="700"
          letter-spacing="2">TRAILBLAZER</text>
  </g>
</svg>
`;

writeFileSync(process.argv[2], svg);
console.log('wrote', process.argv[2]);
