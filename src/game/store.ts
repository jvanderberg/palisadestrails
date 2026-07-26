// Game state — the single source of truth for what the player has collected.
// Persisted locally via Zustand; the storage adapter also mirrors this small
// record to a cookie so iOS can carry it into an installed Home Screen app.
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { progressStorage } from './progressStorage';

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
		{
			name: 'palisades-trails/v1',
			storage: createJSONStorage(() => progressStorage),
		},
	),
);

/** Number of POIs collected. */
export const selectCount = (s: GameState): number => Object.keys(s.collected).length;
