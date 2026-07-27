// Generates the roundel concept. Arc lettering is emitted as individually
// rotated <text> glyphs rather than <textPath>: textPath is unevenly supported
// by SVG renderers and print RIPs, and per-glyph rotation renders identically
// everywhere. Advances come from real Helvetica Bold metrics (units/1000).
import { writeFileSync } from 'node:fs';

const CX = 600;
const CY = 600;

const ADV = {
	A: 722, B: 722, C: 722, D: 722, E: 667, F: 611, G: 778, H: 722, I: 278,
	J: 556, K: 722, L: 611, M: 833, N: 722, O: 778, P: 667, Q: 778, R: 722,
	S: 667, T: 611, U: 722, V: 667, W: 944, X: 667, Y: 667, Z: 611,
	' ': 278, '·': 333, '.': 278, '-': 333,
};
const adv = (ch, size) => ((ADV[ch] ?? 600) / 1000) * size;

const esc = (ch) => (ch === '&' ? '&amp;' : ch === '<' ? '&lt;' : ch);

/**
 * Lay `text` along a circular arc centred on the roundel.
 * @param {string} text
 * @param {number} r      baseline radius
 * @param {number} size   font size
 * @param {number} track  extra tracking between glyphs, in user units
 * @param {'top'|'bottom'} side
 * @param {string} fill
 */
function arcText(text, r, size, track, side, fill) {
	const chars = [...text];
	const widths = chars.map((c) => adv(c, size));
	const total = widths.reduce((a, w) => a + w, 0) + track * (chars.length - 1);

	// Walk from the leading edge, converting arc length to degrees (s = rθ).
	let s = -total / 2;
	const out = [];
	chars.forEach((ch, i) => {
		const centre = s + widths[i] / 2;
		const deg = (centre / r) * (180 / Math.PI);
		s += widths[i] + track;
		if (ch === ' ') return;
		// Rotating about the roundel centre keeps a glyph upright at either
		// pole; the bottom run just walks the other way so it reads L-to-R.
		const a = side === 'top' ? deg : -deg;
		const y = side === 'top' ? CY - r : CY + r;
		out.push(
			`    <text transform="rotate(${a.toFixed(3)} ${CX} ${CY})" x="${CX}" y="${y}">${esc(ch)}</text>`,
		);
	});

	return `  <g fill="${fill}" font-size="${size}" text-anchor="middle"
     font-family="Helvetica Neue, Helvetica, Arial, sans-serif" font-weight="700">
${out.join('\n')}
  </g>`;
}

const TREE = `  <g transform="translate(600 508) scale(1.24)">
    <g fill="#F6F3E9">
      <polygon points="0,-250 -68,-128 68,-128"/>
      <polygon points="0,-192 -88,-64 88,-64"/>
      <polygon points="0,-130 -108,8 108,8"/>
    </g>
    <rect x="-16" y="-10" width="32" height="76" rx="8" fill="#D8B444"/>
    <path d="M-186 104 C -118 76, -70 108, -24 95 C 32 80, 72 110, 186 88"
          fill="none" stroke="#D8B444" stroke-width="26" stroke-linecap="round"/>
  </g>`;

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 1200" width="1200" height="1200"
     role="img" aria-label="Palisades Trailblazer roundel">
  <title>Palisades Trailblazer — Roundel</title>
  <!-- 2 spot colors on a forest-green shirt.
       cream #F6F3E9 · gold #D8B444 · knockout (bare shirt) #1D4524 -->

  <g fill="none" stroke="#F6F3E9">
    <circle cx="600" cy="600" r="548" stroke-width="18"/>
    <circle cx="600" cy="600" r="514" stroke-width="6"/>
  </g>
  <circle cx="600" cy="600" r="392" fill="none" stroke="#D8B444" stroke-width="7"/>

${arcText('PALISADES PARK', 428, 72, 9, 'top', '#F6F3E9')}

${arcText('EVERY POINT FOUND', 452, 44, 20, 'bottom', '#D8B444')}

  <!-- four-point stars closing the gap between the arcs -->
  <g fill="#D8B444">
    <path d="M78 600 c26 -6 38 -18 44 -44 6 26 18 38 44 44 -26 6 -38 18 -44 44 -6 -26 -18 -38 -44 -44z"/>
    <path d="M1122 600 c-26 -6 -38 -18 -44 -44 -6 26 -18 38 -44 44 26 6 38 18 44 44 6 -26 18 -38 44 -44z"/>
  </g>

  <!-- ── center emblem: layered evergreen over a winding trail ── -->
${TREE}

  <!-- ── banner: gold bar with notched tails, wordmark knocked out to shirt ── -->
  <g transform="translate(600 812)">
    <path d="M-336 -52 h672 v104 h-672z
             M-336 -52 L-454 -52 L-408 0 L-454 52 L-336 52 Z
             M336 -52 L454 -52 L408 0 L454 52 L336 52 Z"
          fill="#D8B444"/>
    <text x="0" y="22" text-anchor="middle" fill="#1D4524" font-size="72" letter-spacing="9"
          font-family="Helvetica Neue, Helvetica, Arial, sans-serif" font-weight="700">TRAILBLAZER</text>
  </g>
</svg>
`;

writeFileSync(process.argv[2], svg);
console.log('wrote', process.argv[2]);
