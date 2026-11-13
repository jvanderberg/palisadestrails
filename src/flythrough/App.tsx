import {
	type Camera,
	ChevronDown,
	Eye,
	Hand,
	Mountain,
	Pause,
	Plane,
	Play,
	RotateCcw,
	Satellite,
	Trees,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { COLLECTIBLES } from '../data/collectibles';
import { formatHikeTime, HIKES } from '../data/hikes';
import { park } from '../data/park';
import ElevationProfile from './ElevationProfile';
import { installRecorder } from './recorder';
import { buildRoute, M_PER_MI, M_TO_FT } from './route';
import { type CameraMode, FlyScene, type GroundStyle } from './scene';
import { loadTerrain, type Terrain } from './terrain';

const MODES: { id: CameraMode; label: string; icon: typeof Camera; key: string }[] = [
	{ id: 'drone', label: 'Drone', icon: Plane, key: '1' },
	{ id: 'low', label: 'Low', icon: Eye, key: '2' },
	{ id: 'overhead', label: 'Overhead', icon: Satellite, key: '3' },
	{ id: 'free', label: 'Free look', icon: Hand, key: '4' },
];

const SPEEDS = [
	{ mps: 10, label: '½×' },
	{ mps: 25, label: '1×' },
	{ mps: 50, label: '2×' },
	{ mps: 100, label: '4×' },
];

const EXAGGERATIONS = [1, 1.5, 2];

const PARAMS = new URLSearchParams(window.location.search);
/** `?record`: no UI, just the stage — driven by scripts/record-flythrough.mjs. */
const RECORDING = PARAMS.has('record');

/** `?relief=1.5` sets the starting vertical exaggeration. */
function initialRelief(): number {
	const r = Number(PARAMS.get('relief'));
	return Number.isFinite(r) && r >= 1 && r <= 3 ? r : 1;
}

function hikeFromHash(): string | null {
	const id = new URLSearchParams(window.location.hash.slice(1)).get('hike');
	return id && HIKES.some((h) => h.id === id) ? id : null;
}

export default function App() {
	const hostRef = useRef<HTMLDivElement>(null);
	const sceneRef = useRef<FlyScene | null>(null);
	const [terrain, setTerrain] = useState<Terrain | null>(null);
	const [status, setStatus] = useState('Loading terrain…');
	const [hikeId, setHikeId] = useState<string | null>(hikeFromHash);
	const [s, setS] = useState(0);
	const [playing, setPlaying] = useState(false);
	const [mode, setMode] = useState<CameraMode>('drone');
	const [speed, setSpeed] = useState(25);
	const [exaggeration, setExaggeration] = useState(initialRelief);
	const [ground, setGround] = useState<GroundStyle>('photo');
	const [sceneReady, setSceneReady] = useState(false);

	useEffect(() => {
		let cancelled = false;
		loadTerrain(new URL('terrain/', document.baseURI).href, setStatus)
			.then((t) => {
				if (!cancelled) setTerrain(t);
			})
			.catch((err: Error) => setStatus(`Couldn't load terrain: ${err.message}`));
		return () => {
			cancelled = true;
		};
	}, []);

	useEffect(() => {
		const host = hostRef.current;
		if (!terrain || !host) return;
		let scene: FlyScene;
		try {
			scene = new FlyScene(host, {
				terrain,
				trails: park.trails,
				pois: COLLECTIBLES,
				onFrame: (dist, isPlaying) => {
					setS(dist);
					setPlaying(isPlaying);
				},
			});
		} catch (err) {
			setStatus(`3D isn't available in this browser: ${(err as Error).message}`);
			return;
		}
		sceneRef.current = scene;
		setSceneReady(true);
		setStatus('');
		return () => {
			scene.dispose();
			sceneRef.current = null;
			setSceneReady(false);
		};
	}, [terrain]);

	const route = useMemo(() => {
		const hike = HIKES.find((h) => h.id === hikeId);
		return terrain && hike ? buildRoute(terrain, hike) : null;
	}, [terrain, hikeId]);

	useEffect(() => {
		const scene = sceneRef.current;
		if (!scene || !terrain || !sceneReady) return;
		scene.setRoute(route);
		if (route) setMode((m) => (m === 'free' ? 'drone' : m));
		else setMode('free');
	}, [route, terrain, sceneReady]);

	// Re-applied whenever the scene is (re)created, so choices made while it
	// was loading aren't lost.
	useEffect(() => {
		if (sceneReady) sceneRef.current?.setMode(mode);
	}, [mode, sceneReady]);
	useEffect(() => {
		if (sceneReady) sceneRef.current?.setSpeed(speed);
	}, [speed, sceneReady]);
	useEffect(() => {
		if (sceneReady) sceneRef.current?.setExaggeration(exaggeration);
	}, [exaggeration, sceneReady]);
	useEffect(() => {
		if (sceneReady) sceneRef.current?.setGround(ground);
	}, [ground, sceneReady]);

	useEffect(() => {
		const scene = sceneRef.current;
		if (!RECORDING || !sceneReady || !scene || !terrain || !route) return;
		return installRecorder(scene, terrain, route);
	}, [sceneReady, terrain, route]);

	useEffect(() => {
		const url = new URL(window.location.href);
		url.hash = hikeId ? `hike=${hikeId}` : '';
		window.history.replaceState(null, '', url);
	}, [hikeId]);

	const togglePlay = useCallback(() => {
		const scene = sceneRef.current;
		if (!scene) return;
		if (playing) scene.pause();
		else scene.play();
	}, [playing]);

	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			if (e.target instanceof HTMLSelectElement || e.target instanceof HTMLInputElement) return;
			const scene = sceneRef.current;
			if (!scene) return;
			if (e.key === 't' || e.key === 'T') {
				setGround((g) => (g === 'photo' ? 'bare' : 'photo'));
				return;
			}
			if (!route) return;
			if (e.key === ' ') {
				e.preventDefault();
				togglePlay();
			} else if (e.key === 'ArrowRight') scene.seek(s + 100);
			else if (e.key === 'ArrowLeft') scene.seek(s - 100);
			else {
				const m = MODES.find((x) => x.key === e.key);
				if (m) setMode(m.id);
			}
		};
		window.addEventListener('keydown', onKey);
		return () => window.removeEventListener('keydown', onKey);
	}, [route, s, togglePlay]);

	const hike = route?.hike;
	const lake = terrain?.meta.lakeLevel ?? 0;
	const elevFt = route
		? Math.round(
				(route.heights[Math.min(route.heights.length - 1, Math.round(s / route.path.step))] +
					lake) *
					M_TO_FT,
			)
		: null;

	const credit = (
		<div className="fly-credit">Elevation: USGS 3DEP lidar · Imagery: USDA NAIP 2022</div>
	);

	if (RECORDING) {
		return (
			<div className="fly-app">
				<div ref={hostRef} className="fly-stage" />
				{credit}
			</div>
		);
	}

	return (
		<div className="fly-app">
			<div ref={hostRef} className="fly-stage" />

			{status ? (
				<div className="fly-loading">
					<Mountain size={28} />
					<span>{status}</span>
				</div>
			) : null}

			<div className="fly-panel fly-top">
				<div className="fly-brand">
					<span className="fly-brand-title">Palisades Park</span>
					<span className="fly-brand-sub">3D trail fly-through</span>
				</div>
				<label className="fly-select">
					<select
						value={hikeId ?? ''}
						onChange={(e) => setHikeId(e.target.value || null)}
						aria-label="Choose a hike"
					>
						<option value="">All trails — overview</option>
						{HIKES.map((h) => (
							<option key={h.id} value={h.id}>
								{h.name} · {h.distanceMi.toFixed(1)} mi
							</option>
						))}
					</select>
					<ChevronDown size={16} aria-hidden />
				</label>
				{hike && route ? (
					<div className="fly-chips">
						{hike.difficulty ? <span className="fly-chip">{hike.difficulty}</span> : null}
						<span className="fly-chip">{hike.distanceMi.toFixed(1)} mi</span>
						<span className="fly-chip">{formatHikeTime(hike.estimatedMinutes)}</span>
						<span className="fly-chip">↑ {Math.round(route.stats.gain * M_TO_FT)} ft</span>
					</div>
				) : (
					<p className="fly-hint">Pick a hike to fly it, or drag to explore the park.</p>
				)}
			</div>

			{route ? (
				<div className="fly-panel fly-bottom">
					<ElevationProfile
						route={route}
						lakeLevel={lake}
						position={s}
						onSeek={(d) => sceneRef.current?.seek(d)}
					/>
					<div className="fly-controls">
						<button
							type="button"
							className="fly-play"
							onClick={togglePlay}
							aria-label={playing ? 'Pause' : 'Play'}
						>
							{playing ? <Pause size={20} /> : <Play size={20} />}
						</button>
						<button
							type="button"
							className="fly-icon-btn"
							onClick={() => sceneRef.current?.seek(0)}
							aria-label="Back to start"
						>
							<RotateCcw size={16} />
						</button>
						<div className="fly-readout">
							<strong>
								{(s / M_PER_MI).toFixed(2)} / {(route.path.length / M_PER_MI).toFixed(2)} mi
							</strong>
							<span>{elevFt} ft elevation</span>
						</div>
						<fieldset className="fly-group" aria-label="Camera">
							{MODES.map(({ id, label, icon: Icon, key }) => (
								<button
									key={id}
									type="button"
									className={mode === id ? 'active' : ''}
									onClick={() => setMode(id)}
									title={`${label} (${key})`}
								>
									<Icon size={15} />
									<span>{label}</span>
								</button>
							))}
						</fieldset>
						<fieldset className="fly-group" aria-label="Speed">
							{SPEEDS.map(({ mps, label }) => (
								<button
									key={mps}
									type="button"
									className={speed === mps ? 'active' : ''}
									onClick={() => setSpeed(mps)}
								>
									{label}
								</button>
							))}
						</fieldset>
						<GroundToggle value={ground} onChange={setGround} />
						<ExaggerationToggle value={exaggeration} onChange={setExaggeration} />
					</div>
				</div>
			) : (
				<div className="fly-panel fly-bottom fly-bottom-slim">
					<GroundToggle value={ground} onChange={setGround} />
					<ExaggerationToggle value={exaggeration} onChange={setExaggeration} />
				</div>
			)}

			{credit}
		</div>
	);
}

const GROUNDS: { id: GroundStyle; label: string }[] = [
	{ id: 'photo', label: 'Photo' },
	{ id: 'bare', label: 'Bare earth' },
];

function GroundToggle({
	value,
	onChange,
}: {
	value: GroundStyle;
	onChange: (v: GroundStyle) => void;
}) {
	return (
		<fieldset className="fly-group" aria-label="Ground">
			<span className="fly-group-label" title="Toggle with T">
				<Trees size={14} /> Ground
			</span>
			{GROUNDS.map(({ id, label }) => (
				<button
					key={id}
					type="button"
					className={value === id ? 'active' : ''}
					onClick={() => onChange(id)}
				>
					{label}
				</button>
			))}
		</fieldset>
	);
}

function ExaggerationToggle({ value, onChange }: { value: number; onChange: (v: number) => void }) {
	return (
		<fieldset className="fly-group" aria-label="Vertical exaggeration">
			<span className="fly-group-label">
				<Mountain size={14} /> Relief
			</span>
			{EXAGGERATIONS.map((e) => (
				<button
					key={e}
					type="button"
					className={value === e ? 'active' : ''}
					onClick={() => onChange(e)}
				>
					{e}×
				</button>
			))}
		</fieldset>
	);
}
