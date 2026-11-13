// The three.js side of the fly-through: terrain, lake, sky, trails, POIs and
// the camera rigs that follow a hike. React drives it through a small
// imperative API (setRoute / play / seek / setMode / …) and gets progress
// back through `onFrame`.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { Collectible } from '../data/collectibles';
import type { Trail } from '../data/park';
import { at, type Path, resample, smooth } from './path';
import { M_TO_FT, type Route } from './route';
import { type HeightGrid, heightAt, shoreX, type Terrain, toWorld } from './terrain';

export type CameraMode = 'drone' | 'low' | 'overhead' | 'free';
export type GroundStyle = 'photo' | 'bare';

export interface SceneOptions {
	terrain: Terrain;
	trails: Trail[];
	pois: Collectible[];
	onFrame: (s: number, playing: boolean) => void;
}

/** A scripted camera move (see cinematic.ts). */
export interface Shot {
	duration: number;
	/** Pose at time `t` into `pos`/`target`; returns the hiker's distance along the route. */
	sample(t: number, pos: THREE.Vector3, target: THREE.Vector3): number;
}

export interface Rig {
	/** Distance behind the hiker, metres. */
	back: number;
	/** Height above the hiker, metres. */
	up: number;
	/** How far ahead along the route to aim, metres. */
	ahead: number;
	/** Path smoothing for the camera, metres — bigger is calmer. */
	sigma: number;
	/** Camera follow time constant, seconds. */
	tau: number;
}

const RIGS: Record<Exclude<CameraMode, 'free'>, Rig> = {
	drone: { back: 90, up: 55, ahead: 80, sigma: 40, tau: 0.45 },
	low: { back: 28, up: 10, ahead: 45, sigma: 16, tau: 0.3 },
	overhead: { back: 70, up: 260, ahead: 20, sigma: 60, tau: 0.6 },
};

const HAZE = new THREE.Color('#c9d9e6');
const ZENITH = new THREE.Color('#4f86c6');
const SUN_DIR = new THREE.Vector3(-0.55, 0.62, 0.56).normalize(); // late-afternoon sun over the lake
/** Ground within this many metres of lake level counts as lake surface. */
const LAKE_SINK_BELOW = 0.3;
const LAKE_SINK = 3;
const ROUTE_DONE = new THREE.Color('#ff7a1a');
const ROUTE_AHEAD = new THREE.Color('#fff4d6');

// ---------------------------------------------------------------- geometry

/** One mesh vertex per grid cell centre; optional rectangular hole (world xz). */
function gridGeometry(
	g: HeightGrid,
	hole?: { x0: number; x1: number; z0: number; z1: number },
): THREE.BufferGeometry {
	const { cols, rows, res, x0, z0, data } = g;
	const n = cols * rows;
	const pos = new Float32Array(n * 3);
	const nor = new Float32Array(n * 3);
	const uv = new Float32Array(n * 2);
	for (let r = 0; r < rows; r++) {
		for (let c = 0; c < cols; c++) {
			const i = r * cols + c;
			pos[i * 3] = x0 + c * res;
			// The lake is hydro-flattened to exactly lake level (y = 0). Sink it
			// well below the water plane so the two never z-fight and flicker.
			pos[i * 3 + 1] = data[i] < LAKE_SINK_BELOW ? data[i] - LAKE_SINK : data[i];
			pos[i * 3 + 2] = z0 + r * res;
			uv[i * 2] = (c + 0.5) / cols;
			uv[i * 2 + 1] = 1 - (r + 0.5) / rows;
			// Central-difference normal (one-sided at the edges).
			const l = data[r * cols + Math.max(0, c - 1)];
			const rt = data[r * cols + Math.min(cols - 1, c + 1)];
			const up = data[Math.max(0, r - 1) * cols + c];
			const dn = data[Math.min(rows - 1, r + 1) * cols + c];
			const dx = (l - rt) / (res * (c > 0 && c < cols - 1 ? 2 : 1));
			const dz = (up - dn) / (res * (r > 0 && r < rows - 1 ? 2 : 1));
			const len = Math.hypot(dx, 1, dz);
			nor[i * 3] = dx / len;
			nor[i * 3 + 1] = 1 / len;
			nor[i * 3 + 2] = dz / len;
		}
	}
	const idx: number[] = [];
	for (let r = 0; r < rows - 1; r++) {
		const cz0 = z0 + r * res;
		for (let c = 0; c < cols - 1; c++) {
			const cx0 = x0 + c * res;
			if (
				hole &&
				cx0 >= hole.x0 &&
				cx0 + res <= hole.x1 &&
				cz0 >= hole.z0 &&
				cz0 + res <= hole.z1
			) {
				continue;
			}
			const a = r * cols + c;
			const b = a + 1;
			const d = a + cols;
			const e = d + 1;
			idx.push(a, d, b, b, d, e);
		}
	}
	const geo = new THREE.BufferGeometry();
	geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
	geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
	geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
	geo.setIndex(new THREE.BufferAttribute(new Uint32Array(idx), 1));
	return geo;
}

/**
 * A flat ribbon draped over the terrain along a resampled path, `across`
 * vertices wide. Every vertex samples the ground itself so the ribbon follows
 * side-slopes and ridge crests instead of sagging between its edges. Adds
 * `along` (metres) and `side` (-1..1) attributes for shaders.
 */
