import { isAccepted } from './Gate';

describe('fly-through gate', () => {
	it('accepts any answer containing "chad", in any capitalization', () => {
		for (const answer of [
			'chad',
			'Chad',
			'CHAD',
			'cHaD',
			'Chad Smith',
			'it is chad!',
			'Chadwick',
		]) {
			expect(isAccepted(answer)).toBe(true);
		}
	});

	it('rejects everything else', () => {
		for (const answer of ['', 'chd', 'c h a d', 'Brad', 'the ranger']) {
			expect(isAccepted(answer)).toBe(false);
		}
	});
});
