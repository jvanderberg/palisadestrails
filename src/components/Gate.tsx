import { useState } from 'react';

const ANSWER = 'chad';

interface Props {
	onPass: () => void;
}

/**
 * One-time access gate. Shown until the visitor answers the park question
 * correctly; the pass is persisted (see the store's `unlocked`) so it is
 * never asked again on this device.
 */
export default function Gate({ onPass }: Props) {
	const [value, setValue] = useState('');
	const [wrong, setWrong] = useState(false);

	function submit(e: React.FormEvent) {
		e.preventDefault();
		if (value.trim().toLowerCase() === ANSWER) onPass();
		else setWrong(true);
	}

	return (
		<div className="fixed inset-0 z-[3000] flex flex-col items-center justify-center bg-primary px-6 text-primary-foreground">
			<div className="text-5xl">🍃</div>
			<h1 className="mt-3 text-center font-bold text-2xl">Palisades Trails</h1>
			<p className="mt-2 max-w-xs text-center text-sm opacity-90">
				This app is for visitors in the park. Answer to continue:
			</p>
			<form onSubmit={submit} className="mt-6 w-full max-w-xs">
				<label htmlFor="gate-answer" className="mb-1 block font-semibold text-sm">
					Who's the park manager?
				</label>
				<input
					id="gate-answer"
					type="text"
					value={value}
					autoComplete="off"
					autoCapitalize="none"
					// biome-ignore lint/a11y/noAutofocus: single-field gate is the only thing on screen
					autoFocus
					onChange={(e) => {
						setValue(e.target.value);
						setWrong(false);
					}}
					className="w-full rounded-xl border-2 border-white/30 bg-white/10 px-4 py-3 text-base text-white outline-none placeholder:text-white/50 focus:border-white"
					placeholder="Type your answer"
				/>
				{wrong ? <p className="mt-2 text-sm text-amber-200">That's not it — try again.</p> : null}
				<button
					type="submit"
					className="mt-4 w-full rounded-xl bg-white py-3 font-semibold text-primary"
				>
					Enter
				</button>
			</form>
		</div>
	);
}
