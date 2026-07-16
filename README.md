# Palisades Trails

An installable PWA for **Palisades Park**: a general-purpose trail map plus a
gamified "Trailmaster" challenge. Walk the park, and when your phone's GPS puts
you within range of a point of interest, add it to your collection. Collect
enough of them and you unlock a shareable **Trailmaster certificate** to screenshot
and send in for a t-shirt.

## Stack

React 19 · TypeScript · Vite · Tailwind CSS v4 · react-leaflet · Zustand ·
Biome · Vitest.

## How the game works

- **Points of interest** live in [`src/data/collectibles.ts`](src/data/collectibles.ts) —
  edit that one list to add/remove/re-word POIs or change the rules
  (`GAME_CONFIG.collectRadiusM` and the achievement `TIERS`).
- **Proximity gating** — a POI is collectable only when the player is within
  `collectRadiusM` metres (default 40). See [`src/game/proximity.ts`](src/game/proximity.ts).
- **Persistence** — collected POIs, the player's name, and the claim timestamp
  are stored in `localStorage` via a Zustand `persist` store
  ([`src/game/store.ts`](src/game/store.ts)). It's tiny per-device state, so no
  database is needed; swap the store's backing engine here if you later add a
  server-side claim registry or leaderboard.
- **Reward** — reaching the goal opens a canvas-rendered certificate
  ([`src/lib/certificate.ts`](src/lib/certificate.ts)) with a **Save / Share**
  button (Web Share API with a PNG, falling back to download).

## Develop

```bash
npm install
npm run dev        # vite dev server
npm run check      # biome + tsc + vitest (CI gate)
npm run check:fix  # auto-fix, then check
npm run build      # tsc -b && vite build  ->  dist/
```

### Testing location without walking the park

Append `?sim=lat,lon` to the URL to feed a fixed position, e.g.
`http://localhost:5173/?sim=42.307439,-86.313926` drops you at **Big Pine** so it
becomes collectable immediately.

## Data

`src/data/park.json` is baked offline from the Sign-Locations CSV + the
`Palisades_Park.kml` CalTopo export (43 trails, 50 landmarks, 18 sign posts). To
refresh it, re-run the parse against updated exports and re-commit the JSON.