function ribbonGeometry(
	path: Path,
	width: number,
	lift: number,
	height: (x: number, z: number) => number,
	opts: { across?: number; color?: THREE.Color } = {},
): THREE.BufferGeometry {
	const k = Math.max(2, opts.across ?? 2);
	const n = path.xs.length;
	const pos = new Float32Array(n * k * 3);
	const along = new Float32Array(n * k);
	const side = new Float32Array(n * k);
	const color = opts.color;
	const col = color ? new Float32Array(n * k * 3) : null;
	const half = width / 2;
	for (let i = 0; i < n; i++) {
		const a = Math.max(0, i - 1);
		const b = Math.min(n - 1, i + 1);
		let tx = path.xs[b] - path.xs[a];
		let tz = path.zs[b] - path.zs[a];
		const tl = Math.hypot(tx, tz) || 1;
		tx /= tl;
		tz /= tl;
		for (let j = 0; j < k; j++) {
			const sd = (j / (k - 1)) * 2 - 1;
			const x = path.xs[i] - tz * half * sd;
			const z = path.zs[i] + tx * half * sd;
			const v = i * k + j;
			pos[v * 3] = x;
			pos[v * 3 + 1] = height(x, z) + lift;
			pos[v * 3 + 2] = z;
			along[v] = i * path.step;
			side[v] = sd;
			if (col && color) col.set([color.r, color.g, color.b], v * 3);
		}
	}
	const idx: number[] = [];
	for (let i = 0; i < n - 1; i++) {
		for (let j = 0; j < k - 1; j++) {
			const v = i * k + j;
			idx.push(v, v + k, v + 1, v + 1, v + k, v + k + 1);
		}
	}
	const geo = new THREE.BufferGeometry();
	geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
	geo.setAttribute('along', new THREE.BufferAttribute(along, 1));
	geo.setAttribute('side', new THREE.BufferAttribute(side, 1));
	if (col) geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
	geo.setIndex(idx);
	return geo;
}

/** Tileable wave normal map for the lake, built from a few summed sines. */
function waveNormals(size = 256): THREE.DataTexture {
	const data = new Uint8Array(size * size * 4);
	const waves = [
		[1, 0, 3, 0.0],
		[0.6, 0.8, 5, 1.3],
		[-0.3, 0.95, 7, 2.1],
		[0.85, -0.5, 11, 0.7],
		[-0.7, -0.7, 17, 4.2],
	] as const;
	for (let y = 0; y < size; y++) {
		for (let x = 0; x < size; x++) {
			let dx = 0;
			let dy = 0;
			for (const [wx, wy, f, ph] of waves) {
				const k = (2 * Math.PI * f) / size;
				const c = Math.cos(k * (wx * x + wy * y) * Math.SQRT2 + ph) / f;
				dx += c * wx;
				dy += c * wy;
			}
			const len = Math.hypot(dx, dy, 1.6);
			const i = (y * size + x) * 4;
			data[i] = ((dx / len) * 0.5 + 0.5) * 255;
			data[i + 1] = ((dy / len) * 0.5 + 0.5) * 255;
			data[i + 2] = ((1.6 / len) * 0.5 + 0.5) * 255;
			data[i + 3] = 255;
		}
	}
	const tex = new THREE.DataTexture(data, size, size);
	tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
	tex.generateMipmaps = true;
	tex.minFilter = THREE.LinearMipmapLinearFilter;
	tex.magFilter = THREE.LinearFilter;
	tex.needsUpdate = true;
	return tex;
}

function skyMaterial(): THREE.ShaderMaterial {
	return new THREE.ShaderMaterial({
		side: THREE.BackSide,
		depthWrite: false,
		fog: false,
		toneMapped: false,
		uniforms: {
			uHaze: { value: HAZE },
			uZenith: { value: ZENITH },
			uSun: { value: SUN_DIR },
		},
		vertexShader: /* glsl */ `
			varying vec3 vDir;
			void main() {
				vDir = normalize(position);
				gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
				gl_Position.z = gl_Position.w; // pin to the far plane
			}`,
		fragmentShader: /* glsl */ `
			uniform vec3 uHaze;
			uniform vec3 uZenith;
			uniform vec3 uSun;
			varying vec3 vDir;
			void main() {
				vec3 d = normalize(vDir);
				float h = max(d.y, 0.0);
				vec3 col = mix(uHaze, uZenith, pow(h, 0.55));
				float s = max(dot(d, uSun), 0.0);
				col += vec3(1.0, 0.92, 0.75) * (pow(s, 900.0) * 2.0 + pow(s, 12.0) * 0.18);
				gl_FragColor = vec4(col, 1.0);
				#include <colorspace_fragment>
			}`,
	});
}

/**
 * A POI marker drawn to a canvas for a screen-sized sprite: the full
 * emoji + name pill up close, just the emoji badge from afar.
 */
