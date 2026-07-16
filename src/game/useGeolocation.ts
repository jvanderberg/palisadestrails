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
	/** True once continuous tracking is running. */
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
 * Location. Tapping the button always fetches a fresh fix (maximumAge 0) and
 * recenters the map on it. The first tap also starts `watchPosition`, so the
 * dot keeps updating as the player walks (keeping the collect range live)
 * without needing further taps. A `?sim=` query param short-circuits to a
 * fixed position.
 */
export function useGeolocation(): GeoState {
	const sim = useRef<Position | null>(readSim());
	const [pos, setPos] = useState<Position | null>(sim.current);
	const [locating, setLocating] = useState(false);
	const [watching, setWatching] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [recenter, setRecenter] = useState<Recenter | null>(null);
	const watchId = useRef<number | null>(null);
	const nonce = useRef(0);

	useEffect(() => {
		// Clear the watch on unmount.
		return () => {
			if (watchId.current != null) navigator.geolocation.clearWatch(watchId.current);
		};
	}, []);

	const recenterOn = useCallback((lat: number, lon: number) => {
		nonce.current += 1;
		setRecenter({ lat, lon, nonce: nonce.current });
	}, []);

	// Start continuous tracking once, so the dot follows the walker.
	const ensureWatch = useCallback(() => {
		if (watchId.current != null || sim.current || !('geolocation' in navigator)) return;
		setWatching(true);
		watchId.current = navigator.geolocation.watchPosition(
			(p) =>
				setPos({ lat: p.coords.latitude, lon: p.coords.longitude, accuracy: p.coords.accuracy }),
			(err) => setError(err.message),
			{ enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 },
		);
	}, []);

	const locate = useCallback(() => {
		setError(null);
		if (sim.current) {
			setPos(sim.current);
			recenterOn(sim.current.lat, sim.current.lon);
			return;
		}
		if (!('geolocation' in navigator)) {
			setError('Geolocation is not available on this device.');
			return;
		}
		ensureWatch();
		setLocating(true);
		navigator.geolocation.getCurrentPosition(
			(p) => {
				setLocating(false);
				const np = { lat: p.coords.latitude, lon: p.coords.longitude, accuracy: p.coords.accuracy };
				setPos(np);
				recenterOn(np.lat, np.lon);
			},
			(err) => {
				setLocating(false);
				setError(err.message);
			},
			{ enableHighAccuracy: true, maximumAge: 0, timeout: 15000 },
		);
	}, [ensureWatch, recenterOn]);

	return { pos, locating, watching, error, recenter, locate };
}
