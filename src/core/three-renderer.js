// True-3D surface renderer on vendored Three.js (vendor/three.module.min.js).
// Loaded LAZILY: pages without a 3D topic never fetch the library. The scene
// persists across steps so paths grow and markers glide instead of snapping,
// and a slow auto-orbit keeps the surface readable without any mouse work.

let THREE = null;
let threeLoading = null;
const loadThree = () => {
  threeLoading ??= import('../../vendor/three.module.min.js').then((m) => { THREE = m; });
  return threeLoading;
};

const COLORS = {
  bg: 0x0d1220,
  surfaceLow: { r: 0.16, g: 0.38, b: 0.85 },   // valley blue
  surfaceHigh: { r: 0.92, g: 0.34, b: 0.25 },  // ridge red
  path: [0xffd166, 0x9bf6ff, 0xffadad, 0xcaffbf],
  marker: 0xffffff,
  highlight: 0x7ef9a2,
};

function surfaceGeometry(state) {
  const rows = state.heights.length;
  const cols = state.heights[0].length;
  const { x, y } = state.axes;
  let zMin = Infinity;
  let zMax = -Infinity;
  for (const row of state.heights) for (const v of row) { zMin = Math.min(zMin, v); zMax = Math.max(zMax, v); }
  const zSpan = zMax - zMin || 1;
  const geo = new THREE.PlaneGeometry(1, 1, cols - 1, rows - 1);
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const i = r * cols + c;
      const z01 = (state.heights[r][c] - zMin) / zSpan;
      pos.setXYZ(i, c / (cols - 1) - 0.5, z01 * 0.45, r / (rows - 1) - 0.5);
      const lo = COLORS.surfaceLow;
      const hi = COLORS.surfaceHigh;
      colors[i * 3] = lo.r + (hi.r - lo.r) * z01;
      colors[i * 3 + 1] = lo.g + (hi.g - lo.g) * z01;
      colors[i * 3 + 2] = lo.b + (hi.b - lo.b) * z01;
    }
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  const toScene = (px, py, pz) => new THREE.Vector3(
    (px - x.min) / (x.max - x.min) - 0.5,
    ((pz - zMin) / zSpan) * 0.45 + 0.012,
    (py - y.min) / (y.max - y.min) - 0.5,
  );
  return { geo, toScene, zMin, zSpan };
}

function buildScene(container, state) {
  const W = container.clientWidth || 560;
  const H = 380;
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(W, H);
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  container.textContent = '';
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(COLORS.bg);
  const camera = new THREE.PerspectiveCamera(42, W / H, 0.01, 50);
  scene.add(new THREE.AmbientLight(0xffffff, 0.55));
  const sun = new THREE.DirectionalLight(0xffffff, 1.4);
  sun.position.set(1.5, 2.2, 1.0);
  scene.add(sun);

  const { geo, toScene } = surfaceGeometry(state);
  const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
    vertexColors: true, roughness: 0.62, metalness: 0.12, side: THREE.DoubleSide,
  }));
  scene.add(mesh);
  const wire = new THREE.LineSegments(
    new THREE.WireframeGeometry(geo),
    new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.07 }),
  );
  scene.add(wire);

  const ctx = {
    renderer, scene, camera, toScene,
    pathObjects: new Map(), markerObjects: new Map(),
    angle: 0.9, frame: null, disposed: false,
  };
  const orbit = () => {
    if (ctx.disposed || !renderer.domElement.isConnected) {
      cancelAnimationFrame(ctx.frame);
      renderer.dispose();
      ctx.disposed = true;
      return;
    }
    ctx.angle += 0.0035; // slow tour — readable, education-first
    camera.position.set(Math.cos(ctx.angle) * 1.25, 0.78, Math.sin(ctx.angle) * 1.25);
    camera.lookAt(0, 0.1, 0);
    renderer.render(scene, camera);
    ctx.frame = requestAnimationFrame(orbit);
  };
  orbit();
  return ctx;
}

