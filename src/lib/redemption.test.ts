import { describe, expect, it } from 'vitest';
import { buildTshirtRedemptionMailto } from './redemption';

describe('T-shirt redemption email', () => {
	it('includes the hiker name, every collected POI, and a final size blank', () => {
		const href = buildTshirtRedemptionMailto('Ada Hiker', ['Big Pine', 'Wood Bridge']);
		const url = new URL(href);
		const body = url.searchParams.get('body');

		expect(url.protocol).toBe('mailto:');
		expect(url.pathname).toBe('jvanderberg@gmail.com');
		expect(url.searchParams.get('subject')).toBe('Palisades Trailblazer T-shirt redemption');
		expect(body).toContain('Name: Ada Hiker');
		expect(body).toContain('- Big Pine');
		expect(body).toContain('- Wood Bridge');
		expect(body?.endsWith('my t-shirt size is [      ]')).toBe(true);
	});
});
