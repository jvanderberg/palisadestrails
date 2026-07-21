import { describe, expect, it } from 'vitest';
import { TIERS } from '../data/collectibles';
import { drawCertificate } from './certificate';

describe('certificate footer', () => {
	it('keeps readable footer text inside the inner frame', () => {
		const text: Array<{ value: string; y: number; font: string }> = [];
		const context = {
			font: '',
			fillStyle: '',
			strokeStyle: '',
			lineWidth: 0,
			textAlign: 'start',
			beginPath() {},
			moveTo() {},
			arcTo() {},
			closePath() {},
			fill() {},
			stroke() {},
			fillRect() {},
			lineTo() {},
			createLinearGradient: () => ({ addColorStop() {} }),
			measureText: (value: string) => ({ width: value.length * 20 }),
			fillText(value: string, _x: number, y: number) {
				text.push({ value, y, font: this.font });
			},
		};
		const canvas = {
			width: 1080,
			height: 1350,
			getContext: () => context,
		} as unknown as HTMLCanvasElement;

		drawCertificate(canvas, {
			tier: TIERS[0],
			name: 'Trail Explorer',
			count: 5,
			collectedNames: [],
			date: new Date('2026-07-21T12:00:00Z'),
		});

		const date = text.find(({ value }) => value.includes('Palisades Park ·'));
		const action = text.find(({ value }) => value === 'Screenshot to share your rank');
		expect(date?.y).toBe(1160);
		expect(action?.y).toBe(1205);
		expect(action?.font).toContain('36px');
		expect(action?.y).toBeLessThan(1222);
	});
});