function labelTexture(poi: Collectible, withName: boolean): THREE.CanvasTexture {
	const dpr = 2;
	const font = `600 ${26 * dpr}px "Geist Variable", system-ui, sans-serif`;
	const emojiFont = `${30 * dpr}px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif`;
	const measure = document.createElement('canvas').getContext('2d');
	if (!measure) throw new Error('2D canvas unavailable');
	measure.font = font;
	const h = 52 * dpr;
	const pad = 14 * dpr;
	const emojiW = 38 * dpr;
	const w = withName ? Math.ceil(pad + emojiW + measure.measureText(poi.name).width + pad) : h;
	const canvas = document.createElement('canvas');
	canvas.width = w;
	canvas.height = h + 14 * dpr;
	const ctx = canvas.getContext('2d');
	if (!ctx) throw new Error('2D canvas unavailable');
	ctx.fillStyle = 'rgba(17, 24, 20, 0.82)';
	ctx.beginPath();
	ctx.roundRect(0, 0, w, h, h / 2);
	ctx.fill();
	// Pointer nub under the pill.
	ctx.beginPath();
	ctx.moveTo(w / 2 - 9 * dpr, h - 1);
	ctx.lineTo(w / 2, h + 12 * dpr);
	ctx.lineTo(w / 2 + 9 * dpr, h - 1);
	ctx.fill();
	ctx.textBaseline = 'middle';
	ctx.font = emojiFont;
	ctx.fillStyle = poi.color ?? '#fff';
	if (withName) {
		ctx.fillText(poi.emoji, pad, h / 2 + dpr);
		ctx.font = font;
		ctx.fillStyle = '#fff';
		ctx.fillText(poi.name, pad + emojiW, h / 2 + dpr);
	} else {
		ctx.textAlign = 'center';
		ctx.fillText(poi.emoji, w / 2, h / 2 + dpr);
	}
	const tex = new THREE.CanvasTexture(canvas);
	tex.colorSpace = THREE.SRGBColorSpace;
	tex.anisotropy = 4;
	return tex;
}

const LABEL_SCALE = 0.042;

function fitSprite(sprite: THREE.Sprite, tex: THREE.Texture, scale: number): void {
	const img = tex.image as HTMLCanvasElement;
	sprite.material.map = tex;
	sprite.scale.set((scale * img.width) / img.height, scale, 1);
}

/**
 * Dissolve a terrain layer's outer edges into the haze so the world has no
 * visible rim. Works with or without a texture map (uses the raw uv).
 */
function edgeFade<M extends THREE.Material>(mat: M): M {
	const prev = mat.onBeforeCompile.bind(mat);
	mat.onBeforeCompile = (shader, renderer) => {
		prev(shader, renderer);
		shader.vertexShader = `varying vec2 vEdgeUv;\n${shader.vertexShader}`.replace(
			'#include <begin_vertex>',
			'#include <begin_vertex>\nvEdgeUv = uv;',
		);
		shader.fragmentShader = `varying vec2 vEdgeUv;\n${shader.fragmentShader}`.replace(
			'#include <fog_fragment>',
			`#include <fog_fragment>
			vec2 edge2 = min(vEdgeUv, 1.0 - vEdgeUv);
			float edge = smoothstep(0.0, 0.08, min(edge2.x, edge2.y));
			gl_FragColor.rgb = mix(fogColor, gl_FragColor.rgb, edge);`,
		);
	};
	mat.customProgramCacheKey = () => `edge-fade:${mat.type}:${mat.name}`;
	return mat;
}

/**
 * "Bare earth": the lidar ground with no photo — a warm sand-to-sage ramp by
 * elevation, lit by the scene's sun, with faint 10 ft contours (50 ft index
 * lines) that fade out before they'd shimmer.
 */
function reliefMaterial(mat: THREE.MeshLambertMaterial, lakeFt: number) {
	mat.name = 'relief';
	mat.onBeforeCompile = (shader) => {
		shader.uniforms.uLakeFt = { value: lakeFt };
		shader.vertexShader = `varying float vHeight;\n${shader.vertexShader}`.replace(
			'#include <begin_vertex>',
			'#include <begin_vertex>\nvHeight = position.y;',
		);
		shader.fragmentShader =
			`uniform float uLakeFt;\nvarying float vHeight;\n${shader.fragmentShader}`.replace(
				'vec4 diffuseColor = vec4( diffuse, opacity );',
				`float hm = max(vHeight, 0.0);
				vec3 sand = vec3(0.66, 0.56, 0.40);
				vec3 low = vec3(0.56, 0.50, 0.36);
				vec3 high = vec3(0.47, 0.47, 0.34);
				vec3 ground = mix(sand, low, smoothstep(0.5, 6.0, hm));
				ground = mix(ground, high, smoothstep(15.0, 60.0, hm));
				float ft = hm * 3.28084 + uLakeFt;
				float c10 = ft / 10.0;
				float w10 = fwidth(c10);
				float line10 = 1.0 - smoothstep(0.0, 1.2, abs(fract(c10 - 0.5) - 0.5) / max(w10, 1e-4));
				float c50 = ft / 50.0;
				float w50 = fwidth(c50);
				float line50 = 1.0 - smoothstep(0.0, 1.5, abs(fract(c50 - 0.5) - 0.5) / max(w50, 1e-4));
				float fade10 = 1.0 - smoothstep(0.08, 0.3, w10);
				float fade50 = 1.0 - smoothstep(0.03, 0.12, w50);
				float contour = max(line10 * 0.2 * fade10, line50 * 0.38 * fade50);
				vec4 diffuseColor = vec4(ground * (1.0 - contour), opacity);`,
			);
	};
	return mat;
}

// ---------------------------------------------------------------- scene

