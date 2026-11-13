// Building blocks for scripted camera moves ("shots"). A shot is a set of
// timed keyframes — camera position + look-at target — joined by a
// time-parameterized cubic Hermite spline, so speed changes smoothly between
// segments (C1-continuous in time, easing from rest at the very start and
// end). ShotBuilder adds keyframes in world space with a few helpers: orbit a
// point, follow a hike with a camera rig, look at a lat/lon.
import * as THREE from 'three';
import type { Route } from './route';
import type { CameraMode, FlyScene, Rig, Shot } from './scene';
import { shoreX, type Terrain, toWorld } from './terrain';

export interface Key {
	t: number;
	pos: THREE.Vector3;
	target: THREE.Vector3;
}

/** Hermite spline through timed points, with finite-difference tangents. */
export class TimedSpline {
	private readonly times: number[];
	private readonly points: THREE.Vector3[];
	private readonly tangents: THREE.Vector3[];

	constructor(times: number[], points: THREE.Vector3[]) {
		this.times = times;
		this.points = points;
		const n = points.length;
		this.tangents = points.map((_, i) => {
			if (i === 0 || i === n - 1) return new THREE.Vector3();
			return points[i + 1]
				.clone()
				.sub(points[i - 1])
				.divideScalar(times[i + 1] - times[i - 1]);
		});
	}

	at(t: number, out: THREE.Vector3): THREE.Vector3 {
		const times = this.times;
		const points = this.points;
		const tangents = this.tangents;
		const n = times.length;
		if (t <= times[0]) return out.copy(points[0]);
		if (t >= times[n - 1]) return out.copy(points[n - 1]);
		let i = 0;
		while (i < n - 2 && times[i + 1] < t) i++;
		const h = times[i + 1] - times[i];
		const u = (t - times[i]) / h;
		const u2 = u * u;
		const u3 = u2 * u;
		return out
			.copy(points[i])
			.multiplyScalar(2 * u3 - 3 * u2 + 1)
			.addScaledVector(tangents[i], (u3 - 2 * u2 + u) * h)
			.addScaledVector(points[i + 1], -2 * u3 + 3 * u2)
			.addScaledVector(tangents[i + 1], (u3 - u2) * h);
	}
}

export type Ease = (u: number) => number;
export const ease = {
	linear: (u: number) => u,
	inOut: (u: number) => u * u * (3 - 2 * u),
	/** Starts from rest, ends at full speed. */
	in: (u: number) => u * u * (2 - u),
	/** Starts at full speed, ends at rest. */
	out: (u: number) => 1 - (1 - u) * (1 - u) * (1 + u),
} satisfies Record<string, Ease>;

type RigChoice = Exclude<CameraMode, 'free'> | Rig;

interface FollowSegment {
	t0: number;
	t1: number;
	s0: number;
	s1: number;
}

export class ShotBuilder {
	readonly keys: Key[] = [];
	private readonly follows: FollowSegment[] = [];
	private readonly scene: FlyScene;
	private readonly terrain: Terrain;

	constructor(scene: FlyScene, terrain: Terrain) {
		this.scene = scene;
		this.terrain = terrain;
	}

	/** Ground height (exaggeration applied) under world (x, z). */
	ground(x: number, z: number): number {
		return this.scene.groundHeight(x, z);
	}

	/** A lat/lon on the ground, raised by `up` metres. */
	at(lat: number, lon: number, up = 0): THREE.Vector3 {
		const [x, z] = toWorld(this.terrain.meta, lat, lon);
		return new THREE.Vector3(x, this.ground(x, z) + up, z);
	}

	/** World x of the lake shore at z. */
	shore(z: number): number {
		return shoreX(this.terrain, z);
	}

	key(t: number, pos: THREE.Vector3, target: THREE.Vector3): this {
		this.keys.push({ t, pos: pos.clone(), target: target.clone() });
		return this;
	}

	get last(): Key {
		const k = this.keys[this.keys.length - 1];
		if (!k) throw new Error('Shot has no keyframes yet');
		return k;
	}

	/**
	 * Circle `centre` from t0 to t1. Angles are radians in the world xz plane
	 * (0 = east, π/2 = south, π = west, -π/2 = north); `alt` is absolute y.
	 */
	orbit(o: {
		t0: number;
		t1: number;
		centre: THREE.Vector3;
		radius: [number, number];
		alt: [number, number];
		angle: [number, number];
		ease?: Ease;
		target?: THREE.Vector3;
		step?: number;
		/** Skip the first keyframe (to continue straight on from the previous segment). */
		skipFirst?: boolean;
	}): this {
		const easeFn = o.ease ?? ease.inOut;
		const step = o.step ?? 0.5;
		const n = Math.max(1, Math.round((o.t1 - o.t0) / step));
		for (let i = o.skipFirst ? 1 : 0; i <= n; i++) {
			const e = easeFn(i / n);
			const a = o.angle[0] + (o.angle[1] - o.angle[0]) * e;
			const r = o.radius[0] + (o.radius[1] - o.radius[0]) * e;
			const y = o.alt[0] + (o.alt[1] - o.alt[0]) * e;
			this.key(
				o.t0 + ((o.t1 - o.t0) * i) / n,
				new THREE.Vector3(o.centre.x + r * Math.cos(a), y, o.centre.z + r * Math.sin(a)),
				o.target ?? o.centre,
			);
		}
		return this;
	}

