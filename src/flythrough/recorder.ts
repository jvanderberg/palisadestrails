// Hook for scripts/record-flythrough.mjs: with `?record` in the URL the app
// hides its UI and exposes window.__flyRecorder, which renders the scripted
// camera move one exact frame at a time and hands back each frame as a JPEG.
import * as THREE from 'three';
import { lakefrontIntro } from './cinematic';
import type { Route } from './route';
import type { FlyScene, Shot } from './scene';
import type { Terrain } from './terrain';

export interface FlyRecorder {
	/** Wait for textures, stop the live loop and build the shot. Returns its length (s). */
	prepare(): Promise<{ duration: number }>;
	/** Render the frame at time `t` and return it as a JPEG data URL. */
	frame(t: number, dt: number): string;
}

declare global {
	interface Window {
		__flyRecorder?: FlyRecorder;
	}
}

export function installRecorder(scene: FlyScene, terrain: Terrain, route: Route): () => void {
	let shot: Shot | null = null;
	const pos = new THREE.Vector3();
	const target = new THREE.Vector3();
	window.__flyRecorder = {
		async prepare() {
			await scene.whenReady();
			scene.stopLoop();
			shot = lakefrontIntro(scene, terrain, route);
			return { duration: shot.duration };
		},
		frame(t, dt) {
			if (!shot) throw new Error('Call prepare() first');
			const s = shot.sample(t, pos, target);
			scene.renderFrame(pos, target, s, dt);
			return scene.renderer.domElement.toDataURL('image/jpeg', 0.93);
		},
	};
	return () => {
		window.__flyRecorder = undefined;
	};
}
