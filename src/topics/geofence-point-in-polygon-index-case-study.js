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
        'The animation traces a GPS point through the full geofence decision pipeline: spatial index, candidate filter, exact point-in-polygon, state machine, and event emission.',
        {
          type: 'bullets',
          items: [
            'Active (highlighted) nodes are the current stage of the pipeline receiving a GPS sample.',
            'Compare nodes show an alternative stage whose job is distinct from the active one -- index versus predicate, classification versus event.',
            'Found nodes are confirmed outputs: a fence membership or an emitted enter/exit event.',
            'Removed nodes in the candidate table are fences eliminated by the coarse filter, never reaching exact geometry.',
          ],
        },
        'The candidate-filter view shows the index-then-predicate pipeline. The boundary-policy view shows the decisions that sit after geometry: holes, edge semantics, GPS noise, and audit. Switch between them to see that scale and semantics are separate problems with separate solutions.',
        {type:'callout', text:'A production geofence is not one point-in-polygon test; it is a no-false-negative candidate filter, an exact geometry predicate, and an ordered state machine.'},
        {type:'image', src:'https://upload.wikimedia.org/wikipedia/commons/c/c9/RecursiveEvenPolygon.svg', alt:'Ray crossing a polygon with numbered intersections to illustrate the even-odd point-in-polygon test.', caption:'RecursiveEvenPolygon.svg by Melchoir; GFDL or CC BY-SA 3.0 via Wikimedia Commons.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'A geofence system turns noisy position samples into operational decisions. A delivery van entered the depot. A courier left the paid service zone. A forklift crossed a safety boundary. A phone spent enough time inside a store to count as a visit. The product wants one clean event, but the input is a stream of latitude-longitude pairs and a changing catalog of polygons.',
        {
          type: 'note',
          text: 'Point-in-polygon answers one question: is this coordinate inside this shape? A production geofence system must answer that question quickly for thousands of devices against thousands of fences, then turn repeated classifications into auditable enter and exit events. The geometry predicate is about 5% of the system. The other 95% is indexing, state management, noise suppression, and replay.',
        },
        'The visual separates those responsibilities so scale and semantics do not get mixed together. The candidate-filter view isolates the index contract. The boundary-policy view isolates the semantic contract. Neither can do the other\'s job.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is brute force: for every GPS sample, test the point against every polygon. That is fine for a demo with ten fences. It is also attractive because it seems honest -- no approximate index, no caching, no extra data structure. Every fence gets an exact answer.',
        {
          type: 'table',
          headers: ['Scale', 'Devices', 'Fences', 'Samples/min', 'PIP checks/min'],
          rows: [
            ['Demo', '1', '10', '12', '120'],
            ['City pilot', '1,000', '500', '12,000', '6,000,000'],
            ['National fleet', '50,000', '10,000', '600,000', '6,000,000,000'],
          ],
        },
        'At the national-fleet scale, brute-force point-in-polygon is six billion checks per minute. The ray-casting algorithm runs in O(v) per polygon where v is the vertex count. A complex delivery zone might have 200 vertices. That is 1.2 trillion vertex-edge intersection tests per minute. No amount of fast hardware rescues that path.',
        'Worse, raw containment still does not decide product behavior. A point on a polygon edge may be inside for a retail visit but outside for a legal boundary. A polygon may have holes. A GPS sample may arrive late. A repeated inside result is not another enter event. Brute force solves only the smallest part of the problem.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is not just performance. It is correctness under composition.',
        {
          type: 'diagram',
          text: 'Brute-force pipeline (looks simple, hides three bugs):\n\n  GPS sample --> for each fence --> ray-cast PIP --> emit "inside" or "outside"\n\nBug 1: O(F * V) per sample. At scale, latency exceeds sample interval.\nBug 2: No state. Every "inside" looks like a new arrival.\nBug 3: No boundary policy. Edge points are silently included or excluded\n        depending on floating-point rounding, not business rules.',
          label: 'Three failure modes compound: a slow, stateless, ambiguous pipeline',
        },
        'Consider a delivery truck that reports every 5 seconds. It enters a depot polygon and stays for 30 minutes. The brute-force pipeline produces 360 "inside" results. Without a state machine, every one of those looks like an enter event. The downstream billing system charges 360 arrivals instead of one.',
        {
          type: 'note',
          text: 'The invariant that brute force violates: a geofence event is a transition, not a classification. "Inside" is a state. "Enter" is a change of state. Without tracking previous state per device-fence pair, the system cannot distinguish the first "inside" sample from the 360th.',
        },
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'The core idea is a three-stage pipeline with distinct contracts at each boundary.',
        {
          type: 'diagram',
          text: 'Stage 1: CANDIDATE FILTER (index)\n  Input:  (lat, lon)\n  Output: fence IDs whose bounding region contains the point\n  Contract: no false negatives. May return extra fences. Must never hide one.\n\nStage 2: EXACT PREDICATE (geometry)\n  Input:  (lat, lon) + polygon rings + boundary policy\n  Output: inside / outside / on-boundary\n  Contract: correct under the declared geometry semantics (contains vs covers).\n\nStage 3: EVENT STATE MACHINE (stream)\n  Input:  current classification + previous state + sample sequence\n  Output: enter / exit / no-op\n  Contract: idempotent, ordered, replayable.',
          label: 'Each stage has one job and one contract. No stage can substitute for another.',
        },
        'The candidate filter is allowed to return extra work. It is not allowed to hide a fence that could contain the point. The exact predicate is allowed to be slow. It is not allowed to be approximate. The state machine is allowed to suppress events. It is not allowed to create events from repeated identical states.',
        {
          type: 'quote',
          text: 'The efficiency of the spatial index comes from comparing the query point against simple, pre-computed bounding boxes, allowing the system to avoid the expensive exact computation for the vast majority of polygons.',
          attribution: 'Guttman, "R-Trees: A Dynamic Index Structure for Spatial Searching" (1984), Section 1',
        },
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Stage 1 uses a spatial index to narrow the search. The two dominant strategies are R-trees and discrete cell grids.',
        {
          type: 'table',
          headers: ['Index type', 'How it works', 'Strengths', 'Weaknesses'],
          rows: [
            ['R-tree', 'Groups fence bounding boxes into a balanced tree of nested rectangles. Point query walks from root, pruning branches whose rectangle misses the point.', 'Adapts to irregular fence distribution. Handles overlapping fences well.', 'Insertion and deletion require rebalancing. Complex to implement correctly.'],
            ['S2 / H3 cell grid', 'Projects the sphere into hierarchical cells. Each fence is associated with the cells it covers. Point query looks up the cell, retrieves registered fences.', 'O(1) cell lookup. Simple to shard by cell. Handles antimeridian and poles naturally (S2).', 'Large or irregular fences span many cells, inflating the index. Coarser cells produce more false candidates.'],
            ['Geohash grid', 'Encodes lat/lon as a string prefix. Fences register in all geohash cells they touch. Point query hashes the coordinate, fetches registered fences.', 'Simple string-based lookup. Easy to store in key-value databases.', 'Rectangular cells cause edge discontinuities. Does not handle poles or antimeridian.'],
          ],
        },
        'Stage 2 runs the exact point-in-polygon predicate on each candidate. The standard algorithm is ray casting: cast a horizontal ray from the query point and count edge crossings. An odd count means inside. The algorithm must handle polygon rings (exterior boundary), interior rings (holes), multipolygons, and the boundary policy.',
        {
          type: 'code',
          language: 'javascript',
          text: '// Ray-casting point-in-polygon (simplified)\n// Returns true if point (px, py) is inside the polygon ring.\nfunction raycast(px, py, ring) {\n  let inside = false;\n  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {\n    const xi = ring[i][0], yi = ring[i][1];\n    const xj = ring[j][0], yj = ring[j][1];\n    // Does a rightward ray from (px, py) cross this edge?\n    if ((yi > py) !== (yj > py) &&\n        px < (xj - xi) * (py - yi) / (yj - yi) + xi) {\n      inside = !inside;\n    }\n  }\n  return inside;\n}\n\n// Full PIP with holes: inside exterior AND outside every hole\nfunction pointInPolygon(px, py, polygon) {\n  if (!raycast(px, py, polygon.exterior)) return false;\n  for (const hole of polygon.holes) {\n    if (raycast(px, py, hole)) return false;\n  }\n  return true;\n}',
        },
        {
          type: 'note',
          text: 'The ray-casting algorithm is O(v) where v is the vertex count of the polygon. For a polygon with 200 vertices, this is 200 edge-crossing tests. For 10 candidates averaging 200 vertices each, the exact stage costs about 2,000 comparisons per sample -- trivial compared to the millions saved by skipping the other 9,990 fences.',
        },
        'Stage 3 compares the current classification against stored state. The state machine tracks one record per (device, fence) pair.',
        {
          type: 'table',
          headers: ['Previous state', 'Current PIP result', 'Action', 'Event emitted'],
          rows: [
            ['outside', 'inside', 'Update state to inside, record sample', 'ENTER'],
            ['inside', 'outside', 'Update state to outside, record sample', 'EXIT'],
            ['inside', 'inside', 'Update last-seen timestamp', 'none'],
            ['outside', 'outside', 'No-op', 'none'],
            ['unknown', 'inside', 'Initialize state to inside', 'ENTER (cold start)'],
          ],
        },
        'The candidate-filter view in the animation shows stages 1 and 2. The graph traces a GPS point through cell and R-tree filters to candidates, then through exact PIP to state and event nodes. The boundary-policy view shows the decisions inside stages 2 and 3: edge semantics, holes, GPS noise, and audit metadata.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Correctness depends on one invariant per stage.',
        {
          type: 'table',
          headers: ['Stage', 'Invariant', 'What breaks if violated'],
          rows: [
            ['Candidate filter', 'Every fence that contains the point is in the candidate set (no false negatives).', 'The exact predicate never sees the fence. The system silently misses an enter event. No downstream stage can recover the omission.'],
            ['Exact predicate', 'The PIP result matches the declared geometry semantics (contains or covers) for valid geometry.', 'A point on the boundary gets a different answer depending on floating-point rounding. Two runs on the same data disagree.'],
            ['State machine', 'Events are transitions computed over ordered samples per (device, fence) pair.', 'A repeated "inside" sample emits a duplicate ENTER. A late-arriving sample creates an impossible EXIT-then-ENTER sequence.'],
          ],
        },
        'The candidate filter is safe because bounding boxes are conservative envelopes. A bounding box always contains its polygon. If the point is outside the bounding box, it is guaranteed outside the polygon. False positives (point inside bbox but outside polygon) are harmless -- they only cost one extra ray-cast call. False negatives (point inside polygon but outside bbox) are impossible by construction.',
        'The state machine is safe because it compares current state with previous state under sample ordering. If samples arrive out of order, the machine rejects any sample whose sequence number is older than the last accepted sequence. This makes retry safe: resending sample #42 when #42 was already processed is a no-op, not a duplicate event.',
        {
          type: 'note',
          text: 'The correctness argument is compositional. Each stage can be tested independently. The candidate filter is tested by verifying that every fence containing a test point appears in the candidate set. The predicate is tested with known polygons and known boundary points. The state machine is tested with ordered and disordered sample sequences. End-to-end correctness follows from the three stage invariants holding simultaneously.',
        },
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        {
          type: 'table',
          headers: ['Operation', 'Brute force', 'Indexed pipeline', 'What changed'],
          rows: [
            ['PIP checks per sample', 'F (all fences)', 'C (candidates, typically C << F)', 'Index eliminates ~99% of fences for localized queries'],
            ['Per-check cost', 'O(V) per polygon', 'O(V) per polygon', 'Same algorithm, fewer invocations'],
            ['Total per sample', 'O(F * V)', 'O(log F + C * V) for R-tree; O(1 + C * V) for cell grid', 'Dominated by candidate count, not total fence count'],
            ['State lookup', 'N/A (none)', 'O(1) hash lookup per (device, fence)', 'One hash read per candidate'],
            ['Index build', 'None', 'O(F log F) for R-tree; O(F * cells_per_fence) for grid', 'One-time or incremental cost'],
          ],
        },
        'At the national-fleet scale from the earlier table: 50,000 devices, 10,000 fences, 600,000 samples per minute. With brute force, that is 6 billion PIP checks per minute. With an R-tree returning an average of 5 candidates per query, it drops to 3 million PIP checks per minute -- a 2,000x reduction.',
        'Index maintenance is the ongoing cost. Stable fences (delivery zones, campus boundaries) are indexed once. Frequently edited fences (ad-hoc safety zones, event perimeters) require incremental R-tree updates or cell-grid reregistration. A common pattern is versioned fences: the index stores the current version, and the state machine records which version produced each event for replay.',
        {
          type: 'note',
          text: 'Vertex count matters more than polygon count after the index stage. A city boundary with 5,000 vertices is 25x more expensive to ray-cast than a rectangular delivery zone with 4 vertices. Geometry simplification (Douglas-Peucker, Visvalingam) can reduce vertex count, but over-simplification moves the boundary and changes which points are inside. The safe budget depends on the smallest gap between the fence edge and the nearest device path.',
        },
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'A ride-share company defines four geofences in a city: airport (fence A, complex polygon with a hole for the runway), downtown zone (fence B), suburb (fence C), and industrial park (fence D). A driver\'s phone reports GPS every 5 seconds.',
        {
          type: 'code',
          language: 'text',
          text: 'Fences in the R-tree:\n  A: airport     bbox [40.63..40.66, -73.79..-73.76]  212 vertices, 1 hole\n  B: downtown    bbox [40.74..40.76, -73.99..-73.97]   38 vertices\n  C: suburb      bbox [40.70..40.73, -73.85..-73.82]   24 vertices\n  D: industrial  bbox [40.68..40.69, -73.90..-73.88]   16 vertices\n\nGPS sample #1: (40.6495, -73.7789)  accuracy: 12m\nGPS sample #2: (40.6501, -73.7780)  accuracy: 8m\nGPS sample #3: (40.7512, -73.9845)  accuracy: 15m',
        },
        {
          type: 'table',
          headers: ['Step', 'Sample', 'Index result', 'PIP result', 'Previous state', 'Event'],
          rows: [
            ['1', '#1 (40.649, -73.778)', 'bbox hit: A', 'A: inside exterior, outside hole -> INSIDE', 'A: unknown', 'ENTER fence A'],
            ['2', '#2 (40.650, -73.778)', 'bbox hit: A', 'A: INSIDE', 'A: inside', 'none (no transition)'],
            ['3', '#3 (40.751, -73.984)', 'bbox hit: B', 'B: INSIDE', 'A: inside, B: unknown', 'EXIT fence A, ENTER fence B'],
          ],
        },
        'Sample #1 hits only fence A\'s bounding box. The R-tree prunes B, C, and D in O(log 4) time. Ray-casting against A\'s 212-vertex exterior ring returns inside. A second ray-cast against the 48-vertex hole ring returns outside (the driver is in the terminal area, not on the runway). State initializes to inside, and the system emits ENTER.',
        'Sample #2 again hits only fence A. PIP returns inside. Previous state is already inside. No transition, no event. The state machine updates the last-seen timestamp.',
        'Sample #3 is across the city. The R-tree prunes A, C, D. Only fence B is a candidate. PIP returns inside for B. The state machine sees two transitions: fence A changed from inside to outside (no candidate means no PIP, which means outside), and fence B changed from unknown to inside. It emits EXIT for A and ENTER for B.',
        {
          type: 'note',
          text: 'The "no candidate means outside" rule is safe only because the candidate filter guarantees no false negatives. If fence A contained the point but the index missed it, the system would emit a spurious EXIT. This is why the candidate-filter invariant is the load-bearing contract of the entire pipeline.',
        },
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        {
          type: 'table',
          headers: ['Domain', 'Fence shape', 'Event type', 'Why the index matters'],
          rows: [
            ['Fleet management', 'Depot polygons, route corridors', 'Arrival / departure', '10,000+ vehicles against 500+ depots. Brute force exceeds the GPS reporting interval.'],
            ['Retail foot traffic', 'Store footprints, mall zones', 'Visit start / visit end', 'Millions of phones against thousands of store polygons. Dwell-time gate suppresses walk-bys.'],
            ['Electronic tolling', 'Toll zone polygons', 'Zone entry for billing', 'Toll zones overlap on highways. Boundary policy decides which zone gets the charge.'],
            ['Industrial safety', 'Exclusion zones with holes', 'Unauthorized entry alarm', 'Holes represent safe corridors through hazardous areas. PIP must handle interior rings correctly.'],
            ['Ride-share pricing', 'Airport, surge zones', 'Surge activation / airport surcharge', 'Fences change frequently (surge). Index must handle versioned, short-lived polygons.'],
          ],
        },
        'The pattern wins when events need evidence. A system that records only "enter" and "exit" strings cannot answer disputes. A system that records sample ID, device ID, fence ID, geometry version, boundary policy, candidate method, PIP result, previous state, and emitted transition can replay the decision. PostGIS implements the same two-stage idea: the GiST index returns bounding-box candidates, then ST_Contains or ST_Covers runs exact geometry. The query planner automates the split that this pipeline makes explicit.',
        {
          type: 'code',
          language: 'sql',
          text: '-- PostGIS uses the same two-stage pattern internally.\n-- The GiST index on geom returns bbox candidates,\n-- then ST_Contains runs exact PIP on each candidate.\nSELECT fence_id, fence_name\nFROM   geofences\nWHERE  ST_Contains(geom, ST_SetSRID(ST_Point(-73.9857, 40.7484), 4326))\n  AND  active = true\n  AND  valid_from <= NOW()\n  AND  valid_until >= NOW();',
        },
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'The dangerous shortcuts and genuine hard cases fall into three categories.',
        {
          type: 'table',
          headers: ['Failure class', 'Example', 'Consequence', 'Mitigation'],
          rows: [
            ['Index false negative', 'Bounding box computed on stale geometry after a fence edit', 'System silently misses the fence. No ENTER event. No downstream recovery.', 'Reindex on every fence update. Version the index alongside the fence.'],
            ['Geometry ambiguity', 'Point lies exactly on a polygon edge. Ray-cast result depends on floating-point rounding.', 'Two runs on the same data disagree. Audit replay produces a different event.', 'Declare boundary policy per fence (contains vs covers). Use robust predicates (Shewchuk orientation).'],
            ['Coordinate system mismatch', 'Planar PIP on unprojected lat/lon near the poles or antimeridian', 'A horizontal ray at latitude 89 degrees wraps around the pole. Edge crossings are miscounted.', 'Use geodesic PIP or project to a local planar CRS. S2 geometry operates on the sphere natively.'],
            ['GPS noise at boundary', 'Device oscillates between inside and outside every 5 seconds', 'Rapid ENTER/EXIT/ENTER/EXIT "flapping" floods downstream systems', 'Hysteresis buffer (expand fence for exit, shrink for enter). Dwell-time gate. Accuracy threshold.'],
            ['Stream disorder', 'Mobile retry delivers sample #40 after sample #45 was already processed', 'State machine replays old data and emits a spurious EXIT', 'Reject samples with sequence <= last-accepted. Log rejected samples for audit.'],
          ],
        },
        {
          type: 'note',
          text: 'Indoor GPS is a special case. Consumer GPS accuracy degrades to 10-50 meters inside buildings. A geofence smaller than the GPS error radius produces random containment results. Solutions include Wi-Fi/BLE fingerprinting for indoor positioning, or increasing the fence radius to exceed the expected GPS error. Neither is a geometry fix -- both change the input signal.',
        },
        'The subtlest failure is treating the bounding-box hit as a membership event. This is tempting because it skips the expensive ray-cast. But bounding boxes are axis-aligned rectangles. A triangular fence has a bounding box twice its area. An L-shaped fence has a bounding box that covers the concavity. Every false positive from the index becomes a false enter event if the exact predicate is skipped.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        {
          type: 'table',
          headers: ['Source', 'What it covers', 'Why it matters here'],
          rows: [
            ['Guttman, "R-Trees: A Dynamic Index Structure for Spatial Searching" (SIGMOD 1984)', 'The R-tree data structure for spatial indexing with bounding rectangles', 'Defines the candidate-filter stage. The R-tree invariant (every child bbox is contained in its parent) guarantees no false negatives.'],
            ['Shimrat, "Algorithm 112: Position of point relative to polygon" (CACM 1962)', 'The original ray-casting point-in-polygon algorithm', 'The exact predicate stage. Still the foundation of most PIP implementations.'],
            ['PostGIS documentation: ST_Contains vs ST_Covers', 'Boundary semantics in a production spatial database', 'Shows that the contains/covers distinction is not academic -- it changes query results on real data.'],
            ['Uber H3: hexagonal hierarchical geospatial indexing system', 'Cell-grid alternative to R-trees for geospatial indexing', 'Production-scale cell index used for surge pricing, ETA, and geofencing at millions of events per second.'],
          ],
        },
        {
          type: 'bullets',
          items: [
            'Prerequisite: R-tree spatial indexing -- understand how bounding-box trees prune search space.',
            'Prerequisite: Ray-casting point-in-polygon -- understand edge-crossing counting and its boundary behavior.',
            'Extension: Finite state machines -- formalize the enter/exit state machine with explicit transition tables.',
            'Extension: Stream deduplication and idempotency -- handle retry, late arrival, and replay in event pipelines.',
            'Contrast: Voronoi diagrams and nearest-neighbor search -- when the question is "which region" rather than "inside or outside."',
            'Production: PostGIS GiST indexes -- see the same two-stage pattern implemented inside a SQL query planner.',
          ],
        },
      ],
    },
  ],
};

