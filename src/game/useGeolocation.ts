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
 * Location refreshes automatically on startup and every 30 seconds. Automatic
 * fixes move the player dot without recentering the map. Tapping the button
 * fetches a fresh fix immediately (maximumAge 0) and recenters on it. A
 * `?sim=` query param short-circuits to a fixed position.
 */
export function useGeolocation(): GeoState {
	const sim = useRef<Position | null>(readSim());
	const [pos, setPos] = useState<Position | null>(sim.current);
	const [locating, setLocating] = useState(false);
	const [watching, setWatching] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [recenter, setRecenter] = useState<Recenter | null>(null);
	const intervalId = useRef<number | null>(null);
	const initialRequested = useRef(false);
	const nonce = useRef(0);

	const recenterOn = useCallback((lat: number, lon: number) => {
		nonce.current += 1;
		setRecenter({ lat, lon, nonce: nonce.current });
	}, []);

	const requestPosition = useCallback(
		(recenterMap: boolean, showBusy: boolean) => {
			setError(null);
			if (sim.current) {
				setPos(sim.current);
				if (recenterMap) recenterOn(sim.current.lat, sim.current.lon);
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
					setPos(np);
					if (recenterMap) recenterOn(np.lat, np.lon);
				},
				(err) => {
					if (showBusy) setLocating(false);
					setError(err.message);
				},
				{ enableHighAccuracy: true, maximumAge: 0, timeout: 15000 },
			);
		},
		[recenterOn],
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

		setWatching(true);
		// StrictMode reruns effects in development; request the initial fix once,
		// but recreate the interval after its simulated cleanup.
		if (!initialRequested.current) {
			initialRequested.current = true;
			requestPosition(false, false);
		}
		intervalId.current = window.setInterval(() => requestPosition(false, false), 30_000);

		return () => {
			if (intervalId.current != null) window.clearInterval(intervalId.current);
			intervalId.current = null;
		};
	}, [requestPosition]);

	const locate = useCallback(() => requestPosition(true, true), [requestPosition]);

	return { pos, locating, watching, error, recenter, locate };
}
