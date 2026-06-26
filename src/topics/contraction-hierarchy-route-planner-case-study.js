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


export const article = { sections: [
  { heading: 'How to read the animation', paragraphs: [
    'The preprocess view shows offline work on a mostly stable road graph. Active nodes are vertices being ranked or contracted, compare paths are witness searches, and found edges are shortcuts that preserve distances.',
    'The fast-query view shows the online payoff. The search climbs upward through ranked edges, skips low-level vertices through shortcuts, then unpacks shortcuts back into original road edges for the route response.',
  ] },
  { heading: 'Why this exists', paragraphs: [
    'A road router answers many shortest-path queries over a graph whose topology changes slowly. Running Dijkstra from scratch for every source and target repeats the same local-street exploration all day.',
    'Contraction hierarchies move that repeated work into preprocessing. They rank vertices, hide low-importance intersections, and add shortcuts so later exact queries visit far fewer nodes.',
    {type:'callout', text:'Contraction hierarchies buy fast routes by turning stable road topology into ranked shortcuts with witness-proofed distance preservation.'},
    {type:'image', src:'https://upload.wikimedia.org/wikipedia/commons/3/31/Road-movement-hierarchy.svg', alt:'A road network diagram with arrows moving from local access roads through collection, distribution, transition, and main movement.', caption:'Hierarchy of traffic movement in road networks. Source: Wikimedia Commons, Ftrebien, CC0 1.0.'},
  ] },
  { heading: 'The obvious approach', paragraphs: [
    'The obvious exact baseline is Dijkstra with a priority queue. It is correct for nonnegative edge weights, but it expands broadly before it proves the target distance.',
    'A* is the next reasonable step. A geographic lower bound points the search toward the target, but the query still rediscovers local streets, ramps, and connectors that many other queries already explored.',
  ] },
  { heading: 'The wall', paragraphs: [
    'The wall is repeated local expansion. A long route usually climbs from local roads to arterials or highways, crosses a high-level corridor, then descends near the destination.',
    'A query-time algorithm without stored hierarchy pays that climb and descent every time. It has no certificate saying which low-level vertices can be skipped without changing the shortest distance.',
  ] },
  { heading: 'The core insight', paragraphs: [
    'Contract low-importance vertices while preserving distances among the remaining vertices. If the shortest path from neighbor u to neighbor w would pass through contracted vertex v, add a shortcut u-w with the same cost.',
    'The witness search is the guardrail. If another path from u to w avoiding v is no more expensive, no shortcut is needed; otherwise the shortcut is required before v can be hidden.',
  ] },
  { heading: 'How it works', paragraphs: [
    'Preprocessing chooses a contraction order, usually putting minor streets low and major junctions high. For each vertex v, it checks neighbor pairs and runs bounded witness searches to decide which shortcuts must be added.',
    'A query runs bidirectional upward search. The forward side starts at the source and follows only edges to higher-ranked vertices; the reverse side does the same from the target in the reversed graph; the best meeting vertex gives the compressed path.',
  ] },
  { heading: 'Why it works', paragraphs: [
    'Correctness is an induction over contractions. When v is removed, every shortest path among remaining vertices that needed v is represented by an equal-cost shortcut, while paths not using v remain unchanged.',
    'After all contractions, any shortest path has an equivalent representation that climbs in rank to a peak and then descends. The bidirectional upward query finds that representation, and unpacking preserves the original road sequence.',
  ] },
  { heading: 'Cost and complexity', paragraphs: [
    'The query cost can drop from hundreds of thousands of settled vertices to hundreds or a few thousand on large road graphs. If Dijkstra settles 500000 vertices and CH settles 800, the online work is about 625x smaller before unpacking.',
    'The tax is preprocessing and memory. Witness searches can take minutes or hours on continental graphs, shortcuts may grow edge storage by 1.5x to 3x, and each metric profile needs rebuilding or customization.',
  ] },
  { heading: 'Real-world uses', paragraphs: [
    'Contraction hierarchies fit car navigation, distance matrices for fleet routing, map matching, isochrones, and route previews. The common access pattern is many queries over a graph and metric that are stable enough to amortize preprocessing.',
    'They also support systems work beyond maps. The same trade appears whenever a service builds an expensive index once so online requests can use a smaller search surface.',
  ] },
  { heading: 'Where it fails', paragraphs: [
    'It fails when edge weights change per request. Live traffic, truck restrictions, toll avoidance, weather, and time-dependent turn costs can invalidate shortcuts unless the system uses customization, overlays, or fallback search.',
    'It also fails with bad contraction order or witness bugs. A bad order can create shortcut explosion, while an omitted required shortcut can silently return wrong distances for specific pairs.',
  ] },
  { heading: 'Worked example', paragraphs: [
    'Use the animation path S-A-B-C-D-T with weights S-A=2, A-B=1, B-C=1, C-D=1, and D-T=2. Contract B first; the A-to-C route through B costs 2, and no avoiding witness costs 2 or less, so add shortcut A-C with weight 2.',
    'Contract C next; A-to-D through C costs 3, so add shortcut A-D with weight 3 when no avoiding witness is cheaper. Query S to T uses S-A-D-T with cost 2+3+2=7, then unpacks A-D into A-C-D and A-C into A-B-C.',
  ] },
  { heading: 'Sources and study next', paragraphs: [
    'Primary sources: Geisberger, Sanders, Schultes, and Delling on Contraction Hierarchies; Dibbelt, Strasser, and Wagner on Customizable Contraction Hierarchies; and OSRM design material. Study Dijkstra, bidirectional search, witness search, and route unpacking next.',
    'Then compare A*, ALT landmarks, Customizable Route Planning, turn-expanded graphs, traffic overlays, and HMM map matching. The engineering question is whether preprocessing is stable enough to buy lower online latency.',
  ] },
] };
