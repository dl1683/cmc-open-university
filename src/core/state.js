// Shared input parsing, state snapshots, and the step contract.
// Pure module: no DOM access, so visualizations can share validation logic.
//
// Every topic is a generator that yields step objects:
//   { state, highlight, explanation, invariant? }
// `state` is a fresh snapshot (never a live reference), `highlight` maps
// semantic keys to ids that must exist in the state, and `explanation` is
// the plain-English sentence shown next to the animation.

export class InputError extends Error {}

export const STATE_KINDS = [
  'array',
  'stack',
  'queue',
  'linked-list',
  'hash-table',
  'tree',
  'call-tree',
  'matrix',
  'plot',
  'scatter',
  'graph',
  'surface3d',
  'points3d',
];

export const HIGHLIGHT_KEYS = [
  'active',
  'compare',
  'swap',
  'sorted',
  'range',
  'found',
  'visited',
  'removed',
  'pivot',
  'collision',
  'returning',
];

// ---------------------------------------------------------------- parsing

export function parseNumberList(text, { min = 2, max = 12, label = 'numbers' } = {}) {
  const parts = String(text ?? '').trim().split(/[,\s]+/).filter(Boolean);
  if (parts.length < min) {
    throw new InputError(`Enter at least ${min} ${label}, separated by commas.`);
  }
  if (parts.length > max) {
    throw new InputError(`Enter at most ${max} ${label} so every step stays readable.`);
  }
  return parts.map((part) => {
    const value = Number(part);
    if (!Number.isFinite(value)) {
      throw new InputError(`"${part}" is not a number.`);
    }
    return value;
  });
}

export function parseNumber(text, { label = 'a value' } = {}) {
  const trimmed = String(text ?? '').trim();
  const value = Number(trimmed);
  if (trimmed === '' || !Number.isFinite(value)) {
    throw new InputError(`Enter ${label} (a single number).`);
  }
  return value;
}

export function parseIntegerInRange(text, { min, max, label = 'value' } = {}) {
  const value = parseNumber(text, { label: `${label}` });
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new InputError(`${label} must be a whole number between ${min} and ${max}.`);
  }
  return value;
}

export function parseWordList(text, { min = 2, max = 6, label = 'words' } = {}) {
  const words = String(text ?? '').trim().split(/\s+/).filter(Boolean);
  if (words.length < min) {
    throw new InputError(`Enter at least ${min} ${label}.`);
  }
  if (words.length > max) {
    throw new InputError(`Enter at most ${max} ${label} so the matrices stay readable.`);
  }
  return words;
}

// ------------------------------------------------------ state snapshots
// Builders always return fresh objects so later mutation by the algorithm
// can never corrupt an already-yielded step.

export function arrayState(values, meta = {}) {
  return {
    kind: 'array',
    items: values.map((value, index) => ({ id: `i${index}`, value })),
    meta: { ...meta },
  };
}

// kind: 'stack' (top first), 'queue' (front first), 'linked-list' (head first)
export function sequenceState(kind, nodes, meta = {}) {
  return {
    kind,
    items: nodes.map((node) => ({ id: node.id, value: node.value })),
    meta: { ...meta },
  };
}

export function hashTableState(buckets, meta = {}) {
  return {
    kind: 'hash-table',
    buckets: buckets.map((entry, index) => ({
      id: `b${index}`,
      index,
      key: entry ? entry.key : null,
      empty: !entry,
    })),
    meta: { ...meta },
  };
}

// nodes: iterable of {id, value, left, right} where left/right are ids or null.
export function treeState(nodes, rootId, meta = {}) {
  return {
    kind: 'tree',
    nodes: [...nodes].map((node) => ({
      id: node.id,
      value: node.value,
      left: node.left ?? null,
      right: node.right ?? null,
    })),
    rootId: rootId ?? null,
    meta: { ...meta },
  };
}

