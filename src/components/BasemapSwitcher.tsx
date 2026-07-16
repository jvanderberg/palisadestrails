import { Check, Layers } from 'lucide-react';
import { useState } from 'react';

export interface BasemapOption {
	name: string;
	label: string;
	/** CSS background for the little preview swatch. */
	swatch: string;
}

interface Props {
	value: string;
	options: BasemapOption[];
	onChange: (name: string) => void;
}

/**
 * Compact basemap picker: just a layer-icon button (small mobile footprint)
 * that pops a glassy option card with a scale/opacity transition. Rendered as
 * an HTML overlay (sibling of the map), so map drags don't fire through it.
 */
export default function BasemapSwitcher({ value, options, onChange }: Props) {
	const [open, setOpen] = useState(false);

	return (
		<div className="pointer-events-none absolute top-3 right-3 z-[1000] select-none">
			{/* tap-away backdrop while open */}
			{open ? (
				<button
					type="button"
					aria-label="Close basemap menu"
					onClick={() => setOpen(false)}
					className="pointer-events-auto -z-10 fixed inset-0 cursor-default"
				/>
			) : null}
			<div className="flex flex-col items-end gap-1.5">
				<button
					type="button"
					aria-label="Choose basemap"
					aria-expanded={open}
					onClick={() => setOpen((o) => !o)}
					className={`pointer-events-auto grid h-10 w-10 place-items-center rounded-full bg-white/85 text-primary shadow-lg ring-1 backdrop-blur-md transition active:scale-95 ${
						open ? 'ring-primary/50' : 'ring-black/10'
					}`}
				>
					<Layers size={18} />
				</button>
				<div
					className={`origin-top-right rounded-2xl border border-black/10 bg-white/85 shadow-xl ring-1 ring-black/5 backdrop-blur-md transition-all duration-200 ease-out ${
						open
							? 'pointer-events-auto scale-100 opacity-100'
							: 'pointer-events-none scale-90 opacity-0'
					}`}
				>
					<div className="flex w-48 flex-col gap-0.5 p-1.5">
						{options.map((o) => {
							const active = o.name === value;
							return (
								<button
									key={o.name}
									type="button"
									onClick={() => {
										onChange(o.name);
										setOpen(false);
									}}
									className={`flex items-center gap-2.5 rounded-xl px-2 py-1.5 text-left text-sm transition-colors ${
										active ? 'bg-primary/10 text-primary' : 'text-slate-700 hover:bg-black/5'
									}`}
								>
									<span
										className="h-6 w-6 shrink-0 rounded-md ring-1 ring-black/10"
										style={{ background: o.swatch }}
									/>
									<span className="flex-1 truncate font-medium">{o.label}</span>
									{active ? <Check size={16} className="shrink-0 text-primary" /> : null}
								</button>
							);
						})}
					</div>
				</div>
			</div>
		</div>
	);
}
