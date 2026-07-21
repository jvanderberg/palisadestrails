import { useCallback, useEffect, useRef, useState } from 'react';
import type { LatLng } from '../data/park';
import EditorMap from './EditorMap';
import {
	buildRoute,
	clone,
	joinTrails,
	lineMetres,
	parseGeoFile,
	slugify,
	splitTrail,
	uniqueId,
} from './model';
import type { EditorHike, EditorProject, EditorTab, Interaction } from './types';

const TABS: Array<[EditorTab, string]> = [
	['trails', 'Trails'],
	['markers', 'Markers'],
	['pois', 'POIs'],
	['hikes', 'Hikes'],
];

interface Selection {
	trail: string | null;
	marker: number | null;
	poi: string | null;
	hike: string | null;
}

function miles(coords: LatLng[]) {
	return (lineMetres(coords) / 1609.344).toFixed(2);
}

function downloadJson(project: EditorProject) {
	const blob = new Blob([JSON.stringify(project, null, 2)], { type: 'application/json' });
	const link = document.createElement('a');
	link.href = URL.createObjectURL(blob);
	link.download = `palisades-editor-${new Date().toISOString().slice(0, 10)}.json`;
	link.click();
	setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}

function routeSteps(names: string[]) {
	const seen = new Map<string, number>();
	return names.map((name) => {
		const occurrence = (seen.get(name) ?? 0) + 1;
		seen.set(name, occurrence);
		return { name, key: `${name}-${occurrence}` };
	});
}

