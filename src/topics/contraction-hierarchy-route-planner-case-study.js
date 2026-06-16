// Contraction hierarchies: preprocess a road graph by contracting low-importance
// vertices and adding shortcuts, then answer shortest-path queries quickly.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'contraction-hierarchy-route-planner-case-study',
  title: 'Contraction Hierarchy Route Planner Case Study',
  category: 'Systems',
  summary: 'A route-planning case study: road-graph preprocessing, node importance, witness search, shortcut edges, upward/downward queries, traffic customization, and update tradeoffs.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['preprocess', 'fast query'], defaultValue: 'preprocess' },
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

function roadGraph(title) {
  return graphState({
    nodes: [
      { id: 's', label: 'S', x: 0.8, y: 3.5, note: 'start' },
      { id: 'a', label: 'A', x: 2.3, y: 2.2, note: 'local' },
      { id: 'b', label: 'B', x: 3.8, y: 3.5, note: 'minor' },
      { id: 'c', label: 'C', x: 5.3, y: 2.2, note: 'artery' },
      { id: 'd', label: 'D', x: 6.8, y: 3.5, note: 'hub' },
      { id: 't', label: 'T', x: 8.5, y: 3.5, note: 'goal' },
      { id: 'short', label: 'shortcut', x: 4.6, y: 5.6, note: 'A-D' },
    ],
    edges: [
      { id: 'e-s-a', from: 's', to: 'a', weight: 2 },
      { id: 'e-a-b', from: 'a', to: 'b', weight: 1 },
      { id: 'e-b-c', from: 'b', to: 'c', weight: 1 },
      { id: 'e-c-d', from: 'c', to: 'd', weight: 1 },
      { id: 'e-d-t', from: 'd', to: 't', weight: 2 },
      { id: 'e-a-d', from: 'a', to: 'd', weight: 3 },
      { id: 'e-a-short', from: 'a', to: 'short', weight: 'skip' },
      { id: 'e-short-d', from: 'short', to: 'd', weight: 'skip' },
    ],
  }, { title });
}

function* preprocess() {
  yield {
    state: roadGraph('Start with a road graph'),
    highlight: { active: ['s', 'a', 'b', 'c', 'd', 't', 'e-a-b', 'e-b-c', 'e-c-d'], compare: ['short'] },
    explanation: 'Contraction hierarchies accelerate shortest-path queries by doing expensive preprocessing on a mostly stable road graph.',
  };
  yield {
    state: labelMatrix(
      'Contract order',
      [
        { id: 'b', label: 'B' },
        { id: 'a', label: 'A' },
        { id: 'c', label: 'C' },
        { id: 'd', label: 'D' },
      ],
      [
        { id: 'rank', label: 'rank' },
        { id: 'why', label: 'why' },
      ],
      [
        ['low', 'minor'],
        ['mid', 'local'],
        ['high', 'artery'],
        ['top', 'hub'],
      ],
    ),
    highlight: { active: ['b:rank', 'a:rank'], compare: ['d:rank'] },
    explanation: 'Preprocessing assigns importance ranks. Low-importance nodes are contracted first. Important junctions and arterials survive higher in the hierarchy.',
    invariant: 'Shortcut correctness depends on witness searches during contraction.',
  };
  yield {
    state: roadGraph('Contracting minor nodes creates shortcuts'),
    highlight: { active: ['b', 'c', 'short', 'e-a-short', 'e-short-d'], found: ['e-a-d'], compare: ['e-a-b', 'e-b-c', 'e-c-d'] },
    explanation: 'When a contracted node lies on the shortest path between two neighbors, preprocessing adds a shortcut so future queries can skip the hidden local path.',
  };
  yield {
    state: labelMatrix(
      'Preprocess ledger',
      [
        { id: 'order', label: 'order' },
        { id: 'witness', label: 'witness' },
        { id: 'short', label: 'shortcuts' },
        { id: 'metric', label: 'metric' },
      ],
      [
        { id: 'stored', label: 'stored' },
        { id: 'cost', label: 'cost' },
      ],
      [
        ['ranks', 'minutes'],
        ['searches', 'heavy'],
        ['edges', 'memory'],
        ['time', 'rebuild?'],
      ],
    ),
    highlight: { found: ['order:stored', 'short:stored'], compare: ['witness:cost', 'metric:cost'] },
    explanation: 'The speed comes from a preprocessing ledger: contraction order, witness-search results, shortcut edges, and metric assumptions. Dynamic traffic complicates the story.',
  };
}

