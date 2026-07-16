import { ChevronRight, Map as MapIcon, Medal, X } from 'lucide-react';
import { TIERS, type Tier, TOP_TIER } from '../data/collectibles';
import { HIKES } from '../data/hikes';

interface Props {
	open: boolean;
	route: string;
	collectedCount: number;
	onClose: () => void;
	onNavigate: (route: string) => void;
	onOpenCert: (tier: Tier) => void;
}

export default function Menu({
	open,
	route,
	collectedCount,
	onClose,
	onNavigate,
	onOpenCert,
}: Props) {
	return (
		<>
			<button
				type="button"
				aria-label="Close menu"
				tabIndex={open ? 0 : -1}
				onClick={onClose}
				className={`fixed inset-0 z-[1400] bg-black/40 transition-opacity ${
					open ? 'opacity-100' : 'pointer-events-none opacity-0'
				}`}
			/>
			<aside
				className={`fixed top-0 bottom-0 left-0 z-[1500] flex w-[82%] max-w-xs flex-col bg-card shadow-2xl transition-transform ${
					open ? 'translate-x-0' : '-translate-x-full'
				}`}
			>
				<div className="flex items-center justify-between bg-primary px-4 pt-[calc(env(safe-area-inset-top)+12px)] pb-3 text-primary-foreground">
					<div className="flex items-center gap-2">
						<span className="text-xl">🍃</span>
						<span className="font-bold">Palisades Trails</span>
					</div>
					<button type="button" onClick={onClose} aria-label="Close menu" className="p-1">
						<X size={20} />
					</button>
				</div>

				<nav className="flex-1 overflow-y-auto pb-[env(safe-area-inset-bottom)]">
					<button
						type="button"
						onClick={() => onNavigate('map')}
						className={`flex w-full items-center gap-3 px-4 py-3 text-left ${
							route === 'map' ? 'bg-accent font-semibold text-primary' : ''
						}`}
					>
						<MapIcon size={20} /> Map
					</button>
					<button
						type="button"
						onClick={() => onNavigate('collect')}
						className={`flex w-full items-center justify-between px-4 py-3 text-left ${
							route === 'collect' ? 'bg-accent font-semibold text-primary' : ''
						}`}
					>
						<span className="flex items-center gap-3">
							<Medal size={20} /> Trailmaster
						</span>
						<span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-semibold text-secondary-foreground">
							★ {collectedCount}
						</span>
					</button>

					<div className="mt-2 px-4 pt-3 pb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
						Certificates
					</div>
					{TIERS.map((t) => {
						const earned = collectedCount >= t.count;
						const icon = !earned ? '🔒' : t.count === TOP_TIER.count ? '🏅' : '🎖️';
						return earned ? (
							<button
								key={t.title}
								type="button"
								onClick={() => onOpenCert(t)}
								className="flex w-full items-center justify-between gap-2 border-border/60 border-t px-4 py-3 text-left"
							>
								<span className="flex items-center gap-3">
									<span className="text-lg">{icon}</span>
									{t.title}
								</span>
								<span className="text-xs font-semibold text-primary">View</span>
							</button>
						) : (
							<div
								key={t.title}
								className="flex w-full items-center justify-between gap-2 border-border/60 border-t px-4 py-3 text-muted-foreground"
							>
								<span className="flex items-center gap-3">
									<span className="text-lg">{icon}</span>
									{t.title}
								</span>
								<span className="text-xs">
									{collectedCount}/{t.count}
								</span>
							</div>
						);
					})}

					<div className="mt-2 px-4 pt-3 pb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
						Hikes
					</div>
					{HIKES.length === 0 ? (
						<div className="px-4 py-3 text-sm text-muted-foreground">
							No hikes defined yet — we'll add them together.
						</div>
					) : null}
					{HIKES.map((h) => {
						const active = route === `hike:${h.id}`;
						return (
							<button
								key={h.id}
								type="button"
								onClick={() => onNavigate(`hike:${h.id}`)}
								className={`flex w-full items-center justify-between gap-2 border-border/60 border-t px-4 py-3 text-left ${
									active ? 'bg-accent' : ''
								}`}
							>
								<span className="min-w-0">
									<span className={`block truncate ${active ? 'font-semibold text-primary' : ''}`}>
										{h.name}
									</span>
									<span className="text-xs text-muted-foreground">
										{h.difficulty ? `${h.difficulty} · ` : ''}
										{h.distanceMi.toFixed(1)} mi
									</span>
								</span>
								<ChevronRight size={18} className="shrink-0 text-muted-foreground" />
							</button>
						);
					})}
				</nav>
			</aside>
		</>
	);
}