interface PoiMarker {
	poi: Collectible;
	sprite: THREE.Sprite;
	ground: number;
	full: THREE.CanvasTexture;
	badge: THREE.CanvasTexture;
	onRoute: boolean;
	showingName: boolean;
}

interface CameraPath {
	xs: Float32Array;
	zs: Float32Array;
}

export class FlyScene {
	readonly renderer: THREE.WebGLRenderer;
	private readonly scene = new THREE.Scene();
	private readonly camera = new THREE.PerspectiveCamera(55, 1, 2, 40000);
	private readonly controls: OrbitControls;
	/** Everything that scales with vertical exaggeration. */
	private readonly world = new THREE.Group();
	private readonly sky: THREE.Mesh;
	private readonly water: THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>;
	private readonly hiker = new THREE.Group();
	private readonly routeUniforms = { uProgress: { value: 0 } };
	private readonly terrain: Terrain;
	private readonly pois: PoiMarker[] = [];
	private readonly resizeObserver: ResizeObserver;
	private readonly timer = new THREE.Timer();
	private readonly onFrame: SceneOptions['onFrame'];
	private readonly loading: Promise<void>[] = [];

	private innerMesh!: THREE.Mesh;
	private outerMesh!: THREE.Mesh;
	private groundMaterials!: Record<GroundStyle, [THREE.Material, THREE.Material]>;
	private routeMesh: THREE.Mesh | null = null;
	private route: Route | null = null;
	private camPaths = new Map<number, CameraPath>();
	private exaggeration = 1;
	private s = 0;
	private playing = false;
	private speed = 25;
	private mode: CameraMode = 'drone';
	private camPos = new THREE.Vector3();
	private camTarget = new THREE.Vector3();
	private heading = new THREE.Vector2(0, -1);
	private snap = true;
	private transition = 0;
	private lastHiker = new THREE.Vector3();
	private lastReport = 0;
	private disposed = false;

	private readonly host: HTMLElement;

	constructor(host: HTMLElement, opts: SceneOptions) {
		this.host = host;
		this.terrain = opts.terrain;
		this.onFrame = opts.onFrame;

		this.renderer = new THREE.WebGLRenderer({
			antialias: true,
			powerPreference: 'high-performance',
		});
		this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
		this.renderer.outputColorSpace = THREE.SRGBColorSpace;
		this.renderer.toneMapping = THREE.NoToneMapping;
		host.appendChild(this.renderer.domElement);
		this.renderer.domElement.className = 'fly-canvas';

		this.scene.fog = new THREE.Fog(HAZE, 1800, 9000);
		this.scene.add(this.world);

		// Sky dome follows the camera so it's always "infinitely" far away.
		this.sky = new THREE.Mesh(new THREE.SphereGeometry(1000, 48, 24), skyMaterial());
		this.sky.frustumCulled = false;
		this.sky.renderOrder = -1;
		this.scene.add(this.sky);
		const pmrem = new THREE.PMREMGenerator(this.renderer);
		const envScene = new THREE.Scene();
		envScene.add(new THREE.Mesh(new THREE.SphereGeometry(10, 32, 16), skyMaterial()));
		this.scene.environment = pmrem.fromScene(envScene).texture;
		pmrem.dispose();

		this.scene.add(new THREE.HemisphereLight('#dce9ff', '#5d6b4a', 0.75));
		const sun = new THREE.DirectionalLight('#fff1dc', 1.05);
		sun.position.copy(SUN_DIR).multiplyScalar(1000);
		this.scene.add(sun);

		this.water = this.buildWater();
		this.world.add(this.water);
		this.buildTerrain();
		this.buildTrails(opts.trails);
		this.buildPois(opts.pois);
		this.buildHiker();

		this.controls = new OrbitControls(this.camera, this.renderer.domElement);
		this.controls.enableDamping = true;
		this.controls.dampingFactor = 0.08;
		this.controls.maxPolarAngle = THREE.MathUtils.degToRad(87);
		this.controls.minDistance = 15;
		this.controls.maxDistance = 6000;
		this.controls.autoRotateSpeed = 0.35;
		this.controls.addEventListener('start', () => {
			this.controls.autoRotate = false;
		});
		this.overview();

		this.resizeObserver = new ResizeObserver(() => this.resize());
		this.resizeObserver.observe(host);
		this.resize();
		this.renderer.setAnimationLoop(() => this.tick());
	}

	// ------------------------------------------------------------ public API

	setRoute(route: Route | null): void {
		if (this.routeMesh) {
			this.world.remove(this.routeMesh);
			this.routeMesh.geometry.dispose();
			(this.routeMesh.material as THREE.Material).dispose();
			this.routeMesh = null;
		}
		this.route = route;
		this.camPaths.clear();
		this.playing = false;
		this.s = 0;
		const onRoute = new Set(route?.hike.poiIds ?? []);
		for (const m of this.pois) {
			m.onRoute = onRoute.has(m.poi.id);
			m.sprite.material.opacity = !route || m.onRoute ? 1 : 0.55;
		}
		this.hiker.visible = Boolean(route);
		if (!route) {
			this.overview();
			return;
		}
		this.routeMesh = this.buildRoute(route);
		this.world.add(this.routeMesh);
		this.controls.autoRotate = false;
		if (this.mode === 'free') this.mode = 'drone';
		this.controls.enabled = false;
		this.transition = 2.5;
		this.snap = false;
		// Start the swoop from wherever the camera is now.
		this.camPos.copy(this.camera.position);
		this.camTarget.copy(this.controls.target);
		this.report(true);
	}

