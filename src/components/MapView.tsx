import L from 'leaflet';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
	Circle,
	CircleMarker,
	LayersControl,
	MapContainer,
	Marker,
	Polyline,
	Popup,
	TileLayer,
	Tooltip,
	useMap,
	useMapEvents,
} from 'react-leaflet';
import { GAME_CONFIG } from '../data/collectibles';
import { type LatLng, park } from '../data/park';
import type { PoiInfo } from '../game/proximity';
import type { Position, Recenter } from '../game/useGeolocation';
import { fmtDist } from '../lib/geo';
import { endpointIcon, landmarkIcon, poiIcon } from '../lib/markers';

/** Only show the (43) permanent trail labels once zoomed in enough to read them. */
const LABEL_MIN_ZOOM = 16;

export interface FocusTarget {
	id: string;
	lat: number;
	lon: number;
	/** Bumped on every request so repeated focuses of the same id re-fire. */
	nonce: number;
}

export interface FitTarget {
	coords: [number, number][];
	/** Bumped on every request so re-fitting the same hike re-fires. */
	nonce: number;
}

export interface HikeView {
	name: string;
	trails: LatLng[][];
	start?: LatLng;
	end?: LatLng;
}

interface Props {
	pois: PoiInfo[];
	pos: Position | null;
	focus: FocusTarget | null;
	fit: FitTarget | null;
	/** Changes on each locate-button tap; the map flies to the fresh fix. */
	recenter: Recenter | null;
	/** When set, show only this hike's trail segments + Start/Finish. */
	hikeView: HikeView | null;
	/** True when the map view is showing — triggers a Leaflet resize. */
	visible: boolean;
	onCollect: (id: string) => void;
}

/** Leaflet mis-sizes when its container was display:none; fix on reveal. */
function ResizeController({ visible }: { visible: boolean }) {
	const map = useMap();
	useEffect(() => {
		if (visible) {
			const t = setTimeout(() => map.invalidateSize(), 60);
			return () => clearTimeout(t);
		}
	}, [visible, map]);
	return null;
}

/** Imperatively pans/zooms to a focus request; opens the POI popup when there is one. */
function FocusController({
	focus,
	markers,
}: {
	focus: FocusTarget | null;
	markers: Map<string, L.Marker>;
}) {
	const map = useMap();
	useEffect(() => {
		if (!focus) return;
		map.flyTo([focus.lat, focus.lon], Math.max(map.getZoom(), 18), { duration: 0.4 });
		const marker = markers.get(`poi:${focus.id}`);
		if (!marker) return;
		const t = setTimeout(() => marker.openPopup(), 420);
		return () => clearTimeout(t);
	}, [focus, map, markers]);
	return null;
}

/** Tracks the map's zoom so labels can be shown only when readable. */
function ZoomWatcher({ onZoom }: { onZoom: (zoom: number) => void }) {
	const map = useMapEvents({ zoomend: () => onZoom(map.getZoom()) });
	useEffect(() => onZoom(map.getZoom()), [map, onZoom]);
	return null;
}

const BASEMAP_KEY = 'palisades-basemap';
function readBasemap(): string {
	try {
		return localStorage.getItem(BASEMAP_KEY) ?? 'USGS Topo';
	} catch {
		return 'USGS Topo';
	}
}

/** Remembers the chosen basemap across reloads. */
function BasemapWatcher() {
	useMapEvents({
		baselayerchange: (e) => {
			try {
				localStorage.setItem(BASEMAP_KEY, e.name);
			} catch {
				// ignore
			}
		},
	});
	return null;
}

/** Flies to the player's location on each locate-button tap. */
function RecenterController({ recenter }: { recenter: Recenter | null }) {
	const map = useMap();
	useEffect(() => {
		if (!recenter) return;
		map.flyTo([recenter.lat, recenter.lon], Math.max(map.getZoom(), 17), { duration: 0.4 });
	}, [recenter, map]);
	return null;
}

/** Frames the map to a hike's points of interest. */
function FitController({ fit }: { fit: FitTarget | null }) {
	const map = useMap();
	useEffect(() => {
		if (!fit || fit.coords.length === 0) return;
		if (fit.coords.length === 1) {
			map.flyTo(fit.coords[0], Math.max(map.getZoom(), 17), { duration: 0.4 });
		} else {
			map.fitBounds(L.latLngBounds(fit.coords), { padding: [50, 50], maxZoom: 17 });
		}
	}, [fit, map]);
	return null;
}

