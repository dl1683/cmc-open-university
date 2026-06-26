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
      heading: 'How to read the animation',
      paragraphs: [
        'Read each GPS dot as an observation and each nearby road position as a hidden-state candidate. A hidden Markov model, or HMM, is a model where the real state is not observed directly but emits noisy observations.',
        'Active candidates are still possible route positions at that time step. A safe inference is that the best local snap can lose if it creates an impossible or unlikely transition from the previous road candidate.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'A map app receives points, not roads. Each GPS sample has sensor noise, clock gaps, and a location that may fall between lanes, beside a highway, inside a building, or several meters from the vehicle.',
        'The product needs a road sequence for ETA, tolling, mileage, traffic inference, fleet compliance, and route replay. Map matching turns noisy observations into a plausible path through a road graph.',
        {type:'callout', text:'HMM map matching wins by scoring whole paths, not isolated points: emissions explain local GPS fit while transitions enforce route plausibility.'},
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is nearest-road snapping. For each GPS point, find the closest road segment and call that the answer.',
        'That approach is reasonable on quiet streets with frequent accurate samples. It is fast, simple, and often good enough when geometry and legal route connectivity agree.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall appears when nearby geometry is not reachable road motion. A frontage road can sit five meters from a freeway, a bridge can cross a road without connecting, and a one-way rule can make the closest segment illegal.',
        'Sparse sampling makes the wall larger. If samples arrive every 30 seconds, the vehicle may have taken many legal paths between points, so independent snapping cannot explain continuity.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'The core insight is to score sequences, not points. Emission scores measure how well one road candidate explains one GPS sample, while transition scores measure whether movement between two candidates is plausible in the road network.',
        'Viterbi is the dynamic program that finds the best hidden-state sequence under those scores. It avoids enumerating every possible route by keeping only the best prefix ending at each candidate.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Candidate generation uses a spatial index over road geometry. For each GPS point, the matcher finds nearby road positions and records edge id, offset, snapped coordinate, heading compatibility, road class, and access rules.',
        'The emission score usually decreases as distance from the GPS point increases, often adjusted by reported accuracy. The transition score compares observed movement and elapsed time with legal road-network distance between candidates.',
        'For time t and candidate c, Viterbi stores the best score ending at c and the predecessor that produced it. After the last sample, backpointers recover the chosen candidate sequence and the road paths between candidates.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Viterbi is correct for the HMM scoring model because of optimal substructure. Once the best score ending at each predecessor is known, older history can affect candidate c only through those predecessor scores.',
        'That lets the algorithm discard weaker prefixes safely. It proves the returned route is the highest-scoring hidden-state sequence under the model, not that the map, GPS, or scoring assumptions are always true.',
        'The product correctness invariant is candidate recall. If the true road never enters the candidate set, no dynamic program can recover it later.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Let T be the number of GPS samples and k be the average candidates per sample. The dynamic program is roughly O(T * k^2) before pruning because each candidate can connect to each candidate in the next column.',
        'Transition scoring usually dominates cost because it can require shortest-path queries. Systems use radius caps, beams, cached route distances, contraction hierarchies, or other routing indexes to keep cost bounded.',
        'Behavior changes with signal quality. Worse GPS accuracy increases k, sparse samples increase transition uncertainty, and both raise latency while lowering confidence.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'HMM map matching fits navigation traces, ETA modeling, toll detection, route replay, traffic-speed inference, fleet analytics, and geofence preprocessing. These systems care about route continuity, not just closest geometry.',
        'It also gives an audit path. A disputed trip can be replayed from raw samples, candidate sets, emission scores, transition scores, map version, routing engine version, and chosen backpointers.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'It fails when the right road is absent from the candidate set. Bad map data, too-small search radius, wrong travel mode, heading filters, and stale access rules can remove truth before Viterbi runs.',
        'It also fails when the scoring model ignores real constraints. Tunnels, urban canyons, stacked roads, ferries, private roads, truck restrictions, and missing turn restrictions can make a clean-looking route wrong.',
        'Confidence can fail silently. The best route may be only slightly better than the second-best route, so downstream products should degrade or flag low-confidence matches instead of treating every polyline as equally certain.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'A van drives on a highway beside a service road. Three GPS points land between them, producing two candidates per point: H for highway and S for service road.',
        'At point 1, H is 6 meters away and S is 4 meters away, so nearest-road snapping chooses S. At point 2, H is 5 meters away and S is 7 meters away, and at point 3 H is 4 meters away and S is 6 meters away, so snapping produces S, H, H.',
        'The HMM keeps H, H, H if the transition from S to H requires a 900-meter ramp detour but the samples are only 80 meters and 5 seconds apart. A slightly worse local emission loses to a much better sequence score.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Start with Newson and Krumm, Hidden Markov Map Matching Through Noise and Sparseness. Then compare implementations and routing-engine notes that discuss candidate search, transition scoring, and confidence reporting.',
        'Study Viterbi Dynamic Programming, Dijkstra, A* Search, Contraction Hierarchy Route Planner, R-tree Spatial Indexing, Kalman Filtering, Geofence Point-in-Polygon, and Confidence Calibration next.',
      ],
    },
  ],
};
