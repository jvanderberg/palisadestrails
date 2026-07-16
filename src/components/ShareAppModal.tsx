import { X } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { useEffect } from 'react';

const APP_URL = 'https://jvanderberg.github.io/palisadestrails/';

interface Props {
	open: boolean;
	onClose: () => void;
}

export default function ShareAppModal({ open, onClose }: Props) {
	useEffect(() => {
		if (!open) return;
		const closeOnEscape = (event: KeyboardEvent) => {
			if (event.key === 'Escape') onClose();
		};
		window.addEventListener('keydown', closeOnEscape);
		return () => window.removeEventListener('keydown', closeOnEscape);
	}, [open, onClose]);

	if (!open) return null;

	return (
		<div className="fixed inset-0 z-[2000] flex items-end justify-center p-3 sm:items-center">
			<button
				type="button"
				aria-label="Close share code"
				onClick={onClose}
				className="absolute inset-0 bg-black/60"
			/>
			<div
				role="dialog"
				aria-modal="true"
				aria-labelledby="share-app-title"
				className="relative w-full max-w-sm rounded-2xl bg-card p-5 text-center shadow-2xl"
			>
				<button
					type="button"
					onClick={onClose}
					aria-label="Close"
					className="absolute top-3 right-3 grid h-9 w-9 place-items-center rounded-full bg-secondary text-secondary-foreground"
				>
					<X size={18} />
				</button>
				<h2 id="share-app-title" className="pr-8 font-bold text-xl">
					Share Palisades Trails
				</h2>
				<p className="mt-1 text-sm text-muted-foreground">
					Scan this code to open the app website.
				</p>
				<div className="mx-auto mt-4 w-fit rounded-2xl bg-white p-3 shadow-sm ring-1 ring-black/10">
					<QRCodeSVG
						value={APP_URL}
						size={240}
						level="M"
						marginSize={1}
						title="QR code for the Palisades Trails website"
					/>
				</div>
				<p className="mt-3 break-all text-xs text-muted-foreground">{APP_URL}</p>
				<button
					type="button"
					onClick={onClose}
					className="mt-4 w-full rounded-xl bg-primary py-3 font-semibold text-primary-foreground"
				>
					Done
				</button>
			</div>
		</div>
	);
}
