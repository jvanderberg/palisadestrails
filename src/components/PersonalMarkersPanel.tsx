import {
	Camera,
	Map as MapIcon,
	MapPin,
	Pencil,
	Plus,
	Save,
	Trash2,
	Upload,
	X,
} from 'lucide-react';
import { type ChangeEvent, type FormEvent, type ReactNode, useEffect, useState } from 'react';
import type { Position } from '../game/useGeolocation';
import MarkerPhoto from '../personal/MarkerPhoto';
import { deleteMarkerPhoto, saveMarkerPhoto } from '../personal/photos';
import { type PersonalMarker, usePersonal } from '../personal/store';

interface Props {
	position: Position | null;
	onLocate: () => void;
	onShowMap: (marker: PersonalMarker) => void;
	onMessage: (message: string) => void;
	openEditorId: string | null;
	onEditorOpened: () => void;
}

export default function PersonalMarkersPanel({
	position,
	onLocate,
	onShowMap,
	onMessage,
	openEditorId,
	onEditorOpened,
}: Props) {
	const markers = usePersonal((state) => state.markers);
	const [editor, setEditor] = useState<'new' | string | null>(null);
	const editingMarker = editor === 'new' ? null : markers.find((marker) => marker.id === editor);

	useEffect(() => {
		if (!openEditorId) return;
		setEditor(openEditorId);
		onEditorOpened();
	}, [openEditorId, onEditorOpened]);

	return (
		<div className="h-full overflow-y-auto bg-background px-3 pt-3 pb-24">
			<button
				type="button"
				onClick={() => setEditor('new')}
				className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 font-bold text-primary-foreground shadow-sm"
			>
				<Plus size={19} /> Add marker
			</button>

			<div className="mt-3 overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
				{markers.length ? (
					markers.map((marker, index) => (
						<div
							key={marker.id}
							className={`flex min-h-14 items-center gap-2 px-3 ${index ? 'border-t border-border' : ''}`}
						>
							<MapPin size={18} className="shrink-0 text-violet-700" />
							<span className="min-w-0 flex-1 truncate font-semibold">{marker.name}</span>
							<button
								type="button"
								onClick={() => onShowMap(marker)}
								className="flex items-center gap-1 rounded-lg border border-border px-2.5 py-2 text-sm font-semibold"
							>
								<MapIcon size={15} /> Map
							</button>
							<button
								type="button"
								onClick={() => setEditor(marker.id)}
								className="flex items-center gap-1 rounded-lg border border-border px-2.5 py-2 text-sm font-semibold"
							>
								<Pencil size={15} /> Edit
							</button>
						</div>
					))
				) : (
					<p className="p-5 text-center text-sm text-muted-foreground">No personal markers yet.</p>
				)}
			</div>

			{editor && (editor === 'new' || editingMarker) ? (
				<MarkerEditorModal
					key={editor}
					marker={editingMarker ?? null}
					position={position}
					onLocate={onLocate}
					onClose={() => setEditor(null)}
					onMessage={onMessage}
				/>
			) : null}
		</div>
	);
}

