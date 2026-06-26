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
  const leftCount = 4;
  const rightCount = 4;
  const totalVertices = leftCount + rightCount;
  const freeLeft = 2;
  const matchedLeft = leftCount - freeLeft;
  const freeRight = 2;
  const totalEdges = 10;
  const candidateEdges = totalEdges - matchedLeft - freeRight;

  yield {
    state: matchingGraph('Start from all free vertices on the left'),
    highlight: { active: ['u1', 'u3'], compare: ['u2', 'u4'], found: ['v3', 'v4'] },
    explanation: `Hopcroft-Karp keeps a partial matching. Each phase begins with BFS from every free vertex on the left side — here ${freeLeft} of ${leftCount} left vertices are free. The goal is not one path; it is the full layer graph of shortest augmenting paths across all ${totalEdges} edges.`,
    invariant: `Only shortest augmenting paths are eligible in the current phase; ${freeLeft} free left vertices seed the BFS.`,
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
    explanation: `The BFS direction matters. From the ${leftCount} U vertices, follow edges not currently in the matching. From the ${rightCount} V vertices, follow the matched edge back to U. The first time a free V is reachable, the shortest augmenting length is known — here ${freeRight} right vertices are free targets.`,
  };

  yield {
    state: matchingGraph('Layer graph exposes two shortest augmenting paths'),
    highlight: { active: ['u1', 'v3', 'e-u1-v3', 'u3', 'v4', 'e-u3-v4'], found: ['nil'] },
    explanation: `In this toy graph with ${totalVertices} vertices and ${totalEdges} edges, u1->v3 and u3->v4 are both shortest augmenting paths and they are vertex-disjoint. A one-path-at-a-time algorithm would augment only one; Hopcroft-Karp takes both ${freeLeft} paths in the same phase.`,
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
    explanation: `The data-structure lesson is phase discipline. By refusing longer paths until all ${freeLeft} shortest ones are exhausted, the algorithm bounds how often path length can increase — total cost is O(${totalEdges} * sqrt(${totalVertices})) for this graph.`,
  };
}

