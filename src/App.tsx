import { Info, Menu as MenuIcon } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import CollectPanel from './components/CollectPanel';
import Gate from './components/Gate';
import HikeDetail from './components/HikeDetail';
import InstallHelpModal from './components/InstallHelpModal';
import MapView, { type FitTarget, type FocusTarget, type HikeView } from './components/MapView';
import Menu from './components/Menu';
import PersonalHikesPanel from './components/PersonalHikesPanel';
import PersonalMarkersPanel from './components/PersonalMarkersPanel';
import RewardModal from './components/RewardModal';
import ShareAppModal from './components/ShareAppModal';
import { COLLECTIBLES, currentTier, GAME_CONFIG, type Tier, TOP_TIER } from './data/collectibles';
import { formatHikeTime, HIKES, type Hike, hikeEndpoints, hikeTrails } from './data/hikes';
import { annotate } from './game/proximity';
import { selectCount, useGame } from './game/store';
import { useGeolocation } from './game/useGeolocation';
import { type PersonalHike, type PersonalMarker, usePersonal } from './personal/store';

export default function App() {
	// Route is a main menu page or `hike:<id>` for a curated hike.
	const [route, setRoute] = useState('map');
	const [menuOpen, setMenuOpen] = useState(false);
	const [installHelpOpen, setInstallHelpOpen] = useState(false);
	const [shareOpen, setShareOpen] = useState(false);
	const [focus, setFocus] = useState<FocusTarget | null>(null);
	const [fit, setFit] = useState<FitTarget | null>(null);
	// When set, the map shows only this hike's trail portion + Start/Finish.
	const [mapHikeId, setMapHikeId] = useState<string | null>(null);
	const [mapDetailsOpen, setMapDetailsOpen] = useState(false);
	const [personalHikeViewId, setPersonalHikeViewId] = useState<string | null>(null);
	const [personalHikeEditId, setPersonalHikeEditId] = useState<string | null>(null);
	const [personalMarkerEditId, setPersonalMarkerEditId] = useState<string | null>(null);
	// Which rank's certificate is showing (null = closed).
	const [rewardTier, setRewardTier] = useState<Tier | null>(null);
	const [toast, setToast] = useState<string | null>(null);
	const toastTimer = useRef<number | undefined>(undefined);

	const { pos, locating, watching, error, recenter, locate } = useGeolocation();
	const collected = useGame((s) => s.collected);
	const count = useGame(selectCount);
	const doCollect = useGame((s) => s.collect);
	const unlocked = useGame((s) => s.unlocked);
	const unlock = useGame((s) => s.unlock);
	const personalHikes = usePersonal((state) => state.hikes);
	const personalMarkers = usePersonal((state) => state.markers);
	const activeHikeId = usePersonal((state) => state.activeHikeId);
	const addTrackPoint = usePersonal((state) => state.addTrackPoint);
	const pausePersonalHike = usePersonal((state) => state.pauseHike);
	const resumePersonalHike = usePersonal((state) => state.resumeHike);
	const finishPersonalHike = usePersonal((state) => state.finishHike);
	const activePersonalHike = personalHikes.find((hike) => hike.id === activeHikeId);

	const pois = useMemo(
		() => annotate(COLLECTIBLES, collected, pos, GAME_CONFIG.collectRadiusM),
		[collected, pos],
	);
	const activeHike: Hike | undefined = route.startsWith('hike:')
		? HIKES.find((h) => h.id === route.slice(5))
		: undefined;

	const mapHike = useMemo(
		() => (mapHikeId ? HIKES.find((h) => h.id === mapHikeId) : undefined),
		[mapHikeId],
	);
	const hikeView: HikeView | null = useMemo(() => {
		const h = mapHike;
		if (!h) return null;
		const { start, end } = hikeEndpoints(h);
		return { name: h.name, trails: hikeTrails(h), start, end };
	}, [mapHike]);
	const personalTracks = useMemo(() => {
		const ids = new Set(
			(personalHikeViewId ? [personalHikeViewId] : [activeHikeId]).filter(Boolean),
		);
		return personalHikes
			.filter((hike) => ids.has(hike.id))
			.map((hike) => ({
				id: hike.id,
				name: hike.name,
				selected: hike.id === personalHikeViewId,
				segments: hike.segments.map((segment) =>
					segment.map((point): [number, number] => [point.lat, point.lon]),
				),
			}));
	}, [personalHikes, activeHikeId, personalHikeViewId]);

	const flash = useCallback((msg: string) => {
		setToast(msg);
		window.clearTimeout(toastTimer.current);
		toastTimer.current = window.setTimeout(() => setToast(null), 2400);
	}, []);

	// Local development preview for reviewing the complete top-tier flow.
	// This branch is removed from production builds by Vite.
	useEffect(() => {
		if (!import.meta.env.DEV) return;
		if (new URLSearchParams(window.location.search).get('demo') !== 'trailblazer') return;
		const timestamp = new Date().toISOString();
		useGame.setState({
			name: 'Trailblazer Demo',
			collected: Object.fromEntries(COLLECTIBLES.map((poi) => [poi.id, timestamp])),
			unlocked: true,
		});
		setRewardTier(TOP_TIER);
	}, []);

	// Auto-open the certificate each time a new rank is reached.
	const prevCount = useRef(count);
	useEffect(() => {
		const before = currentTier(prevCount.current);
		const now = currentTier(count);
		if (now && (!before || now.count > before.count)) setRewardTier(now);
		prevCount.current = count;
	}, [count]);

	useEffect(() => {
		if (error) flash(error);
	}, [error, flash]);

	useEffect(() => {
		if (!pos || activePersonalHike?.status !== 'recording') return;
		addTrackPoint({ ...pos, timestamp: Date.now() });
	}, [pos, activePersonalHike?.status, addTrackPoint]);

	const navigate = useCallback((r: string) => {
		// Choosing "Map" from the menu returns to the full trail network.
		if (r === 'map') {
			setMapHikeId(null);
			setPersonalHikeViewId(null);
		}
		setRoute(r);
		setMenuOpen(false);
	}, []);

	const handleCollect = useCallback(
		(id: string) => {
			const info = pois.find((p) => p.poi.id === id);
			if (!info || info.state === 'collected') return;
			if (info.state !== 'near') {
				flash(pos ? 'Too far — get closer to collect' : 'Turn on location to collect');
				return;
			}
			if (doCollect(id)) flash(`${info.poi.emoji} Collected ${info.poi.name}!`);
		},
		[pois, pos, doCollect, flash],
	);

	const focusPoi = useCallback((id: string) => {
		const p = COLLECTIBLES.find((x) => x.id === id);
		if (!p) return;
		setRoute('map');
		setFocus((f) => ({ id, lat: p.lat, lon: p.lon, nonce: (f?.nonce ?? 0) + 1 }));
	}, []);

	const showHikeOnMap = useCallback((hike: Hike) => {
		const coords = hikeTrails(hike).flat();
		setMapHikeId(hike.id);
		setPersonalHikeViewId(null);
		setMapDetailsOpen(false);
		setRoute('map');
		if (coords.length > 0) setFit((f) => ({ coords, nonce: (f?.nonce ?? 0) + 1 }));
	}, []);

	const showPersonalHikeOnMap = useCallback((hike: PersonalHike) => {
		const coords = hike.segments.flatMap((segment) =>
			segment.map((point): [number, number] => [point.lat, point.lon]),
		);
		setMapHikeId(null);
		setPersonalHikeViewId(hike.id);
		setRoute('map');
		if (coords.length) setFit((value) => ({ coords, nonce: (value?.nonce ?? 0) + 1 }));
	}, []);

	const showPersonalMarkerOnMap = useCallback((marker: PersonalMarker) => {
		setRoute('map');
		setFocus((value) => ({
			id: marker.id,
			markerKey: `personal:${marker.id}`,
			lat: marker.lat,
			lon: marker.lon,
			nonce: (value?.nonce ?? 0) + 1,
		}));
	}, []);

	const title = activeHike
		? activeHike.name
		: route === 'collect'
			? 'Trail Mastery'
			: route === 'my-hikes'
				? 'My Hikes'
				: route === 'my-markers'
					? 'My Markers'
					: 'Palisades Trails';

	return (
		<div className="flex h-[100dvh] flex-col overflow-hidden bg-background text-foreground">
			<header className="z-[500] flex shrink-0 items-center gap-3 bg-primary px-3 pt-[calc(env(safe-area-inset-top)+10px)] pb-2.5 text-primary-foreground shadow">
				<button
					type="button"
					onClick={() => setMenuOpen(true)}
					aria-label="Open menu"
					className="grid h-10 w-10 shrink-0 place-items-center rounded-lg hover:bg-white/10"
				>
					<MenuIcon size={22} />
				</button>
				<div className="min-w-0 flex-1">
					<h1 className="truncate text-lg font-bold leading-tight">{title}</h1>
					<p className="truncate text-xs opacity-80">
						{GAME_CONFIG.parkName} · explore &amp; collect
					</p>
				</div>
				<button
					type="button"
					onClick={() => navigate('collect')}
					className="flex shrink-0 items-center gap-1 rounded-full bg-white/15 px-3 py-1 text-sm font-bold"
					title="Collected points of interest"
				>
					<span className="text-amber-300">★</span>
					{count}
				</button>
			</header>

			<main className="relative flex-1 overflow-hidden">
				<div className={`absolute inset-0 ${route === 'map' ? 'block' : 'hidden'}`}>
					<MapView
						pois={pois}
						pos={pos}
						focus={focus}
						fit={fit}
						recenter={recenter}
						hikeView={hikeView}
						personalTracks={personalTracks}
						personalMarkers={personalMarkers}
						visible={route === 'map'}
						onCollect={handleCollect}
						onEditPersonalMarker={(marker) => {
							setPersonalMarkerEditId(marker.id);
							setRoute('my-markers');
						}}
					/>
					{hikeView && mapHike ? (
						<div className="-translate-x-1/2 absolute top-20 left-1/2 z-[600] w-[calc(100%-1.5rem)] max-w-md overflow-hidden rounded-2xl bg-primary/95 text-sm text-primary-foreground shadow-lg sm:top-3">
							<div className="flex items-center gap-2 py-1.5 pr-1.5 pl-3">
								<button
									type="button"
									onClick={() => setMapDetailsOpen((open) => !open)}
									aria-expanded={mapDetailsOpen}
									className="flex min-w-0 flex-1 items-center gap-2 rounded-full px-1 py-1 text-left"
								>
									<Info size={16} className="shrink-0" />
									<span className="truncate font-semibold">{hikeView.name}</span>
									<span className="shrink-0 text-xs opacity-80">
										{mapDetailsOpen ? 'Hide details' : 'Details'}
									</span>
								</button>
								<button
									type="button"
									onClick={() => {
										setMapHikeId(null);
										setMapDetailsOpen(false);
									}}
									className="shrink-0 rounded-full bg-white/20 px-3 py-1 text-xs font-semibold"
								>
									Show all trails
								</button>
							</div>
							{mapDetailsOpen ? (
								<div className="border-white/20 border-t bg-white px-4 py-3 text-foreground">
									<div className="mb-2 flex items-center gap-2 text-xs font-semibold">
										{mapHike.difficulty ? (
											<span className="rounded-full bg-secondary px-2.5 py-1">
												{mapHike.difficulty}
											</span>
										) : null}
										<span className="rounded-full bg-secondary px-2.5 py-1">
											{mapHike.distanceMi.toFixed(1)} mi
										</span>
										<span className="rounded-full bg-secondary px-2.5 py-1">
											{formatHikeTime(mapHike.estimatedMinutes)}
										</span>
									</div>
									<p className="m-0 text-[13px] leading-relaxed">
										{mapHike.description ?? 'Description coming soon.'}
									</p>
								</div>
							) : null}
						</div>
					) : null}
					<button
						type="button"
						onClick={locate}
						aria-label="Show my location"
						className={`absolute right-3 bottom-3 z-[600] grid h-12 w-12 place-items-center rounded-full shadow-lg ${
							watching ? 'bg-primary text-white' : 'bg-white text-primary'
						} ${locating ? 'animate-pulse' : ''}`}
					>
						<span className="text-xl">◎</span>
					</button>
					{toast ? (
						<div className="-translate-x-1/2 absolute bottom-20 left-1/2 z-[700] max-w-[90%] rounded-full bg-black/80 px-4 py-2 text-center text-sm text-white shadow-lg">
							{toast}
						</div>
					) : null}
					{activePersonalHike ? (
						<div className="absolute bottom-3 left-3 z-[600] flex items-center gap-1 rounded-2xl bg-white/95 p-1.5 shadow-lg">
							<span className="max-w-32 truncate px-2 text-xs font-bold">
								{activePersonalHike.status === 'recording' ? '● Recording' : 'Paused'}
							</span>
							{activePersonalHike.status === 'recording' ? (
								<button
									type="button"
									onClick={() => pausePersonalHike()}
									className="rounded-xl bg-amber-100 px-3 py-2 text-xs font-bold text-amber-900"
								>
									Pause
								</button>
							) : (
								<button
									type="button"
									onClick={() => resumePersonalHike(pos)}
									className="rounded-xl bg-primary px-3 py-2 text-xs font-bold text-white"
								>
									Resume
								</button>
							)}
							<button
								type="button"
								onClick={() => {
									const finishedId = activePersonalHike.id;
									finishPersonalHike(pos);
									setPersonalHikeEditId(finishedId);
									setRoute('my-hikes');
								}}
								className="rounded-xl bg-red-700 px-3 py-2 text-xs font-bold text-white"
							>
								Finish
							</button>
						</div>
					) : null}
				</div>

				<div className={`absolute inset-0 ${route === 'collect' ? 'block' : 'hidden'}`}>
					<CollectPanel
						pois={pois}
						onCollect={handleCollect}
						onFocus={focusPoi}
						onClaim={() => setRewardTier(currentTier(count))}
					/>
				</div>

				<div className={`absolute inset-0 ${route === 'my-hikes' ? 'block' : 'hidden'}`}>
					<PersonalHikesPanel
						position={pos}
						onLocate={locate}
						onShowMap={showPersonalHikeOnMap}
						openEditorId={personalHikeEditId}
						onEditorOpened={() => setPersonalHikeEditId(null)}
					/>
				</div>

				<div className={`absolute inset-0 ${route === 'my-markers' ? 'block' : 'hidden'}`}>
					<PersonalMarkersPanel
						position={pos}
						onLocate={locate}
						onShowMap={showPersonalMarkerOnMap}
						onMessage={flash}
						openEditorId={personalMarkerEditId}
						onEditorOpened={() => setPersonalMarkerEditId(null)}
					/>
				</div>

				{activeHike ? (
					<div className="absolute inset-0">
						<HikeDetail hike={activeHike} onShowOnMap={showHikeOnMap} onOpenPoi={focusPoi} />
					</div>
				) : null}
			</main>

			<Menu
				open={menuOpen}
				route={route}
				collectedCount={count}
				personalHikeCount={personalHikes.filter((hike) => hike.status === 'finished').length}
				personalMarkerCount={personalMarkers.length}
				recording={activePersonalHike?.status === 'recording'}
				onClose={() => setMenuOpen(false)}
				onNavigate={navigate}
				onOpenCert={(t) => {
					setRewardTier(t);
					setMenuOpen(false);
				}}
				onOpenInstall={() => {
					setInstallHelpOpen(true);
					setMenuOpen(false);
				}}
				onOpenShare={() => {
					setShareOpen(true);
					setMenuOpen(false);
				}}
			/>
			<InstallHelpModal open={installHelpOpen} onClose={() => setInstallHelpOpen(false)} />
			<ShareAppModal open={shareOpen} onClose={() => setShareOpen(false)} />
			<RewardModal tier={rewardTier} onClose={() => setRewardTier(null)} />
			{unlocked ? null : <Gate onPass={unlock} />}
		</div>
	);
}
