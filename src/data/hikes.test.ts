import { describe, expect, it } from 'vitest';
import { metres } from '../lib/geo';
import { estimateHikeMinutes, formatHikeTime, HIKES } from './hikes';

describe('hike time estimates', () => {
	it('slows the pace as difficulty increases', () => {
		expect(estimateHikeMinutes(2, 'Easy')).toBe(50);
		expect(estimateHikeMinutes(2, 'Moderate')).toBe(60);
		expect(estimateHikeMinutes(2, 'Hard')).toBe(70);
	});

	it('rounds to useful five-minute estimates', () => {
		expect(estimateHikeMinutes(0.41, 'Easy')).toBe(10);
		expect(formatHikeTime(10)).toBe('~10 min');
		expect(formatHikeTime(90)).toBe('~1 hr 30 min');
	});
});

describe('hike routes', () => {
	// The editor joins the picked trail segments end to end, so a segment left
	// out of a hike shows up as a long straight jump between two vertices (the
	// Grand Tour once skipped Pine Valley Trail that way). These crossings are
	// the known ones with no mapped trail between them, keyed by hike id.
	const OFF_NETWORK: Record<string, number[]> = {
		// Drainage Path → Sugar Bowl Exit, across the open sand.
		'grand-tour': [88],
		// The same crossing, plus a hop onto the Wood Bridge Path.
		'longest-trek': [88, 101],
	};
	const MAX_STEP_M = 30;

	for (const hike of HIKES) {
		it(`${hike.id} follows the trails without straight-line gaps`, () => {
			const coords = hike.segments.flat();
			const gaps: number[] = [];
			for (let i = 1; i < coords.length; i++) {
				const [aLat, aLon] = coords[i - 1];
				const [bLat, bLon] = coords[i];
				const d = metres(aLat, aLon, bLat, bLon);
				if (d > MAX_STEP_M) gaps.push(Math.round(d));
			}
			expect(gaps).toEqual(OFF_NETWORK[hike.id] ?? []);
		});
	}
});
