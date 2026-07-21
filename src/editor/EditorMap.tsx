import L from 'leaflet';
import { useMemo } from 'react';
import {
	CircleMarker,
	MapContainer,
	Marker,
	Polyline,
	TileLayer,
	Tooltip,
	useMapEvents,
} from 'react-leaflet';
import type { LatLng } from '../data/park';
import type { EditorProject, EditorTab, Interaction } from './types';

const vertexIcon = L.divIcon({
	className: '',
	html: '<div class="editor-vertex" />',
	iconSize: [14, 14],
	iconAnchor: [7, 7],
});
const landmarkIcon = L.divIcon({
	className: '',
	html: '<div class="editor-landmark" />',
	iconSize: [18, 18],
	iconAnchor: [9, 9],
});

function poiIcon(emoji: string, color?: string) {
	const safeEmoji = emoji.replace(/[&<>"']/g, '');
	const safeColor = color && /^#[0-9a-f]{6}$/i.test(color) ? color : '#fff';
	return L.divIcon({
		className: '',
		html: `<div class="editor-poi" style="color:${safeColor}">${safeEmoji}</div>`,
		iconSize: [30, 30],
		iconAnchor: [15, 15],
	});
}

function MapEvents({ onClick }: { onClick: (point: LatLng) => void }) {
	useMapEvents({ click: (event) => onClick([event.latlng.lat, event.latlng.lng]) });
	return null;
}

interface Props {
	project: EditorProject;
	tab: EditorTab;
	selectedTrailId: string | null;
	selectedMarkerIndex: number | null;
	selectedPoiId: string | null;
	selectedHikeId: string | null;
	interaction: Interaction;
	hikeDraftIds: string[];
	onMapClick: (point: LatLng) => void;
	onTrailClick: (id: string, point: LatLng) => void;
	onSelectMarker: (index: number) => void;
	onSelectPoi: (id: string) => void;
	onBeginGesture: () => void;
	onTrailVertex: (trailId: string, index: number, point: LatLng) => void;
	onMoveMarker: (index: number, point: LatLng) => void;
	onMovePoi: (id: string, point: LatLng) => void;
	onEndGesture: (message: string) => void;
}

export default function EditorMap({
	project,
	tab,
	selectedTrailId,
	selectedMarkerIndex,
	selectedPoiId,
	selectedHikeId,
	interaction,
	hikeDraftIds,
	onMapClick,
	onTrailClick,
	onSelectMarker,
	onSelectPoi,
	onBeginGesture,
	onTrailVertex,
	onMoveMarker,
	onMovePoi,
	onEndGesture,
}: Props) {
	const selectedTrail = project.park.trails.find((trail) => trail.id === selectedTrailId);
	const activeHike = project.hikes.find((hike) => hike.id === selectedHikeId);
	const poiIcons = useMemo(
		() => new Map(project.pois.map((poi) => [poi.id, poiIcon(poi.emoji, poi.color)])),
		[project.pois],
	);
	return (
		<MapContainer
			bounds={project.park.bounds}
			boundsOptions={{ padding: [25, 25] }}
			className="editor-map"
			doubleClickZoom={false}
		>
			<TileLayer
				url="https://basemap.nationalmap.gov/arcgis/rest/services/USGSTopo/MapServer/tile/{z}/{y}/{x}"
				attribution="&copy; USGS The National Map"
				maxNativeZoom={16}
				maxZoom={20}
			/>
			{project.park.trails.map((trail) => {
				const picked = hikeDraftIds.includes(trail.id);
				const selected = trail.id === selectedTrailId;
				return (
					<Polyline
						key={trail.id}
						positions={trail.coords}
						pathOptions={{
							color: picked
								? '#d6006e'
								: trail.color.toUpperCase() === '#000000'
									? '#344b37'
									: trail.color,
							weight: picked || selected ? 7 : 4,
							opacity: tab === 'hikes' && !picked ? 0.45 : 0.85,
						}}
						eventHandlers={{
							click: (event) => {
								L.DomEvent.stopPropagation(event.originalEvent);
								onTrailClick(trail.id, [event.latlng.lat, event.latlng.lng]);
							},
						}}
					>
						<Tooltip sticky>{trail.name}</Tooltip>
					</Polyline>
				);
			})}
			{tab === 'hikes' && activeHike?.route.coords.length ? (
				<Polyline
					positions={activeHike.route.coords}
					pathOptions={{
						color: '#d6006e',
						weight: 7,
						opacity: 0.9,
						dashArray: interaction?.type === 'pick-hike' ? '8 7' : undefined,
					}}
				/>
			) : null}
			{project.park.points.map((point, index) => (
				<Marker
					// biome-ignore lint/suspicious/noArrayIndexKey: source landmarks have no IDs; index is stable during a drag.
					key={index}
					position={[point.lat, point.lon]}
					icon={landmarkIcon}
					draggable={tab === 'markers' && selectedMarkerIndex === index}
					eventHandlers={{
						click: () => onSelectMarker(index),
						dragstart: onBeginGesture,
						drag: (event) => {
							const value = event.target.getLatLng();
							onMoveMarker(index, [value.lat, value.lng]);
						},
						dragend: () => onEndGesture(`Moved ${point.name}`),
					}}
				>
					<Tooltip>{point.name}</Tooltip>
				</Marker>
			))}
			{project.pois.map((poi) => (
				<Marker
					key={poi.id}
					position={[poi.lat, poi.lon]}
					icon={poiIcons.get(poi.id) ?? poiIcon(poi.emoji, poi.color)}
					draggable={tab === 'pois' && selectedPoiId === poi.id}
					eventHandlers={{
						click: () => onSelectPoi(poi.id),
						dragstart: onBeginGesture,
						drag: (event) => {
							const value = event.target.getLatLng();
							onMovePoi(poi.id, [value.lat, value.lng]);
						},
						dragend: () => onEndGesture(`Moved ${poi.name}`),
					}}
				>
					<Tooltip>{`${poi.emoji} ${poi.name}`}</Tooltip>
				</Marker>
			))}
			{tab === 'trails' && selectedTrail && interaction?.type !== 'draw-trail'
				? selectedTrail.coords.map((point, index) => (
						<Marker
							// biome-ignore lint/suspicious/noArrayIndexKey: ordered vertex position is its editing identity.
							key={index}
							position={point}
							icon={vertexIcon}
							draggable
							zIndexOffset={1200}
							eventHandlers={{
								dragstart: onBeginGesture,
								drag: (event) => {
									const value = event.target.getLatLng();
									onTrailVertex(selectedTrail.id, index, [value.lat, value.lng]);
								},
								dragend: () => onEndGesture(`Moved a vertex on ${selectedTrail.name}`),
							}}
						/>
					))
				: null}
			{interaction?.type === 'draw-trail' && selectedTrail
				? selectedTrail.coords.map((point, index) => (
						<CircleMarker
							// biome-ignore lint/suspicious/noArrayIndexKey: drawing only appends, so indices stay stable.
							key={index}
							center={point}
							radius={5}
							pathOptions={{ color: '#fff', weight: 2, fillColor: '#d6006e', fillOpacity: 1 }}
						/>
					))
				: null}
			<MapEvents onClick={onMapClick} />
		</MapContainer>
	);
}
