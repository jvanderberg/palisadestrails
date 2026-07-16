import { MapPin, Mountain } from 'lucide-react';
import { COLLECTIBLES } from '../data/collectibles';
import type { Difficulty, Hike } from '../data/hikes';
import { useGame } from '../game/store';

interface Props {
	hike: Hike;
	onShowOnMap: (hike: Hike) => void;
	onOpenPoi: (id: string) => void;
}

const DIFFICULTY_TINT: Record<Difficulty, string> = {
	Easy: 'bg-emerald-100 text-emerald-800',
	Moderate: 'bg-amber-100 text-amber-800',
	Hard: 'bg-rose-100 text-rose-800',
};

export default function HikeDetail({ hike, onShowOnMap, onOpenPoi }: Props) {
	const collected = useGame((s) => s.collected);
	const stops = (hike.poiIds ?? [])
		.map((id) => COLLECTIBLES.find((p) => p.id === id))
		.filter((p): p is (typeof COLLECTIBLES)[number] => Boolean(p));
	const done = stops.filter((p) => collected[p.id]).length;

	return (
		<div className="h-full overflow-y-auto bg-background px-4 pt-4 pb-24">
			<h2 className="text-xl font-bold">{hike.name}</h2>
			<div className="mt-2 flex flex-wrap items-center gap-2 text-xs font-semibold">
				{hike.difficulty ? (
					<span className={`rounded-full px-2.5 py-1 ${DIFFICULTY_TINT[hike.difficulty]}`}>
						<Mountain size={12} className="mr-1 inline" />
						{hike.difficulty}
					</span>
				) : null}
				<span className="rounded-full bg-secondary px-2.5 py-1 text-secondary-foreground">
					{hike.distanceMi.toFixed(1)} mi
				</span>
				{stops.length > 0 ? (
					<span className="rounded-full bg-secondary px-2.5 py-1 text-secondary-foreground">
						{done}/{stops.length} POIs collected
					</span>
				) : null}
			</div>

			{hike.description ? (
				<p className="mt-3 text-[15px] leading-relaxed text-foreground/90">{hike.description}</p>
			) : null}

			<button
				type="button"
				onClick={() => onShowOnMap(hike)}
				className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 font-semibold text-primary-foreground"
			>
				<MapPin size={18} /> Show route on map
			</button>

			{stops.length > 0 ? (
				<>
					<div className="mt-6 mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
						Points of interest on this hike
					</div>
					<div className="flex flex-col gap-2">
						{stops.map((p) => {
							const got = Boolean(collected[p.id]);
							return (
								<button
									key={p.id}
									type="button"
									onClick={() => onOpenPoi(p.id)}
									className={`flex items-center gap-3 rounded-xl border p-3 text-left shadow-sm ${
										got ? 'border-amber-300 bg-amber-50' : 'border-border bg-card'
									}`}
								>
									<div
										className={`grid h-10 w-10 shrink-0 place-items-center rounded-full text-lg ${
											got ? 'bg-amber-400 text-white' : 'bg-secondary'
										}`}
									>
										{got ? '★' : p.emoji}
									</div>
									<div className="min-w-0 flex-1">
										<div className="truncate font-semibold">{p.name}</div>
										<div className="truncate text-xs text-muted-foreground">
											{got ? 'Collected' : p.hint}
										</div>
									</div>
									{got ? <span className="text-amber-500">✓</span> : null}
								</button>
							);
						})}
					</div>
				</>
			) : null}
		</div>
	);
}
