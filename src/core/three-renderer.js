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
export function renderSurface3d(container, step) {
  const boot = () => {
    if (!container._three || container._three.disposed || !container.contains(container._three.renderer.domElement)) {
      container._three = buildScene(container, step.state);
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
