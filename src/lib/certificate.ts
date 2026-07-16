// Draws a rank certificate onto a canvas. Kept framework-free so the same
// routine renders the on-screen preview and the saved/shared PNG.
import { GAME_CONFIG, isTopTier, type Tier } from '../data/collectibles';
import { fmtDate } from './geo';

export interface CertData {
	tier: Tier;
	name: string;
	count: number;
	collectedNames: string[];
	date: Date;
}

function roundRect(
	g: CanvasRenderingContext2D,
	x: number,
	y: number,
	w: number,
	h: number,
	r: number,
) {
	g.beginPath();
	g.moveTo(x + r, y);
	g.arcTo(x + w, y, x + w, y + h, r);
	g.arcTo(x + w, y + h, x, y + h, r);
	g.arcTo(x, y + h, x, y, r);
	g.arcTo(x, y, x + w, y, r);
	g.closePath();
}

function clip(g: CanvasRenderingContext2D, text: string, maxW: number): string {
	if (g.measureText(text).width <= maxW) return text;
	let t = text;
	while (t.length > 1 && g.measureText(`${t}…`).width > maxW) t = t.slice(0, -1);
	return `${t}…`;
}

function wrap(
	g: CanvasRenderingContext2D,
	text: string,
	cx: number,
	y: number,
	maxW: number,
	lh: number,
) {
	let line = '';
	let yy = y;
	for (const word of text.split(' ')) {
		const test = line ? `${line} ${word}` : word;
		if (g.measureText(test).width > maxW && line) {
			g.fillText(line, cx, yy);
			line = word;
			yy += lh;
		} else {
			line = test;
		}
	}
	if (line) g.fillText(line, cx, yy);
}

export function drawCertificate(canvas: HTMLCanvasElement, data: CertData): void {
	const g = canvas.getContext('2d');
	if (!g) return;
	const W = canvas.width;
	const H = canvas.height;
	const sans = "-apple-system, 'Segoe UI', Roboto, sans-serif";

	const grad = g.createLinearGradient(0, 0, 0, H);
	grad.addColorStop(0, '#2f6b3a');
	grad.addColorStop(1, '#1c4523');
	g.fillStyle = grad;
	g.fillRect(0, 0, W, H);

	g.fillStyle = '#f7f5ec';
	roundRect(g, 70, 70, W - 140, H - 140, 36);
	g.fill();
	g.strokeStyle = '#c9a53a';
	g.lineWidth = 10;
	roundRect(g, 108, 108, W - 216, H - 216, 22);
	g.stroke();
	g.strokeStyle = 'rgba(47,107,58,.4)';
	g.lineWidth = 3;
	roundRect(g, 128, 128, W - 256, H - 256, 14);
	g.stroke();

	const isTop = isTopTier(data.tier);
	g.textAlign = 'center';
	g.fillStyle = '#234f2c';
	g.font = `600 38px ${sans}`;
	g.fillText('CERTIFIED', W / 2, 232);
	g.fillStyle = '#2f6b3a';
	const titleUpper = data.tier.title.toUpperCase();
	g.font = `800 ${titleUpper.length > 10 ? 88 : 100}px ${sans}`;
	g.fillText(titleUpper, W / 2, 336);
	g.font = '120px serif';
	g.fillText(isTop ? '🏅' : '🎖️', W / 2, 484);

	g.fillStyle = '#5b5140';
	g.font = `32px ${sans}`;
	g.fillText('This certifies that', W / 2, 560);

	const name = data.name.trim() || 'Trail Explorer';
	g.fillStyle = '#1c4523';
	g.font = "700 64px Georgia, 'Times New Roman', serif";
	g.fillText(clip(g, name, W - 320), W / 2, 636);
	g.strokeStyle = '#c9a53a';
	g.lineWidth = 3;
	g.beginPath();
	g.moveTo(W / 2 - 260, 662);
	g.lineTo(W / 2 + 260, 662);
	g.stroke();

	g.fillStyle = '#5b5140';
	g.font = `32px ${sans}`;
	wrap(
		g,
		`has explored ${data.count} points of interest across ${GAME_CONFIG.parkName} and earned the rank of ${data.tier.title}.`,
		W / 2,
		718,
		W - 360,
		44,
	);

	// Collected POIs in up to two columns of 7; anything past 14 is summarised
	// as "+N more" so even a full 18-POI run fits above the footer.
	const names = data.collectedNames;
	const perCol = 7;
	const rows = Math.min(perCol, names.length);
	const twoCol = names.length > perCol;
	const startY = 852;
	const lh = 34;
	const colW = 360;
	const leftX = twoCol ? 150 : W / 2 - colW / 2;
	g.font = `27px ${sans}`;
	g.textAlign = 'left';
	g.fillStyle = '#3d4a33';
	names.slice(0, perCol * 2).forEach((line, i) => {
		const col = i < perCol ? 0 : 1;
		const row = i % perCol;
		const x = col === 0 ? leftX : W / 2 + 30;
		g.fillText(clip(g, line, colW), x, startY + row * lh);
	});
	g.textAlign = 'center';
	if (names.length > perCol * 2) {
		g.fillStyle = '#8a8272';
		g.fillText(`+ ${names.length - perCol * 2} more`, W / 2, startY + rows * lh);
	}

	g.fillStyle = '#8a8272';
	g.font = `28px ${sans}`;
	g.fillText(`${GAME_CONFIG.parkName} · ${fmtDate(data.date)}`, W / 2, H - 148);
	g.fillStyle = '#c9a53a';
	g.font = `600 26px ${sans}`;
	g.fillText(
		isTop ? 'Screenshot & send in to claim your t-shirt' : 'Screenshot to share your rank',
		W / 2,
		H - 106,
	);
}
