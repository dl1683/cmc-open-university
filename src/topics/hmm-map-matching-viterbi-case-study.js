// HMM map matching: noisy GPS observations become candidate road states, then
// Viterbi selects the most likely route through the road graph.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'hmm-map-matching-viterbi-case-study',
  title: 'HMM Map Matching Viterbi Case Study',
  category: 'Systems',
  summary: 'A map-matching case study: noisy GPS observations, road candidates, emission probabilities, route-transition probabilities, Viterbi dynamic programming, and confidence gaps.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['candidate lattice', 'viterbi path'], defaultValue: 'candidate lattice' },
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

function hmmGraph(title) {
  return graphState({
    nodes: [
      { id: 'g1', label: 'gps1', x: 0.8, y: 2.0, note: 'noisy' },
      { id: 'g2', label: 'gps2', x: 0.8, y: 4.8, note: 'noisy' },
      { id: 'a1', label: 'A1', x: 3.0, y: 1.4, note: 'road' },
      { id: 'b1', label: 'B1', x: 3.0, y: 2.7, note: 'road' },
      { id: 'a2', label: 'A2', x: 5.4, y: 4.1, note: 'road' },
      { id: 'b2', label: 'B2', x: 5.4, y: 5.5, note: 'road' },
      { id: 'route', label: 'route', x: 8.2, y: 3.4, note: 'best' },
    ],
    edges: [
      { id: 'e-g1-a1', from: 'g1', to: 'a1', weight: 'emit' },
      { id: 'e-g1-b1', from: 'g1', to: 'b1', weight: 'emit' },
      { id: 'e-g2-a2', from: 'g2', to: 'a2', weight: 'emit' },
      { id: 'e-g2-b2', from: 'g2', to: 'b2', weight: 'emit' },
      { id: 'e-a1-a2', from: 'a1', to: 'a2', weight: 'trans' },
      { id: 'e-a1-b2', from: 'a1', to: 'b2', weight: 'trans' },
      { id: 'e-b1-a2', from: 'b1', to: 'a2', weight: 'trans' },
      { id: 'e-b1-b2', from: 'b1', to: 'b2', weight: 'trans' },
      { id: 'e-a2-route', from: 'a2', to: 'route' },
      { id: 'e-b2-route', from: 'b2', to: 'route' },
    ],
  }, { title });
}

function* candidateLattice() {
  yield {
    state: hmmGraph('GPS points create road candidates'),
    highlight: { active: ['g1', 'g2', 'a1', 'b1', 'a2', 'b2', 'e-g1-a1', 'e-g2-a2'], compare: ['route'] },
    explanation: 'Map matching starts by finding nearby road candidates for each GPS observation. Each candidate is a hidden state in a Hidden Markov Model.',
  };
  yield {
    state: labelMatrix(
      'Emission scores',
      [
        { id: 'a1', label: 'A1' },
        { id: 'b1', label: 'B1' },
        { id: 'a2', label: 'A2' },
        { id: 'b2', label: 'B2' },
      ],
      [
        { id: 'dist', label: 'dist' },
        { id: 'score', label: 'score' },
      ],
      [
        ['8m', 'high'],
        ['22m', 'mid'],
        ['12m', 'high'],
        ['18m', 'mid'],
      ],
    ),
    highlight: { active: ['a1:score', 'a2:score'], compare: ['b1:score', 'b2:score'] },
    explanation: 'Emission probability measures how likely a road candidate is given the GPS point, usually based on distance and accuracy radius.',
    invariant: 'Nearest road is not always the best route.',
  };
  yield {
    state: hmmGraph('Transitions score route plausibility'),
    highlight: { active: ['e-a1-a2', 'e-b1-b2'], compare: ['e-a1-b2', 'e-b1-a2'], found: ['route'] },
    explanation: 'Transition probability compares the observed movement with the shortest-path distance through the road graph. Implausible jumps or U-turns receive lower scores.',
  };
  yield {
    state: labelMatrix(
      'HMM pieces',
      [
        { id: 'obs', label: 'obs' },
        { id: 'state', label: 'state' },
        { id: 'emit', label: 'emit' },
        { id: 'trans', label: 'trans' },
      ],
      [
        { id: 'meaning', label: 'meaning' },
        { id: 'data', label: 'data' },
      ],
      [
        ['GPS sample', 'lat/lng/t'],
        ['road cand', 'edge pos'],
        ['distance', 'sensor noise'],
        ['path fit', 'router'],
      ],
    ),
    highlight: { found: ['emit:data', 'trans:data'], active: ['obs:data', 'state:data'] },
    explanation: 'The lattice combines geometry and routing. Emissions come from local distance; transitions come from graph travel distance and elapsed time.',
  };
}

