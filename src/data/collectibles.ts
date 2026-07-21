import rawCollectibles from './pois.json';

// ------------------------------------------------------------------
//  GAME LAYER — edit points of interest and rules here.
//  Collectibles are the landmarks players walk to and "collect" when
//  their phone's GPS is within `collectRadiusM` metres of the point.
//  Add / remove / re-word freely — the app rebuilds from this list.
// ------------------------------------------------------------------

export interface Collectible {
	id: string;
	name: string;
	emoji: string;
	lat: number;
	lon: number;
	hint: string;
	/** Optional CSS color for the glyph (e.g. a non-emoji ★ rendered blue). */
	color?: string;
}

export interface GameConfig {
	parkName: string;
	/** How close (metres) a player must be to collect a POI. */
	collectRadiusM: number;
}

export const GAME_CONFIG: GameConfig = {
	parkName: 'Palisades Park',
	// 200 ft; proximity math remains metric internally.
	collectRadiusM: 60.96,
};

export interface Tier {
	/** Stable identity. Display-title changes must never change this value. */
	id: `tier-${number}`;
	/** POIs needed to earn this rank. */
	count: number;
	/** User-facing rank name; safe to rename without affecting progress. */
	title: string;
}

/** Achievement ranks, ascending. Reach a tier's `count` to earn it; the top
 *  tier is the one you screenshot to send in for the t-shirt. */
export const TIERS: Tier[] = [
	{ id: 'tier-1', count: 5, title: 'Bushwacker' },
	{ id: 'tier-2', count: 10, title: 'Wayfinder' },
	{ id: 'tier-3', count: 15, title: 'Trailblazer' },
];

/** The highest tier earned at `n` collected (null if below the first). */
export function currentTier(n: number): Tier | null {
	let earned: Tier | null = null;
	for (const t of TIERS) if (n >= t.count) earned = t;
	return earned;
}

/** The next tier to aim for (null once all are earned). */
export function nextTier(n: number): Tier | null {
	for (const t of TIERS) if (n < t.count) return t;
	return null;
}

/** The top tier — reaching this earns the t-shirt. */
export const TOP_TIER: Tier = TIERS[TIERS.length - 1];

/** Whether a rank is the top rank, independent of its title or threshold. */
export function isTopTier(tier: Tier): boolean {
	return tier.id === TOP_TIER.id;
}

// JSON is the shared source edited by the local trail editor. Keep IDs stable:
// collection progress is persisted by POI ID in users' browsers.
export const COLLECTIBLES = rawCollectibles as Collectible[];
