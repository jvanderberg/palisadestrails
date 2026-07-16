// Game state — the single source of truth for what the player has
// collected. Persisted to localStorage via zustand's persist middleware;
// swap the storage engine here (e.g. for a server-backed claim registry)
// without touching any component.
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface GameState {
	/** Player's display name for the certificate. */
	name: string;
	/** poiId -> ISO timestamp collected. */
	collected: Record<string, string>;
	/** Passed the access gate — persisted so it's only ever asked once. */
	unlocked: boolean;

	collect: (id: string) => boolean;
	uncollect: (id: string) => void;
	setName: (name: string) => void;
	unlock: () => void;
	reset: () => void;
}

export const useGame = create<GameState>()(
	persist(
		(set, get) => ({
			name: '',
			collected: {},
			unlocked: false,

			collect: (id) => {
				if (get().collected[id]) return false;
				set({ collected: { ...get().collected, [id]: new Date().toISOString() } });
				return true;
			},
			uncollect: (id) => {
				const collected = { ...get().collected };
				delete collected[id];
				set({ collected });
			},
			setName: (name) => set({ name }),
			unlock: () => set({ unlocked: true }),
			// Resets game progress only — the access gate stays unlocked.
			reset: () => set({ collected: {} }),
		}),
		{ name: 'palisades-trails/v1' },
	),
);

/** Number of POIs collected. */
export const selectCount = (s: GameState): number => Object.keys(s.collected).length;