	play(): void {
		if (!this.route) return;
		if (this.s >= this.route.path.length - 0.5) this.seek(0);
		this.playing = true;
		this.report(true);
	}

	pause(): void {
		this.playing = false;
		this.report(true);
	}

	seek(s: number): void {
		if (!this.route) return;
		const next = THREE.MathUtils.clamp(s, 0, this.route.path.length);
		if (Math.abs(next - this.s) > 60) this.snap = true;
		this.s = next;
		this.report(true);
	}

	setSpeed(metresPerSecond: number): void {
		this.speed = metresPerSecond;
	}

	setMode(mode: CameraMode): void {
		// Follow cameras need a hike; without one the overview stays free.
		if (mode === this.mode || (!this.route && mode !== 'free')) return;
		if (mode === 'free') {
			this.controls.target.copy(this.camTarget);
			this.controls.enabled = true;
		} else {
			this.controls.enabled = false;
			this.camPos.copy(this.camera.position);
			this.camTarget.copy(this.controls.target);
			this.transition = 1.5;
		}
		this.mode = mode;
	}

	setGround(style: GroundStyle): void {
		const [inner, outer] = this.groundMaterials[style];
		this.innerMesh.material = inner;
		this.outerMesh.material = outer;
	}

	setExaggeration(e: number): void {
		const ratio = e / this.exaggeration;
		this.exaggeration = e;
		this.world.scale.y = e;
		for (const m of this.pois) m.sprite.position.y = (m.ground + 16) * e;
		// Keep a free camera at the same height above the ground.
		this.camera.position.y *= ratio;
		this.controls.target.y *= ratio;
		this.camPos.y *= ratio;
		this.camTarget.y *= ratio;
	}

	/** Back to the whole-park view, slowly circling. */
	overview(): void {
		const { inner } = this.terrain;
		const cx = inner.grid.x0 + ((inner.grid.cols - 1) * inner.grid.res) / 2;
		const cz = inner.grid.z0 + ((inner.grid.rows - 1) * inner.grid.res) / 2;
		this.mode = 'free';
		this.controls.enabled = true;
		this.controls.target.set(cx, 30 * this.exaggeration, cz);
		this.camera.position.set(cx - 1350, 650, cz + 1150);
		this.controls.autoRotate = true;
		this.controls.update();
	}

	// ------------------------------------------------------------ recording

	/** Resolves once the terrain photos have loaded and can be rendered. */
	whenReady(): Promise<void> {
		return Promise.all(this.loading).then(() => undefined);
	}

	/** Stop the real-time loop; frames are then drawn only by renderFrame(). */
	stopLoop(): void {
		this.renderer.setAnimationLoop(null);
		this.controls.enabled = false;
		this.controls.autoRotate = false;
		this.playing = false;
	}

	/** Ground height in world space at (x, z), with exaggeration applied. */
	groundHeight(x: number, z: number): number {
		return this.groundY(x, z);
	}

	/** Where a follow rig wants the camera at distance `s` (unsmoothed). */
	followPose(
		s: number,
		pos: THREE.Vector3,
		target: THREE.Vector3,
		rig: Exclude<CameraMode, 'free'> | Rig = 'drone',
	): void {
		const saved = this.s;
		this.s = s;
		const hiker = this.hikerPosition(new THREE.Vector3());
		this.desired(typeof rig === 'string' ? RIGS[rig] : rig, hiker, pos, target);
		this.s = saved;
	}

	/** Draw one frame from an explicit camera pose (used by the recorder). */
	renderFrame(pos: THREE.Vector3, target: THREE.Vector3, s: number, dt: number): void {
		this.s = s;
		if (this.route) {
			this.hiker.position.copy(this.hikerPosition(this.tmpHiker));
			this.routeUniforms.uProgress.value = s;
		}
		this.camera.position.copy(pos);
		this.camera.lookAt(target);
		this.updateLabels();
		this.sky.position.copy(pos);
		this.animateWater(dt);
		this.renderer.render(this.scene, this.camera);
	}

	dispose(): void {
		this.disposed = true;
		this.renderer.setAnimationLoop(null);
		this.resizeObserver.disconnect();
		this.controls.dispose();
		this.scene.traverse((obj) => {
			if (obj instanceof THREE.Mesh || obj instanceof THREE.Sprite || obj instanceof THREE.Line) {
				obj.geometry.dispose();
				const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
				for (const m of mats) {
					for (const v of Object.values(m)) if (v instanceof THREE.Texture) v.dispose();
					m.dispose();
				}
			}
		});
		for (const mat of Object.values(this.groundMaterials).flat()) {
			for (const v of Object.values(mat)) if (v instanceof THREE.Texture) v.dispose();
			mat.dispose();
		}
		for (const m of this.pois) {
			m.full.dispose();
			m.badge.dispose();
		}
		this.scene.environment?.dispose();
		this.renderer.dispose();
		this.renderer.forceContextLoss();
		this.renderer.domElement.remove();
	}

	// ------------------------------------------------------------ building

	private height = (x: number, z: number) => heightAt(this.terrain, x, z);

