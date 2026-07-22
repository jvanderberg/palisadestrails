import {
	Mail,
	Map as MapIcon,
	Pause,
	Pencil,
	Play,
	Plus,
	Route,
	Save,
	Square,
	Trash2,
	X,
} from 'lucide-react';
import { type FormEvent, useEffect, useState } from 'react';
import type { Position } from '../game/useGeolocation';
import { fmtDist } from '../lib/geo';
import { personalHikeEmailUrl } from '../lib/personalHikeEmail';
import {
	formatPersonalDuration,
	type PersonalHike,
	personalHikeDistanceMetres,
	personalHikeElapsedMs,
	usePersonal,
} from '../personal/store';

interface Props {
	position: Position | null;
	onLocate: () => void;
	onShowMap: (hike: PersonalHike) => void;
	openEditorId: string | null;
	onEditorOpened: () => void;
}

export default function PersonalHikesPanel({
	position,
	onLocate,
	onShowMap,
	openEditorId,
	onEditorOpened,
}: Props) {
	const hikes = usePersonal((state) => state.hikes);
	const activeHikeId = usePersonal((state) => state.activeHikeId);
	const [editor, setEditor] = useState<'new' | string | null>(null);
	const editingHike = editor === 'new' ? null : hikes.find((hike) => hike.id === editor);
	const active = hikes.find((hike) => hike.id === activeHikeId);

	useEffect(() => {
		if (!openEditorId) return;
		setEditor(openEditorId);
		onEditorOpened();
	}, [openEditorId, onEditorOpened]);

	return (
		<div className="h-full overflow-y-auto bg-background px-3 pt-3 pb-24">
			<button
				type="button"
				onClick={() => setEditor(active?.id ?? 'new')}
				className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 font-bold text-primary-foreground shadow-sm"
			>
				{active ? (
					<>
						<span
							className={`h-2.5 w-2.5 rounded-full ${active.status === 'recording' ? 'animate-pulse bg-red-400' : 'bg-amber-300'}`}
						/>
						Manage {active.status === 'recording' ? 'recording' : 'paused hike'}
					</>
				) : (
					<>
						<Plus size={19} /> Record a hike
					</>
				)}
			</button>

			<div className="mt-3 overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
				{hikes.length ? (
					hikes.map((hike, index) => (
						<div
							key={hike.id}
							className={`flex min-h-14 items-center gap-2 px-3 ${index ? 'border-t border-border' : ''}`}
						>
							<Route size={18} className="shrink-0 text-primary" />
							<div className="flex min-w-0 flex-1 items-center gap-2">
								<span className="truncate font-semibold">{hike.name}</span>
								{hike.status !== 'finished' ? (
									<span
										className={`shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase ${
											hike.status === 'recording'
												? 'bg-red-100 text-red-700'
												: 'bg-amber-100 text-amber-700'
										}`}
									>
										{hike.status}
									</span>
								) : null}
							</div>
							<button
								type="button"
								onClick={() => onShowMap(hike)}
								className="flex items-center gap-1 rounded-lg border border-border px-2.5 py-2 text-sm font-semibold"
							>
								<MapIcon size={15} /> Map
							</button>
							<button
								type="button"
								onClick={() => setEditor(hike.id)}
								className="flex items-center gap-1 rounded-lg border border-border px-2.5 py-2 text-sm font-semibold"
							>
								<Pencil size={15} /> Edit
							</button>
						</div>
					))
				) : (
					<p className="p-5 text-center text-sm text-muted-foreground">No recorded hikes yet.</p>
				)}
			</div>

			{editor && (editor === 'new' || editingHike) ? (
				<HikeEditorModal
					key={editor}
					hike={editingHike ?? null}
					position={position}
					onLocate={onLocate}
					onShowMap={onShowMap}
					onClose={() => setEditor(null)}
				/>
			) : null}
		</div>
	);
}

