import { X } from 'lucide-react';
import { useEffect } from 'react';

interface Props {
	open: boolean;
	onClose: () => void;
}

interface InstallGuide {
	device: string;
	intro: string;
	steps: string[];
}

function detectGuide(): { guide: InstallGuide; installed: boolean } {
	const ua = navigator.userAgent;
	const ios =
		/iPad|iPhone|iPod/.test(ua) ||
		(navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
	const android = /Android/i.test(ua);
	const installed =
		window.matchMedia('(display-mode: standalone)').matches ||
		Boolean((navigator as Navigator & { standalone?: boolean }).standalone);

	if (ios) {
		return {
			installed,
			guide: {
				device: 'iPhone or iPad',
				intro: 'Install from Safari for the full-screen app experience.',
				steps: [
					'Open this site in Safari.',
					'Tap the Share button (the square with an upward arrow).',
					'Scroll down and tap “Add to Home Screen.”',
					'Tap “Add” in the upper-right corner.',
				],
			},
		};
	}

	if (android) {
		return {
			installed,
			guide: {
				device: 'Android',
				intro: 'Install from Chrome to add Palisades Trails to your home screen.',
				steps: [
					'Open this site in Chrome.',
					'Tap the three-dot menu in the upper-right corner.',
					'Tap “Install app” or “Add to Home screen.”',
					'Confirm by tapping “Install.”',
				],
			},
		};
	}

	return {
		installed,
		guide: {
			device: 'Computer',
			intro: 'Install Palisades Trails from a supported desktop browser.',
			steps: [
				'Open this site in Chrome or Edge.',
				'Click the install icon at the right side of the address bar.',
				'If no icon appears, open the browser menu and choose “Install Palisades Trails.”',
				'Confirm by clicking “Install.”',
			],
		},
	};
}

export default function InstallHelpModal({ open, onClose }: Props) {
	useEffect(() => {
		if (!open) return;
		const closeOnEscape = (event: KeyboardEvent) => {
			if (event.key === 'Escape') onClose();
		};
		window.addEventListener('keydown', closeOnEscape);
		return () => window.removeEventListener('keydown', closeOnEscape);
	}, [open, onClose]);

	if (!open) return null;
	const { guide, installed } = detectGuide();

	return (
		<div className="fixed inset-0 z-[2000] flex items-end justify-center p-3 sm:items-center">
			<button
				type="button"
				aria-label="Close installation instructions"
				onClick={onClose}
				className="absolute inset-0 bg-black/60"
			/>
			<div
				role="dialog"
				aria-modal="true"
				aria-labelledby="install-help-title"
				className="relative w-full max-w-md rounded-2xl bg-card p-5 shadow-2xl"
			>
				<button
					type="button"
					onClick={onClose}
					aria-label="Close"
					className="absolute top-3 right-3 grid h-9 w-9 place-items-center rounded-full bg-secondary text-secondary-foreground"
				>
					<X size={18} />
				</button>
				<img
					src={`${import.meta.env.BASE_URL}icons/icon.svg`}
					alt=""
					className="h-12 w-12 rounded-xl"
				/>
				<h2 id="install-help-title" className="mt-3 pr-10 text-xl font-bold">
					Installing this app
				</h2>
				<div className="mt-2 inline-flex rounded-full bg-secondary px-2.5 py-1 text-xs font-semibold text-secondary-foreground">
					Instructions for {guide.device}
				</div>
				{installed ? (
					<p className="mt-3 rounded-xl bg-primary/10 px-3 py-2 text-sm font-medium text-primary">
						You’re currently using the installed app. Use these steps to install it on another
						device.
					</p>
				) : (
					<p className="mt-3 text-sm text-muted-foreground">{guide.intro}</p>
				)}
				<ol className="mt-4 space-y-3">
					{guide.steps.map((step, index) => (
						<li key={step} className="flex gap-3 text-sm leading-relaxed">
							<span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
								{index + 1}
							</span>
							<span>{step}</span>
						</li>
					))}
				</ol>
				<button
					type="button"
					onClick={onClose}
					className="mt-5 w-full rounded-xl bg-primary py-3 font-semibold text-primary-foreground"
				>
					Done
				</button>
			</div>
		</div>
	);
}