	private loadTexture(url: string): THREE.Texture {
		let settle: () => void = () => {};
		let fail: (err: unknown) => void = () => {};
		this.loading.push(
			new Promise<void>((resolve, reject) => {
				settle = resolve;
				fail = reject;
			}),
		);
		const tex = new THREE.TextureLoader().load(
			url,
			() => settle(),
			undefined,
			(err) => fail(err),
		);
		tex.colorSpace = THREE.SRGBColorSpace;
		tex.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
		return tex;
	}

	private buildTerrain(): void {
		const { inner, outer, meta } = this.terrain;
		const g = inner.grid;
		const o = outer.grid;
		// Punch out the outer cells the inner grid fully covers; the seam
		// overlaps by about one outer cell and sits behind via polygon offset.
		const hole = {
			x0: g.x0 + o.res,
			x1: g.x0 + (g.cols - 1) * g.res - o.res,
			z0: g.z0 + o.res,
			z1: g.z0 + (g.rows - 1) * g.res - o.res,
		};
		const behind = { polygonOffset: true, polygonOffsetFactor: 2, polygonOffsetUnits: 4 };
		const lakeFt = meta.lakeLevel * M_TO_FT;
		this.groundMaterials = {
			photo: [
				new THREE.MeshLambertMaterial({ map: this.loadTexture(inner.imageUrl) }),
				edgeFade(
					new THREE.MeshLambertMaterial({ map: this.loadTexture(outer.imageUrl), ...behind }),
				),
			],
			bare: [
				reliefMaterial(new THREE.MeshLambertMaterial(), lakeFt),
				edgeFade(reliefMaterial(new THREE.MeshLambertMaterial(behind), lakeFt)),
			],
		};
		this.innerMesh = new THREE.Mesh(gridGeometry(g), this.groundMaterials.photo[0]);
		this.outerMesh = new THREE.Mesh(gridGeometry(o, hole), this.groundMaterials.photo[1]);
		this.world.add(this.innerMesh, this.outerMesh);
	}

	private buildWater(): THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial> {
		// The lake is a huge quad west of the shoreline (a straight-line fit
		// across the park, pushed a little inland so the terrain hides its
		// edge). Clipping it there keeps water from showing where land should
		// be beyond the edges of the terrain data.
		const za = -1000;
		const zb = 1000;
		const a = new THREE.Vector2(shoreX(this.terrain, za), za);
		const b = new THREE.Vector2(shoreX(this.terrain, zb), zb);
		const along = b.clone().sub(a).normalize();
		const east = new THREE.Vector2(along.y, -along.x);
		if (east.x < 0) east.negate();
		const origin = a.clone().addScaledVector(east, 250);
		const reach = 30000;
		const corners = [
			origin.clone().addScaledVector(along, -reach),
			origin.clone().addScaledVector(along, reach),
			origin.clone().addScaledVector(along, reach).addScaledVector(east, -reach),
			origin.clone().addScaledVector(along, -reach).addScaledVector(east, -reach),
		];
		const tile = 40; // metres per wave-normal tile
		const geo = new THREE.BufferGeometry();
		geo.setAttribute(
			'position',
			new THREE.Float32BufferAttribute(
				corners.flatMap((c) => [c.x, 0.08, c.y]),
				3,
			),
		);
		geo.setAttribute(
			'normal',
			new THREE.Float32BufferAttribute(
				corners.flatMap(() => [0, 1, 0]),
				3,
			),
		);
		geo.setAttribute(
			'uv',
			new THREE.Float32BufferAttribute(
				corners.flatMap((c) => [c.x / tile, -c.y / tile]),
				2,
			),
		);
		geo.setIndex([0, 1, 2, 0, 2, 3]);
		const mat = new THREE.MeshStandardMaterial({
			color: '#3b6f8c',
			roughness: 0.3,
			metalness: 0.05,
			normalMap: waveNormals(),
			normalScale: new THREE.Vector2(0.25, 0.25),
			envMapIntensity: 0.9,
			side: THREE.DoubleSide,
		});
		// Past the north/south edges of the terrain data there's no land, so
		// near the shore the water would end in a hard straight line against
		// the sky. Fade it into the haze there, like the land edges; the open
		// lake further west keeps its horizon.
		const o = this.terrain.outer.grid;
		mat.onBeforeCompile = (shader) => {
			shader.uniforms.uOrigin = { value: origin };
			shader.uniforms.uEast = { value: east };
			shader.uniforms.uZRange = { value: new THREE.Vector2(o.z0, o.z0 + (o.rows - 1) * o.res) };
			shader.vertexShader = `varying vec3 vWaterPos;\n${shader.vertexShader}`.replace(
				'#include <begin_vertex>',
				'#include <begin_vertex>\nvWaterPos = (modelMatrix * vec4(transformed, 1.0)).xyz;',
			);
			shader.fragmentShader =
				`uniform vec2 uOrigin;\nuniform vec2 uEast;\nuniform vec2 uZRange;\nvarying vec3 vWaterPos;\n${shader.fragmentShader}`.replace(
					'#include <fog_fragment>',
					`#include <fog_fragment>
					float beyond = max(uZRange.x - vWaterPos.z, vWaterPos.z - uZRange.y);
					float outside = smoothstep(-600.0, 0.0, beyond);
					float nearShore = smoothstep(-2500.0, -300.0, dot(vWaterPos.xz - uOrigin, uEast));
					gl_FragColor.rgb = mix(gl_FragColor.rgb, fogColor, outside * nearShore);`,
				);
		};
		const water = new THREE.Mesh(geo, mat);
		water.renderOrder = 1;
		return water;
	}

