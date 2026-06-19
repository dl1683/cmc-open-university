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
        "Read the animation as the execution trace for Geofence Point-in-Polygon Index Case Study. A geofence case study: R-tree or cell prefilters, bounding-box candidates, point-in-polygon checks, holes, boundary policy, invalid geometry, and event dedupe..",
        "Active items are the current decision point. Visited markers are state that is already ruled out by proof, not by taste.",
        "Found markers are outcomes now guaranteed true. If this is not visible, the animation can mislead.",
        "At each frame, ask what changed, why that move is legal, and where the idea is strong or fragile.",
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        `A geofence system turns noisy position samples into operational decisions. A delivery van entered the depot. A courier left the paid service zone. A forklift crossed a safety boundary. A phone spent enough time inside a store to count as a visit. The product wants one clear event, but the input is a stream of latitude-longitude points and a changing catalog of polygons.`,
        `This topic exists because the simple geometry question is not the full system question. Point-in-polygon tells you whether one point is inside one shape. A production geofence system must answer that question quickly for many devices and many fences, then turn repeated classifications into audited enter and exit events. The visual separates those responsibilities so scale and semantics do not get mixed together.`,
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        `The obvious approach is brute force: for every GPS sample, test the point against every polygon. That is fine for a demo with ten fences. It is also attractive because it seems honest. There is no approximate index, no caching, and no extra data structure to maintain. Every possible fence gets an exact answer.`,
        `The approach fails as soon as either side grows. Ten thousand devices reporting every few seconds against thousands of fences becomes millions of polygon checks per minute. Worse, raw containment still does not decide the product behavior. A point on a border may be inside for a retail visit but outside for a legal boundary. A polygon may have holes. A GPS sample may arrive late. A repeated inside result is not another enter event. Brute force solves only the smallest part of the problem.`,
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        `The core idea is a two-stage decision. First, use a spatial index to find a safe superset of fences that might contain the point. Second, run exact point-in-polygon only on that candidate set. The index is allowed to return extra work. It is not allowed to hide a fence that could contain the point.`,
        `This split is the same reason database systems use spatial indexes for predicates such as contains and intersects. Bounding boxes, R-trees, GiST indexes, S2 cells, H3 cells, and geohash grids are fast because they reason about coarse covering shapes. Exact geometry is slower because it reasons about rings, vertices, holes, and boundary rules. The safe pattern is maybe first, exact answer second, event transition third.`,
      ],
    },
    {
      heading: 'Data model',
      paragraphs: [
        `A fence record should contain more than a polygon. It needs a stable fence id, tenant or owner, active time window if one exists, normalized geometry, bounding box, geometry version, coordinate reference system, and boundary policy. If the fence came from user input, the record should also store validation results so bad geometry is not silently accepted.`,
        `A device-fence state record is separate. It stores the previous classification, last accepted sample time or sequence, last event emitted, and sometimes the confidence or GPS accuracy that supported the decision. This state is what turns geometry into a stream system. Without it, every inside point looks like a new arrival and replaying late samples can change history.`,
      ],
    },
    {
      heading: 'Index and candidates',
      paragraphs: [
        `At ingestion time, the system validates each fence and builds a lookup structure. An R-tree groups bounding boxes so a point query visits only nearby tree branches. A cell index stores which fences cover each coarse geospatial cell. A database index such as PostGIS GiST uses bounding boxes to narrow the search before exact predicates run.`,
        `The candidate table in the visual is the important contract. Fence A and fence B have bounding-box hits, so they move to exact point-in-polygon. Fence C and fence D miss the coarse filter, so they are skipped. A hit is not a membership event. It is only permission to spend more CPU on the exact check.`,
      ],
    },
    {
      heading: 'Exact geometry',
      paragraphs: [
        `The exact check must implement the real geometry rules, not a sketch of them. A polygon can have an exterior ring and interior rings. A multipolygon can contain several disconnected areas. A warehouse fence may exclude a public road through a hole. A point can lie exactly on an edge or vertex. Invalid rings may self-intersect.`,
        `The boundary policy belongs here. Some products want covers semantics, where boundary points count as inside. Others want strict contains semantics, where only the interior counts. Neither answer is universally correct. The policy must be attached to the fence or query and recorded with the event so a later audit can reproduce the decision.`,
      ],
    },
    {
      heading: 'Event state',
      paragraphs: [
        `A point-in-polygon result is a classification, not an event. Events come from transitions. If the previous state was outside and the new state is inside, emit enter. If the previous state was inside and the new state is outside, emit exit. If the state did not change, update bookkeeping and stay quiet.`,
        `This layer must handle ordering and idempotence. Mobile samples can arrive late, repeat after retry, or appear with coarse accuracy. The state machine should reject old sequence numbers, dedupe repeated samples, and make retry safe. A geofence dispute is usually a replay problem: what did the system know, which geometry version did it use, and why did it emit that transition?`,
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        `The candidate-filter view proves that the index and the exact predicate have different jobs. The index makes the search small by returning possible fences. The exact predicate makes the answer true by rejecting false positives. The event node appears only after state changes, because geometry alone does not know whether this sample is the first inside sample or the hundredth.`,
        `The boundary-policy view proves that many hard cases sit after the index. Holes, boundary points, invalid geometry, GPS accuracy, dwell time, and hysteresis cannot be decided by a bounding box. They are policy and state decisions wrapped around exact geometry. If those decisions are implicit, two teams can run the same polygon and produce different business events.`,
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        `The algorithm is correct when the candidate stage has no false negatives and the exact stage implements the promised geometry semantics. Returning extra candidates only costs time. Dropping a possible fence breaks correctness because the exact predicate never gets a chance to recover it.`,
        `The stream layer is correct when transitions are computed over an ordered state per device and fence. That is why replay metadata matters. If the system can reconstruct the candidate set, geometry version, boundary rule, sample timestamp, previous state, and exact result, it can explain why an enter or exit was emitted and avoid creating a different answer during retry.`,
      ],
    },
    {
      heading: 'Cost and behavior',
      paragraphs: [
        `Index lookup cost is usually small compared with scanning every fence, but it is not free. Dense downtown regions, many overlapping polygons, and large administrative boundaries can return many candidates. Exact cost then depends on candidate count, vertex count, and predicate implementation. Simplifying geometry can help, but over-simplification can move borders and change events.`,
        `Updates also cost something. Stable fences are easy to index. Frequently edited fences require versioning, incremental index updates, or batch rebuilds. GPS noise adds a product tradeoff: hysteresis, dwell-time gates, accuracy filters, and map matching reduce border flapping, but they can delay real events or suppress short visits.`,
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        `This structure wins when many moving points are checked against a relatively stable set of polygons. Delivery zones, pickup areas, campus boundaries, industrial safety regions, toll regions, store visits, fleet alerts, and IoT asset tracking all fit the pattern. The more fences and samples you have, the more valuable the candidate filter becomes.`,
        `It also wins when events need evidence. A system that records only enter and exit strings cannot answer disputes. A system that records sample id, device id, fence id, geometry version, boundary policy, candidate method, exact predicate, previous state, and emitted transition can replay the decision. That audit trail is part of the design, not paperwork added later.`,
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        `The dangerous shortcut is treating a bounding-box hit as inside. Another is leaving boundary behavior implicit. Invalid polygons, mixed coordinate systems, antimeridian-crossing shapes, polar regions, stale fence versions, and indoor GPS drift can all produce surprising results. So can planar predicates run on latitude-longitude data without understanding projection error.`,
        `Stream failures are just as common. Out-of-order samples can create impossible enter and exit sequences. Devices that report too rarely can miss short visits. Retry without idempotence can duplicate events. A full implementation protects both geometry correctness and event correctness, because users experience the event, not the predicate.`,
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        `Study next: R-tree Spatial Indexing for candidate search, Point-in-Polygon Predicates for exact geometry, Finite State Machines for enter and exit transitions, Stream Deduplication for retry safety, Coordinate Reference Systems for projection risk, HMM Map Matching Viterbi for noisy GPS traces, and PostGIS Spatial Indexes for a production database implementation of the same two-stage idea.`,
      ],
    },
      {
      heading: 'The wall',
      paragraphs: [
        "Every topic in this pattern has a hard boundary where a tempting shortcut fails; define that boundary first.",
        "State the exact invariant that must hold, show one operation sequence that can break it, and explain what changes after a failure and why.",
        "If you can reproduce this wall in one example, the rest of the page is motivated.",
      ],
    },

    {
      heading: 'Worked example',
      paragraphs: [
        "Trace one representative example end-to-end so readers can watch state evolve across every step.",
        "Keep the walkthrough concise and precise: at each step, write current state, action taken, and resulting output.",
        "The goal is prediction, not a one-off demonstration.",
      ],
    },


      {
        heading: 'Sources and study next',
        paragraphs: [
          'Read one primary source, one implementation source, and one production case where this idea appears.',
          'If they disagree on a detail, prefer the source with the clearest constraint and define the simplification for this animation.',
          'Then choose three study topics: one prerequisite, one extension, and one case study for your next session.',
        ],
      },

      {
        heading: 'Learning map',
        paragraphs: [
          'Before this topic, unlock all prerequisites and define the required preconditions.',
          'After this topic, trace where this idea appears in one larger path on this site.',
          'Use unlock relationships to keep one path and one checkpoint per review cycle.',
        ],
      },

      {
        heading: 'Micro checks',
        paragraphs: [
          {
            type: 'bullets',
            items: [
              'Can you state one invariant in one sentence?',
              'Can you prove one transition with pre and post state?',
              'Can you name one hidden edge case in one line?',
              'Can you transfer this mechanism to a neighboring domain?',
            ],
          },
        ],
      },

      {
        heading: 'Try this now',
        paragraphs: [
          'Build one input manually and predict every step before running the animation.',
          'If your predicted final state matches the animation for geofence-point-in-polygon-index-case-study, continue to the next topic in the same track.'
  ],
      },
],
};