// frames: iterable of {id, parentId, name, args, status, result}
// status: 'active' (running now) | 'waiting' (paused on child calls) | 'returned'
export function callTreeState(frames, meta = {}) {
  return {
    kind: 'call-tree',
    frames: [...frames].map((frame) => ({
      id: frame.id,
      parentId: frame.parentId ?? null,
      name: frame.name,
      args: String(frame.args),
      status: frame.status,
      result: frame.result ?? null,
    })),
    meta: { ...meta },
  };
}

// rows/columns: [{id, label}]; values: 2D number array indexed [row][column].
export function matrixState({ title = '', rows, columns, values, format = defaultFormat }, meta = {}) {
  const flat = values.flat();
  const lo = Math.min(...flat);
  const hi = Math.max(...flat);
  const span = hi - lo || 1;
  return {
    kind: 'matrix',
    title,
    rows: rows.map((row) => ({ ...row })),
    columns: columns.map((column) => ({ ...column })),
    cells: values.flatMap((rowValues, r) =>
      rowValues.map((value, c) => ({
        id: `${rows[r].id}:${columns[c].id}`,
        row: rows[r].id,
        column: columns[c].id,
        value,
        label: format(value),
        intensity: (value - lo) / span,
      })),
    ),
    meta: { ...meta },
  };
}

