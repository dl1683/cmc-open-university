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
    { heading: 'What it is', paragraphs: ['HMM map matching converts noisy GPS points into a likely path on a road graph. Observed GPS samples are emissions; hidden states are candidate positions on roads; transitions score whether movement between candidates is plausible.'] },
    { heading: 'How it works', paragraphs: ['For each GPS point, find nearby road candidates. Score emissions from GPS distance and accuracy. Score transitions from shortest-path distance and elapsed time. Run Viterbi to select the best candidate sequence and reconstruct the road path.'] },
    { heading: 'Case study', paragraphs: ['A vehicle reports sparse GPS near two parallel roads. The nearest road changes point by point, but the HMM keeps the route on one plausible road because cross-road transitions are unlikely.'] },
    { heading: 'Pitfalls', paragraphs: ['Do not snap every point to the nearest road independently. Do not ignore GPS accuracy radius. Do not hide low confidence. Do not assume the map graph is complete.'] },
    { heading: 'Why it matters', paragraphs: ['Map matching joins spatial indexes, shortest-path routing, probability, and dynamic programming. It is the hidden data structure behind trip traces, ETA, geofencing, tolling, and traffic inference.'] },
    { heading: 'Sources and study next', paragraphs: ['Primary sources: Newson and Krumm map matching paper at https://www.microsoft.com/en-us/research/wp-content/uploads/2016/12/map-matching-ACM-GIS-camera-ready.pdf and publication page at https://www.microsoft.com/en-us/research/publication/hidden-markov-map-matching-noise-sparseness/. Study Dijkstra, A* Search, Geofence Point-in-Polygon, and Contraction Hierarchy Route Planner next.'] },
  ],
};