export default function MapView({
	pois,
	pos,
	focus,
	fit,
	recenter,
	hikeView,
	visible,
	onCollect,
}: Props) {
	const markers = useRef<Map<string, L.Marker>>(new Map());
	const bounds = useMemo(() => L.latLngBounds(park.bounds), []);
	const [zoom, setZoom] = useState(0);
	const showLabels = zoom >= LABEL_MIN_ZOOM;
	const [savedBasemap] = useState(readBasemap);

	const register = (key: string) => (m: L.Marker | null) => {
		if (m) markers.current.set(key, m);
		else markers.current.delete(key);
	};

	return (
		<MapContainer
			bounds={bounds}
			boundsOptions={{ padding: [30, 30] }}
			className="h-full w-full"
			zoomControl
		>
			<LayersControl position="topright">
				<LayersControl.BaseLayer checked={savedBasemap === 'USGS Topo'} name="USGS Topo">
					<TileLayer
						attribution="&copy; USGS The National Map"
						url="https://basemap.nationalmap.gov/arcgis/rest/services/USGSTopo/MapServer/tile/{z}/{y}/{x}"
						maxNativeZoom={16}
						maxZoom={19}
					/>
				</LayersControl.BaseLayer>
				<LayersControl.BaseLayer checked={savedBasemap === 'Topographic'} name="Topographic">
					<TileLayer
						attribution='&copy; <a href="https://opentopomap.org">OpenTopoMap</a> (CC-BY-SA) · &copy; OpenStreetMap'
						url="https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png"
						maxNativeZoom={17}
						maxZoom={19}
					/>
				</LayersControl.BaseLayer>
				<LayersControl.BaseLayer checked={savedBasemap === 'Street'} name="Street">
					<TileLayer
						attribution="&copy; OpenStreetMap"
						url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
						maxZoom={19}
					/>
				</LayersControl.BaseLayer>
			</LayersControl>

			{hikeView ? (
				<>
					{hikeView.trails.map((coords) => (
						<Polyline
							key={`hikeseg-${coords[0]?.join(',')}-${coords[coords.length - 1]?.join(',')}`}
							positions={coords}
							pathOptions={{
								color: '#d6006e',
								weight: 6,
								opacity: 0.95,
								lineCap: 'round',
								lineJoin: 'round',
							}}
						/>
					))}
					{hikeView.start ? (
						<Marker position={hikeView.start} icon={endpointIcon('start')} zIndexOffset={1100}>
							<Popup>Start · {hikeView.name}</Popup>
						</Marker>
					) : null}
					{hikeView.end ? (
						<Marker position={hikeView.end} icon={endpointIcon('end')} zIndexOffset={1100}>
							<Popup>Finish · {hikeView.name}</Popup>
						</Marker>
					) : null}
				</>
			) : (
				park.trails.map((t) => (
					<Polyline
						key={`trail-${t.name}-${t.coords[0]?.join(',')}`}
						positions={t.coords}
						pathOptions={{
							color: t.color === '#000000' ? '#3d4a33' : t.color,
							weight: 4,
							opacity: 0.85,
							lineCap: 'round',
							lineJoin: 'round',
						}}
					>
						{showLabels ? (
							<Tooltip permanent direction="center" className="trail-label">
								{t.name}
							</Tooltip>
						) : null}
					</Polyline>
				))
			)}

			{park.points.map((p) => (
				<Marker
					key={`lm-${p.name}-${p.lat}-${p.lon}`}
					position={[p.lat, p.lon]}
					icon={landmarkIcon()}
				>
					<Popup>{p.name}</Popup>
				</Marker>
			))}

			{pois.map(({ poi, distance, state }) => (
				<Marker
					key={`poi-${poi.id}`}
					position={[poi.lat, poi.lon]}
					icon={poiIcon(poi, state)}
					zIndexOffset={1000}
					ref={register(`poi:${poi.id}`)}
				>
					<Popup>
						<h3 className="m-0 mb-1 text-sm font-semibold">
							{poi.emoji} {poi.name}
						</h3>
						{poi.hint ? (
							<p className="mt-0 mb-1.5 text-xs text-muted-foreground">{poi.hint}</p>
						) : null}
						{state === 'collected' ? (
							<div className="font-semibold text-primary">✓ Collected</div>
						) : state === 'near' ? (
							<button
								type="button"
								className="w-full rounded-lg bg-primary px-3 py-1.5 font-semibold text-primary-foreground"
								onClick={() => onCollect(poi.id)}
							>
								Add to collection ✦
							</button>
						) : distance != null ? (
							<div className="text-xs text-muted-foreground">
								Get within {GAME_CONFIG.collectRadiusM} m to collect — you're {fmtDist(distance)}{' '}
								away.
							</div>
						) : (
							<div className="text-xs text-muted-foreground">
								Turn on location (◎) to collect when you're close.
							</div>
						)}
					</Popup>
				</Marker>
			))}

			{pos ? (
				<>
					<Circle
						center={[pos.lat, pos.lon]}
						radius={pos.accuracy || 0}
						pathOptions={{ color: '#2f6bd6', weight: 1, fillColor: '#2f6bd6', fillOpacity: 0.12 }}
						interactive={false}
					/>
					<CircleMarker
						center={[pos.lat, pos.lon]}
						radius={8}
						pathOptions={{ color: '#fff', weight: 3, fillColor: '#2f6bd6', fillOpacity: 1 }}
					/>
				</>
			) : null}

			<FocusController focus={focus} markers={markers.current} />
			<FitController fit={fit} />
			<RecenterController recenter={recenter} />
			<ResizeController visible={visible} />
			<ZoomWatcher onZoom={setZoom} />
			<BasemapWatcher />
		</MapContainer>
	);
}
