// Hopcroft-Karp: maximum bipartite matching by augmenting many shortest paths
// per phase instead of one path at a time.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'hopcroft-karp-bipartite-matching',
  title: 'Hopcroft-Karp Bipartite Matching',
  category: 'Data Structures',
  summary: 'Find maximum bipartite matchings by layering shortest augmenting paths with BFS, then augmenting a disjoint batch with DFS.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['layered search', 'augment phase'], defaultValue: 'layered search' },
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

function matchingGraph(title) {
  return graphState({
    nodes: [
      { id: 'u1', label: 'u1', x: 1.0, y: 1.2, note: 'free left' },
      { id: 'u2', label: 'u2', x: 1.0, y: 3.2, note: 'matched' },
      { id: 'u3', label: 'u3', x: 1.0, y: 5.2, note: 'free left' },
      { id: 'u4', label: 'u4', x: 1.0, y: 7.2, note: 'matched' },
      { id: 'v1', label: 'v1', x: 5.0, y: 1.2, note: 'matched' },
      { id: 'v2', label: 'v2', x: 5.0, y: 3.2, note: 'matched' },
      { id: 'v3', label: 'v3', x: 5.0, y: 5.2, note: 'free right' },
      { id: 'v4', label: 'v4', x: 5.0, y: 7.2, note: 'free right' },
      { id: 'nil', label: 'NIL', x: 8.5, y: 4.2, note: 'free endpoint' },
    ],
    edges: [
      { id: 'e-u1-v1', from: 'u1', to: 'v1', weight: 'candidate' },
      { id: 'e-u1-v3', from: 'u1', to: 'v3', weight: 'free target' },
      { id: 'e-u2-v1', from: 'u2', to: 'v1', weight: 'matched' },
      { id: 'e-u2-v2', from: 'u2', to: 'v2', weight: 'candidate' },
      { id: 'e-u3-v2', from: 'u3', to: 'v2', weight: 'candidate' },
      { id: 'e-u3-v4', from: 'u3', to: 'v4', weight: 'free target' },
      { id: 'e-u4-v2', from: 'u4', to: 'v2', weight: 'matched' },
      { id: 'e-u4-v4', from: 'u4', to: 'v4', weight: 'candidate' },
      { id: 'e-v3-nil', from: 'v3', to: 'nil', weight: 'unmatched' },
      { id: 'e-v4-nil', from: 'v4', to: 'nil', weight: 'unmatched' },
    ],
  }, { title });
}

function* layeredSearch() {
  yield {
    state: matchingGraph('Start from all free vertices on the left'),
    highlight: { active: ['u1', 'u3'], compare: ['u2', 'u4'], found: ['v3', 'v4'] },
    explanation: 'Hopcroft-Karp keeps a partial matching. Each phase begins with BFS from every free vertex on the left side. The goal is not one path; it is the full layer graph of shortest augmenting paths.',
    invariant: 'Only shortest augmenting paths are eligible in the current phase.',
  };

  yield {
    state: labelMatrix(
      'BFS alternates edge types',
      [
        { id: 'l0', label: 'layer 0' },
        { id: 'l1', label: 'layer 1' },
        { id: 'l2', label: 'layer 2' },
        { id: 'stop', label: 'stop' },
      ],
      [{ id: 'vertices', label: 'vertices' }, { id: 'edge_rule', label: 'edge rule' }],
      [
        ['free U: u1,u3', 'start'],
        ['unmatched edges to V', 'u -> v not in M'],
        ['matched partners in U', 'v -> pair[v]'],
        ['first free V found', 'distance to NIL fixed'],
      ],
    ),
    highlight: { active: ['l0:vertices', 'l1:edge_rule'], found: ['stop:vertices'] },
    explanation: 'The BFS direction matters. From U, follow edges not currently in the matching. From V, follow the matched edge back to U. The first time a free V is reachable, the shortest augmenting length is known.',
  };

  yield {
    state: matchingGraph('Layer graph exposes two shortest augmenting paths'),
    highlight: { active: ['u1', 'v3', 'e-u1-v3', 'u3', 'v4', 'e-u3-v4'], found: ['nil'] },
    explanation: 'In this toy graph, u1->v3 and u3->v4 are both shortest augmenting paths and they are vertex-disjoint. A one-path-at-a-time algorithm would augment only one. Hopcroft-Karp takes both in the same phase.',
  };

  yield {
    state: labelMatrix(
      'Why batching matters',
      [
        { id: 'single', label: 'one path per pass' },
        { id: 'hk', label: 'Hopcroft-Karp' },
        { id: 'dense', label: 'dense graph' },
        { id: 'sparse', label: 'sparse graph' },
      ],
      [{ id: 'idea', label: 'idea' }, { id: 'cost', label: 'cost' }],
      [
        ['augment greedily', 'can need many passes'],
        ['batch shortest paths', 'O(E sqrt(V))'],
        ['many edges', 'BFS dominates'],
        ['few edges', 'batching still helps'],
      ],
    ),
    highlight: { found: ['hk:cost'], compare: ['single:cost'] },
    explanation: 'The data-structure lesson is phase discipline. By refusing longer paths until all shortest ones are exhausted, the algorithm bounds how often path length can increase.',
  };
}

