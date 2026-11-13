import { useEffect, useRef, useState } from 'react';

const STORAGE_KEY = 'palisades-flythrough-unlocked';

/** Any answer that mentions the park manager, in any capitalization. */
export function isAccepted(answer: string): boolean {
	return answer.toLowerCase().includes('chad');
}

export function isUnlocked(): boolean {
	try {
		return localStorage.getItem(STORAGE_KEY) === '1';
	} catch {
		return false;
	}
}

function rememberUnlock(): void {
	try {
		localStorage.setItem(STORAGE_KEY, '1');
	} catch {
		// Private mode / blocked storage: they'll just be asked again next time.
	}
}

interface Props {
	onPass: () => void;
}

/**
 * One-time access gate, shown before anything 3D loads. The pass is
 * remembered on this device.
 */
export default function Gate({ onPass }: Props) {
	const [value, setValue] = useState('');
	const [wrong, setWrong] = useState(false);
	const inputRef = useRef<HTMLInputElement>(null);

	// StrictMode remounts can drop autoFocus; re-assert it a frame later.
	useEffect(() => {
		const raf = requestAnimationFrame(() => inputRef.current?.focus());
		return () => cancelAnimationFrame(raf);
	}, []);

	function submit(e: React.FormEvent) {
		e.preventDefault();
		if (isAccepted(value)) {
			rememberUnlock();
			onPass();
		} else {
			setWrong(true);
		}
	}

	return (
		<div className="fly-gate">
			<div className="fly-gate-card">
				<div className="fly-gate-icon" aria-hidden>
					🏔️
				</div>
				<h1>Palisades Park 3D</h1>
				<p>This fly-through is for friends of the park. Answer to continue:</p>
				<form onSubmit={submit}>
					<label htmlFor="fly-gate-answer">Who's the park manager?</label>
					<input
						id="fly-gate-answer"
						ref={inputRef}
						type="text"
						value={value}
						autoComplete="off"
						autoCapitalize="none"
						spellCheck={false}
						placeholder="Type your answer"
						onChange={(e) => {
							setValue(e.target.value);
							setWrong(false);
						}}
					/>
					{wrong ? <p className="fly-gate-wrong">That's not it — try again.</p> : null}
					<button type="submit">Enter</button>
				</form>
			</div>
		</div>
	);
}