function defaultFormat(value) {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

// Computes axis ranges from the data when none are given, with 6% padding.
function fitAxes(axes, xs, ys) {
  const pad = (lo, hi) => {
    const span = hi - lo || 1;
    return { min: lo - span * 0.06, max: hi + span * 0.06 };
  };
  return {
    x: { label: axes?.x?.label ?? '', ...pad(Math.min(...xs), Math.max(...xs)), ...axes?.x },
    y: { label: axes?.y?.label ?? '', ...pad(Math.min(...ys), Math.max(...ys)), ...axes?.y },
  };
}

// series: [{id, label, points: [{x, y}]}]; markers: [{id, x, y, label}];
// vectors: [{id, from: {x, y}, to: {x, y}, label}]
export function plotState({ axes, series = [], markers = [], vectors = [] }, meta = {}) {
  const xs = [
    ...series.flatMap((s) => s.points.map((p) => p.x)),
    ...markers.map((m) => m.x),
    ...vectors.flatMap((v) => [v.from.x, v.to.x]),
  ];
  const ys = [
    ...series.flatMap((s) => s.points.map((p) => p.y)),
    ...markers.map((m) => m.y),
    ...vectors.flatMap((v) => [v.from.y, v.to.y]),
  ];
  return {
    kind: 'plot',
    axes: fitAxes(axes, xs, ys),
    series: series.map((s) => ({ id: s.id, label: s.label ?? '', points: s.points.map((p) => ({ ...p })) })),
    markers: markers.map((m) => ({ ...m })),
    vectors: vectors.map((v) => ({ id: v.id, label: v.label ?? '', from: { ...v.from }, to: { ...v.to } })),
    meta: { ...meta },
  };
}

// nodes: [{id, label, x, y, note}] with x/y on a roughly 0–10 canvas;
// edges: [{id, from, to, weight}] (undirected). `note` renders under the
// node — e.g. a running distance in Dijkstra.
export function graphState({ nodes, edges }, meta = {}) {
  return {
    kind: 'graph',
    nodes: nodes.map((n) => ({ ...n, note: n.note ?? '' })),
    edges: edges.map((e) => ({ ...e })),
    meta: { ...meta },
  };
}

// points: [{id, x, y, clusterId}]; centroids: [{id, x, y, label}]
export function scatterState({ axes, points = [], centroids = [] }, meta = {}) {
  const xs = [...points.map((p) => p.x), ...centroids.map((c) => c.x)];
  const ys = [...points.map((p) => p.y), ...centroids.map((c) => c.y)];
  return {
    kind: 'scatter',
    axes: fitAxes(axes, xs, ys),
    points: points.map((p) => ({ ...p, clusterId: p.clusterId ?? null })),
    centroids: centroids.map((c) => ({ ...c })),
    meta: { ...meta },
  };
}


// True-3D surface (rendered with vendored Three.js when available).
// heights: 2D array of z-values over a regular grid spanning the axes.
// paths: [{id, label, points: [{x, y, z}]}] — trajectories draped on the
// surface. markers: [{id, x, y, z, label}].
export function surface3dState({ axes, heights, paths = [], markers = [] }, meta = {}) {
  return {
    kind: 'surface3d',
    axes: {
      x: { ...axes.x },
      y: { ...axes.y },
      z: { ...(axes.z ?? {}) },
    },
    heights: heights.map((row) => [...row]),
    paths: paths.map((p) => ({ id: p.id, label: p.label ?? '', points: p.points.map((q) => ({ ...q })) })),
    markers: markers.map((m) => ({ ...m })),
    meta: { ...meta },
  };
}


// True-3D point cloud (embedding spaces, clusters). points carry an optional
// cluster for coloring; vectors draw arrows between 3D positions.
export function points3dState({ axes, points = [], vectors = [] }, meta = {}) {
  return {
    kind: 'points3d',
    axes: { x: { ...axes.x }, y: { ...axes.y }, z: { ...(axes.z ?? {}) } },
    points: points.map((q) => ({ ...q })),
    vectors: vectors.map((v) => ({ id: v.id, label: v.label ?? '', from: { ...v.from }, to: { ...v.to } })),
    meta: { ...meta },
  };
}

// ------------------------------------------------------- step contract

export function collectStateIds(state) {
  switch (state.kind) {
    case 'array':
    case 'stack':
    case 'queue':
    case 'linked-list':
      return state.items.map((item) => item.id);
    case 'hash-table':
      return state.buckets.map((bucket) => bucket.id);
    case 'tree':
      return state.nodes.map((node) => node.id);
    case 'call-tree':
      return state.frames.map((frame) => frame.id);
    case 'matrix':
      return [
        ...state.rows.map((row) => row.id),
        ...state.columns.map((column) => column.id),
        ...state.cells.map((cell) => cell.id),
      ];
    case 'plot':
      return [
        ...state.series.map((s) => s.id),
        ...state.markers.map((m) => m.id),
        ...state.vectors.map((v) => v.id),
      ];
    case 'scatter':
      return [
        ...state.points.map((p) => p.id),
        ...state.centroids.map((c) => c.id),
      ];
    case 'graph':
      return [
        ...state.nodes.map((n) => n.id),
        ...state.edges.map((e) => e.id),
      ];
    case 'surface3d':
      return [
        ...state.paths.map((p) => p.id),
        ...state.markers.map((m) => m.id),
      ];
    case 'points3d':
      return [
        ...state.points.map((q) => q.id),
        ...state.vectors.map((v) => v.id),
      ];
    default:
      return [];
  }
}

const MAX_STEPS = 5000; // backstop against runaway generators (the old merge-sort bug class)

export function collectSteps(generator, topicId = 'topic') {
  const steps = [];
  for (const step of generator) {
    steps.push(step);
    if (steps.length > MAX_STEPS) {
      throw new Error(`${topicId}: exceeded ${MAX_STEPS} steps — generator is probably not terminating`);
    }
  }
  return steps;
}

export function validateSteps(steps, topicId = 'topic') {
  if (!Array.isArray(steps) || steps.length === 0) {
    throw new Error(`${topicId}: produced no steps`);
  }
  steps.forEach((step, index) => {
    const where = `${topicId} step ${index}`;
    if (!step || typeof step !== 'object') {
      throw new Error(`${where}: step is not an object`);
    }
    if (typeof step.explanation !== 'string' || step.explanation.trim() === '') {
      throw new Error(`${where}: every step needs a non-empty explanation`);
    }
    if (!step.state || !STATE_KINDS.includes(step.state.kind)) {
      throw new Error(`${where}: invalid state.kind "${step.state && step.state.kind}"`);
    }
    const ids = new Set(collectStateIds(step.state));
    for (const [key, list] of Object.entries(step.highlight ?? {})) {
      if (!HIGHLIGHT_KEYS.includes(key)) {
        throw new Error(`${where}: unknown highlight key "${key}"`);
      }
      for (const id of list) {
        if (!ids.has(id)) {
          throw new Error(`${where}: highlight id "${id}" does not exist in the state`);
        }
      }
    }
  });
  return steps;
}