function syncStep(ctx, step) {
  const state = step.state;
  const lit = new Set(Object.values(step.highlight ?? {}).flat());

  const wantedPaths = new Set(state.paths.map((p) => p.id));
  for (const [id, obj] of ctx.pathObjects) {
    if (!wantedPaths.has(id)) { ctx.scene.remove(obj); ctx.pathObjects.delete(id); }
  }
  state.paths.forEach((p, i) => {
    const pts = p.points.map((q) => ctx.toScene(q.x, q.y, q.z));
    const old = ctx.pathObjects.get(p.id);
    if (old) { ctx.scene.remove(old); }
    if (pts.length < 2) return;
    const curve = new THREE.CatmullRomCurve3(pts);
    const tube = new THREE.Mesh(
      new THREE.TubeGeometry(curve, Math.max(16, pts.length * 4), lit.has(p.id) ? 0.011 : 0.007, 8),
      new THREE.MeshStandardMaterial({
        color: COLORS.path[i % COLORS.path.length],
        emissive: lit.has(p.id) ? COLORS.highlight : 0x000000,
        emissiveIntensity: lit.has(p.id) ? 0.45 : 0,
        roughness: 0.4,
      }),
    );
    ctx.scene.add(tube);
    ctx.pathObjects.set(p.id, tube);
  });

  const wantedMarkers = new Set(state.markers.map((m) => m.id));
  for (const [id, obj] of ctx.markerObjects) {
    if (!wantedMarkers.has(id)) { ctx.scene.remove(obj); ctx.markerObjects.delete(id); }
  }
  for (const m of state.markers) {
    let sphere = ctx.markerObjects.get(m.id);
    if (!sphere) {
      sphere = new THREE.Mesh(
        new THREE.SphereGeometry(0.02, 20, 20),
        new THREE.MeshStandardMaterial({ color: COLORS.marker, roughness: 0.3 }),
      );
      ctx.scene.add(sphere);
      ctx.markerObjects.set(m.id, sphere);
    }
    sphere.position.copy(ctx.toScene(m.x, m.y, m.z));
    const isLit = lit.has(m.id);
    sphere.material.emissive = new THREE.Color(isLit ? COLORS.highlight : 0x222222);
    sphere.material.emissiveIntensity = isLit ? 0.9 : 0.25;
    sphere.scale.setScalar(isLit ? 1.6 : 1);
  }
}

// Sync facade for the RENDERERS map: first call boots Three lazily (with a
// small placeholder), later calls reuse the live scene so steps animate.
const heightsKey = (heights) => `${heights.length}x${heights[0].length}:${heights.flat().reduce((a, v) => a + v, 0).toFixed(4)}`;

export function renderSurface3d(container, step) {
  const boot = () => {
    const key = heightsKey(step.state.heights);
    if (!container._three || container._three.disposed || container._three.terrainKey !== key
      || !container.contains(container._three.renderer.domElement)) {
      if (container._three && !container._three.disposed) container._three.disposed = true;
      container._three = buildScene(container, step.state);
      container._three.terrainKey = key;
    }
    syncStep(container._three, step);
  };
  if (THREE) { boot(); return; }
  if (!container.querySelector('[data-three-loading]')) {
    const note = document.createElement('p');
    note.dataset.threeLoading = '1';
    note.textContent = 'Warming up the 3D engine…';
    container.textContent = '';
    container.appendChild(note);
  }
  loadThree().then(() => boot());
}

// ---------------------------------------------------------- point clouds

const CLUSTER_COLORS = [0x6ea8ff, 0xffd166, 0xff8fa3, 0x9bf6ff, 0xcaffbf, 0xbdb2ff];

function buildPointsScene(container) {
  const W = container.clientWidth || 560;
  const H = 380;
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(W, H);
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  container.textContent = '';
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(COLORS.bg);
  const camera = new THREE.PerspectiveCamera(42, W / H, 0.01, 50);
  scene.add(new THREE.AmbientLight(0xffffff, 0.7));
  const sun = new THREE.DirectionalLight(0xffffff, 1.1);
  sun.position.set(1.5, 2.2, 1.0);
  scene.add(sun);
  const floor = new THREE.GridHelper(1.3, 13, 0x2a3550, 0x1a2238);
  floor.position.y = -0.45;
  scene.add(floor);

  const ctx = {
    renderer, scene, camera, kind: 'points3d',
    pointObjects: new Map(), vectorObjects: new Map(), clusterIndex: new Map(),
    angle: 0.6, frame: null, disposed: false,
  };
  const orbit = () => {
    if (ctx.disposed || !renderer.domElement.isConnected) {
      cancelAnimationFrame(ctx.frame);
      renderer.dispose();
      ctx.disposed = true;
      return;
    }
    ctx.angle += 0.0035;
    camera.position.set(Math.cos(ctx.angle) * 1.45, 0.62, Math.sin(ctx.angle) * 1.45);
    camera.lookAt(0, 0, 0);
    renderer.render(scene, camera);
    ctx.frame = requestAnimationFrame(orbit);
  };
  orbit();
  return ctx;
}

