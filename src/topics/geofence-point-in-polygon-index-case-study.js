// Geofence point-in-polygon: use a spatial index to find candidate fences,
// then run exact polygon predicates with boundary policy and holes.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'geofence-point-in-polygon-index-case-study',
  title: 'Geofence Point-in-Polygon Index Case Study',
  category: 'Systems',
  summary: 'A geofence case study: R-tree or cell prefilters, bounding-box candidates, point-in-polygon checks, holes, boundary policy, invalid geometry, and event dedupe.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['candidate filter', 'boundary policy'], defaultValue: 'candidate filter' },
  ],
  run,
};

function labelMatrix(title, rows, columns, labelsByRow) {
  const labels = [''];
  const codes = new Map([['', 0]]);
  const code = (label) => {
    if (!codes.has(label)) {
      codes.set(label, labels.length);
      labels.push(label);
    }
    return codes.get(label);
  };
  return matrixState({ title, rows, columns, values: labelsByRow.map((row) => row.map(code)), format: (value) => labels[value] });
}

function fenceGraph(title) {
  return graphState({
    nodes: [
      { id: 'gps', label: 'GPS', x: 0.8, y: 3.4, note: 'point' },
      { id: 'cell', label: 'cell', x: 2.4, y: 2.0, note: 'coarse' },
      { id: 'rtree', label: 'Rtree', x: 2.4, y: 4.8, note: 'bbox' },
      { id: 'cand', label: 'cand', x: 4.5, y: 3.4, note: 'maybe' },
      { id: 'pip', label: 'PIP', x: 6.3, y: 3.4, note: 'exact' },
      { id: 'state', label: 'state', x: 8.2, y: 2.0, note: 'inside?' },
      { id: 'event', label: 'event', x: 8.2, y: 4.8, note: 'enter/exit' },
    ],
    edges: [
      { id: 'e-gps-cell', from: 'gps', to: 'cell' },
      { id: 'e-gps-rtree', from: 'gps', to: 'rtree' },
      { id: 'e-cell-cand', from: 'cell', to: 'cand' },
      { id: 'e-rtree-cand', from: 'rtree', to: 'cand' },
      { id: 'e-cand-pip', from: 'cand', to: 'pip' },
      { id: 'e-pip-state', from: 'pip', to: 'state' },
      { id: 'e-state-event', from: 'state', to: 'event' },
    ],
  }, { title });
}

function* candidateFilter() {
  yield {
    state: fenceGraph('Geofence lookup starts with coarse candidates'),
    highlight: { active: ['gps', 'cell', 'rtree', 'cand', 'e-gps-cell', 'e-gps-rtree', 'e-cell-cand', 'e-rtree-cand'], compare: ['pip'] },
    explanation: 'A GPS point should not be tested against every polygon. Use a geospatial cell index or R-tree bounding-box index to find candidate fences first.',
  };
  yield {
    state: labelMatrix(
      'Candidate table',
      [
        { id: 'a', label: 'fence A' },
        { id: 'b', label: 'fence B' },
        { id: 'c', label: 'fence C' },
        { id: 'd', label: 'fence D' },
      ],
      [
        { id: 'bbox', label: 'bbox' },
        { id: 'pip', label: 'PIP' },
      ],
      [
        ['hit', 'inside'],
        ['hit', 'outside'],
        ['miss', 'skip'],
        ['miss', 'skip'],
      ],
    ),
    highlight: { active: ['a:bbox', 'b:bbox'], found: ['a:pip'], removed: ['c:pip', 'd:pip'] },
    explanation: 'Bounding boxes are fast and lossy. Exact point-in-polygon is slower and authoritative. The two-stage structure matches how PostGIS index-aware predicates work.',
    invariant: 'A bbox hit is a maybe, not a membership event.',
  };
  yield {
    state: fenceGraph('Exact polygon check emits state'),
    highlight: { active: ['cand', 'pip', 'state', 'e-cand-pip', 'e-pip-state'], found: ['event'], compare: ['gps'] },
    explanation: 'The exact predicate must handle polygon rings, holes, multipolygons, invalid geometries, and coordinate-system consistency. Only then should the system update inside/outside state.',
  };
  yield {
    state: labelMatrix(
      'Event dedupe',
      [
        { id: 'prev', label: 'prev' },
        { id: 'now', label: 'now' },
        { id: 'seq', label: 'seq' },
        { id: 'emit', label: 'emit' },
      ],
      [
        { id: 'value', label: 'val' },
        { id: 'why', label: 'why' },
      ],
      [
        ['outside', 'old'],
        ['inside', 'new'],
        ['gps t42', 'order'],
        ['enter', 'change'],
      ],
    ),
    highlight: { found: ['emit:value', 'emit:why'], active: ['prev:value', 'now:value'] },
    explanation: 'Geofencing is stateful. A point-in-polygon result is not an event by itself; enter and exit events come from comparing current state with previous state under ordered GPS samples.',
  };
}

