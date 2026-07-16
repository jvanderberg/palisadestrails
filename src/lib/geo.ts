// Geospatial + formatting helpers (pure, unit-tested).

const EARTH_RADIUS_M = 6_371_000;
const DEG = Math.PI / 180;

/** Great-circle distance between two lat/lon points, in metres. */
export function metres(aLat: number, aLon: number, bLat: number, bLon: number): number {
	const dLat = (bLat - aLat) * DEG;
	const dLon = (bLon - aLon) * DEG;
	const s =
		Math.sin(dLat / 2) ** 2 + Math.cos(aLat * DEG) * Math.cos(bLat * DEG) * Math.sin(dLon / 2) ** 2;
	return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(s));
}

/** Human-readable US trail distance. Calculations stay metric internally. */
export function fmtDist(m: number | null): string {
	if (m == null) return '—';
	const feet = Math.round(m * 3.28084);
	return `${feet.toLocaleString('en-US')} ft`;
}

/** Locale-formatted long date for the certificate (e.g. "July 15, 2026"). */
export function fmtDate(d: Date): string {
	return d.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
}
