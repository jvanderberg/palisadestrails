import { describe, expect, it } from 'vitest';
import { buildRoute, joinTrails, parseGeoFile, splitTrailAtVertex } from './model';
import type { EditorTrail } from './types';

const trails: EditorTrail[] = [
	{
		id: 'one',
		name: 'One',
		color: '#112233',
		folder: 'Trails',
		coords: [
			[42, -86],
			[42, -85.999],
			[42, -85.998],
		],
	},
	{
		id: 'two',
		name: 'Two',
		color: '#445566',
		folder: 'Trails',
		coords: [
			[42, -85.996],
			[42, -85.997],
			[42, -85.998],
		],
	},
];

describe('trail editor geometry', () => {
	it('splits a trail exactly at an interior vertex without mutating the source', () => {
		const result = splitTrailAtVertex(trails, 'one', 1);
		expect(result.trails).toHaveLength(3);
		expect(result.ids).toEqual(['one-a', 'one-b']);
		expect(result.trails[0].coords).toEqual([
			[42, -86],
			[42, -85.999],
		]);
		expect(result.trails[1].coords).toEqual([
			[42, -85.999],
			[42, -85.998],
		]);
		expect(() => splitTrailAtVertex(trails, 'one', 0)).toThrow('interior vertex');
		expect(trails[0].coords).toHaveLength(3);
	});

	it('joins nearest endpoints and retains the first identity', () => {
		const result = joinTrails(trails, 'one', 'two');
		expect(result.trails).toHaveLength(1);
		expect(result.id).toBe('one');
		expect(result.gapMetres).toBeCloseTo(0, 5);
		expect(result.trails[0].coords.at(-1)).toEqual([42, -85.996]);
	});

	it('builds a continuous hike route in walking order', () => {
		const route = buildRoute(trails, ['one', 'two']);
		expect(route.names).toEqual(['One', 'Two']);
		expect(route.coords[0]).toEqual([42, -86]);
		expect(route.coords.at(-1)).toEqual([42, -85.996]);
		expect(route.gaps[0]).toBeCloseTo(0, 5);
	});
});

describe('GPX/KML import', () => {
	it('imports GPX tracks, named routes, and waypoints', () => {
		const parsed = parseGeoFile(
			`<gpx><trk><trkseg><trkpt lat="42" lon="-86"/><trkpt lat="42.1" lon="-86.1"/></trkseg></trk><rte><name>Ridge</name><rtept lat="42.2" lon="-86.2"/><rtept lat="42.3" lon="-86.3"/></rte><wpt lat="42.4" lon="-86.4"><name>Lookout</name></wpt></gpx>`,
			'route.gpx',
		);
		expect(parsed.lines).toHaveLength(2);
		expect(parsed.lines[1].name).toBe('Ridge');
		expect(parsed.points).toEqual([{ name: 'Lookout', lat: 42.4, lon: -86.4 }]);
	});

	it('imports KML lines, gx tracks, and points', () => {
		const parsed = parseGeoFile(
			`<kml><Placemark><name>Loop</name><LineString><coordinates>-86,42 -86.1,42.1</coordinates></LineString></Placemark><Placemark><name>Recorded</name><gx:Track><gx:coord>-86.2 42.2 0</gx:coord><gx:coord>-86.3 42.3 0</gx:coord></gx:Track></Placemark><Placemark><name>Bridge</name><Point><coordinates>-86.4,42.4</coordinates></Point></Placemark></kml>`,
			'route.kml',
		);
		expect(parsed.lines.map((line) => line.name)).toEqual(['Loop', 'Recorded']);
		expect(parsed.points[0]).toEqual({ name: 'Bridge', lat: 42.4, lon: -86.4 });
	});
});
