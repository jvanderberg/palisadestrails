import { describe, expect, it } from 'vitest';
import type { PersonalHike } from '../personal/store';
import { personalHikeCsv, personalHikeEmailUrl } from './personalHikeEmail';

const hike: PersonalHike = {
	id: 'hike-1',
	name: 'Morning & evening',
	startedAt: 1,
	finishedAt: 2,
	status: 'finished',
	elapsedMs: 1,
	activeSince: null,
	segments: [
		[
			{ lat: 42.123456789, lon: -86.987654321, accuracy: 5, timestamp: 1 },
			{ lat: 42.2, lon: -86.8, accuracy: 6, timestamp: 2 },
		],
	],
};

describe('personal hike email', () => {
	it('formats every recorded point as latitude/longitude CSV', () => {
		expect(personalHikeCsv(hike)).toBe(
			'latitude,longitude\n42.1234568,-86.9876543\n42.2000000,-86.8000000',
		);
	});

	it('addresses and safely encodes the hike email', () => {
		const url = new URL(personalHikeEmailUrl(hike));
		expect(url.protocol).toBe('mailto:');
		expect(url.pathname).toBe('jvanderberg@gmail.com');
		expect(url.searchParams.get('subject')).toBe('Palisades Trails hike: Morning & evening');
		expect(url.searchParams.get('body')).toContain('Hike name: Morning & evening');
		expect(url.searchParams.get('body')).toContain('42.1234568,-86.9876543');
	});
});