	private buildTrails(trails: Trail[]): void {
		const geos = trails
			.filter((t) => t.coords.length > 1)
			.map((t) => {
				const pts = t.coords.map(([lat, lon]) => toWorld(this.terrain.meta, lat, lon));
				return ribbonGeometry(resample(pts, 1.5), 1.8, 0.4, this.height, {
					color: new THREE.Color(t.color),
				});
			});
		if (geos.length === 0) return;
		const merged = mergeGeometries(geos);
		for (const g of geos) g.dispose();
		const mesh = new THREE.Mesh(
			merged,
			new THREE.MeshBasicMaterial({
				vertexColors: true,
				side: THREE.DoubleSide,
				polygonOffset: true,
				polygonOffsetFactor: -2,
				polygonOffsetUnits: -4,
			}),
		);
		mesh.renderOrder = 2;
		this.world.add(mesh);
	}

	private buildRoute(route: Route): THREE.Mesh {
		const geo = ribbonGeometry(route.path, 5, 0.9, this.height, { across: 5 });
		const mat = new THREE.MeshBasicMaterial({
			color: ROUTE_AHEAD,
			transparent: true,
			depthWrite: false,
			side: THREE.DoubleSide,
			polygonOffset: true,
			polygonOffsetFactor: -4,
			polygonOffsetUnits: -8,
		});
		mat.onBeforeCompile = (shader) => {
			shader.uniforms.uProgress = this.routeUniforms.uProgress;
			shader.uniforms.uDone = { value: ROUTE_DONE };
			shader.vertexShader =
				`attribute float along;\nattribute float side;\nvarying float vAlong;\nvarying float vSide;\n${shader.vertexShader}`.replace(
					'#include <begin_vertex>',
					'#include <begin_vertex>\nvAlong = along;\nvSide = side;',
				);
			shader.fragmentShader =
				`uniform float uProgress;\nuniform vec3 uDone;\nvarying float vAlong;\nvarying float vSide;\n${shader.fragmentShader}`.replace(
					'vec4 diffuseColor = vec4( diffuse, opacity );',
					`float done = step(vAlong, uProgress);
					vec3 base = mix(diffuse, uDone, done);
					float d = abs(vSide);
					float core = 1.0 - smoothstep(0.36, 0.48, d);
					float glow = (1.0 - smoothstep(0.35, 1.0, d)) * 0.45;
					float a = max(core * mix(0.8, 1.0, done), glow);
					vec4 diffuseColor = vec4(base, a * opacity);`,
				);
		};
		const mesh = new THREE.Mesh(geo, mat);
		mesh.renderOrder = 3;
		return mesh;
	}

