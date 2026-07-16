import { describe, expect, it } from 'vitest';
import { estimateHikeMinutes, formatHikeTime } from './hikes';

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