function* boundaryPolicy() {
  yield {
    state: labelMatrix(
      'Boundary cases',
      [
        { id: 'inside', label: 'inside' },
        { id: 'edge', label: 'edge' },
        { id: 'hole', label: 'hole' },
        { id: 'bad', label: 'invalid' },
      ],
      [
        { id: 'result', label: 'result' },
        { id: 'policy', label: 'policy' },
      ],
      [
        ['true', 'enter'],
        ['depends', 'covers?'],
        ['false', 'exclude'],
        ['unknown', 'repair'],
      ],
    ),
    highlight: { active: ['inside:result', 'edge:result', 'hole:result'], compare: ['bad:policy'] },
    explanation: 'Boundary semantics matter. Some products count boundary points as inside; others require strict interior containment. Holes and invalid polygons must be explicit policy decisions.',
  };
  yield {
    state: fenceGraph('Boundary policy sits after exact geometry'),
    highlight: { active: ['pip', 'state', 'event', 'e-pip-state', 'e-state-event'], compare: ['cell', 'rtree'] },
    explanation: 'The spatial index cannot decide boundary semantics. That policy belongs with the exact geometry predicate and event state machine.',
  };
  yield {
    state: labelMatrix(
      'GPS noise controls',
      [
        { id: 'acc', label: 'accuracy' },
        { id: 'hyst', label: 'hyst' },
        { id: 'dwell', label: 'dwell' },
        { id: 'snap', label: 'snap' },
      ],
      [
        { id: 'problem', label: 'problem' },
        { id: 'fix', label: 'fix' },
      ],
      [
        ['wide error', 'ignore?'],
        ['flapping', 'buffer'],
        ['drive-by', 'time gate'],
        ['road GPS', 'map match'],
      ],
    ),
    highlight: { found: ['hyst:fix', 'dwell:fix', 'snap:fix'], compare: ['acc:fix'] },
    explanation: 'Real GPS points jump. Geofence systems often need hysteresis buffers, dwell time, accuracy thresholds, and map matching before they emit business events.',
  };
  yield {
    state: labelMatrix(
      'Audit fields',
      [
        { id: 'fence', label: 'fence' },
        { id: 'geom', label: 'geom' },
        { id: 'policy', label: 'policy' },
        { id: 'sample', label: 'sample' },
      ],
      [
        { id: 'stored', label: 'stored' },
        { id: 'reason', label: 'why' },
      ],
      [
        ['id', 'debug'],
        ['version', 'replay'],
        ['edge rule', 'explain'],
        ['time', 'order'],
      ],
    ),
    highlight: { found: ['geom:reason', 'policy:reason', 'sample:reason'] },
    explanation: 'Store geometry version, boundary policy, sample timestamp, and candidate filter path. Geofence disputes are replay problems, not just geometry problems.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'candidate filter') yield* candidateFilter();
  else if (view === 'boundary policy') yield* boundaryPolicy();
  else throw new InputError('Pick a geofence view.');
}

export const article = {
  sections: [
    { heading: 'What it is', paragraphs: ['A geofence system decides whether a moving point is inside a polygonal zone and emits enter or exit events. It combines spatial indexing, exact geometry predicates, boundary policy, GPS-noise controls, and event state.'] },
    { heading: 'How it works', paragraphs: ['Use an R-tree, GiST, or cell index to find candidate polygons by bounding box. Run exact point-in-polygon only on candidates. Then compare the new inside/outside state with the previous state to emit a deduplicated event.'] },
    { heading: 'Case study', paragraphs: ['A delivery app checks whether a driver entered a pickup zone. The location point hits two candidate bounding boxes. Exact polygon logic says one is inside and one is outside. The state machine emits enter only if the previous state for that fence was outside.'] },
    { heading: 'Pitfalls', paragraphs: ['Do not turn a bounding-box hit into an event. Do not ignore boundary semantics. Do not use invalid polygons. Do not let GPS flapping emit repeated enter/exit events around a border.'] },
    { heading: 'Why it matters', paragraphs: ['Geofencing looks like a geometry predicate, but production behavior is mostly data structures: spatial indexes, candidate sets, ordered sample state, policy versions, and replayable audit logs.'] },
    { heading: 'Sources and study next', paragraphs: ['Primary sources: PostGIS ST_Contains at https://postgis.net/docs/ST_Contains.html, PostGIS spatial indexing workshop at https://postgis.net/workshops/postgis-intro/indexing.html, and Turf booleanPointInPolygon at https://turfjs.org/docs/api/booleanPointInPolygon. Study R-tree, PostGIS GiST Spatial Index, HMM Map Matching, and Finite State Machine next.'] },
  ],
};