function MarkerEditorModal({
	marker,
	position,
	onLocate,
	onClose,
	onMessage,
}: {
	marker: PersonalMarker | null;
	position: Position | null;
	onLocate: () => void;
	onClose: () => void;
	onMessage: (message: string) => void;
}) {
	const addMarker = usePersonal((state) => state.addMarker);
	const updateMarker = usePersonal((state) => state.updateMarker);
	const deleteMarker = usePersonal((state) => state.deleteMarker);
	const [name, setName] = useState(marker?.name ?? '');
	const [photo, setPhoto] = useState<File | null>(null);

	useEffect(() => {
		const closeOnEscape = (event: KeyboardEvent) => {
			if (event.key === 'Escape') onClose();
		};
		window.addEventListener('keydown', closeOnEscape);
		return () => window.removeEventListener('keydown', closeOnEscape);
	}, [onClose]);

	const choosePhoto = (event: ChangeEvent<HTMLInputElement>) => {
		setPhoto(event.currentTarget.files?.[0] ?? null);
		event.currentTarget.value = '';
	};

	const save = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		if (!marker && !position) {
			onLocate();
			return;
		}

		if (marker) {
			try {
				if (photo) await saveMarkerPhoto(marker.id, photo);
				updateMarker(marker.id, { name, ...(photo ? { hasPhoto: true } : {}) });
				onMessage('Marker updated.');
				onClose();
			} catch {
				onMessage('The marker photo could not be saved.');
			}
			return;
		}

		const markerId = addMarker(name, position as Position, Boolean(photo));
		try {
			if (photo) await saveMarkerPhoto(markerId, photo);
			onMessage('Marker added at your current location.');
		} catch {
			updateMarker(markerId, { hasPhoto: false });
			onMessage('Marker saved, but the photo could not be stored.');
		}
		onClose();
	};

	const removePhoto = async () => {
		if (!marker) return;
		await deleteMarkerPhoto(marker.id).catch(() => undefined);
		updateMarker(marker.id, { hasPhoto: false });
		onMessage('Photo removed.');
	};

	const removeMarker = async () => {
		if (!marker || !confirm(`Delete “${marker.name}”? This cannot be undone.`)) return;
		deleteMarker(marker.id);
		if (marker.hasPhoto) await deleteMarkerPhoto(marker.id).catch(() => undefined);
		onMessage('Marker deleted.');
		onClose();
	};

	return (
		<div className="fixed inset-0 z-[2000] flex items-end justify-center p-3 sm:items-center">
			<button
				type="button"
				aria-label="Close marker editor"
				onClick={onClose}
				className="absolute inset-0 bg-black/60"
			/>
			<div
				role="dialog"
				aria-modal="true"
				aria-labelledby="marker-editor-title"
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
				<h2 id="marker-editor-title" className="pr-10 text-xl font-bold">
					{marker ? 'Edit marker' : 'Add marker'}
				</h2>
				<p className="mt-1 text-sm text-muted-foreground">
					{marker
						? 'Update this marker’s name or photo.'
						: 'Save a named place at your current GPS position.'}
				</p>

				{marker ? (
					<MarkerPhoto
						markerId={marker.id}
						hasPhoto={marker.hasPhoto}
						version={marker.updatedAt}
						className="mt-4 max-h-56 w-full rounded-xl object-cover"
					/>
				) : null}

				<form onSubmit={save} className="mt-4">
					<label className="block text-xs font-semibold text-muted-foreground">
						Marker name
						<input
							value={name}
							onChange={(event) => setName(event.target.value)}
							placeholder="Creek crossing"
							required
							maxLength={80}
							className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-base text-foreground"
						/>
					</label>

					<p className="mt-3 text-xs text-muted-foreground">
						{marker
							? `${marker.lat.toFixed(6)}, ${marker.lon.toFixed(6)}`
							: position
								? `Current GPS: ${position.lat.toFixed(6)}, ${position.lon.toFixed(6)}`
								: 'Waiting for a GPS position.'}
					</p>

					<div className="mt-3 grid grid-cols-2 gap-2">
						<PhotoSource
							icon={<Camera size={18} />}
							label="Take photo"
							capture
							onChange={choosePhoto}
						/>
						<PhotoSource icon={<Upload size={18} />} label="Choose photo" onChange={choosePhoto} />
					</div>
					{photo ? (
						<p className="mt-2 truncate text-xs text-muted-foreground">Selected: {photo.name}</p>
					) : null}

					{!marker && !position ? (
						<button
							type="button"
							onClick={onLocate}
							className="mt-4 w-full rounded-xl bg-primary py-3 font-bold text-primary-foreground"
						>
							Get GPS lock
						</button>
					) : (
						<button
							type="submit"
							className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 font-bold text-primary-foreground"
						>
							<Save size={18} /> {marker ? 'Save changes' : 'Add marker here'}
						</button>
					)}
				</form>

				{marker?.hasPhoto ? (
					<button
						type="button"
						onClick={removePhoto}
						className="mt-2 w-full rounded-xl border border-border py-2.5 text-sm font-semibold text-red-700"
					>
						Remove photo
					</button>
				) : null}
				{marker ? (
					<button
						type="button"
						onClick={removeMarker}
						className="mt-2 flex w-full items-center justify-center gap-2 py-2 text-sm font-semibold text-red-700"
					>
						<Trash2 size={17} /> Delete marker
					</button>
				) : null}
			</div>
		</div>
	);
}

function PhotoSource({
	icon,
	label,
	capture = false,
	onChange,
}: {
	icon: ReactNode;
	label: string;
	capture?: boolean;
	onChange: (event: ChangeEvent<HTMLInputElement>) => void;
}) {
	return (
		<label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-border py-2.5 text-sm font-semibold">
			{icon} {label}
			<input
				type="file"
				accept="image/*"
				capture={capture ? 'environment' : undefined}
				onChange={onChange}
				className="sr-only"
			/>
		</label>
	);
}
