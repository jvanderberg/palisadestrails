import { beforeEach, describe, expect, it } from 'vitest';
import { currentTier, TIERS } from '../data/collectibles';
import { selectCount, useGame } from './store';

beforeEach(() => {
	localStorage.clear();
	useGame.setState({ name: '', collected: {}, unlocked: false });
});

describe('useGame', () => {
	it('collects a POI once and is idempotent', () => {
		expect(useGame.getState().collect('big-pine')).toBe(true);
		expect(useGame.getState().collect('big-pine')).toBe(false);
		expect(selectCount(useGame.getState())).toBe(1);
	});

	it('crosses tiers as the count grows', () => {
		expect(currentTier(0)).toBeNull();
		for (let i = 0; i < TIERS[0].count; i++) useGame.getState().collect(`poi-${i}`);
		expect(currentTier(selectCount(useGame.getState()))?.title).toBe(TIERS[0].title);
		for (let i = TIERS[0].count; i < TIERS[2].count; i++) useGame.getState().collect(`poi-${i}`);
		expect(currentTier(selectCount(useGame.getState()))?.title).toBe(TIERS[2].title);
	});

	it('uncollect and reset clear state', () => {
		useGame.getState().collect('a');
		useGame.getState().collect('b');
		useGame.getState().uncollect('a');
		expect(selectCount(useGame.getState())).toBe(1);
		useGame.getState().reset();
		expect(selectCount(useGame.getState())).toBe(0);
	});

	it('persists the name', () => {
		useGame.getState().setName('Ada');
		expect(useGame.getState().name).toBe('Ada');
	});
});
