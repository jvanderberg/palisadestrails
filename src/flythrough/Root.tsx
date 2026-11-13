import { useState } from 'react';
import App from './App';
import Gate, { isUnlocked } from './Gate';

/** The 3D app (and its terrain download) only mounts once past the gate. */
export default function Root() {
	const [unlocked, setUnlocked] = useState(isUnlocked);
	return unlocked ? <App /> : <Gate onPass={() => setUnlocked(true)} />;
}
