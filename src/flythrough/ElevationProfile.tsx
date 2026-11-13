import { useMemo } from 'react';
import { smooth } from './path';
import { M_TO_FT, type Route } from './route';

interface Props {
	route: Route;
	lakeLevel: number;
	/** Current distance along the route, metres. */
	position: number;
	onSeek: (metres: number) => void;
}

const W = 1000;
const H = 100;
const PAD_TOP = 8;

/** Elevation profile that doubles as the scrubber. */
export default function ElevationProfile({ route, lakeLevel, position, onSeek }: Props) {
	const { area, line, minFt, maxFt } = useMemo(() => {
		const hs = smooth(route.heights, 2);
		const minM = Math.min(...hs);
		const maxM = Math.max(...hs);
		const span = Math.max(maxM - minM, 10);
		const n = hs.length;
		const stride = Math.max(1, Math.floor(n / 500));
		const pts: string[] = [];
		for (let i = 0; i < n; i += stride) {
			const x = (i / (n - 1)) * W;
			const y = PAD_TOP + (1 - (hs[i] - minM) / span) * (H - PAD_TOP);
			pts.push(`${x.toFixed(1)},${y.toFixed(1)}`);
		}
		const yLast = PAD_TOP + (1 - (hs[n - 1] - minM) / span) * (H - PAD_TOP);
		pts.push(`${W},${yLast.toFixed(1)}`);
		return {
			line: `M${pts.join('L')}`,
			area: `M0,${H}L${pts.join('L')}L${W},${H}Z`,
			minFt: Math.round((minM + lakeLevel) * M_TO_FT),
			maxFt: Math.round((maxM + lakeLevel) * M_TO_FT),
		};
	}, [route, lakeLevel]);

	const frac = route.path.length > 0 ? position / route.path.length : 0;

	return (
		<div className="fly-profile">
			<div className="fly-profile-axis">
				<span>{maxFt} ft</span>
				<span>{minFt} ft</span>
			</div>
			<div className="fly-profile-track">
				<svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden="true">
					<defs>
						<clipPath id="fly-done">
							<rect x={0} y={0} width={frac * W} height={H} />
						</clipPath>
					</defs>
					<path d={area} className="fly-profile-area" />
					<path d={area} className="fly-profile-area-done" clipPath="url(#fly-done)" />
					<path d={line} className="fly-profile-line" vectorEffect="non-scaling-stroke" />
					<line
						x1={frac * W}
						x2={frac * W}
						y1={0}
						y2={H}
						className="fly-profile-cursor"
						vectorEffect="non-scaling-stroke"
					/>
				</svg>
				<input
					type="range"
					min={0}
					max={Math.round(route.path.length)}
					step={1}
					value={Math.round(position)}
					aria-label="Position along the hike"
					onChange={(e) => onSeek(Number(e.target.value))}
					onKeyDown={(e) => e.stopPropagation()}
				/>
			</div>
		</div>
	);
}