function* viterbiPath() {
  yield {
    state: labelMatrix(
      'Viterbi DP',
      [
        { id: 't1a', label: 't1 A' },
        { id: 't1b', label: 't1 B' },
        { id: 't2a', label: 't2 A' },
        { id: 't2b', label: 't2 B' },
      ],
      [
        { id: 'score', label: 'score' },
        { id: 'prev', label: 'prev' },
      ],
      [
        ['.80', 'start'],
        ['.42', 'start'],
        ['.61', 'A1'],
        ['.35', 'B1'],
      ],
    ),
    highlight: { active: ['t1a:score', 't2a:score', 't2a:prev'], compare: ['t2b:score'] },
    explanation: 'Viterbi dynamic programming keeps the best prior state for each candidate. After the final observation, backpointers reconstruct the most likely road path.',
  };
  yield {
    state: hmmGraph('Best path follows candidates A1 to A2'),
    highlight: { active: ['a1', 'a2', 'route', 'e-a1-a2', 'e-a2-route'], compare: ['b1', 'b2'] },
    explanation: 'The chosen path may not use the nearest road at every individual point. It maximizes the whole sequence: emissions plus transitions.',
  };
  yield {
    state: labelMatrix(
      'Confidence ledger',
      [
        { id: 'gap', label: 'gap' },
        { id: 'gps', label: 'GPS acc' },
        { id: 'route', label: 'route ok' },
        { id: 'emit', label: 'emit' },
      ],
      [
        { id: 'value', label: 'val' },
        { id: 'gate', label: 'gate' },
      ],
      [
        ['.26', 'ok'],
        ['18m', 'warn'],
        ['yes', 'ok'],
        ['mixed', 'review'],
      ],
    ),
    highlight: { found: ['gap:gate', 'route:gate'], compare: ['gps:gate', 'emit:gate'] },
    explanation: 'Production map matching should output confidence: best-vs-second-best gap, GPS accuracy, route feasibility, and whether a manual fallback or lower-confidence display is needed.',
  };
  yield {
    state: labelMatrix(
      'Failure modes',
      [
        { id: 'parallel', label: 'parallel' },
        { id: 'tunnel', label: 'tunnel' },
        { id: 'sparse', label: 'sparse' },
        { id: 'map', label: 'map gap' },
      ],
      [
        { id: 'symptom', label: 'symptom' },
        { id: 'fix', label: 'fix' },
      ],
      [
        ['wrong lane', 'more obs'],
        ['GPS loss', 'dead reck'],
        ['big jumps', 'HMM'],
        ['no edge', 'fallback'],
      ],
    ),
    highlight: { found: ['parallel:fix', 'sparse:fix'], compare: ['map:fix'] },
    explanation: 'Map matching fails on parallel roads, tunnels, sparse sampling, and missing map data. A confidence ledger is as important as the matched route.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'candidate lattice') yield* candidateLattice();
  else if (view === 'viterbi path') yield* viterbiPath();
  else throw new InputError('Pick a map-matching view.');
}

export const article = {
  sections: [
    {
      heading: 'Why this exists',
      paragraphs: [
        'A map app receives points, not roads. Each GPS sample has sensor noise, clock gaps, and a location that may fall between lanes, beside a highway, inside a building, or several meters away from the vehicle.',
        'The product needs a road sequence. ETA, tolling, traffic inference, mileage, turn-by-turn replay, and fleet compliance all depend on knowing which edge in the road graph the vehicle used. A dot on a map is not enough.',
        'The problem is hard because geometry and legality are different things. Two roads can be close in latitude and longitude while being separated by a barrier, elevation, one-way rule, private-access restriction, or missing turn. Map matching exists to turn noisy observations into a plausible path through the road graph, not merely to draw points on nearby lines.',
      ],
    },
    {
      heading: 'Baseline and wall',
      paragraphs: [
        'The first baseline is nearest-road snapping. For every GPS sample, find the closest road segment and call that the answer. It is fast, easy to explain, and often works on quiet streets with dense samples.',
        'The wall appears on roads that are close in geometry but far in the graph. A frontage road may sit five meters from a freeway. A bridge may cross a road without connecting to it. A phone may report one sample every 30 seconds. Nearest-road snapping can jump across barriers, alternate between parallel roads, or create turns the vehicle could not have made.',
        'Another simple baseline is to snap each point and then smooth the polyline. That can make the drawing nicer but still ignores route feasibility. Smoothing a wrong sequence of road edges does not make it legal. The matcher needs a model that scores local fit and path continuity together.',
      ],
    },
    {
      heading: 'Core model',
      paragraphs: [
        'HMM map matching treats the true road position as hidden state and the GPS sample as noisy observation. Each observation gets a small candidate set: road edge, offset along the edge, heading if available, and a score for how well that candidate explains the sample.',
        'The model has two scores. The emission score measures local fit, usually distance from the GPS point adjusted by reported accuracy. The transition score measures path fit: whether the road-network distance between two candidates matches the observed movement and elapsed time.',
        'Viterbi is the dynamic program over this lattice. It chooses the highest-scoring candidate sequence without enumerating every possible route.',
        'The core invariant is sequence score. The best candidate at one time step is not necessarily part of the best route. A slightly farther road can win if it creates a much more plausible transition sequence. That is the central reason HMM matching beats independent nearest-road decisions.',
      ],
    },
    {
      heading: 'Candidate lattice',
      paragraphs: [
        'The lattice is built one observation at a time. Each column is a timestamp. Each node in a column is a candidate road position for that observation. Edges between adjacent columns represent possible movement through the road network. This shape is small enough to optimize, but rich enough to express ambiguity.',
        'Candidate recall is the first correctness gate. If the true road edge is not in the candidate set, Viterbi cannot choose it later. Search radius, spatial index accuracy, GPS accuracy, heading filters, map version, and mode rules all influence recall. Over-pruning early can make the final route confidently wrong.',
        'Candidate precision still matters. If every point produces hundreds of candidates, transition scoring becomes expensive and ambiguity rises. Good matchers widen the radius for uncertain samples and narrow it for accurate samples, instead of using one fixed radius everywhere.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Candidate generation starts with a spatial index over road geometry. For each GPS point, the matcher asks for nearby road positions inside a search radius. Low-quality samples get wider radii, but a wider radius increases the number of candidates the dynamic program must compare.',
        'The transition step calls routing logic between candidate pairs. If two samples are 80 meters apart in straight-line distance but the legal road path between their candidates is 1.5 kilometers, the transition gets a low score. If the path requires a forbidden turn, it should be rejected or heavily penalized.',
        'For time step t and candidate c, Viterbi stores the best score ending at c and the predecessor that produced it. After the last GPS point, the matcher follows backpointers to recover the route and can expand the road path between matched candidates.',
        'In practice, implementations use log scores. Multiplying many small probabilities can underflow, while adding log probabilities is stable and turns the maximization into a sum of emission and transition terms. Impossible transitions can be represented as negative infinity or by omitting the lattice edge.',
        'The matcher also needs gap handling. If the time between samples is too large, the route between them may be underdetermined. Some systems split the trace, lower confidence, or allow several plausible connectors instead of pretending one path is certain.',
      ],
    },
    {
      heading: 'Concrete example',
      paragraphs: [
        'Suppose a delivery van drives on a highway with a service road beside it. Three GPS samples land between the two roads. The nearest segment alternates highway, service road, highway because the phone noise moves a few meters each time.',
        'The HMM can keep the van on the highway. Switching to the service road would require an exit ramp, a local segment, and a re-entry ramp that do not fit the elapsed time. The local emission is slightly worse on one point, but the sequence score is better.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Viterbi is correct for the model because the best sequence ending at a candidate only needs the best sequence ending at each predecessor. Once those predecessor scores are known, no older history can improve the current state except through the predecessor score already stored.',
        'That optimal-substructure rule lets the matcher discard weaker prefixes. It is not proving the road truth directly. It is proving that, under the emission and transition scores, the returned path is the highest-scoring hidden-state sequence.',
        'This distinction matters. The algorithm can be exact while the model is wrong. If the map is stale, the GPS is biased, or the transition cost ignores turn restrictions, Viterbi will faithfully optimize a bad scoring problem. Correctness of the dynamic program is not correctness of the product result.',
      ],
    },
    {
      heading: 'Reliability contract',
      paragraphs: [
        'A production matcher needs candidate recall. If the correct road never enters the candidate set, Viterbi cannot recover it later. Search radius, map freshness, heading filters, and road-access rules decide whether the true state is even available.',
        'The output should include confidence, not only a polyline. Useful signals include best-versus-second-best score gap, GPS accuracy, number of candidates, impossible transition count, route feasibility, and map version. Low confidence should degrade the user experience instead of pretending the route is certain.',
        'The contract should also include provenance. A disputed trip should be replayable from raw samples, candidate sets, emission scores, transition scores, chosen backpointers, routing engine version, map version, and policy flags. Without those artifacts, engineers cannot distinguish a sensor problem from a map problem or a scoring problem.',
      ],
    },
    {
      heading: 'Cost and behavior',
      paragraphs: [
        'Let T be the number of GPS samples and k the average candidates per sample. The dynamic program is roughly O(T * k^2) before pruning because every candidate can transition to every candidate at the next time step.',
        'Candidate lookup is usually cheap with a spatial index. Transition scoring dominates because it may require many shortest-path queries. Systems use radius caps, beams, cached route distances, contraction hierarchies, or other route indexes to keep k and transition cost bounded.',
        'When sampling becomes sparse, transition scoring becomes more important and less certain. When GPS accuracy gets worse, the candidate set grows. Both cases raise cost and lower confidence.',
        'There is a latency split between online and offline matching. A navigation app needs quick incremental updates and may accept a provisional match that changes as more samples arrive. A fleet analytics pipeline can batch a full trip, use slower routing, and produce a cleaner final trace. The same HMM idea can serve both, but the buffering and confidence policy differ.',
      ],
    },
    {
      heading: 'Implementation guidance',
      paragraphs: [
        'Start with clean coordinate handling. Project coordinates into a metric space before distance calculations, keep units explicit, and account for reported GPS accuracy when computing emissions. A meter/kilometer mix-up or a latitude-degree distance shortcut can dominate every later model choice.',
        'Make the road candidate object rich enough: edge id, offset, side of street when relevant, heading compatibility, access mode, road class, and snapped coordinate. Transition scoring should use the routing graph, not just Euclidean distance between snapped points.',
        'Use beam pruning carefully. Dropping low-scoring candidates keeps latency bounded, but it can remove the true road during noisy segments. A good implementation records when pruning happened and treats narrow score gaps as low-confidence rather than definitive.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'HMM matching fits trip reconstruction, ETA modeling, toll detection, route replay, traffic-speed inference, fleet analytics, and geofence preprocessing. These systems care about route continuity, not just the nearest geometry to each point.',
        'It also gives engineers an audit path. A disputed match can be replayed from observations, candidates, emissions, transitions, backpointers, and map version.',
        'It is especially strong when samples are moderately noisy but still frequent enough to constrain movement. In that regime, emissions narrow local candidates and transitions reject impossible jumps. The two signals correct each other.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Sparse traces can hide the actual path between samples. Tunnels and urban canyons can produce long gaps or biased points. Parallel roads, stacked roads, private roads, missing map edges, wrong turn restrictions, and ferries can all beat the scoring model.',
        'The model also depends on the travel mode. A pedestrian, cyclist, truck, and car may have different legal paths through the same map. A good matcher makes the mode and policy explicit.',
        'It can also fail silently when confidence is hidden. A clean-looking polyline may be the best of several weak alternatives. Products should expose uncertainty through degraded displays, delayed finalization, manual review flags, or downstream filters instead of treating every matched route as equally trustworthy.',
      ],
    },
    {
      heading: 'What to tune',
      paragraphs: [
        'Tune the emission model to the sensor, not to an ideal GPS. Phones, vehicle trackers, watches, and embedded modules have different noise patterns. Reported accuracy may be missing or miscalibrated. Heading may be reliable at speed and noisy while stopped.',
        'Tune the transition model to the road network and product. A delivery fleet may need truck restrictions. A cycling app needs paths and bike lanes. A tolling system needs policy around ramps and gantries. A traffic analytics system may care more about segment speed than exact lane-level geometry.',
        'Evaluate with labeled traces that include hard cases: parallel roads, bridges, tunnels, stops, sparse sampling, urban canyons, private roads, map gaps, and mode changes. Aggregate accuracy is not enough if the failures concentrate in expensive product scenarios.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Read Newson and Krumm, Hidden Markov Map Matching Through Noise and Sparseness, then study Dijkstra, A* Search, Contraction Hierarchy Route Planner, Geofence Point-in-Polygon, R-tree spatial indexing, HMM/Viterbi dynamic programming, Kalman filtering, and confidence calibration.',
      ],
    },
  ],
};
