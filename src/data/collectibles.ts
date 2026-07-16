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

export const COLLECTIBLES: Collectible[] = [
	{
		id: 'big-pine',
		name: 'Big Pine',
		emoji: '🌲',
		lat: 42.30716,
		lon: -86.31458,
		hint: 'The giant old-growth pine off the Big Pine Trail.',
	},
	{
		id: 'wood-bridge',
		name: 'Wood Bridge',
		emoji: '🌉',
		lat: 42.31401,
		lon: -86.314713,
		hint: 'The classic wooden footbridge over the ravine.',
	},
	{
		id: 'sugar-bowl',
		name: 'Sugar Bowl',
		emoji: '🥣',
		lat: 42.306233,
		lon: -86.323078,
		hint: 'The big natural bowl near the lakeshore.',
	},
	{
		id: 'lake-bluff',
		name: 'Lake Bluff Lookout',
		emoji: '🔭',
		lat: 42.305846,
		lon: -86.323292,
		hint: 'Overlook above Lake Michigan on the west bluff.',
	},
	{
		id: 'best-view',
		name: 'Best View in Park',
		emoji: '🌅',
		lat: 42.305705,
		lon: -86.31799,
		hint: "The signed 'best view' spur — worth the climb.",
	},
	{
		id: 'thunder-summit',
		name: 'Thunder Mountain Summit',
		emoji: '⛰️',
		lat: 42.308552,
		lon: -86.318851,
		hint: 'Top of the Thunder Mountain climb.',
	},
	{
		id: 'n-sugarbowl-sum',
		name: 'North Sugarbowl Summit',
		emoji: '🏔️',
		lat: 42.307114,
		lon: -86.320371,
		hint: 'High point above the north bowl.',
	},
	{
		id: 'e-sugarbowl-sum',
		name: 'East Sugar Bowl Summit',
		emoji: '🗻',
		lat: 42.305098,
		lon: -86.31707,
		hint: 'Summit on the east rim of the sugar bowl.',
	},
	{
		id: 'pine-valley-sw',
		name: 'Pine Valley Switchback',
		emoji: '↩️',
		lat: 42.306511,
		lon: -86.313604,
		hint: 'The tight switchback down Pine Valley.',
	},
	{
		id: 'hemlock-loop',
		name: 'Hemlock Loop',
		emoji: '🌿',
		lat: 42.309669,
		lon: -86.31298,
		hint: 'Shady hemlock stand on the east side.',
	},
	{
		id: 'gardner-head',
		name: 'Gardner Trailhead',
		emoji: '🚪',
		lat: 42.307651,
		lon: -86.321579,
		hint: 'The Jack Gardner trailhead entrance.',
	},
	{
		id: 'meadow-bridge',
		name: 'Meadow Bridge',
		emoji: '🌉',
		lat: 42.313592,
		lon: -86.317073,
		hint: 'The footbridge over the meadow stream.',
	},
	{
		id: 'highpoint',
		name: 'Highpoint',
		emoji: '🔝',
		lat: 42.315766,
		lon: -86.310931,
		hint: 'Highpoint of the northside trails.',
	},
	{
		id: 'blue-star',
		name: 'Blue Star',
		emoji: '★',
		color: '#2f6bd6',
		lat: 42.315684,
		lon: -86.305992,
		hint: 'The east edge of the trails by Blue Star Highway.',
	},
	{
		id: 'pats-path',
		name: "Pat's Path",
		emoji: '🥾',
		lat: 42.311239,
		lon: -86.317073,
		hint: '',
	},
	{
		id: 'fern-loop',
		name: 'Fern Loop',
		emoji: '🍃',
		lat: 42.314697,
		lon: -86.313416,
		hint: '',
	},
	{
		id: 'stagecoach',
		name: 'Stagecoach Trail',
		emoji: '🐎',
		lat: 42.310351,
		lon: -86.31561,
		hint: 'The once and former entrance to the park.',
	},
	{
		id: 'water-tower',
		name: 'Water Tower',
		emoji: '🗼',
		lat: 42.31057,
		lon: -86.32076,
		hint: 'The water tower lookout on the west bluff.',
	},
];