function pointsToScene(state) {
  const { x, y, z } = state.axes;
  const zr = z && z.max !== undefined ? z : x;
  return (px, py, pz) => new THREE.Vector3(
    (px - x.min) / (x.max - x.min) - 0.5,
    ((pz - (zr.min ?? 0)) / ((zr.max ?? 1) - (zr.min ?? 0))) * 0.9 - 0.45,
    (py - y.min) / (y.max - y.min) - 0.5,
  );
}

function syncPoints(ctx, step) {
  const state = step.state;
  const lit = new Set(Object.values(step.highlight ?? {}).flat());
  const toScene = pointsToScene(state);

  const wanted = new Set(state.points.map((q) => q.id));
  for (const [id, obj] of ctx.pointObjects) {
    if (!wanted.has(id)) { ctx.scene.remove(obj); ctx.pointObjects.delete(id); }
  }
  for (const q of state.points) {
    if (q.cluster !== undefined && !ctx.clusterIndex.has(q.cluster)) {
      ctx.clusterIndex.set(q.cluster, ctx.clusterIndex.size);
    }
    const color = q.cluster !== undefined
      ? CLUSTER_COLORS[ctx.clusterIndex.get(q.cluster) % CLUSTER_COLORS.length]
      : COLORS.marker;
    let sphere = ctx.pointObjects.get(q.id);
    if (!sphere) {
      sphere = new THREE.Mesh(
        new THREE.SphereGeometry(0.018, 18, 18),
        new THREE.MeshStandardMaterial({ color, roughness: 0.35 }),
      );
      ctx.scene.add(sphere);
      ctx.pointObjects.set(q.id, sphere);
    }
    sphere.material.color = new THREE.Color(color);
    sphere.position.copy(toScene(q.x, q.y, q.z));
    const isLit = lit.has(q.id);
    sphere.material.emissive = new THREE.Color(isLit ? COLORS.highlight : color);
    sphere.material.emissiveIntensity = isLit ? 0.85 : 0.18;
    sphere.scale.setScalar(isLit ? 1.7 : 1);
  }

  const wantedVecs = new Set(state.vectors.map((v) => v.id));
  for (const [id, obj] of ctx.vectorObjects) {
    if (!wantedVecs.has(id)) { ctx.scene.remove(obj); ctx.vectorObjects.delete(id); }
  }
  for (const v of state.vectors) {
    const old = ctx.vectorObjects.get(v.id);
    if (old) ctx.scene.remove(old);
    const from = toScene(v.from.x, v.from.y, v.from.z);
    const to = toScene(v.to.x, v.to.y, v.to.z);
    const dir = to.clone().sub(from);
    const arrow = new THREE.ArrowHelper(
      dir.clone().normalize(), from, dir.length(),
      lit.has(v.id) ? COLORS.highlight : 0xffffff, 0.035, 0.02,
    );
    ctx.scene.add(arrow);
    ctx.vectorObjects.set(v.id, arrow);
  }
}

export function renderPoints3d(container, step) {
  const boot = () => {
    if (!container._three || container._three.disposed || container._three.kind !== 'points3d'
      || !container.contains(container._three.renderer.domElement)) {
      container._three = buildPointsScene(container);
    }
    syncPoints(container._three, step);
  };
  if (THREE) { boot(); return; }
  if (!container.querySelector('[data-three-loading]')) {
    const note = document.createElement('p');
    note.dataset.threeLoading = '1';
    note.textContent = 'Warming up the 3D engine…';
    container.textContent = '';
    container.appendChild(note);
  }
  loadThree().then(() => boot());
}