function* augmentPhase() {
  const leftCount = 4;
  const rightCount = 4;
  const totalVertices = leftCount + rightCount;
  const matchedEdges = 2;
  const freeLeft = leftCount - matchedEdges;
  const freeRight = rightCount - matchedEdges;
  const augmentedPaths = 2;
  const finalMatchingSize = matchedEdges + augmentedPaths;

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
    explanation: `After BFS fixes the shortest distance, DFS searches for vertex-disjoint augmenting paths inside that layered graph. It ignores edges that would leave the layer discipline — here ${augmentedPaths} disjoint paths are found from ${freeLeft} free left vertices.`,
    invariant: `A phase augments a maximal set of vertex-disjoint shortest augmenting paths; this phase finds ${augmentedPaths} paths, raising the matching from ${matchedEdges} to ${finalMatchingSize}.`,
  };

  yield {
    state: matchingGraph('Flip unmatched/matched status along each path'),
    highlight: { found: ['e-u1-v3', 'e-u3-v4'], active: ['u1', 'v3', 'u3', 'v4'], compare: ['e-u2-v1', 'e-u4-v2'] },
    explanation: `Augmenting means toggling every edge on the path. Unmatched edges become matched; matched edges on longer alternating paths would be removed. The matching size increases by one per augmenting path — ${augmentedPaths} paths raise the total from ${matchedEdges} to ${finalMatchingSize}.`,
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
    explanation: `The complete use case is assignment under binary eligibility. If every driver-route pair is either allowed or not allowed, maximum bipartite matching finds the largest feasible assignment — here ${leftCount} drivers and ${rightCount} routes yield a maximum matching of ${finalMatchingSize} before cost optimization enters the picture.`,
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
    explanation: `Hopcroft-Karp solves a specific matching problem extremely well — for this ${totalVertices}-vertex bipartite graph it found a perfect matching of size ${finalMatchingSize}. If edges have costs, capacities, or non-bipartite structure, the problem has changed and the data structure should change with it.`,
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
    { heading: 'How to read the animation', paragraphs: [
        'The animation shows a bipartite graph: left vertices U, right vertices V, and allowed pairs as edges. A matching is a set of edges with no shared endpoint. Active highlights show the current BFS or DFS step, compared edges are already matched, and found edges join the matching.',
        {type: `callout`, text: `Hopcroft-Karp is fast because one BFS phase finds the shortest legal layer graph, then DFS spends that layer graph on a whole batch of disjoint augmenting paths.`},
        'The safe inference rule is that an augmenting path starts at a free left vertex, ends at a free right vertex, and alternates unmatched and matched edges. Flipping that path increases matching size by one. Watch BFS build shortest layers, then DFS spend those layers on several disjoint paths.',
      
        {type: 'image', src: './assets/gifs/hopcroft-karp-bipartite-matching.gif', alt: 'Animated walkthrough of the hopcroft karp bipartite matching visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},],
    },
    { heading: 'Why this exists', paragraphs: [
        'Bipartite matching pairs items from two sets, one partner per item. Workers can do certain jobs, students can take certain rooms, and reviewers can handle certain papers. An edge means the pair is allowed.',
        {type: `image`, src: `https://upload.wikimedia.org/wikipedia/commons/thumb/b/b9/Simple_bipartite_graph%3B_two_layers.svg/500px-Simple_bipartite_graph%3B_two_layers.svg.png`, alt: `Bipartite graph drawn as two layers with edges only between layers`, caption: `A bipartite graph makes the two-part assignment constraint visible: every allowed pair crosses from left to right. Source: Wikimedia Commons: https://commons.wikimedia.org/wiki/File:Simple_bipartite_graph;_two_layers.svg`},
        'Maximum matching asks for the largest feasible set of pairs. It is often the feasibility check before cost optimization. If only 93 of 100 shifts can be covered by eligibility edges, no objective function can cover all 100 without relaxing constraints.',
      ], },
    { heading: 'The obvious approach', paragraphs: [
        'The brute-force approach enumerates possible matchings. With n vertices on each side, the complete case has n! possible perfect pairings. For n = 10, that is 3,628,800 candidates; for n = 20, it is over 2 * 10^18.',
        'A better first attempt is one augmenting path at a time. Search for any alternating path from a free left vertex to a free right vertex, flip it, and repeat. This is correct, but it may rescan the graph once per added match.',
      ], },
    { heading: 'The wall', paragraphs: [
        'The wall is repeated rediscovery. If a graph has many short augmenting paths at once, a one-path algorithm finds one, flips it, and then scans again for the next. With 10,000 matches and 50,000 edges, that can mean hundreds of millions of edge inspections.',
        'The wasted work is not in the correctness idea. Augmenting paths are still the right proof object. The waste is scheduling: the algorithm refuses to use other shortest paths that were visible in the same search.',
      ], },
    { heading: 'The core insight', paragraphs: [
        'Batch shortest augmenting paths by phase. BFS from all free left vertices builds a layered graph of shortest alternating paths. The first free right vertex reached fixes the shortest augmenting length for that phase.',
        'DFS then finds a maximal set of vertex-disjoint paths inside that layer graph. Because the paths are disjoint, they can be flipped together. After the phase, no augmenting path of that length remains, so the shortest length must increase.',
      ], },
    { heading: 'How it works', paragraphs: [
        'Maintain pairU and pairV arrays for current matches, plus dist for left-side BFS layers. BFS enqueues every free left vertex at distance 0. From a left vertex, it follows unmatched edges to right vertices; from a matched right vertex, it follows the matched edge back to the next left vertex.',
        {type: `image`, src: `https://upload.wikimedia.org/wikipedia/commons/2/23/Directed_graph_no_background.svg`, alt: `Directed graph with nodes connected by arrows`, caption: `The alternating search can be read as a directed reachability problem: unmatched edges move left-to-right, matched edges move back. Source: Wikimedia Commons: https://commons.wikimedia.org/wiki/File:Directed_graph_no_background.svg`},
        'If BFS reaches a free right vertex, DFS tries to reach free rights while respecting the layer distances. A successful DFS call updates pairU and pairV along the path. A failed left vertex can be marked dead for the current phase so other DFS calls do not re-enter it.',
      ], },
    { heading: 'Why it works', paragraphs: [
        'Correctness uses Berge\'s lemma: a matching is maximum if and only if no augmenting path exists. Hopcroft-Karp only flips valid augmenting paths and stops only when BFS cannot reach a free right vertex. At that point no augmenting path remains, so the matching is maximum.',
        'Flipping preserves the matching property. Internal vertices trade one matched edge for another, and the free endpoints become matched. Vertex-disjoint augmenting paths can be flipped in the same phase because they share no endpoints.',
        'The phase bound comes from shortest-path growth. After a maximal batch of shortest paths is flipped, no path of that length remains. Once path length exceeds sqrt(V), only about sqrt(V) disjoint paths can remain, so the total number of phases is O(sqrt(V)).',
      ], },
    { heading: 'Cost and complexity', paragraphs: [
        'Each phase costs O(E): BFS scans edges to build layers, and DFS scans edges within those layers while pruning dead ends. The number of phases is O(sqrt(V)). Total time is O(E * sqrt(V)), and space is O(V + E).',
        {type: `image`, src: `https://upload.wikimedia.org/wikipedia/commons/thumb/d/d4/Biclique_K_3_5_bicolor.svg/500px-Biclique_K_3_5_bicolor.svg.png`, alt: `Complete bipartite graph K three five with two colored vertex sets`, caption: `Dense bipartite graphs make the E term visible: one phase may inspect many left-right eligibility edges. Source: Wikimedia Commons: https://commons.wikimedia.org/wiki/File:Biclique_K_3_5_bicolor.svg`},
        'With 10,000 vertices and 50,000 edges, sqrt(V) is about 100, so the rough phase-scan budget is 5 million edge scans. A one-path approach can approach 10,000 * 50,000 = 500 million scans. The behavior difference comes from batching, not from a different final answer.',
      ], },
    { heading: 'Real-world uses', paragraphs: [
        'Eligibility assignment is the direct use: workers to shifts, students to rooms, papers to reviewers, and tests to machines. Maximum matching tells whether enough compatible pairs exist before any weighted objective is considered.',
        'It also appears as a subroutine in scheduling, feature matching, and feasibility checks for larger optimization systems. If costs matter, Hopcroft-Karp can establish whether a perfect matching exists before a weighted assignment algorithm chooses the cheapest one.',
      ], },
    { heading: 'Where it fails', paragraphs: [
        'Hopcroft-Karp only applies to bipartite, unweighted, unit-capacity matching. General graphs with odd cycles need blossom-style algorithms. Weighted assignment needs Hungarian algorithm or min-cost flow.',
        'Dynamic and online settings also weaken the fit. If vertices and edges arrive continuously, recomputing from scratch can cause churn. Multi-capacity cases, such as one worker covering two shifts, need b-matching or flow rather than plain matching.',
      ], },
    { heading: 'Worked example', paragraphs: [
        'Workers u1-u4 and jobs v1-v4 have current matches u2-v1 and u4-v2. Free left vertices are u1 and u3; free right vertices are v3 and v4. Edges include u1-v3 and u3-v4, so two direct augmenting paths exist.',
        'BFS starts from u1 and u3 at distance 0 and reaches free rights v3 and v4 at length 1. DFS takes u1-v3 and u3-v4, which are vertex-disjoint. After flipping both, the matching is {u1-v3, u2-v1, u3-v4, u4-v2}, size 4.',
        'A one-path algorithm would add u1-v3 in one pass, then rescan to add u3-v4. Hopcroft-Karp takes both in one phase because BFS proved they are shortest and DFS proved they do not share vertices.',
      ], },
    { heading: 'Sources and study next', paragraphs: [
        'Primary source: Hopcroft and Karp, An n^(5/2) Algorithm for Maximum Matchings in Bipartite Graphs, 1973. Berge\'s augmenting-path lemma and Konig\'s theorem are the proof background for bipartite matching.',
        'Study BFS, DFS, and augmenting paths first. Study Dinic\'s max-flow algorithm for a similar level-graph plus blocking-flow pattern, Hungarian algorithm for weighted assignment, and Edmonds blossom for general graph matching.',
      ], },
  ],
};
