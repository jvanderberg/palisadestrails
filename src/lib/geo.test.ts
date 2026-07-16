import { describe, expect, it } from 'vitest';
import { fmtDate, fmtDist, metres } from './geo';

describe('metres', () => {
	it('is zero for identical points', () => {
		expect(metres(42.3074, -86.3139, 42.3074, -86.3139)).toBe(0);
	});

	it('measures a known short distance within tolerance', () => {
		// ~124 m between two Wood Bridge / Sign #2 coords in the park data.
		const d = metres(42.31385, -86.31598, 42.31414, -86.31472);
		expect(d).toBeGreaterThan(100);
		expect(d).toBeLessThan(150);
	});

	it('is symmetric', () => {
		const a = metres(42.3, -86.3, 42.31, -86.32);
		const b = metres(42.31, -86.32, 42.3, -86.3);
		expect(a).toBeCloseTo(b, 6);
	});
});

describe('fmtDist', () => {
	it('handles null', () => {
		expect(fmtDist(null)).toBe('—');
	});
	it('formats internal metre distances as feet', () => {
		expect(fmtDist(0)).toBe('0 ft');
		expect(fmtDist(40)).toBe('131 ft');
		expect(fmtDist(60.96)).toBe('200 ft');
		expect(fmtDist(1000)).toBe('3,281 ft');
	});
});

describe('fmtDate', () => {
	it('formats a date without throwing', () => {
		expect(fmtDate(new Date('2026-07-15T12:00:00Z'))).toMatch(/2026/);
	});
});
