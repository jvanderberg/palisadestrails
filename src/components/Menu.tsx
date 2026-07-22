import {
	ChevronRight,
	Download,
	Mail,
	Map as MapIcon,
	MapPin,
	Medal,
	Route,
	Share2,
	X,
} from 'lucide-react';
import { isTopTier, TIERS, type Tier } from '../data/collectibles';
import { formatHikeTime, HIKES } from '../data/hikes';

interface Props {
	open: boolean;
	route: string;
	collectedCount: number;
	personalHikeCount: number;
	personalMarkerCount: number;
	recording: boolean;
	onClose: () => void;
	onNavigate: (route: string) => void;
	onOpenCert: (tier: Tier) => void;
	onOpenInstall: () => void;
	onOpenShare: () => void;
}

export default function Menu({
	open,
	route,
	collectedCount,
	personalHikeCount,
	personalMarkerCount,
	recording,
	onClose,
	onNavigate,
	onOpenCert,
	onOpenInstall,
	onOpenShare,
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
						<img
							src={`${import.meta.env.BASE_URL}icons/icon.svg`}
							alt=""
							className="h-7 w-7 rounded-md"
						/>
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
						onClick={() => onNavigate('my-hikes')}
						className={`flex w-full items-center justify-between px-4 py-3 text-left ${
							route === 'my-hikes' ? 'bg-accent font-semibold text-primary' : ''
						}`}
					>
						<span className="flex items-center gap-3">
							<Route size={20} /> My Hikes
						</span>
						<span
							className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
								recording ? 'bg-red-100 text-red-700' : 'bg-secondary text-secondary-foreground'
							}`}
						>
							{recording ? '● REC' : personalHikeCount}
						</span>
					</button>
					<button
						type="button"
						onClick={() => onNavigate('my-markers')}
						className={`flex w-full items-center justify-between px-4 py-3 text-left ${
							route === 'my-markers' ? 'bg-accent font-semibold text-primary' : ''
						}`}
					>
						<span className="flex items-center gap-3">
							<MapPin size={20} /> My Markers
						</span>
						<span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-semibold text-secondary-foreground">
							{personalMarkerCount}
						</span>
					</button>
					<button
						type="button"
						onClick={() => onNavigate('collect')}
						className={`flex w-full items-center justify-between px-4 py-3 text-left ${
							route === 'collect' ? 'bg-accent font-semibold text-primary' : ''
						}`}
					>
						<span className="flex items-center gap-3">
							<Medal size={20} /> Trail Mastery
						</span>
						<span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-semibold text-secondary-foreground">
							★ {collectedCount}
						</span>
					</button>
					<button
						type="button"
						onClick={onOpenInstall}
						className="flex w-full items-center justify-between gap-2 border-border/60 border-t px-4 py-3 text-left"
					>
						<span className="flex items-center gap-3">
							<Download size={20} /> Installing this app
						</span>
						<ChevronRight size={18} className="shrink-0 text-muted-foreground" />
					</button>
					<button
						type="button"
						onClick={onOpenShare}
						className="flex w-full items-center justify-between gap-2 border-border/60 border-t px-4 py-3 text-left"
					>
						<span className="flex items-center gap-3">
							<Share2 size={20} /> Share this app
						</span>
						<ChevronRight size={18} className="shrink-0 text-muted-foreground" />
					</button>
					<a
						href="mailto:jvanderberg@gmail.com?subject=Palisades%20Trails%20feedback"
						onClick={onClose}
						className="flex w-full items-center justify-between gap-2 border-border/60 border-t px-4 py-3 text-left"
					>
						<span className="flex items-center gap-3">
							<Mail size={20} /> Send feedback
						</span>
						<ChevronRight size={18} className="shrink-0 text-muted-foreground" />
					</a>

					<div className="mt-2 px-4 pt-3 pb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
						Certificates
					</div>
					{TIERS.map((t) => {
						const earned = collectedCount >= t.count;
						const icon = !earned ? '🔒' : isTopTier(t) ? '🏅' : '🎖️';
						return earned ? (
							<button
								key={t.id}
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
								key={t.id}
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
										{h.distanceMi.toFixed(1)} mi · {formatHikeTime(h.estimatedMinutes)}
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
