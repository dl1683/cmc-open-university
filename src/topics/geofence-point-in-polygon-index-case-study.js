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
    {
      heading: 'How to read the animation',
      paragraphs: [
        'Read the animation as a stream decision, not as one geometry test. A geofence is a polygonal region with a business meaning, point-in-polygon is the exact geometry predicate, and a spatial index is a data structure that narrows which polygons need that predicate. Active nodes process the current GPS sample, compared nodes show alternatives being filtered, and found nodes are confirmed memberships or events.',
        'The safe inference rule is no false negatives in the candidate stage. The index may return extra fences, but it must not discard a fence that could contain the point, because the exact predicate only runs on candidates.',
        {type:'callout', text:'A production geofence is not one point-in-polygon test; it is a no-false-negative candidate filter, an exact geometry predicate, and an ordered state machine.'},
        {type:'image', src:'https://upload.wikimedia.org/wikipedia/commons/c/c9/RecursiveEvenPolygon.svg', alt:'Ray crossing a polygon with numbered intersections to illustrate the even-odd point-in-polygon test.', caption:'RecursiveEvenPolygon.svg by Melchoir; GFDL or CC BY-SA 3.0 via Wikimedia Commons.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Geofencing turns noisy position samples into decisions such as a truck entered a depot or a phone left a service area. The input is a stream of latitude and longitude samples, and the fence catalog can contain thousands of polygons.',
        'The product wants events, not raw classifications. A repeated inside result should usually update state, not emit a new enter event every few seconds.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is brute force. For every GPS sample, run point-in-polygon against every fence and emit inside or outside for each one.',
        'That approach is attractive because it uses exact geometry everywhere. For a demo with one device and ten fences, it is simple and correct enough to understand.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is multiplicative cost. With 50,000 devices reporting every 5 seconds, the system receives 600,000 samples per minute. Against 10,000 fences, brute force means 6 billion point-in-polygon checks per minute.',
        'The wall is also semantic. A point on an edge, a polygon with a hole, a late sample, or a repeated inside classification cannot be handled by geometry alone. The system needs indexing, exact geometry, and state transitions as separate contracts.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Use a three-stage pipeline. The spatial index returns candidate fences with no false negatives, the exact predicate classifies the point against those candidates, and the state machine turns classification changes into events.',
        'The stages have different correctness rules. The index may be approximate only by returning extra work, the predicate must match declared boundary semantics, and the state machine must be ordered and replayable.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The index can be an R-tree, S2 or H3 cell mapping, geohash grid, or another spatial structure. It maps a point to a small candidate set by using bounding boxes or cells before exact polygon work begins.',
        'The exact stage applies a point-in-polygon algorithm such as ray casting. For polygons with holes, the point must be inside the exterior ring and outside each interior ring, with a declared rule for boundary points.',
        'The event stage keeps state per device-fence pair. Outside to inside emits enter, inside to outside emits exit, and repeated inside or outside samples update last-seen information without creating duplicate events.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The candidate filter is correct if every fence that could contain the point remains in the candidate set. Extra candidates only cost time; missing candidates create false negatives the later stages can never recover.',
        'Ray casting works under the even-odd rule because a ray from the point crosses the polygon boundary an odd number of times for inside points and an even number for outside points, with special handling for edges and vertices. The state machine works because events are defined as transitions, not as raw classifications.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Brute force costs O(F times V) per sample, where F is fence count and V is average vertex count. With 10,000 fences and 200 vertices each, one sample can require about 2 million edge tests.',
        'With an index that returns 12 candidates, the exact stage needs about 2,400 edge tests for the same sample. Doubling device count doubles stream load, while doubling fence count mainly hurts through index size and candidate count rather than through every polygon.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'This pattern fits fleet tracking, delivery depots, retail visit detection, campus safety zones, tolling regions, industrial equipment boundaries, and location-based notifications. The common access pattern is many points against many regions over time.',
        'It is also useful for replay and audit. If samples, fence versions, boundary policies, and state transitions are logged, the system can explain why an enter or exit event was emitted.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'The index can fail by using cells or bounding boxes too coarsely, which creates too many candidates and pushes cost back into exact geometry. It can also fail by clipping or projecting polygons incorrectly, which creates false negatives.',
        'The state machine can fail under GPS jitter, delayed samples, out-of-order events, and boundary ambiguity. Hysteresis, dwell time, sequence numbers, and policy-specific edge rules are often necessary for a production result.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'A driver reports every 5 seconds for 30 minutes inside a depot, producing 360 inside samples. A classifier-only system emits 360 enter-like facts, while a state machine emits one enter, 358 no-op updates, and one exit when the driver leaves.',
        'Now add scale. If the depot city has 4,000 fences with 150 vertices each, brute force is 600,000 edge tests per sample. If the index returns 8 candidates, exact work drops to 1,200 edge tests while preserving correctness as long as no true candidate is filtered out.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Study Guttman R-trees, S2 geometry, H3 indexing, geohash grids, ray-casting point-in-polygon, winding number predicates, and robust geometry libraries such as GEOS or JTS. The main source lesson is that spatial indexing and exact geometry are different layers.',
        'Next study stream processing state, event-time ordering, idempotent event emission, GPS noise filtering, and map projections. Production geofencing is a geometry problem embedded inside a streaming system.',
      ],
    },
  ],
};

