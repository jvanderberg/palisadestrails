import { Archive, Download, Upload, X } from 'lucide-react';
import { type ChangeEvent, useEffect, useRef, useState } from 'react';
import {
	createBackupFile,
	type PreparedBackup,
	readBackupFile,
	restoreBackup,
	summarizeBackup,
} from '../lib/backup';

interface Props {
	open: boolean;
	recording: boolean;
	onClose: () => void;
	onMessage: (message: string) => void;
}

function saveFile(file: File): void {
	const url = URL.createObjectURL(file);
	const link = document.createElement('a');
	link.href = url;
	link.download = file.name;
	link.click();
	window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

export default function DataBackupModal({ open, recording, onClose, onMessage }: Props) {
	const inputRef = useRef<HTMLInputElement>(null);
	const [busy, setBusy] = useState(false);
	const [preparingBackup, setPreparingBackup] = useState(false);
	const [message, setMessage] = useState<string | null>(null);
	const [backupFile, setBackupFile] = useState<File | null>(null);
	const [prepared, setPrepared] = useState<PreparedBackup | null>(null);

	useEffect(() => {
		if (!open) return;
		let active = true;
		setPreparingBackup(true);
		setBackupFile(null);
		setMessage(null);
		createBackupFile()
			.then((file) => {
				if (active) setBackupFile(file);
			})
			.catch((error) => {
				if (active)
					setMessage(error instanceof Error ? error.message : 'The backup could not be prepared.');
			})
			.finally(() => {
				if (active) setPreparingBackup(false);
			});
		return () => {
			active = false;
		};
	}, [open]);

	useEffect(() => {
		if (!open) {
			setBusy(false);
			setPreparingBackup(false);
			setMessage(null);
			setBackupFile(null);
			setPrepared(null);
			return;
		}
		const closeOnEscape = (event: KeyboardEvent) => {
			if (event.key === 'Escape' && !busy) onClose();
		};
		window.addEventListener('keydown', closeOnEscape);
		return () => window.removeEventListener('keydown', closeOnEscape);
	}, [open, busy, onClose]);

	if (!open) return null;
	const summary = prepared ? summarizeBackup(prepared) : null;

	const saveOrShare = async () => {
		if (!backupFile) return;
		setBusy(true);
		setMessage(null);
		try {
			const shareData = { files: [backupFile], title: 'Palisades Trails backup' };
			if (navigator.share && navigator.canShare?.(shareData)) await navigator.share(shareData);
			else saveFile(backupFile);
			onMessage('Backup saved.');
		} catch (error) {
			if (error instanceof DOMException && error.name === 'AbortError') return;
			if (error instanceof DOMException && error.name === 'NotAllowedError') {
				saveFile(backupFile);
				onMessage('Backup downloaded.');
				return;
			}
			setMessage(error instanceof Error ? error.message : 'The backup could not be saved.');
		} finally {
			setBusy(false);
		}
	};

	const chooseBackup = async (event: ChangeEvent<HTMLInputElement>) => {
		const file = event.currentTarget.files?.[0];
		event.currentTarget.value = '';
		if (!file) return;
		setBusy(true);
		setPrepared(null);
		setMessage(null);
		try {
			setPrepared(await readBackupFile(file));
		} catch (error) {
			setMessage(error instanceof Error ? error.message : 'The backup could not be opened.');
		} finally {
			setBusy(false);
		}
	};

	const restore = async () => {
		if (!prepared || recording) return;
		setBusy(true);
		setMessage(null);
		try {
			await restoreBackup(prepared);
			window.location.reload();
		} catch (error) {
			setMessage(error instanceof Error ? error.message : 'The backup could not be restored.');
			setBusy(false);
		}
	};

	return (
		<div className="fixed inset-0 z-[2000] flex items-end justify-center p-3 sm:items-center">
			<button
				type="button"
				aria-label="Close data and backup"
				onClick={busy ? undefined : onClose}
				className="absolute inset-0 bg-black/60"
			/>
			<div
				role="dialog"
				aria-modal="true"
				aria-labelledby="data-backup-title"
				className="relative max-h-[calc(100dvh-24px)] w-full max-w-md overflow-y-auto rounded-2xl bg-card p-5 shadow-2xl"
			>
				<button
					type="button"
					onClick={onClose}
					disabled={busy}
					aria-label="Close"
					className="absolute top-3 right-3 grid h-9 w-9 place-items-center rounded-full bg-secondary text-secondary-foreground disabled:opacity-50"
				>
					<X size={18} />
				</button>
				<Archive size={32} className="text-primary" />
				<h2 id="data-backup-title" className="mt-2 pr-10 text-xl font-bold">
					Data &amp; backup
				</h2>
				<p className="mt-2 text-sm text-muted-foreground">
					Move your progress between the website and installed app, or keep a private offline copy.
					Backups include trail mastery, hikes, markers, settings, and marker photos.
				</p>

				<section className="mt-5 rounded-xl border border-border p-4">
					<h3 className="font-semibold">Create a backup</h3>
					<p className="mt-1 text-sm text-muted-foreground">
						Save one file to Files, AirDrop, or another location you control.
					</p>
					<button
						type="button"
						onClick={saveOrShare}
						disabled={busy || preparingBackup || !backupFile}
						className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 font-semibold text-primary-foreground disabled:opacity-50"
					>
						<Download size={18} /> {preparingBackup ? 'Preparing…' : 'Save backup'}
					</button>
					{backupFile ? (
						<p className="mt-2 truncate text-xs text-muted-foreground">{backupFile.name}</p>
					) : null}
				</section>

				<section className="mt-3 rounded-xl border border-border p-4">
					<h3 className="font-semibold">Restore a backup</h3>
					<p className="mt-1 text-sm text-muted-foreground">
						Existing data is kept. Collected points are combined, and only missing or newer records
						are added.
					</p>
					<input
						ref={inputRef}
						type="file"
						accept=".zip,application/zip"
						onChange={chooseBackup}
						className="hidden"
					/>
					<button
						type="button"
						onClick={() => inputRef.current?.click()}
						disabled={busy}
						className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 font-semibold text-primary-foreground disabled:opacity-50"
					>
						<Upload size={18} /> Choose backup
					</button>

					{summary ? (
						<div className="mt-3 rounded-xl bg-primary/10 p-3 text-sm">
							<p className="font-semibold text-primary">Backup ready to restore</p>
							<p className="mt-1 text-muted-foreground">
								{summary.collected} collected · {summary.hikes} hikes · {summary.markers} markers ·{' '}
								{summary.photos} photos
							</p>
							<p className="mt-1 text-xs text-muted-foreground">
								Created {new Date(summary.exportedAt).toLocaleString()}
							</p>
							{recording ? (
								<p className="mt-2 font-medium text-amber-800">
									Pause your current hike before restoring.
								</p>
							) : null}
							<button
								type="button"
								onClick={restore}
								disabled={busy || recording}
								className="mt-3 w-full rounded-xl bg-primary py-3 font-semibold text-primary-foreground disabled:opacity-50"
							>
								Restore and merge
							</button>
						</div>
					) : null}
				</section>

				{message ? (
					<p role="status" className="mt-3 rounded-xl bg-secondary px-3 py-2 text-sm">
						{message}
					</p>
				) : null}
				<p className="mt-4 text-xs leading-relaxed text-muted-foreground">
					Backup files can contain precise locations and personal photos. They never leave your
					device unless you choose where to save or share them.
				</p>
			</div>
		</div>
	);
}
