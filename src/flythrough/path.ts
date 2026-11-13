// Route geometry helpers: uniform resampling, smoothing and lookups along a
// polyline in world space. Uniform spacing turns "distance along the route"
// into a simple array index, which keeps every per-frame lookup O(1).

export interface Path {
	/** Distance between consecutive samples, metres. */
	step: number;
	/** Total length, metres. */
	length: number;
	xs: Float32Array;
	zs: Float32Array;
}

/** Resample a polyline at a fixed spacing (the last point is always kept). */
export function resample(points: readonly (readonly [number, number])[], step: number): Path {
	const pts = points.filter(
		(p, i) => i === 0 || p[0] !== points[i - 1][0] || p[1] !== points[i - 1][1],
	);
	if (pts.length < 2) {
		const [x, z] = pts[0] ?? [0, 0];
		return { step, length: 0, xs: Float32Array.of(x), zs: Float32Array.of(z) };
	}
	const cum = [0];
	for (let i = 1; i < pts.length; i++) {
		cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
	}
	const length = cum[cum.length - 1];
	const n = Math.max(2, Math.ceil(length / step) + 1);
	const actual = length / (n - 1);
	const xs = new Float32Array(n);
	const zs = new Float32Array(n);
	let seg = 1;
	for (let i = 0; i < n; i++) {
		const s = i * actual;
		while (seg < pts.length - 1 && cum[seg] < s) seg++;
		const span = cum[seg] - cum[seg - 1];
		const t = span > 0 ? (s - cum[seg - 1]) / span : 0;
		xs[i] = pts[seg - 1][0] + (pts[seg][0] - pts[seg - 1][0]) * t;
		zs[i] = pts[seg - 1][1] + (pts[seg][1] - pts[seg - 1][1]) * t;
	}
	return { step: actual, length, xs, zs };
}

/** Gaussian blur of a 1-D signal with clamped edges. `sigma` is in samples. */
export function smooth(values: Float32Array, sigma: number): Float32Array {
	if (sigma <= 0) return values.slice();
	const radius = Math.ceil(sigma * 3);
	const kernel = new Float32Array(radius * 2 + 1);
	let sum = 0;
	for (let i = -radius; i <= radius; i++) {
		const w = Math.exp(-(i * i) / (2 * sigma * sigma));
		kernel[i + radius] = w;
		sum += w;
	}
	const n = values.length;
	const out = new Float32Array(n);
	for (let i = 0; i < n; i++) {
		let acc = 0;
		for (let j = -radius; j <= radius; j++) {
			const k = Math.min(n - 1, Math.max(0, i + j));
			acc += values[k] * kernel[j + radius];
		}
		out[i] = acc / sum;
	}
	return out;
}

/** Linear lookup of a per-sample array at distance `s` (clamped to the route). */
export function at(values: Float32Array, step: number, s: number): number {
	const n = values.length;
	if (n === 1) return values[0];
	const f = Math.min(n - 1, Math.max(0, s / step));
	const i = Math.min(n - 2, Math.floor(f));
	return values[i] + (values[i + 1] - values[i]) * (f - i);
}

export interface ElevationStats {
	min: number;
	max: number;
	/** Total climb, metres, ignoring wiggles smaller than `threshold`. */
	gain: number;
}

/** Min/max and hysteresis-filtered climb, so lidar noise doesn't inflate gain. */
export function elevationStats(heights: Float32Array, threshold = 1.5): ElevationStats {
	let min = Infinity;
	let max = -Infinity;
	let gain = 0;
	let ref = heights[0] ?? 0;
	for (const h of heights) {
		if (h < min) min = h;
		if (h > max) max = h;
		if (h - ref >= threshold) {
			gain += h - ref;
			ref = h;
		} else if (ref - h >= threshold) {
			ref = h;
		}
	}
	return { min, max, gain };
}
