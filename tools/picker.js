/* Standalone segment picker — select segments in order, or split any segment
   at any point into two. Export the ordered route for baking into a hike. */
(() => {
	const map = L.map('map');
	L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
		maxZoom: 19,
		attribution: '&copy; OpenStreetMap',
	}).addTo(map);
	map.fitBounds(L.latLngBounds(window.PARK.bounds), { padding: [20, 20] });

	// planar metres for projection / distance (small area)
	const rad = Math.PI / 180;
	const lat0 = (window.PARK.bounds[0][0] + window.PARK.bounds[1][0]) / 2;
	const kx = Math.cos(lat0 * rad) * 111320;
	const ky = 110540;
	const XY = ([lat, lon]) => [lon * kx, lat * ky];
	const metres = (a, b) => { const [ax, ay] = XY(a), [bx, by] = XY(b); return Math.hypot(ax - bx, ay - by); };
	const segLen = (c) => { let m = 0; for (let i = 1; i < c.length; i++) m += metres(c[i - 1], c[i]); return m; };

	// mutable segment set (splittable)
	let nextId = 0;
	const segs = window.PARK.trails.map((t) => ({ id: `s${nextId++}`, name: t.name, coords: t.coords }));
	const layerById = new Map();
	let selected = []; // ordered seg ids
	let mode = 'select';
	const badges = [];
	const bridgeLayers = [];

	window.setMode = (m) => {
		mode = m;
		document.getElementById('mSelect').classList.toggle('on', m === 'select');
		document.getElementById('mSplit').classList.toggle('on', m === 'split');
		document.getElementById('map').classList.toggle('splitting', m === 'split');
	};

	const isSel = (id) => selected.includes(id);
	function styleSeg(seg) {
		const l = layerById.get(seg.id);
		if (!l) return;
		l.vis.setStyle(
			isSel(seg.id)
				? { color: '#d6006e', weight: 6, opacity: 1 }
				: { color: '#3388ff', weight: 3, opacity: 0.6 },
		);
	}

	function drawSeg(seg) {
		const hit = L.polyline(seg.coords, { color: '#000', weight: 16, opacity: 0 }).addTo(map);
		const vis = L.polyline(seg.coords, { color: '#3388ff', weight: 3, opacity: 0.6 }).addTo(map);
		vis.bindTooltip(seg.name, { sticky: true });
		const onClick = (e) => (mode === 'split' ? splitSeg(seg.id, e.latlng) : toggle(seg.id));
		const over = () => !isSel(seg.id) && vis.setStyle({ weight: 6, opacity: 1, color: '#0aa' });
		const out = () => styleSeg(seg);
		hit.on('click', onClick).on('mouseover', over).on('mouseout', out);
		vis.on('click', onClick).on('mouseover', over).on('mouseout', out);
		layerById.set(seg.id, { hit, vis });
	}
	function removeSegLayer(id) {
		const l = layerById.get(id);
		if (l) { map.removeLayer(l.hit); map.removeLayer(l.vis); }
		layerById.delete(id);
	}

	function toggle(id) {
		const p = selected.indexOf(id);
		if (p >= 0) selected.splice(p, 1);
		else selected.push(id);
		render();
	}

	// split a segment at the point on it nearest the click
	function splitSeg(id, latlng) {
		const seg = segs.find((s) => s.id === id);
		if (!seg) return;
		const p = [latlng.lat, latlng.lng];
		let best = { d: Infinity, k: 0, pt: null };
		for (let i = 0; i < seg.coords.length - 1; i++) {
			const a = seg.coords[i], b = seg.coords[i + 1];
			const [Px, Py] = XY(p), [Ax, Ay] = XY(a), [Bx, By] = XY(b);
			const abx = Bx - Ax, aby = By - Ay;
			const t = Math.max(0, Math.min(1, ((Px - Ax) * abx + (Py - Ay) * aby) / (abx * abx + aby * aby || 1)));
			const cx = Ax + abx * t, cy = Ay + aby * t;
			const d = Math.hypot(Px - cx, Py - cy);
			if (d < best.d) best = { d, k: i, pt: [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t] };
		}
		const a = seg.coords.slice(0, best.k + 1).concat([best.pt]);
		const b = [best.pt].concat(seg.coords.slice(best.k + 1));
		if (a.length < 2 || b.length < 2) return;
		const idx = segs.indexOf(seg);
		const s1 = { id: `s${nextId++}`, name: seg.name, coords: a };
		const s2 = { id: `s${nextId++}`, name: seg.name, coords: b };
		segs.splice(idx, 1, s1, s2);
		const sp = selected.indexOf(id);
		if (sp >= 0) selected.splice(sp, 1);
		removeSegLayer(id);
		drawSeg(s1);
		drawSeg(s2);
		render();
	}

	window.undo = () => { selected.pop(); render(); };
	window.clearAll = () => { selected = []; render(); };
	window.rm = (id) => { const p = selected.indexOf(id); if (p >= 0) selected.splice(p, 1); render(); };

	// Build the route: bridge each consecutive pair by their two NEAREST
	// endpoints (the shortest possible connector), and orient segments so the
	// exported polyline is continuous.
	function buildRoute() {
		const cs = selected
			.map((id) => segs.find((s) => s.id === id))
			.filter(Boolean)
			.map((s) => s.coords.slice());
		const n = cs.length;
		if (!n) return { poly: [], gaps: [], bridges: [] };

		// nearest endpoint pair between two coord arrays -> {ai, bi, d}
		const nearestPair = (A, B) => {
			const ae = [A[0], A[A.length - 1]], be = [B[0], B[B.length - 1]];
			let best = { ai: 0, bi: 0, d: Infinity };
			for (let ai = 0; ai < 2; ai++)
				for (let bi = 0; bi < 2; bi++) {
					const d = metres(ae[ai], be[bi]);
					if (d < best.d) best = { ai, bi, d };
				}
			return best;
		};
		const np = [];
		for (let i = 0; i < n - 1; i++) np.push(nearestPair(cs[i], cs[i + 1]));

		// bridges = the nearest-endpoint connector for each consecutive pair
		const gaps = [0];
		const bridges = [];
		for (let i = 0; i < n - 1; i++) {
			const A = cs[i], B = cs[i + 1];
			const p = np[i].ai === 0 ? A[0] : A[A.length - 1];
			const q = np[i].bi === 0 ? B[0] : B[B.length - 1];
			gaps.push(Math.round(np[i].d));
			if (np[i].d > 2) bridges.push({ p, q, d: np[i].d });
		}

		// orient each segment to enter at the endpoint connecting to the previous
		// pick and exit toward the next (first starts away from the second)
		const oriented = cs.map((c, i) => {
			let entryIdx;
			if (i > 0) entryIdx = np[i - 1].bi;
			else if (n > 1) entryIdx = 1 - np[0].ai;
			else entryIdx = 0;
			return entryIdx === 1 ? c.slice().reverse() : c.slice();
		});
		let poly = oriented[0].slice();
		for (let i = 1; i < n; i++) poly = poly.concat(oriented[i]);
		return { poly, gaps, bridges };
	}

	function render() {
		for (const seg of segs) styleSeg(seg);
		for (const b of badges) map.removeLayer(b);
		badges.length = 0;
		for (const b of bridgeLayers) map.removeLayer(b);
		bridgeLayers.length = 0;

		const { gaps, bridges } = buildRoute();
		// Fill each gap between consecutive picks with the SHORTEST connector.
		// Small gaps close seamlessly; large ones show red-dashed with distance.
		for (const br of bridges) {
			const big = br.d >= 60;
			const line = L.polyline([br.p, br.q], big
				? { color: '#e00000', weight: 3, opacity: 0.95, dashArray: '5,7' }
				: { color: '#d6006e', weight: 6, opacity: 0.9 }).addTo(map);
			if (big) line.bindTooltip(`${Math.round(br.d)} m`, { permanent: true, direction: 'center' });
			bridgeLayers.push(line);
		}

		selected.forEach((id, k) => {
			const seg = segs.find((s) => s.id === id);
			if (!seg) return;
			const mid = seg.coords[Math.floor(seg.coords.length / 2)];
			badges.push(L.marker(mid, {
				icon: L.divIcon({
					className: '',
					html: `<div style="background:#d6006e;color:#fff;width:22px;height:22px;border-radius:50%;display:grid;place-items:center;font:bold 12px sans-serif;border:2px solid #fff">${k + 1}</div>`,
					iconSize: [22, 22], iconAnchor: [11, 11],
				}),
			}).addTo(map));
		});

		let totalM = 0;
		selected.forEach((id) => { const s = segs.find((x) => x.id === id); if (s) totalM += segLen(s.coords); });
		document.getElementById('meta').textContent = `${selected.length} segments · ${(totalM / 1609.344).toFixed(2)} mi`;
		document.getElementById('list').innerHTML = selected
			.map((id, k) => {
				const s = segs.find((x) => x.id === id);
				if (!s) return '';
				const g = gaps[k] > 25 ? `<span class="g">${gaps[k]}m gap</span>` : '';
				return `<div class="row"><span class="n">${k + 1}</span><span class="nm" title="${s.name}">${s.name}</span>${g}<button onclick="rm('${id}')">×</button></div>`;
			})
			.join('');
		const out = document.getElementById('out');
		if (out.style.display === 'block') doExport();
	}

	window.doExport = () => {
		const { poly } = buildRoute();
		const names = [];
		selected.forEach((id) => { const s = segs.find((x) => x.id === id); if (s && names[names.length - 1] !== s.name) names.push(s.name); });
		const out = document.getElementById('out');
		out.style.display = 'block';
		out.value = JSON.stringify({ names, coords: poly });
		out.select();
		try { navigator.clipboard.writeText(out.value); } catch (_) {}
	};

	for (const seg of segs) drawSeg(seg);
	render();

	// tiny hook for automated verification
	window.__picker = {
		count: () => segs.length,
		splitMid: (i) => {
			const s = segs[i];
			const m = s.coords[Math.floor(s.coords.length / 2)];
			splitSeg(s.id, { lat: m[0], lng: m[1] });
		},
		select: (i) => toggle(segs[i].id),
	};
})();
