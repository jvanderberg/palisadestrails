import {
	currentTier,
	GAME_CONFIG,
	isTopTier,
	nextTier,
	TIERS,
	TOP_TIER,
} from '../data/collectibles';
import type { PoiInfo } from '../game/proximity';
import { selectCount, useGame } from '../game/store';
import { fmtDist } from '../lib/geo';

interface Props {
	pois: PoiInfo[];
	onCollect: (id: string) => void;
	onFocus: (id: string) => void;
	onClaim: () => void;
}

export default function CollectPanel({ pois, onCollect, onFocus, onClaim }: Props) {
	const count = useGame(selectCount);
	const reset = useGame((s) => s.reset);
	const total = pois.length;
	const rank = currentTier(count);
	const next = nextTier(count);
	const prevCount = rank?.count ?? 0;
	// progress from the last rank toward the next
	const pct = next ? Math.round(((count - prevCount) / (next.count - prevCount)) * 100) : 100;

	const eligible = pois.filter((p) => p.state !== 'collected');
	const nearNow = eligible.filter((p) => p.state === 'near');
	const closest = eligible
		.filter((p) => p.distance != null)
		.sort((a, b) => (a.distance ?? 0) - (b.distance ?? 0))[0];

	return (
		<div className="h-full overflow-y-auto bg-background px-3 pt-3 pb-24">
			<div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
				<div className="flex items-start justify-between gap-3">
					<div>
						<div className="text-base font-bold">
							{rank ? `Rank: ${rank.title}` : 'Earn your rank'}
						</div>
						<div className="mt-0.5 text-[13px] text-muted-foreground">
							{next
								? `${next.count - count} more to reach ${next.title}`
								: `Top rank earned — ${TOP_TIER.title}! 🎉`}
						</div>
					</div>
					{rank ? (
						<button
							type="button"
							onClick={onClaim}
							className="shrink-0 rounded-xl bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground"
						>
							{isTopTier(rank) ? 'Claim 🎽' : 'Cert 🎖️'}
						</button>
					) : null}
				</div>
				<div className="mt-3 h-2.5 overflow-hidden rounded-full bg-secondary">
					<div
						className="h-full rounded-full bg-primary transition-all"
						style={{ width: `${pct}%` }}
					/>
				</div>
				<div className="mt-1.5 flex justify-between text-xs text-muted-foreground">
					<span>{count} collected</span>
					<span>{next ? `next: ${next.title} at ${next.count}` : `${count} / ${total}`}</span>
				</div>
				{/* Three ranks */}
				<div className="mt-3 flex gap-2">
					{TIERS.map((t) => {
						const earned = count >= t.count;
						return (
							<div
								key={t.id}
								className={`flex-1 rounded-lg border p-2 text-center ${
									earned ? 'border-amber-300 bg-amber-50' : 'border-border bg-secondary/40'
								}`}
							>
								<div className="text-lg">{earned ? (isTopTier(t) ? '🏅' : '🎖️') : '🔒'}</div>
								<div className="mt-0.5 truncate font-semibold text-[11px]">{t.title}</div>
								<div className="text-[10px] text-muted-foreground">{t.count} POIs</div>
							</div>
						);
					})}
				</div>
			</div>

			{nearNow.length > 0 ? (
				<div className="mt-3 flex flex-col gap-2">
					{nearNow.map(({ poi }) => (
						<button
							key={poi.id}
							type="button"
							onClick={() => onCollect(poi.id)}
							className="rounded-xl bg-emerald-600 px-4 py-3 text-left font-semibold text-white shadow-sm"
						>
							{poi.emoji} Collect {poi.name} — you're here!
						</button>
					))}
				</div>
			) : closest ? (
				<div className="mt-3 rounded-xl border border-border bg-card px-4 py-2.5 text-[13px] text-muted-foreground">
					Closest: <b className="text-foreground">{closest.poi.name}</b> —{' '}
					{fmtDist(closest.distance)} away. Get within {fmtDist(GAME_CONFIG.collectRadiusM)} to
					collect.
				</div>
			) : null}

			<div className="mt-3 flex flex-col gap-2">
				{pois.map(({ poi, distance, state }) => (
					<button
						key={poi.id}
						type="button"
						onClick={() => (state === 'near' ? onCollect(poi.id) : onFocus(poi.id))}
						className={`flex items-center gap-3 rounded-xl border p-3 text-left shadow-sm ${
							state === 'collected'
								? 'border-amber-300 bg-amber-50'
								: state === 'near'
									? 'border-emerald-400 bg-emerald-50'
									: 'border-border bg-card'
						}`}
					>
						<div
							className={`grid h-11 w-11 shrink-0 place-items-center rounded-full text-xl ${
								state === 'collected' ? 'bg-amber-400 text-white' : 'bg-secondary'
							}`}
						>
							<span style={poi.color && state !== 'collected' ? { color: poi.color } : undefined}>
								{state === 'collected' ? '★' : poi.emoji}
							</span>
						</div>
						<div className="min-w-0 flex-1">
							<div className="truncate font-semibold">{poi.name}</div>
							<div className="truncate text-xs text-muted-foreground">
								{state === 'collected' ? 'Collected' : poi.hint}
							</div>
						</div>
						{state === 'collected' ? (
							<span className="text-lg text-amber-500">✓</span>
						) : state === 'near' ? (
							<span className="shrink-0 rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white">
								Collect
							</span>
						) : (
							<span className="shrink-0 text-xs text-muted-foreground">{fmtDist(distance)}</span>
						)}
					</button>
				))}
			</div>

			<button
				type="button"
				onClick={() => {
					if (confirm("Reset your collection and trail mastery progress? This can't be undone."))
						reset();
				}}
				className="mt-4 w-full rounded-xl border border-border py-2.5 text-sm text-muted-foreground"
			>
				Reset my progress
			</button>
		</div>
	);
}
