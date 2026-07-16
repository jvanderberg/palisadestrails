import { X } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { COLLECTIBLES, isTopTier, type Tier, TOP_TIER } from '../data/collectibles';
import { selectCount, useGame } from '../game/store';
import { drawCertificate } from '../lib/certificate';

interface Props {
	/** Which rank's certificate to show; null = closed. */
	tier: Tier | null;
	onClose: () => void;
}

export default function RewardModal({ tier, onClose }: Props) {
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const name = useGame((s) => s.name);
	const collected = useGame((s) => s.collected);
	const setName = useGame((s) => s.setName);
	const count = useGame(selectCount);
	const isTop = tier ? isTopTier(tier) : false;

	// Repaint whenever the modal opens or the name/collection changes.
	useEffect(() => {
		if (!tier || !canvasRef.current) return;
		const collectedNames = COLLECTIBLES.filter((p) => collected[p.id]).map(
			(p) => `${p.emoji} ${p.name}`,
		);
		drawCertificate(canvasRef.current, { tier, name, count, collectedNames, date: new Date() });
	}, [tier, name, collected, count]);

	if (!tier) return null;

	async function save() {
		const canvas = canvasRef.current;
		if (!canvas || !tier) return;
		const slug = tier.title.toLowerCase().replace(/\s+/g, '-');
		canvas.toBlob(async (blob) => {
			if (!blob) return;
			const file = new File([blob], `${slug}.png`, { type: 'image/png' });
			if (navigator.canShare?.({ files: [file] })) {
				try {
					await navigator.share({
						files: [file],
						title: tier.title,
						text: `I earned the Palisades ${tier.title} rank!`,
					});
					return;
				} catch {
					// fall through to download
				}
			}
			const a = document.createElement('a');
			a.href = URL.createObjectURL(blob);
			a.download = `${slug}.png`;
			document.body.appendChild(a);
			a.click();
			a.remove();
			setTimeout(() => URL.revokeObjectURL(a.href), 4000);
		}, 'image/png');
	}

	return (
		<div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/70 p-4">
			<div className="relative flex max-h-[92vh] w-full max-w-md flex-col overflow-hidden rounded-2xl bg-card shadow-2xl">
				<button
					type="button"
					onClick={onClose}
					aria-label="Close"
					className="absolute top-2 right-2 z-10 grid h-9 w-9 place-items-center rounded-full bg-black/40 text-white"
				>
					<X size={18} />
				</button>
				<div className="overflow-y-auto p-3">
					<canvas
						ref={canvasRef}
						width={1080}
						height={1350}
						className="w-full rounded-lg shadow"
						aria-label={`${tier.title} certificate`}
					/>
					<label className="mt-3 flex flex-col gap-1 text-sm font-medium">
						Your name
						<input
							type="text"
							value={name}
							maxLength={28}
							placeholder="Trail Explorer"
							autoComplete="name"
							onChange={(e) => setName(e.target.value)}
							className="rounded-lg border border-border bg-background px-3 py-2 text-base outline-none focus:border-primary"
						/>
					</label>
					<button
						type="button"
						onClick={save}
						className="mt-3 w-full rounded-xl bg-primary py-3 font-semibold text-primary-foreground"
					>
						Save / Share image
					</button>
					<p className="mt-2 text-center text-xs text-muted-foreground">
						{isTop
							? `Screenshot or save this certificate and send it in to claim your ${TOP_TIER.title} t-shirt.`
							: 'Screenshot or save this certificate to share your rank.'}
					</p>
				</div>
			</div>
		</div>
	);
}
