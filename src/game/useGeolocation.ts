import { useCallback, useEffect, useRef, useState } from 'react';

export interface Position {
	lat: number;
	lon: number;
	accuracy: number;
}

export interface Recenter {
	lat: number;
	lon: number;
	/** Bumped on every locate so repeated taps re-center even if the fix is unchanged. */
	nonce: number;
}

interface GeoState {
	pos: Position | null;
	/** True while a fresh fix is being fetched (button spinner). */
	locating: boolean;
	/** True while automatic location refreshes are scheduled. */
	watching: boolean;
	error: string | null;
	/** Changes on each locate; the map flies to it. */
	recenter: Recenter | null;
	locate: () => void;
}

/** Parse a `?sim=lat,lon` query param for testing/demo without real GPS. */
function readSim(): Position | null {
	if (typeof window === 'undefined') return null;
	const m = /[?&]sim=(-?\d+\.?\d*),(-?\d+\.?\d*)/.exec(window.location.search);
	return m ? { lat: Number(m[1]), lon: Number(m[2]), accuracy: 8 } : null;
}

/**
 * A high-accuracy watch stays active to keep the phone's GPS warm. Its latest
 * fix is published every 30 seconds; the first fix and meaningful accuracy
 * improvements publish immediately. Tapping the button requests a fresh fix
 * and recenters on it. A `?sim=` query param short-circuits to a fixed position.
 */
export function useGeolocation(): GeoState {
	const sim = useRef<Position | null>(readSim());
	const [pos, setPos] = useState<Position | null>(sim.current);
	const [locating, setLocating] = useState(false);
	const [watching, setWatching] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [recenter, setRecenter] = useState<Recenter | null>(null);
	const intervalId = useRef<number | null>(null);
	const watchId = useRef<number | null>(null);
	const latestFix = useRef<Position | null>(sim.current);
	const hasPublished = useRef(Boolean(sim.current));
	const publishedAccuracy = useRef(sim.current?.accuracy ?? Number.POSITIVE_INFINITY);
	const nonce = useRef(0);

	const recenterOn = useCallback((lat: number, lon: number) => {
		nonce.current += 1;
		setRecenter({ lat, lon, nonce: nonce.current });
	}, []);

	const publishPosition = useCallback(
		(np: Position, recenterMap: boolean) => {
			latestFix.current = np;
			hasPublished.current = true;
			publishedAccuracy.current = np.accuracy;
			setPos(np);
			setError(null);
			if (recenterMap) recenterOn(np.lat, np.lon);
		},
		[recenterOn],
	);

	const requestPosition = useCallback(
		(recenterMap: boolean, showBusy: boolean) => {
			if (showBusy) setError(null);
			if (sim.current) {
				publishPosition(sim.current, recenterMap);
				return;
			}
			if (!('geolocation' in navigator)) {
				setWatching(false);
				setError('Geolocation is not available on this device.');
				return;
			}
			if (showBusy) setLocating(true);
			navigator.geolocation.getCurrentPosition(
				(p) => {
					if (showBusy) setLocating(false);
					const np = {
						lat: p.coords.latitude,
						lon: p.coords.longitude,
						accuracy: p.coords.accuracy,
					};
					publishPosition(np, recenterMap);
				},
				(err) => {
					if (showBusy) setLocating(false);
					// Scheduled timeouts and temporary unavailability are expected in
					// deep woods. Surface permission failures and explicit button errors.
					if (showBusy || err.code === err.PERMISSION_DENIED) setError(err.message);
				},
				{ enableHighAccuracy: true, maximumAge: 0, timeout: 25_000 },
			);
		},
		[publishPosition],
	);

	useEffect(() => {
		if (sim.current) {
			setWatching(true);
			return;
		}
		if (!('geolocation' in navigator)) {
			setWatching(false);
			return;
		}
		const geolocation = navigator.geolocation;

		const stopTracking = () => {
			if (intervalId.current != null) window.clearInterval(intervalId.current);
			intervalId.current = null;
			if (watchId.current != null) geolocation.clearWatch(watchId.current);
			watchId.current = null;
			setWatching(false);
		};

		const startTracking = () => {
			if (document.visibilityState === 'hidden' || watchId.current != null) return;
			setWatching(true);
			watchId.current = geolocation.watchPosition(
				(p) => {
					const np = {
						lat: p.coords.latitude,
						lon: p.coords.longitude,
						accuracy: p.coords.accuracy,
					};
					latestFix.current = np;
					// Publish the first lock immediately. While the GPS settles, also
					// publish fixes that improve accuracy by at least 30%.
					if (!hasPublished.current || np.accuracy <= publishedAccuracy.current * 0.7) {
						publishPosition(np, false);
					}
				},
				(err) => {
					if (err.code === err.PERMISSION_DENIED) {
						stopTracking();
						setError(err.message);
					}
				},
				{ enableHighAccuracy: true, maximumAge: 5000, timeout: 30_000 },
			);
			intervalId.current = window.setInterval(() => {
				if (latestFix.current) publishPosition(latestFix.current, false);
			}, 5000);
		};

		const handleVisibility = () => {
			if (document.visibilityState === 'hidden') stopTracking();
			else startTracking();
		};

		startTracking();
		document.addEventListener('visibilitychange', handleVisibility);

		return () => {
			document.removeEventListener('visibilitychange', handleVisibility);
			stopTracking();
		};
	}, [publishPosition]);

	const locate = useCallback(() => requestPosition(true, true), [requestPosition]);

	return { pos, locating, watching, error, recenter, locate };
}