export default function EditorApp() {
	const [project, setProject] = useState<EditorProject | null>(null);
	const [token, setToken] = useState('');
	const [tab, setTab] = useState<EditorTab>('trails');
	const [selection, setSelection] = useState<Selection>({
		trail: null,
		marker: null,
		poi: null,
		hike: null,
	});
	const [interaction, setInteraction] = useState<Interaction>(null);
	const [hikeDraftIds, setHikeDraftIds] = useState<string[]>([]);
	const [search, setSearch] = useState('');
	const [status, setStatus] = useState('Loading project…');
	const [statusType, setStatusType] = useState<'error' | ''>('');
	const [revision, setRevision] = useState(0);
	const fileInput = useRef<HTMLInputElement>(null);
	const importTarget = useRef<EditorTab>('trails');
	const projectRef = useRef<EditorProject | null>(null);
	const cleanRef = useRef('');
	const undoRef = useRef<string[]>([]);
	const redoRef = useRef<string[]>([]);
	const gestureRef = useRef(false);

	const replaceProject = useCallback((next: EditorProject) => {
		projectRef.current = next;
		setProject(next);
		setRevision((value) => value + 1);
	}, []);

	const commit = useCallback(
		(mutator: (draft: EditorProject) => void, message = 'Unsaved changes') => {
			const current = projectRef.current;
			if (!current) return;
			undoRef.current.push(JSON.stringify(current));
			if (undoRef.current.length > 50) undoRef.current.shift();
			redoRef.current = [];
			const next = clone(current);
			mutator(next);
			replaceProject(next);
			setStatus(message);
			setStatusType('');
		},
		[replaceProject],
	);

	const updateDirect = useCallback(
		(mutator: (draft: EditorProject) => void) => {
			const current = projectRef.current;
			if (!current) return;
			const next = clone(current);
			mutator(next);
			replaceProject(next);
		},
		[replaceProject],
	);

	const dirty = project ? JSON.stringify(project) !== cleanRef.current : false;

	useEffect(() => {
		fetch('/api/editor/data')
			.then(async (response) => {
				const result = (await response.json()) as {
					token?: string;
					project?: EditorProject;
					error?: string;
				};
				if (!response.ok || !result.project || !result.token)
					throw new Error(result.error || 'Could not load editor data.');
				setToken(result.token);
				projectRef.current = result.project;
				cleanRef.current = JSON.stringify(result.project);
				setProject(result.project);
				setStatus('Source files loaded');
			})
			.catch((error: Error) => {
				setStatus(error.message);
				setStatusType('error');
			});
	}, []);

	useEffect(() => {
		const beforeUnload = (event: BeforeUnloadEvent) => {
			if (!projectRef.current || JSON.stringify(projectRef.current) === cleanRef.current) return;
			event.preventDefault();
		};
		window.addEventListener('beforeunload', beforeUnload);
		return () => window.removeEventListener('beforeunload', beforeUnload);
	}, []);

	const undo = useCallback(() => {
		const current = projectRef.current;
		const previous = undoRef.current.pop();
		if (!current || !previous) return;
		redoRef.current.push(JSON.stringify(current));
		replaceProject(JSON.parse(previous) as EditorProject);
		setInteraction(null);
		setHikeDraftIds([]);
		setStatus('Undid last change');
	}, [replaceProject]);

	const redo = useCallback(() => {
		const current = projectRef.current;
		const next = redoRef.current.pop();
		if (!current || !next) return;
		undoRef.current.push(JSON.stringify(current));
		replaceProject(JSON.parse(next) as EditorProject);
		setInteraction(null);
		setHikeDraftIds([]);
		setStatus('Redid change');
	}, [replaceProject]);

	const save = useCallback(async () => {
		const current = projectRef.current;
		if (!current) return;
		try {
			setStatus('Saving source files…');
			const response = await fetch('/api/editor/save', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json', 'X-Editor-Token': token },
				body: JSON.stringify(current),
			});
			const result = (await response.json()) as { files?: number; backup?: string; error?: string };
			if (!response.ok) throw new Error(result.error || 'Save failed.');
			cleanRef.current = JSON.stringify(current);
			undoRef.current = [];
			redoRef.current = [];
			setStatus(`Saved ${result.files} files · backup: ${result.backup}`);
			setStatusType('');
			setRevision((value) => value + 1);
		} catch (error) {
			setStatus((error as Error).message);
			setStatusType('error');
		}
	}, [token]);

	useEffect(() => {
		const shortcut = (event: KeyboardEvent) => {
			if (!(event.metaKey || event.ctrlKey)) return;
			if (event.key.toLowerCase() === 's') {
				event.preventDefault();
				save();
			} else if (event.key.toLowerCase() === 'z') {
				event.preventDefault();
				event.shiftKey ? redo() : undo();
			}
		};
		window.addEventListener('keydown', shortcut);
		return () => window.removeEventListener('keydown', shortcut);
	}, [redo, save, undo]);

	const selectedTrail = project?.park.trails.find((trail) => trail.id === selection.trail) ?? null;
	const selectedMarker =
		selection.marker == null ? null : (project?.park.points[selection.marker] ?? null);
	const selectedPoi = project?.pois.find((poi) => poi.id === selection.poi) ?? null;
	const selectedHike = project?.hikes.find((hike) => hike.id === selection.hike) ?? null;

	const selectTab = (next: EditorTab) => {
		setTab(next);
		setSearch('');
		setInteraction(null);
		setHikeDraftIds([]);
	};

	const beginGesture = () => {
		if (gestureRef.current || !projectRef.current) return;
		gestureRef.current = true;
		undoRef.current.push(JSON.stringify(projectRef.current));
		redoRef.current = [];
	};

	const endGesture = (message: string) => {
		gestureRef.current = false;
		setStatus(message);
	};

	const moveTrailVertex = (trailId: string, index: number, point: LatLng) =>
		updateDirect((draft) => {
			const trail = draft.park.trails.find((item) => item.id === trailId);
			if (trail) trail.coords[index] = point;
		});

	const moveMarker = (index: number, point: LatLng) =>
		updateDirect((draft) => {
			draft.park.points[index].lat = point[0];
			draft.park.points[index].lon = point[1];
		});

	const movePoi = (id: string, point: LatLng) =>
		updateDirect((draft) => {
			const poi = draft.pois.find((item) => item.id === id);
			if (poi) [poi.lat, poi.lon] = point;
		});

	const applyHikeDraft = (draft: EditorProject, ids: string[]) => {
		const hike = draft.hikes.find((item) => item.id === selection.hike);
		if (!hike) return;
		const route = buildRoute(draft.park.trails, ids);
		hike.route = { names: route.names, coords: route.coords };
	};

	const trailClick = (id: string, point: LatLng) => {
		if (!project) return;
		if (tab === 'hikes' && interaction?.type === 'pick-hike') {
			const nextIds = hikeDraftIds.includes(id)
				? hikeDraftIds.filter((value) => value !== id)
				: [...hikeDraftIds, id];
			setHikeDraftIds(nextIds);
			commit((draft) => applyHikeDraft(draft, nextIds), 'Updated hike route');
			return;
		}
		if (tab !== 'trails') {
			setTab('trails');
			setSelection((value) => ({ ...value, trail: id }));
			return;
		}
		if (interaction?.type === 'split-trail') {
			try {
				let firstId = id;
				commit((draft) => {
					const result = splitTrail(draft.park.trails, id, point);
					draft.park.trails = result.trails;
					[firstId] = result.ids;
				}, 'Split trail into two segments');
				setSelection((value) => ({ ...value, trail: firstId }));
				setInteraction(null);
			} catch (error) {
				setStatus((error as Error).message);
				setStatusType('error');
			}
			return;
		}
		if (interaction?.type === 'join-trail') {
			if (id === interaction.firstId) return;
			try {
				let resultId = interaction.firstId;
				let gap = 0;
				commit(
					(draft) => {
						const result = joinTrails(draft.park.trails, interaction.firstId, id);
						draft.park.trails = result.trails;
						resultId = result.id;
						gap = result.gapMetres;
					},
					`Joined segments${gap > 10 ? ` across ${Math.round(gap)} m` : ''}`,
				);
				setSelection((value) => ({ ...value, trail: resultId }));
				setInteraction(null);
			} catch (error) {
				setStatus((error as Error).message);
				setStatusType('error');
			}
			return;
		}
		setSelection((value) => ({ ...value, trail: id }));
	};

	const mapClick = (point: LatLng) => {
		if (!interaction || !project) return;
		if (interaction.type === 'draw-trail') {
			updateDirect((draft) => {
				const trail = draft.park.trails.find((item) => item.id === interaction.trailId);
				trail?.coords.push(point);
			});
			setStatus('Added trail vertex');
		} else if (interaction.type === 'add-marker') {
			let index = project.park.points.length;
			commit((draft) => {
				index = draft.park.points.push({ name: 'New Marker', lat: point[0], lon: point[1] }) - 1;
			}, 'Added landmark marker');
			setSelection((value) => ({ ...value, marker: index }));
			setInteraction(null);
		} else if (interaction.type === 'add-poi') {
			const id = uniqueId('new-poi', new Set(project.pois.map((poi) => poi.id)));
			commit((draft) => {
				draft.pois.push({
					id,
					name: 'New POI',
					emoji: '📍',
					lat: point[0],
					lon: point[1],
					hint: '',
				});
			}, 'Added collectible POI');
			setSelection((value) => ({ ...value, poi: id }));
			setInteraction(null);
		}
	};

	const newTrail = () => {
		if (!project) return;
		const id = uniqueId('trail', new Set(project.park.trails.map((trail) => trail.id)));
		commit((draft) => {
			draft.park.trails.push({
				id,
				name: 'New Trail',
				color: '#3388FF',
				folder: 'Trails',
				coords: [],
			});
		}, 'Click the map to draw the trail');
		setSelection((value) => ({ ...value, trail: id }));
		setInteraction({ type: 'draw-trail', trailId: id });
	};

	const newHike = () => {
		if (!project) return;
		const id = uniqueId('new-hike', new Set(project.hikes.map((hike) => hike.id)));
		commit((draft) => {
			draft.hikes.push({
				id,
				name: 'New Hike',
				routeFile: `${id}.json`,
				difficulty: 'Moderate',
				description: '',
				route: { names: [], coords: [] },
			});
		}, 'Click trail segments in walking order');
		setSelection((value) => ({ ...value, hike: id }));
		setHikeDraftIds([]);
		setInteraction({ type: 'pick-hike' });
	};

	const deleteSelected = (kind: EditorTab) => {
		if (!project) return;
		const name =
			kind === 'trails'
				? selectedTrail?.name
				: kind === 'markers'
					? selectedMarker?.name
					: kind === 'pois'
						? selectedPoi?.name
						: selectedHike?.name;
		if (
			!name ||
			!window.confirm(
				`Delete ${name}?${kind === 'pois' ? ' Existing users will retain its old collection record.' : ''}`,
			)
		)
			return;
		commit((draft) => {
			if (kind === 'trails')
				draft.park.trails = draft.park.trails.filter((item) => item.id !== selection.trail);
			else if (kind === 'markers' && selection.marker != null)
				draft.park.points.splice(selection.marker, 1);
			else if (kind === 'pois') draft.pois = draft.pois.filter((item) => item.id !== selection.poi);
			else draft.hikes = draft.hikes.filter((item) => item.id !== selection.hike);
		}, `Deleted ${name}`);
		setSelection((value) => ({
			...value,
			[kind === 'trails'
				? 'trail'
				: kind === 'markers'
					? 'marker'
					: kind === 'pois'
						? 'poi'
						: 'hike']: null,
		}));
		setInteraction(null);
	};

	const submitTrail = (event: React.FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		const values = new FormData(event.currentTarget);
		commit((draft) => {
			const trail = draft.park.trails.find((item) => item.id === selection.trail);
			if (!trail) return;
			trail.name = String(values.get('name')).trim();
			trail.color = String(values.get('color')).toUpperCase();
			trail.folder = String(values.get('folder')).trim() || null;
		}, 'Updated trail');
	};

	const submitMarker = (event: React.FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		const values = new FormData(event.currentTarget);
		commit((draft) => {
			if (selection.marker == null) return;
			const marker = draft.park.points[selection.marker];
			marker.name = String(values.get('name')).trim();
			marker.lat = Number(values.get('lat'));
			marker.lon = Number(values.get('lon'));
		}, 'Updated marker');
	};

	const submitPoi = (event: React.FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		const values = new FormData(event.currentTarget);
		commit((draft) => {
			const poi = draft.pois.find((item) => item.id === selection.poi);
			if (!poi) return;
			poi.name = String(values.get('name')).trim();
			poi.emoji = String(values.get('emoji')).trim();
			poi.hint = String(values.get('hint')).trim();
			poi.lat = Number(values.get('lat'));
			poi.lon = Number(values.get('lon'));
			const color = String(values.get('color'));
			if (color) poi.color = color;
		}, 'Updated POI');
	};

	const submitHike = (event: React.FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		const values = new FormData(event.currentTarget);
		commit((draft) => {
			const hike = draft.hikes.find((item) => item.id === selection.hike);
			if (!hike) return;
			hike.name = String(values.get('name')).trim();
			hike.difficulty = String(values.get('difficulty')) as EditorHike['difficulty'];
			hike.description = String(values.get('description')).trim();
		}, 'Updated hike details');
	};

	const startImport = () => {
		importTarget.current = tab;
		fileInput.current?.click();
	};

	const importFile = async (file: File) => {
		if (!project) return;
		try {
			const parsed = parseGeoFile(await file.text(), file.name);
			const target = importTarget.current;
			if (target === 'trails') {
				commit((draft) => {
					const used = new Set(draft.park.trails.map((trail) => trail.id));
					for (const line of parsed.lines) {
						const base = slugify(line.name, 'imported-trail');
						let id = base;
						let suffix = 2;
						while (used.has(id)) id = `${base}-${suffix++}`;
						used.add(id);
						draft.park.trails.push({
							id,
							name: line.name,
							color: '#3388FF',
							folder: 'Imported',
							coords: line.coords,
						});
					}
					draft.park.points.push(...parsed.points);
				}, `Imported ${parsed.lines.length} trails and ${parsed.points.length} markers`);
			} else if (target === 'markers') {
				if (!parsed.points.length)
					throw new Error('That file contains no waypoints or KML Points.');
				commit(
					(draft) => draft.park.points.push(...parsed.points),
					`Imported ${parsed.points.length} markers`,
				);
			} else if (target === 'pois') {
				if (!parsed.points.length)
					throw new Error('That file contains no waypoints or KML Points.');
				commit((draft) => {
					const used = new Set(draft.pois.map((poi) => poi.id));
					for (const point of parsed.points) {
						const base = slugify(point.name, 'imported-poi');
						let id = base;
						let suffix = 2;
						while (used.has(id)) id = `${base}-${suffix++}`;
						used.add(id);
						draft.pois.push({
							id,
							name: point.name,
							emoji: '📍',
							lat: point.lat,
							lon: point.lon,
							hint: '',
						});
					}
				}, `Imported ${parsed.points.length} POIs`);
			} else {
				if (!parsed.lines.length) throw new Error('That file contains no track or route geometry.');
				let lastId = '';
				commit(
					(draft) => {
						const used = new Set(draft.hikes.map((hike) => hike.id));
						for (const line of parsed.lines) {
							const base = slugify(line.name, 'imported-hike');
							let id = base;
							let suffix = 2;
							while (used.has(id)) id = `${base}-${suffix++}`;
							used.add(id);
							lastId = id;
							draft.hikes.push({
								id,
								name: line.name,
								routeFile: `${id}.json`,
								difficulty: 'Moderate',
								description: '',
								route: { names: [line.name], coords: line.coords },
							});
						}
					},
					`Imported ${parsed.lines.length} hike route${parsed.lines.length === 1 ? '' : 's'}`,
				);
				setSelection((value) => ({ ...value, hike: lastId }));
			}
		} catch (error) {
			setStatus((error as Error).message);
			setStatusType('error');
		}
	};

	const interactionText =
		interaction?.type === 'draw-trail'
			? 'Click the map to add trail vertices, then Finish drawing.'
			: interaction?.type === 'split-trail'
				? 'Click a trail where it should be split.'
				: interaction?.type === 'join-trail'
					? 'Click the second segment; nearest endpoints will be joined.'
					: interaction?.type === 'add-marker'
						? 'Click the map to place the new landmark.'
						: interaction?.type === 'add-poi'
							? 'Click the map to place the new collectible POI.'
							: interaction?.type === 'pick-hike'
								? 'Click trail segments in walking order; click again to remove.'
								: '';

	const toolbar = (
		<div className="editor-toolbar">
			{tab === 'trails' ? (
				interaction?.type === 'draw-trail' ? (
					<>
						<button
							type="button"
							className="editor-button primary"
							onClick={() => {
								if ((selectedTrail?.coords.length ?? 0) < 2)
									return setStatus('Add at least two vertices.');
								setInteraction(null);
							}}
						>
							Finish drawing
						</button>
						<button
							type="button"
							className="editor-button"
							onClick={() => deleteSelected('trails')}
						>
							Cancel
						</button>
					</>
				) : (
					<>
						<button type="button" className="editor-button primary" onClick={newTrail}>
							New trail
						</button>
						<button type="button" className="editor-button" onClick={startImport}>
							Import GPX/KML
						</button>
					</>
				)
			) : tab === 'markers' ? (
				<>
					<button
						type="button"
						className="editor-button primary"
						onClick={() => setInteraction({ type: 'add-marker' })}
					>
						New marker
					</button>
					<button type="button" className="editor-button" onClick={startImport}>
						Import points
					</button>
				</>
			) : tab === 'pois' ? (
				<>
					<button
						type="button"
						className="editor-button primary"
						onClick={() => setInteraction({ type: 'add-poi' })}
					>
						New POI
					</button>
					<button type="button" className="editor-button" onClick={startImport}>
						Import points
					</button>
				</>
			) : (
				<>
					<button type="button" className="editor-button primary" onClick={newHike}>
						New hike
					</button>
					<button type="button" className="editor-button" onClick={startImport}>
						Import route
					</button>
				</>
			)}
			<button
				type="button"
				className="editor-button"
				disabled={!undoRef.current.length}
				onClick={undo}
			>
				Undo
			</button>
			<button
				type="button"
				className="editor-button"
				disabled={!redoRef.current.length}
				onClick={redo}
			>
				Redo
			</button>
		</div>
	);

	if (!project) {
		return <div className="editor-status error">{status}</div>;
	}

	const needle = search.toLowerCase();
	const filteredTrails = project.park.trails.filter((trail) =>
		`${trail.name} ${trail.folder || ''}`.toLowerCase().includes(needle),
	);
	const filteredMarkers = project.park.points
		.map((marker, index) => ({ marker, index }))
		.filter(({ marker }) => marker.name.toLowerCase().includes(needle));
	const filteredPois = project.pois.filter((poi) =>
		`${poi.name} ${poi.id}`.toLowerCase().includes(needle),
	);
	const filteredHikes = project.hikes.filter((hike) =>
		`${hike.name} ${hike.difficulty}`.toLowerCase().includes(needle),
	);

	return (
		<div className="editor-shell">
			<aside className="editor-sidebar">
				<header className="editor-head">
					<h1>Palisades Trail Editor</h1>
					<p>React source editor · loopback only · automatic backups</p>
				</header>
				<nav className="editor-tabs">
					{TABS.map(([id, label]) => (
						<button
							type="button"
							key={id}
							className={`editor-tab ${tab === id ? 'active' : ''}`}
							onClick={() => selectTab(id)}
						>
							{label}
						</button>
					))}
				</nav>
				{toolbar}
				<div className={`editor-status ${statusType || (dirty ? 'dirty' : '')}`}>
					{status || (dirty ? 'Unsaved changes' : 'Source files are up to date')}
				</div>
				<main className="editor-content">
					{tab === 'trails' ? (
						<>
							{selectedTrail ? (
								<form
									key={`${selectedTrail.id}-${revision}`}
									className="editor-card"
									onSubmit={submitTrail}
								>
									<h3>Edit trail segment</h3>
									<label className="editor-field">
										Name
										<input name="name" defaultValue={selectedTrail.name} required />
									</label>
									<div className="editor-row">
										<label className="editor-field">
											Color
											<input name="color" type="color" defaultValue={selectedTrail.color} />
										</label>
										<label className="editor-field">
											Folder
											<input name="folder" defaultValue={selectedTrail.folder || ''} />
										</label>
									</div>
									<span className="editor-item-meta">
										{selectedTrail.coords.length} vertices · {miles(selectedTrail.coords)} mi ·{' '}
										{selectedTrail.id}
									</span>
									<div className="editor-actions">
										<button type="submit" className="editor-button primary">
											Apply
										</button>
										<button
											type="button"
											className="editor-button"
											onClick={() => setInteraction({ type: 'split-trail' })}
										>
											Split
										</button>
										<button
											type="button"
											className="editor-button"
											onClick={() =>
												setInteraction({ type: 'join-trail', firstId: selectedTrail.id })
											}
										>
											Join
										</button>
										<button
											type="button"
											className="editor-button danger"
											onClick={() => deleteSelected('trails')}
										>
											Delete
										</button>
									</div>
									<p className="editor-help">
										Drag the pink handles to edit vertices. Split creates two independently
										named/colorable segments.
									</p>
								</form>
							) : (
								<p className="editor-help">
									Select a trail, draw a new one, or import GPX/KML geometry.
								</p>
							)}
							<div className="editor-section-title">
								<span>{filteredTrails.length} segments</span>
								<span>
									{project.park.trails
										.reduce((sum, trail) => sum + lineMetres(trail.coords), 0)
										.toFixed(0)}{' '}
									m
								</span>
							</div>
							<input
								className="editor-search"
								placeholder="Filter trails…"
								value={search}
								onChange={(event) => setSearch(event.target.value)}
							/>
							<div className="editor-list">
								{filteredTrails.map((trail) => (
									<button
										type="button"
										key={trail.id}
										className={`editor-item ${selection.trail === trail.id ? 'active' : ''}`}
										onClick={() => {
											setSelection((value) => ({ ...value, trail: trail.id }));
											setInteraction(null);
										}}
									>
										<span className="editor-swatch" style={{ background: trail.color }} />
										<span className="editor-item-main">
											<span className="editor-item-name">{trail.name}</span>
											<span className="editor-item-meta">
												{trail.folder || 'No folder'} · {miles(trail.coords)} mi
											</span>
										</span>
									</button>
								))}
							</div>
						</>
					) : tab === 'markers' ? (
						<>
							{selectedMarker ? (
								<form
									key={`${selection.marker}-${revision}`}
									className="editor-card"
									onSubmit={submitMarker}
								>
									<h3>Edit landmark marker</h3>
									<label className="editor-field">
										Name
										<input name="name" defaultValue={selectedMarker.name} required />
									</label>
									<div className="editor-row">
										<label className="editor-field">
											Latitude
											<input
												name="lat"
												type="number"
												step="any"
												defaultValue={selectedMarker.lat}
											/>
										</label>
										<label className="editor-field">
											Longitude
											<input
												name="lon"
												type="number"
												step="any"
												defaultValue={selectedMarker.lon}
											/>
										</label>
									</div>
									<div className="editor-actions">
										<button type="submit" className="editor-button primary">
											Apply
										</button>
										<button
											type="button"
											className="editor-button danger"
											onClick={() => deleteSelected('markers')}
										>
											Delete
										</button>
									</div>
									<p className="editor-help">
										Drag the selected purple marker directly on the map.
									</p>
								</form>
							) : (
								<p className="editor-help">
									Select a marker, place a new one, or import GPX/KML points.
								</p>
							)}
							<div className="editor-section-title">
								<span>{filteredMarkers.length} markers</span>
							</div>
							<input
								className="editor-search"
								placeholder="Filter markers…"
								value={search}
								onChange={(event) => setSearch(event.target.value)}
							/>
							<div className="editor-list">
								{filteredMarkers.map(({ marker, index }) => (
									<button
										type="button"
										key={`${marker.name}-${index}`}
										className={`editor-item ${selection.marker === index ? 'active' : ''}`}
										onClick={() => setSelection((value) => ({ ...value, marker: index }))}
									>
										<span className="editor-swatch" style={{ background: '#6c54a3' }} />
										<span className="editor-item-main">
											<span className="editor-item-name">{marker.name}</span>
											<span className="editor-item-meta">
												{marker.lat.toFixed(6)}, {marker.lon.toFixed(6)}
											</span>
										</span>
									</button>
								))}
							</div>
						</>
					) : tab === 'pois' ? (
						<>
							{selectedPoi ? (
								<form
									key={`${selectedPoi.id}-${revision}`}
									className="editor-card"
									onSubmit={submitPoi}
								>
									<h3>Edit collectible POI</h3>
									<label className="editor-field">
										Name
										<input name="name" defaultValue={selectedPoi.name} required />
									</label>
									<div className="editor-row">
										<label className="editor-field">
											Emoji
											<input name="emoji" defaultValue={selectedPoi.emoji} required />
										</label>
										<label className="editor-field">
											Glyph color
											<input
												name="color"
												type="color"
												defaultValue={selectedPoi.color || '#2f6bd6'}
											/>
										</label>
									</div>
									<label className="editor-field">
										Hint
										<textarea name="hint" defaultValue={selectedPoi.hint} />
									</label>
									<div className="editor-row">
										<label className="editor-field">
											Latitude
											<input name="lat" type="number" step="any" defaultValue={selectedPoi.lat} />
										</label>
										<label className="editor-field">
											Longitude
											<input name="lon" type="number" step="any" defaultValue={selectedPoi.lon} />
										</label>
									</div>
									<div className="editor-warning">
										Stable ID: {selectedPoi.id}. It cannot be renamed because installed-user
										progress is keyed to it.
									</div>
									<div className="editor-actions">
										<button type="submit" className="editor-button primary">
											Apply
										</button>
										<button
											type="button"
											className="editor-button danger"
											onClick={() => deleteSelected('pois')}
										>
											Delete
										</button>
									</div>
								</form>
							) : (
								<p className="editor-help">
									Collectible POIs are separate from ordinary landmark markers and keep permanent
									IDs.
								</p>
							)}
							<div className="editor-section-title">
								<span>{filteredPois.length} POIs</span>
							</div>
							<input
								className="editor-search"
								placeholder="Filter POIs…"
								value={search}
								onChange={(event) => setSearch(event.target.value)}
							/>
							<div className="editor-list">
								{filteredPois.map((poi) => (
									<button
										type="button"
										key={poi.id}
										className={`editor-item ${selection.poi === poi.id ? 'active' : ''}`}
										onClick={() => setSelection((value) => ({ ...value, poi: poi.id }))}
									>
										<span className="editor-swatch" style={{ background: '#2f6b3a' }} />
										<span className="editor-item-main">
											<span className="editor-item-name">
												{poi.emoji} {poi.name}
											</span>
											<span className="editor-item-meta">{poi.id}</span>
										</span>
									</button>
								))}
							</div>
						</>
					) : (
						<>
							{selectedHike ? (
								<form
									key={`${selectedHike.id}-${revision}`}
									className="editor-card"
									onSubmit={submitHike}
								>
									<h3>Edit hike</h3>
									<label className="editor-field">
										Name
										<input name="name" defaultValue={selectedHike.name} required />
									</label>
									<div className="editor-row">
										<label className="editor-field">
											Difficulty
											<select name="difficulty" defaultValue={selectedHike.difficulty}>
												<option>Easy</option>
												<option>Moderate</option>
												<option>Hard</option>
											</select>
										</label>
										<label className="editor-field">
											Stable ID
											<input value={selectedHike.id} disabled />
										</label>
									</div>
									<label className="editor-field">
										Directions / description
										<textarea name="description" defaultValue={selectedHike.description} />
									</label>
									<span className="editor-item-meta">
										{selectedHike.route.coords.length} vertices · {miles(selectedHike.route.coords)}{' '}
										mi · {selectedHike.routeFile}
									</span>
									<div className="editor-actions">
										<button type="submit" className="editor-button primary">
											Apply details
										</button>
										{interaction?.type === 'pick-hike' ? (
											<>
												<button
													type="button"
													className="editor-button primary"
													onClick={() => {
														if (selectedHike.route.coords.length < 2)
															return setStatus('Choose at least one trail segment.');
														setInteraction(null);
														setHikeDraftIds([]);
													}}
												>
													Finish route
												</button>
												<button
													type="button"
													className="editor-button"
													onClick={() => {
														const ids = hikeDraftIds.slice(0, -1);
														setHikeDraftIds(ids);
														commit((draft) => applyHikeDraft(draft, ids), 'Removed last segment');
													}}
												>
													Undo segment
												</button>
											</>
										) : (
											<button
												type="button"
												className="editor-button"
												onClick={() => {
													if (
														selectedHike.route.coords.length &&
														!window.confirm('Replace this hike route?')
													)
														return;
													setHikeDraftIds([]);
													commit((draft) => {
														const hike = draft.hikes.find((item) => item.id === selectedHike.id);
														if (hike) hike.route = { names: [], coords: [] };
													}, 'Click trail segments in order');
													setInteraction({ type: 'pick-hike' });
												}}
											>
												Rebuild from trails
											</button>
										)}
										<button
											type="button"
											className="editor-button danger"
											onClick={() => deleteSelected('hikes')}
										>
											Delete
										</button>
									</div>
									<ol className="editor-route-steps">
										{routeSteps(
											hikeDraftIds.length
												? hikeDraftIds.map(
														(id) =>
															project.park.trails.find((trail) => trail.id === id)?.name || id,
													)
												: selectedHike.route.names,
										).map((step) => (
											<li key={step.key}>{step.name}</li>
										))}
									</ol>
								</form>
							) : (
								<p className="editor-help">
									Create, update, delete, rebuild, or import hikes in the same map used for trail
									editing.
								</p>
							)}
							<div className="editor-section-title">
								<span>{filteredHikes.length} hikes</span>
							</div>
							<input
								className="editor-search"
								placeholder="Filter hikes…"
								value={search}
								onChange={(event) => setSearch(event.target.value)}
							/>
							<div className="editor-list">
								{filteredHikes.map((hike) => (
									<button
										type="button"
										key={hike.id}
										className={`editor-item ${selection.hike === hike.id ? 'active' : ''}`}
										onClick={() => {
											setSelection((value) => ({ ...value, hike: hike.id }));
											setInteraction(null);
											setHikeDraftIds([]);
										}}
									>
										<span className="editor-swatch" style={{ background: '#d6006e' }} />
										<span className="editor-item-main">
											<span className="editor-item-name">{hike.name}</span>
											<span className="editor-item-meta">
												{hike.difficulty} · {miles(hike.route.coords)} mi
											</span>
										</span>
									</button>
								))}
							</div>
						</>
					)}
				</main>
				<footer className="editor-savebar">
					<button type="button" className="editor-button" onClick={() => downloadJson(project)}>
						Export backup
					</button>
					<button type="button" className="editor-button primary" onClick={save}>
						Save source files
					</button>
				</footer>
			</aside>
			<section className="editor-map-wrap">
				<EditorMap
					project={project}
					tab={tab}
					selectedTrailId={selection.trail}
					selectedMarkerIndex={selection.marker}
					selectedPoiId={selection.poi}
					selectedHikeId={selection.hike}
					interaction={interaction}
					hikeDraftIds={hikeDraftIds}
					onMapClick={mapClick}
					onTrailClick={trailClick}
					onSelectMarker={(index) => {
						setTab('markers');
						setSelection((value) => ({ ...value, marker: index }));
					}}
					onSelectPoi={(id) => {
						setTab('pois');
						setSelection((value) => ({ ...value, poi: id }));
					}}
					onBeginGesture={beginGesture}
					onTrailVertex={moveTrailVertex}
					onMoveMarker={moveMarker}
					onMovePoi={movePoi}
					onEndGesture={endGesture}
				/>
				<div className={`editor-banner ${interactionText ? 'active' : ''}`}>{interactionText}</div>
			</section>
			<input
				ref={fileInput}
				type="file"
				accept=".gpx,.kml"
				hidden
				onChange={(event) => {
					const file = event.target.files?.[0];
					if (file) importFile(file);
					event.target.value = '';
				}}
			/>
		</div>
	);
}