function* fastQuery() {
  yield {
    state: roadGraph('Query searches upward through shortcut graph'),
    highlight: { active: ['s', 'a', 'short', 'd', 't', 'e-s-a', 'e-a-short', 'e-short-d', 'e-d-t'], removed: ['b', 'c'] },
    explanation: 'At query time, the router searches mostly upward in node importance, uses shortcuts to skip low-level paths, and then unpacks shortcuts into the original road sequence.',
  };
  yield {
    state: plotState({
      axes: { x: { label: 'query', min: 0, max: 4 }, y: { label: 'visited nodes', min: 0, max: 1000 } },
      series: [
        { id: 'dij', label: 'Dijkstra', points: [{ x: 0, y: 900 }, { x: 1, y: 870 }, { x: 2, y: 930 }, { x: 3, y: 890 }] },
        { id: 'ch', label: 'CH', points: [{ x: 0, y: 80 }, { x: 1, y: 60 }, { x: 2, y: 95 }, { x: 3, y: 70 }] },
      ],
      markers: [
        { id: 'fast', x: 1, y: 60, label: 'fast' },
      ],
    }),
    highlight: { active: ['ch', 'fast'], compare: ['dij'] },
    explanation: 'The payoff is fewer visited nodes per route query. The cost is preprocessing time, extra shortcut storage, and trickier updates when road weights change.',
  };
  yield {
    state: labelMatrix(
      'Update tradeoffs',
      [
        { id: 'closure', label: 'road close' },
        { id: 'traffic', label: 'traffic' },
        { id: 'profile', label: 'profile' },
        { id: 'map', label: 'new map' },
      ],
      [
        { id: 'effect', label: 'effect' },
        { id: 'action', label: 'action' },
      ],
      [
        ['topology', 'rebuild'],
        ['weights', 'customize'],
        ['avoid toll', 'metric'],
        ['nodes', 'reprep'],
      ],
    ),
    highlight: { found: ['traffic:action', 'profile:action'], compare: ['closure:action', 'map:action'] },
    explanation: 'Contraction hierarchies are excellent when topology is stable. Live traffic and preferences need customization or alternative routing strategies.',
  };
  yield {
    state: labelMatrix(
      'Route artifact',
      [
        { id: 'path', label: 'path' },
        { id: 'short', label: 'shortcuts' },
        { id: 'eta', label: 'ETA' },
        { id: 'audit', label: 'audit' },
      ],
      [
        { id: 'value', label: 'val' },
        { id: 'need', label: 'need' },
      ],
      [
        ['S-A-D-T', 'unpack'],
        ['A-D', 'expand'],
        ['6 min', 'metric'],
        ['version', 'replay'],
      ],
    ),
    highlight: { found: ['path:need', 'short:need', 'audit:need'] },
    explanation: 'A route response should include enough versioning to explain it later: graph version, metric profile, traffic snapshot, and any shortcuts that were unpacked.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'preprocess') yield* preprocess();
  else if (view === 'fast query') yield* fastQuery();
  else throw new InputError('Pick a contraction-hierarchy view.');
}

export const article = {
  sections: [
    { heading: 'What it is', paragraphs: ['A contraction hierarchy is a shortest-path speedup technique for road networks. It preprocesses a graph by contracting low-importance vertices and adding shortcut edges that preserve shortest-path distances.'] },
    { heading: 'How it works', paragraphs: ['During preprocessing, the system chooses an importance order. When contracting a node, witness searches decide whether shortcuts are required between its neighbors. Query time then searches mostly upward through the hierarchy and unpacks shortcuts into real roads.'] },
    { heading: 'Case study', paragraphs: ['A route from a neighborhood street to an airport would make Dijkstra inspect many local intersections. A contraction hierarchy skips low-level streets through shortcuts, visits far fewer nodes, and then expands the shortcuts for turn-by-turn output.'] },
    { heading: 'Pitfalls', paragraphs: ['Do not forget the cost of preprocessing and shortcut storage. Do not assume road closures or live traffic are free updates. Do not return shortcuts directly to users without unpacking them into real road geometry.'] },
    { heading: 'Why it matters', paragraphs: ['Fast routing is a data-structure story: road graph, node ranks, shortcut edges, metric snapshots, and route replay metadata. Dijkstra is the baseline; contraction hierarchies are one production acceleration strategy.'] },
    { heading: 'Sources and study next', paragraphs: ['Study sources: OSRM routing context at https://github.com/Project-OSRM/osrm-backend/issues/5443, contraction hierarchy overview at https://en.wikipedia.org/wiki/Contraction_hierarchies, and customizable CH notes at https://curiouscoding.nl/posts/cch/. Study Dijkstra, A* Search, HMM Map Matching, and BGP Route Selection next.'] },
  ],
};