	private buildPois(pois: Collectible[]): void {
		const poles: number[] = [];
		for (const poi of pois) {
			const [x, z] = toWorld(this.terrain.meta, poi.lat, poi.lon);
			const ground = this.height(x, z);
			const full = labelTexture(poi, true);
			const badge = labelTexture(poi, false);
			const sprite = new THREE.Sprite(
				new THREE.SpriteMaterial({ sizeAttenuation: false, transparent: true }),
			);
			sprite.center.set(0.5, 0);
			sprite.renderOrder = 10;
			fitSprite(sprite, badge, LABEL_SCALE);
			sprite.position.set(x, ground + 16, z);
			this.scene.add(sprite);
			this.pois.push({ poi, sprite, ground, full, badge, onRoute: false, showingName: false });
			poles.push(x, ground, z, x, ground + 16, z);
		}
		const geo = new THREE.BufferGeometry();
		geo.setAttribute('position', new THREE.Float32BufferAttribute(poles, 3));
		this.world.add(
			new THREE.LineSegments(
				geo,
				new THREE.LineBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.7 }),
			),
		);
	}

	private buildHiker(): void {
		const dot = new THREE.Mesh(
			new THREE.SphereGeometry(2.4, 24, 12),
			new THREE.MeshBasicMaterial({ color: ROUTE_DONE }),
		);
		dot.position.y = 2.4;
		const beam = new THREE.Mesh(
			new THREE.CylinderGeometry(0.6, 0.6, 60, 12, 1, true),
			new THREE.MeshBasicMaterial({
				color: ROUTE_DONE,
				transparent: true,
				opacity: 0.35,
				depthWrite: false,
				blending: THREE.AdditiveBlending,
			}),
		);
		beam.position.y = 30;
		this.hiker.add(dot, beam);
		this.hiker.visible = false;
		this.scene.add(this.hiker);
	}

	// ------------------------------------------------------------ per frame

	private resize(): void {
		const w = this.host.clientWidth || 1;
		const h = this.host.clientHeight || 1;
		this.renderer.setSize(w, h, false);
		this.camera.aspect = w / h;
		this.camera.updateProjectionMatrix();
	}

	private camPath(sigmaM: number): CameraPath {
		const cached = this.camPaths.get(sigmaM);
		if (cached) return cached;
		const p = this.route?.path;
		if (!p) throw new Error('No route');
		const made = { xs: smooth(p.xs, sigmaM / p.step), zs: smooth(p.zs, sigmaM / p.step) };
		this.camPaths.set(sigmaM, made);
		return made;
	}

	/** Ground height in world space (exaggeration applied). */
	private groundY(x: number, z: number): number {
		return this.height(x, z) * this.exaggeration;
	}

	private hikerPosition(out: THREE.Vector3): THREE.Vector3 {
		const r = this.route;
		if (!r) return out.set(0, 0, 0);
		const x = at(r.path.xs, r.path.step, this.s);
		const z = at(r.path.zs, r.path.step, this.s);
		return out.set(x, this.groundY(x, z), z);
	}

	private desired(rig: Rig, hiker: THREE.Vector3, pos: THREE.Vector3, target: THREE.Vector3) {
		const r = this.route;
		if (!r) return;
		const step = r.path.step;
		const cp = this.camPath(rig.sigma);
		const ax = at(cp.xs, step, this.s);
		const az = at(cp.zs, step, this.s);
		const dx = at(cp.xs, step, this.s + 25) - at(cp.xs, step, this.s - 25);
		const dz = at(cp.zs, step, this.s + 25) - at(cp.zs, step, this.s - 25);
		const dl = Math.hypot(dx, dz);
		if (dl > 1) this.heading.set(dx / dl, dz / dl);
		const hx = this.heading.x;
		const hz = this.heading.y;
		const e = this.exaggeration;

		pos.set(ax - hx * rig.back, 0, az - hz * rig.back);
		let camY = Math.max(hiker.y + rig.up * e, this.groundY(pos.x, pos.z) + 6);
		// Lift the camera until its sight line to the hiker clears the ground.
		for (let i = 1; i <= 8; i++) {
			const t = i / 10;
			const x = pos.x + (hiker.x - pos.x) * t;
			const z = pos.z + (hiker.z - pos.z) * t;
			const lineY = camY + (hiker.y - camY) * t;
			const need = this.groundY(x, z) + 4 - lineY;
			if (need > 0) camY += need / (1 - t);
		}
		pos.y = camY;

		const tx = at(cp.xs, step, this.s + rig.ahead);
		const tz = at(cp.zs, step, this.s + rig.ahead);
		const blend = 0.45;
		target.set(
			hiker.x + (tx - hiker.x) * blend,
			hiker.y + (this.groundY(tx, tz) - hiker.y) * blend,
			hiker.z + (tz - hiker.z) * blend,
		);
	}

	private readonly tmpHiker = new THREE.Vector3();
	private readonly tmpPos = new THREE.Vector3();
	private readonly tmpTarget = new THREE.Vector3();

	private tick(): void {
		if (this.disposed) return;
		this.timer.update();
		const dt = Math.min(this.timer.getDelta(), 0.25);
		const r = this.route;
		if (r && this.playing) {
			this.s += this.speed * dt;
			if (this.s >= r.path.length) {
				this.s = r.path.length;
				this.playing = false;
				this.report(true);
			}
		}

		const hiker = this.hikerPosition(this.tmpHiker);
		if (r) {
			this.hiker.position.copy(hiker);
			this.routeUniforms.uProgress.value = this.s;
		}

		if (this.mode === 'free') {
			if (r) {
				// Carry an orbiting camera along with the hiker.
				const delta = this.tmpPos.subVectors(hiker, this.lastHiker);
				if (delta.lengthSq() < 400 * 400) {
					this.camera.position.add(delta);
					this.controls.target.add(delta);
				}
			}
			this.controls.update(dt);
			const floor = this.groundY(this.camera.position.x, this.camera.position.z) + 3;
			if (this.camera.position.y < floor) this.camera.position.y = floor;
			this.camTarget.copy(this.controls.target);
		} else if (r) {
			const rig = RIGS[this.mode];
			this.desired(rig, hiker, this.tmpPos, this.tmpTarget);
			if (this.snap) {
				this.camPos.copy(this.tmpPos);
				this.camTarget.copy(this.tmpTarget);
				this.snap = false;
			} else {
				const tau = this.transition > 0 ? 0.9 : rig.tau;
				const a = 1 - Math.exp(-dt / tau);
				this.camPos.lerp(this.tmpPos, a);
				this.camTarget.lerp(this.tmpTarget, a);
			}
			this.transition = Math.max(0, this.transition - dt);
			this.camera.position.copy(this.camPos);
			this.camera.lookAt(this.camTarget);
		}
		this.lastHiker.copy(hiker);

		this.updateLabels();
		this.sky.position.copy(this.camera.position);
		this.animateWater(dt);
		this.renderer.render(this.scene, this.camera);
		this.report(false);
	}

	private animateWater(dt: number): void {
		const wn = this.water.material.normalMap;
		if (!wn) return;
		wn.offset.x = (wn.offset.x + dt * 0.012) % 1;
		wn.offset.y = (wn.offset.y + dt * 0.007) % 1;
	}

	/** Names only for nearby POIs (farther for ones on the current hike). */
	private updateLabels(): void {
		const cam = this.camera.position;
		for (const m of this.pois) {
			const reach = m.onRoute ? 1100 : this.route ? 450 : 650;
			const show = m.sprite.position.distanceTo(cam) < reach;
			if (show === m.showingName) continue;
			m.showingName = show;
			fitSprite(m.sprite, show ? m.full : m.badge, LABEL_SCALE);
		}
	}

	private report(force: boolean): void {
		const now = performance.now();
		if (!force && now - this.lastReport < 66) return;
		this.lastReport = now;
		this.onFrame(this.s, this.playing);
	}
}