	/** Follow the scene's current hike from s0 to s1 metres with a camera rig. */
	follow(f: {
		t0: number;
		t1: number;
		s0: number;
		s1: number;
		rig?: RigChoice;
		step?: number;
		skipFirst?: boolean;
	}): this {
		const step = f.step ?? 1;
		const n = Math.max(1, Math.round((f.t1 - f.t0) / step));
		const pos = new THREE.Vector3();
		const target = new THREE.Vector3();
		for (let i = f.skipFirst ? 1 : 0; i <= n; i++) {
			const u = i / n;
			this.scene.followPose(f.s0 + (f.s1 - f.s0) * u, pos, target, f.rig ?? 'drone');
			this.key(f.t0 + (f.t1 - f.t0) * u, pos, target);
		}
		this.follows.push({ t0: f.t0, t1: f.t1, s0: f.s0, s1: f.s1 });
		return this;
	}

	/** The rig's camera pose at distance s along the hike (to aim a transition at). */
	followPose(s: number, rig: RigChoice = 'drone'): { pos: THREE.Vector3; target: THREE.Vector3 } {
		const pos = new THREE.Vector3();
		const target = new THREE.Vector3();
		this.scene.followPose(s, pos, target, rig);
		return { pos, target };
	}

	build(): Shot {
		const keys = [...this.keys].sort((a, b) => a.t - b.t);
		if (keys.length < 2) throw new Error('A shot needs at least two keyframes');
		const times = keys.map((k) => k.t);
		const posSpline = new TimedSpline(
			times,
			keys.map((k) => k.pos),
		);
		const targetSpline = new TimedSpline(
			times,
			keys.map((k) => k.target),
		);
		const follows = [...this.follows].sort((a, b) => a.t0 - b.t0);
		const hikerAt = (t: number) => {
			let s = follows[0]?.s0 ?? 0;
			for (const f of follows) {
				if (t < f.t0) break;
				s = t >= f.t1 ? f.s1 : f.s0 + ((f.s1 - f.s0) * (t - f.t0)) / (f.t1 - f.t0);
			}
			return s;
		};
		const scene = this.scene;
		return {
			duration: times[times.length - 1],
			sample(t, pos, target) {
				posSpline.at(t, pos);
				targetSpline.at(t, target);
				// Never let the spline dip the camera into a hillside.
				const floor = scene.groundHeight(pos.x, pos.z) + 8;
				if (pos.y < floor) pos.y = floor;
				return hikerAt(t);
			},
		};
	}
}

/**
 * The recorded fly-through: "up high → spin in → up the lakefront → into the trail".
 *   0–7.5 s    spiral down around the park from ~2.6 km, ending SW over the lake
 *   7.5–10.5   dive to ~60 m over the water at the south end
 *   10.5–16.5  run north up the shoreline, bluffs on the right
 *   16.5–20.5  bank inland over the beach to the hike's trailhead
 *   20.5–end   drone-follow the hike as the route lights up behind the hiker
 */
export function lakefrontIntro(
	scene: FlyScene,
	terrain: Terrain,
	route: Route,
	opts: { followSeconds?: number; followSpeed?: number } = {},
): Shot {
	const followSeconds = opts.followSeconds ?? 12;
	const followSpeed = opts.followSpeed ?? 32;
	const b = new ShotBuilder(scene, terrain);

	// 1. Spin in: orbit the park centre while dropping from ~2.6 km to ~750 m.
	const centre = new THREE.Vector3(-150, b.ground(-150, 0) + 10, 0);
	const end = Math.atan2(0.8, -0.6); // south-west of the park, over the lake
	b.orbit({
		t0: 0,
		t1: 7.5,
		centre,
		radius: [900, 1600],
		alt: [2600, 750],
		angle: [end - 3.6, end],
		ease: ease.in, // starts from rest, ends at full speed into the dive
	});

	// 2–3. Dive to the south end of the lakefront, then fly north just offshore.
	const offshore = 120;
	const lookAhead = 280;
	for (const { t, z, alt } of [
		{ t: 10.5, z: 950, alt: 70 },
		{ t: 12.5, z: 820, alt: 60 },
		{ t: 14.5, z: 690, alt: 55 },
		{ t: 16.5, z: 560, alt: 55 },
	]) {
		const tz = z - lookAhead;
		const tx = b.shore(tz) + 70;
		b.key(
			t,
			new THREE.Vector3(b.shore(z) - offshore, alt, z),
			new THREE.Vector3(tx, b.ground(tx, tz) + 5, tz),
		);
	}

	// 4–5. Bank into the trailhead and hand over to the drone follow rig.
	const start = b.followPose(0);
	const last = b.last;
	b.key(
		18.5,
		last.pos
			.clone()
			.lerp(start.pos, 0.5)
			.add(new THREE.Vector3(0, 12, 0)),
		last.target.clone().lerp(start.target, 0.65),
	);
	b.follow({
		t0: 20.5,
		t1: 20.5 + followSeconds,
		s0: 0,
		s1: Math.min(route.path.length, followSeconds * followSpeed),
	});
	return b.build();
}
