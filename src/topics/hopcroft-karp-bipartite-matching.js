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
    {
      heading: 'Why this exists',
      paragraphs: [
        `Bipartite matching is the problem of pairing items from a left set with items from a right set when each item can be used at most once. Drivers can be paired with routes, students with projects, workers with shifts, tests with machines, reviewers with papers, or jobs with eligible devices. An edge means the pair is allowed.`,
        `The maximum-cardinality version ignores preferences and asks one narrow question: how many compatible pairs can be chosen without sharing endpoints? That question is often the feasibility layer before a richer optimizer. If only 93 of 100 shifts can be covered under the eligibility graph, no weighting scheme can cover all 100 without changing constraints.`,
        `Hopcroft-Karp exists because the simple augmenting-path method is correct but can waste passes. It keeps the same correctness theorem as the simple method, then changes the schedule: instead of finding one augmenting path per search, it finds a maximal batch of shortest augmenting paths in each phase.`,
      ],
    },
    {
      heading: 'The obvious approach and the wall',
      paragraphs: [
        `The obvious algorithm keeps a current matching, searches for an augmenting path, flips that path, and repeats. An augmenting path starts at a free vertex on the left, ends at a free vertex on the right, and alternates between edges not in the matching and edges already in the matching. Flipping means selected edges become unselected and unselected edges become selected.`,
        `That method is not naive in the dismissive sense. It is the core idea. Each successful flip increases the matching size by exactly one, and if no augmenting path remains, the matching is maximum. The problem is the schedule. One search can return one path even when many disjoint shortest paths are available at the same time.`,
        `The wall is repeated rediscovery. A one-path-at-a-time algorithm may scan the same graph region over and over, increasing the matching by one per pass. Hopcroft-Karp asks a stronger question in each phase: what is the shortest augmenting length right now, and how many vertex-disjoint paths of that length can we take before allowing longer paths?`,
      ],
    },
    {
      heading: 'Core insight',
      paragraphs: [
        `The core insight is phase discipline. BFS from all free left vertices builds a layer graph of shortest alternating paths. From a left vertex, the search follows unmatched edges to the right. From a right vertex that is already matched, it follows the matched edge back to the left. The first free right side reached fixes the shortest augmenting distance for the phase.`,
        `DFS then searches only inside that layer graph. It is not allowed to wander into longer paths or ignore the distance labels. Its job is to find a maximal set of vertex-disjoint shortest augmenting paths. After those paths are flipped, every shortest augmenting path of that old length is gone.`,
        `That is why the algorithm is faster. The matching grows by a batch when many short paths exist. When it cannot grow by a large batch, the shortest augmenting paths get longer, and there can only be so many long vertex-disjoint paths left.`,
      ],
    },
    {
      heading: 'Mechanism',
      paragraphs: [
        `A practical implementation stores adjacency lists from left vertices to right vertices, an array pairU for the right partner of each left vertex, an array pairV for the left partner of each right vertex, and a distance array for left vertices. A sentinel NIL represents a reachable free right endpoint during BFS. NIL is a stopping condition, not a real vertex that enters the matching.`,
        `Each phase starts by putting every free left vertex into the BFS queue at distance zero. Matched left vertices start unreachable for this phase. When BFS scans a left vertex u, it looks at each neighbor v. If v is free, the search has found a path to NIL at the next distance. If v is matched to some left vertex u2, and u2 has not yet received a distance, u2 gets distance dist[u] plus one and enters the queue.`,
        `The BFS result is a distance labeling for the alternating layer graph. DFS starts from each free left vertex and tries to reach NIL while respecting those labels. For an edge u to v, DFS may use v if v is free or if pairV[v] has distance dist[u] plus one and can continue the search. Edges that do not advance through the BFS layers are ignored for this phase.`,
        `When DFS finds a path, it updates pairU and pairV along the way. That flip may disqualify vertices for other DFS attempts in the same phase, which is why the algorithm seeks vertex-disjoint paths. Failed DFS states can be marked so later searches do not repeat work inside the same layer graph.`,
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        `The first correctness invariant is the definition of a matching: no two selected edges share an endpoint. Flipping an augmenting path preserves that invariant. Internal vertices on the path have exactly one matched edge before the flip and exactly one matched edge after the flip. The endpoints are free before the flip and become matched after it.`,
        `The path contains one more unmatched edge than matched edge because it starts and ends free. After the flip, that extra edge becomes selected, so the matching size increases by one. If a phase finds k vertex-disjoint augmenting paths, it can flip all k paths and increase the matching size by k because the paths do not fight over endpoints.`,
        `Berge's lemma gives the global stopping rule: a matching is maximum exactly when no augmenting path exists. Hopcroft-Karp does not replace that theorem. It uses the same theorem and organizes the search so that all shortest augmenting paths are exhausted before longer paths are considered.`,
        `The speed argument rests on what happens after a phase. If there were still an augmenting path of the same shortest length, DFS would not have found a maximal set. Since those paths are gone, the next successful phase either starts with longer paths or the previous phase already increased the matching by a large batch. That tension bounds the number of expensive full-graph phases.`,
      ],
    },
    {
      heading: 'Concrete example',
      paragraphs: [
        `In the visual example, u1 and u3 are free on the left. v3 and v4 are free on the right. The shortest augmenting paths are u1 to v3 and u3 to v4. They share no vertices, so one phase can flip both. The matching grows by two while a one-path algorithm would grow by one and then search again.`,
        `Now imagine a slightly harder case. A free u1 can reach matched v1, whose partner u2 can reach free v3. The alternating path is u1 to v1, v1 back through its matched edge to u2, and u2 to v3. Flipping that path frees the old u2-v1 edge but selects u1-v1 and u2-v3. The number of matched pairs still increases by one.`,
        `The BFS layer rule prevents DFS from grabbing a longer path while a shorter phase is active. That matters because a longer path may consume vertices that could have completed several shortest paths. Hopcroft-Karp is greedy about path length, not about the first path it happens to see.`,
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        `One phase costs O(E) with adjacency lists. BFS scans left-to-right candidate edges to build distances, and the DFS work can be bounded by edge scans inside the phase when failed choices are not repeated. The classic total running time is O(E * sqrt(V)) for a graph with V vertices and E edges.`,
        `The usual proof splits execution into short-path and long-path regimes. While shortest augmenting paths are short, a maximal set of vertex-disjoint shortest paths tends to increase the matching in useful batches. There cannot be too many phases before either the matching has grown substantially or the shortest path length rises.`,
        `Once the shortest augmenting path length exceeds sqrt(V), every remaining augmenting path uses many vertices. Since vertex-disjoint paths cannot collectively use more than V vertices, there can be only O(sqrt(V)) more successful augmentations by phase. Multiplying the O(E) phase cost by the bounded number of phases gives the O(E * sqrt(V)) result.`,
        `The memory cost is modest: adjacency lists, two partner arrays, a distance array, and the BFS/DFS stacks or queues. In practice, graph representation dominates. Dense graphs have many edges to scan. Sparse eligibility graphs are where Hopcroft-Karp usually feels like the right tool.`,
      ],
    },
    {
      heading: 'Implementation details',
      paragraphs: [
        `Keep left and right ids separate. Many bugs come from treating a right vertex id as an index into the left-side distance array, or from using zero as both a real vertex and the NIL sentinel. A small wrapper around ids is often worth it in production code.`,
        `The DFS condition is the most common correctness bug. From u through neighbor v, either v is free, or the matched partner pairV[v] must sit at the next BFS distance. If DFS follows an edge that violates that rule, the phase may no longer be restricted to shortest augmenting paths, and the complexity argument breaks even if the final matching still happens to be correct.`,
        `Be careful with failed searches. If DFS from a left vertex cannot reach NIL in the current layer graph, marking its distance as unreachable for the rest of the phase avoids repeated dead work. Clear or recompute that state in the next BFS phase, because a later matching can change which paths exist.`,
        `The algorithm returns a maximum-cardinality matching, not a proof that every left vertex can be matched. Callers should inspect the matching size and unmatched sets. In scheduling systems, the unmatched vertices are often the most useful output because they explain which resources, skills, or constraints are binding.`,
      ],
    },
    {
      heading: 'Useful contexts',
      paragraphs: [
        `Use Hopcroft-Karp when the graph is bipartite, edges mean binary eligibility, each vertex has unit capacity, and the objective is to maximize the number of pairs. It is a strong fit for sparse assignment problems where the matching size itself is the question.`,
        `It is also useful as a diagnostic pass. A marketplace can run maximum matching to see whether there are enough compatible drivers for routes before optimizing price or fairness. A test scheduler can check whether every test has at least one eligible machine. A reviewer assignment system can measure whether topic conflicts leave some papers uncovered.`,
        `The algorithm is less useful when the real problem is weighted from the start. If one valid assignment is much better than another, maximum cardinality is only a feasibility check. The next tool must understand costs, capacities, or fairness constraints.`,
      ],
    },
    {
      heading: 'Limits',
      paragraphs: [
        `Hopcroft-Karp requires a bipartite graph. If the graph can contain odd cycles and either side of the pair can be any vertex, use a general matching algorithm such as blossom. Forcing a non-bipartite problem into two sides can silently remove valid matches or add invalid ones.`,
        `It optimizes cardinality only. It does not choose the cheapest assignment, the fairest assignment, the most stable assignment, or the assignment with capacity greater than one. Hungarian algorithms, min-cost flow, max flow, b-matching, and stable matching solve different problems. The edge set may look similar, but the objective and constraints change the data structure.`,
        `It is also not an online matching policy by itself. If vertices and edges arrive continuously, rerunning Hopcroft-Karp after every update may be too expensive and too unstable. Dynamic or online matching methods trade optimality, update cost, and churn explicitly.`,
      ],
    },
    {
      heading: 'Failure modes',
      paragraphs: [
        `The first failure mode is bad modeling. Eligibility edges must mean the same thing across the whole graph. If one edge means "can do the job" and another means "prefers the job," maximum cardinality will optimize a mixed signal and produce misleading results.`,
        `The second failure mode is hiding constraints outside the graph. If a worker can take two short shifts, the unit-capacity model is wrong. If a route needs two drivers, the simple matching model is wrong. If assignments must be balanced across regions, plain cardinality is incomplete.`,
        `The third failure mode is assuming a maximum matching is the final product. In many systems it is evidence, not the whole decision. It tells you whether capacity exists under binary constraints. Humans or downstream optimizers may still need to choose among many maximum matchings.`,
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        `Primary source: Hopcroft and Karp, "An n^(5/2) Algorithm for Maximum Matchings in Bipartite Graphs", https://epubs.siam.org/doi/10.1137/0202019, with a PDF copy at https://web.eecs.umich.edu/~pettie/matching/Hopcroft-Karp-bipartite-matching.pdf.`,
        `Study Graph BFS for the layer construction, DFS Traversal for the restricted search, Max Flow for capacity-based formulations, Hungarian or min-cost flow methods for weighted assignment, and Dinic's algorithm as another example of building a level graph and pushing a batch of shortest augmenting structure before rebuilding the layers.`,
      ],
    },
  ],
};