function* augmentPhase() {
  yield {
    state: labelMatrix(
      'DFS only follows the BFS layers',
      [
        { id: 'try1', label: 'try u1' },
        { id: 'take1', label: 'take v3' },
        { id: 'try3', label: 'try u3' },
        { id: 'take3', label: 'take v4' },
      ],
      [{ id: 'dfs', label: 'DFS choice' }, { id: 'result', label: 'result' }],
      [
        ['u1 -> v3', 'augment'],
        ['flip edge', 'u1 matched'],
        ['u3 -> v4', 'augment'],
        ['flip edge', 'u3 matched'],
      ],
    ),
    highlight: { active: ['try1:dfs', 'try3:dfs'], found: ['take1:result', 'take3:result'] },
    explanation: 'After BFS fixes the shortest distance, DFS searches for vertex-disjoint augmenting paths inside that layered graph. It ignores edges that would leave the layer discipline.',
    invariant: 'A phase augments a maximal set of vertex-disjoint shortest augmenting paths.',
  };

  yield {
    state: matchingGraph('Flip unmatched/matched status along each path'),
    highlight: { found: ['e-u1-v3', 'e-u3-v4'], active: ['u1', 'v3', 'u3', 'v4'], compare: ['e-u2-v1', 'e-u4-v2'] },
    explanation: 'Augmenting means toggling every edge on the path. Unmatched edges become matched; matched edges on longer alternating paths would be removed. The matching size increases by one per augmenting path.',
  };

  yield {
    state: labelMatrix(
      'Case study: marketplace assignment',
      [
        { id: 'left', label: 'left side' },
        { id: 'right', label: 'right side' },
        { id: 'edge', label: 'edge' },
        { id: 'matching', label: 'matching' },
      ],
      [{ id: 'meaning', label: 'meaning' }, { id: 'constraint', label: 'constraint' }],
      [
        ['drivers', 'one route each'],
        ['delivery routes', 'one driver each'],
        ['qualified + available', 'eligible assignment'],
        ['chosen edges', 'no shared endpoint'],
      ],
    ),
    highlight: { active: ['edge:meaning'], found: ['matching:constraint'] },
    explanation: 'The complete use case is assignment under binary eligibility. If every driver-route pair is either allowed or not allowed, maximum bipartite matching finds the largest feasible assignment before cost optimization enters the picture.',
  };

  yield {
    state: labelMatrix(
      'Where to go next',
      [
        { id: 'unweighted', label: 'unweighted matching' },
        { id: 'weighted', label: 'weighted assignment' },
        { id: 'flow', label: 'flow network' },
        { id: 'dynamic', label: 'changing graph' },
      ],
      [{ id: 'tool', label: 'tool' }, { id: 'reason', label: 'reason' }],
      [
        ['Hopcroft-Karp', 'maximize cardinality'],
        ['Hungarian / min-cost flow', 'optimize value'],
        ['Max flow', 'general capacities'],
        ['incremental matching', 'avoid full rebuild'],
      ],
    ),
    highlight: { found: ['unweighted:tool', 'flow:tool'], compare: ['weighted:tool'] },
    explanation: 'Hopcroft-Karp solves a specific matching problem extremely well. If edges have costs, capacities, or non-bipartite structure, the problem has changed and the data structure should change with it.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'layered search') yield* layeredSearch();
  else if (view === 'augment phase') yield* augmentPhase();
  else throw new InputError('Pick a Hopcroft-Karp view.');
}

export const article = {
  sections: [
    { heading: 'What it is', paragraphs: [
      'Hopcroft-Karp is an algorithm for maximum cardinality matching in bipartite graphs. A bipartite graph has a left side and a right side, and a matching is a set of edges with no shared endpoints. The algorithm finds as many disjoint pairs as possible.',
      'The core idea is to augment in batches. Simpler augmenting-path algorithms find one path from an unmatched left vertex to an unmatched right vertex, flip it, and repeat. Hopcroft-Karp finds a maximal set of shortest vertex-disjoint augmenting paths in each phase.',
    ] },
    { heading: 'How it works', paragraphs: [
      'Each phase starts with BFS from all free vertices on the left. From left vertices, BFS follows unmatched edges. From right vertices, it follows the currently matched edge back to the left. This builds a layered graph and discovers the distance to the nearest free right endpoint.',
      'Then DFS searches only inside that layered graph. Every successful DFS returns one shortest augmenting path, and the algorithm flips all paths found in the phase. Once no augmenting path exists, the matching is maximum.',
    ] },
    { heading: 'Cost and complexity', paragraphs: [
      'The classic bound is O(E sqrt(V)). A single phase costs O(E), and the number of phases is bounded by O(sqrt(V)). The memory footprint is simple: adjacency lists, pair arrays for both sides, distances for BFS, and recursion or an explicit stack for DFS.',
      'The main implementation bugs are mixing the two sides, allowing DFS to ignore the BFS distance labels, and forgetting that NIL or the free-right endpoint is part of the BFS stopping condition. The phase boundary is the algorithm.',
      'In practice, adjacency-list layout matters because the algorithm repeatedly scans edges during BFS and DFS phases. Dense eligibility graphs may be better modeled as flow or assignment problems with additional structure, while sparse eligibility graphs are exactly where Hopcroft-Karp is easy to justify.',
    ] },
    { heading: 'Complete case study', paragraphs: [
      'Imagine a delivery marketplace where drivers can take only routes for which they have the right vehicle, time window, and region. Drivers are left vertices, routes are right vertices, and eligibility creates edges. Hopcroft-Karp returns the largest possible set of assignments if every feasible assignment has the same value.',
      'If routes have different values or drivers have preferences, cardinality matching is only the first layer. The next step becomes weighted assignment or min-cost flow. That distinction is important: Hopcroft-Karp is excellent when the question is "how many pairs can we form?"',
      'A useful production pattern is to run maximum matching first as a feasibility check, then run a richer optimizer only if the maximum cardinality is acceptable. That keeps the data-structure lesson clean: cardinality, cost, fairness, and stability are separate constraints.',
    ] },
    { heading: 'Sources and study next', paragraphs: [
      'Sources: Hopcroft and Karp, "An n^(5/2) Algorithm for Maximum Matchings in Bipartite Graphs", https://epubs.siam.org/doi/10.1137/0202019, and a PDF copy at https://web.eecs.umich.edu/~pettie/matching/Hopcroft-Karp-bipartite-matching.pdf. Study Graph BFS, DFS Traversal, Max Flow, Binary Heap, and Two Pointers next.',
    ] },
  ],
};