function HikeEditorModal({
	hike,
	position,
	onLocate,
	onShowMap,
	onClose,
}: {
	hike: PersonalHike | null;
	position: Position | null;
	onLocate: () => void;
	onShowMap: (hike: PersonalHike) => void;
	onClose: () => void;
}) {
	const startHike = usePersonal((state) => state.startHike);
	const pauseHike = usePersonal((state) => state.pauseHike);
	const resumeHike = usePersonal((state) => state.resumeHike);
	const finishHike = usePersonal((state) => state.finishHike);
	const renameHike = usePersonal((state) => state.renameHike);
	const deleteHike = usePersonal((state) => state.deleteHike);
	const [name, setName] = useState(hike?.name ?? '');
	const [, setClock] = useState(0);

	useEffect(() => {
		const closeOnEscape = (event: KeyboardEvent) => {
			if (event.key === 'Escape') onClose();
		};
		window.addEventListener('keydown', closeOnEscape);
		return () => window.removeEventListener('keydown', closeOnEscape);
	}, [onClose]);

	useEffect(() => {
		if (hike?.status !== 'recording') return;
		const timer = window.setInterval(() => setClock(Date.now()), 1000);
		return () => window.clearInterval(timer);
	}, [hike?.status]);

	const saveName = (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		if (!hike) return;
		renameHike(hike.id, name);
		onClose();
	};

	const start = () => {
		if (!position) {
			onLocate();
			return;
		}
		const hikeId = startHike(position);
		const startedHike = usePersonal.getState().hikes.find((candidate) => candidate.id === hikeId);
		onClose();
		if (startedHike) onShowMap(startedHike);
	};

	const pause = () => {
		if (hike) renameHike(hike.id, name);
		pauseHike();
	};

	const resume = () => {
		if (hike) renameHike(hike.id, name);
		resumeHike(position);
	};

	const finish = () => {
		if (hike) renameHike(hike.id, name);
		finishHike(position);
	};

	const remove = () => {
		if (!hike || !confirm(`Delete “${hike.name}”? This cannot be undone.`)) return;
		deleteHike(hike.id);
		onClose();
	};

	return (
		<div className="fixed inset-0 z-[2000] flex items-end justify-center p-3 sm:items-center">
			<button
				type="button"
				aria-label="Close hike editor"
				onClick={onClose}
				className="absolute inset-0 bg-black/60"
			/>
			<div
				role="dialog"
				aria-modal="true"
				aria-labelledby="hike-editor-title"
				className="relative max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-2xl bg-card p-5 shadow-2xl"
			>
				<button
					type="button"
					onClick={onClose}
					aria-label="Close"
					className="absolute top-3 right-3 grid h-9 w-9 place-items-center rounded-full bg-secondary text-secondary-foreground"
				>
					<X size={18} />
				</button>

				{hike ? (
					<>
						<h2 id="hike-editor-title" className="pr-10 text-xl font-bold">
							{hike.status === 'finished' ? 'Edit hike' : 'Manage hike'}
						</h2>
						<p className="mt-1 text-sm text-muted-foreground">
							{hike.status === 'recording'
								? 'Your route is currently being recorded.'
								: hike.status === 'paused'
									? 'Recording is paused.'
									: new Date(hike.startedAt).toLocaleString()}
						</p>

						<form onSubmit={saveName} className="mt-4">
							<label className="block text-xs font-semibold text-muted-foreground">
								Hike name
								<input
									value={name}
									onChange={(event) => setName(event.target.value)}
									required
									maxLength={80}
									className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-base text-foreground"
								/>
							</label>

							<div className="mt-3 grid grid-cols-3 gap-2 text-center">
								<Stat label="Time" value={formatPersonalDuration(personalHikeElapsedMs(hike))} />
								<Stat label="Distance" value={fmtDist(personalHikeDistanceMetres(hike))} />
								<Stat
									label="GPS points"
									value={String(hike.segments.reduce((sum, segment) => sum + segment.length, 0))}
								/>
							</div>

							{hike.status === 'finished' ? (
								<button
									type="submit"
									className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 font-bold text-primary-foreground"
								>
									<Save size={18} /> Save changes
								</button>
							) : (
								<div className="mt-4 grid grid-cols-2 gap-2">
									{hike.status === 'recording' ? (
										<button
											type="button"
											onClick={pause}
											className="flex items-center justify-center gap-2 rounded-xl bg-amber-100 py-3 font-semibold text-amber-900"
										>
											<Pause size={18} /> Pause
										</button>
									) : (
										<button
											type="button"
											onClick={resume}
											className="flex items-center justify-center gap-2 rounded-xl bg-primary py-3 font-semibold text-primary-foreground"
										>
											<Play size={18} /> Resume
										</button>
									)}
									<button
										type="button"
										onClick={finish}
										className="flex items-center justify-center gap-2 rounded-xl bg-red-700 py-3 font-semibold text-white"
									>
										<Square size={17} /> Finish
									</button>
								</div>
							)}
						</form>

						{hike.status === 'finished' ? (
							<a
								href={personalHikeEmailUrl(hike, name)}
								className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl border border-border py-2.5 text-sm font-semibold"
							>
								<Mail size={17} /> Email hike
							</a>
						) : null}

						<button
							type="button"
							onClick={remove}
							className="mt-2 flex w-full items-center justify-center gap-2 py-2 text-sm font-semibold text-red-700"
						>
							<Trash2 size={17} /> Delete hike
						</button>
					</>
				) : (
					<>
						<Route className="text-primary" size={34} />
						<h2 id="hike-editor-title" className="mt-2 pr-10 text-xl font-bold">
							Record your hike
						</h2>
						<p className="mt-1 text-sm text-muted-foreground">
							Your route stays private on this device. Pause any time and finish when you are done.
						</p>
						<p className="mt-3 text-xs text-muted-foreground">
							{position
								? `Current GPS: ${position.lat.toFixed(6)}, ${position.lon.toFixed(6)}`
								: 'Waiting for a GPS position.'}
						</p>
						<button
							type="button"
							onClick={start}
							className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 font-bold text-primary-foreground"
						>
							<Play size={19} /> {position ? 'Start recording' : 'Get GPS lock to start'}
						</button>
					</>
				)}
			</div>
		</div>
	);
}

function Stat({ label, value }: { label: string; value: string }) {
	return (
		<div className="rounded-xl bg-secondary/60 p-2">
			<div className="font-bold tabular-nums">{value}</div>
			<div className="text-[10px] text-muted-foreground">{label}</div>
		</div>
	);
}
