# Palisades Trails

An installable trail-map PWA for Palisades Park. Browse the trail network and
curated hikes, follow route directions, locate yourself on the map, collect
points of interest, and earn trail-mastery certificates.

**[Open Palisades Trails](https://jvanderberg.github.io/palisadestrails/)**

## Features

- Mobile-friendly topographic, street, and USGS basemaps
- Curated hikes with difficulty, distance, directions, and mapped routes
- Automatic location updates and proximity-based POI collection
- Offline app shell and caching for previously viewed map tiles
- Installable PWA with locally saved progress and shareable certificates

## Development

Requires Node.js 24 and npm.

```bash
npm install
npm run dev
npm run check
npm run build
```

Append `?sim=lat,lon` to simulate a location during development. For example,
`?sim=42.307439,-86.313926` places the user near Big Pine.

## Local trail editor

Run `npm run editor`, then open <http://127.0.0.1:4174/tools/editor/>. The editor
is a local-only React/TypeScript app using React-Leaflet; it is excluded from the
public PWA build.

It can create, update, and delete trails, markers, POIs, and curated hikes;
split and join trail segments; edit segment names and colors; rebuild hike
routes by clicking trail segments; and import GPX or KML geometry. Saving writes
the baked files in `src/data` atomically and first creates a timestamped backup
under `.trail-editor-backups/`. Keep existing POI and hike IDs when editing so
saved user progress remains valid.

## License

The application shell and software implementation are available under the MIT
License. Trail geometry, coordinates, landmarks, hike routes and descriptions,
points of interest, and other map content are excluded from that license and
remain all rights reserved. See [LICENSE.md](LICENSE.md) for the precise scope.
