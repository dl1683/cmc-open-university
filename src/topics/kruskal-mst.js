// Kruskal's minimum spanning tree: sort the edges by cost, take each one
// unless it closes a cycle — and Union-Find answers the cycle question in
// near-constant time. Greedy, provably optimal, and satisfying to watch.

import { graphState, InputError } from '../core/state.js';

export const topic = {
  id: 'kruskal-mst',
  title: "Kruskal's Minimum Spanning Tree",
  category: 'Data Structures',
  summary: 'Connect every node at minimum total cost: cheapest edges first, cycles vetoed by Union-Find.',
  controls: [
    { id: 'mode', label: 'Show', type: 'select', options: ['full run', 'stop at 3 clusters'], defaultValue: 'full run' },
  ],
  run,
};

const NODES = [
  { id: 'A', label: 'A', x: 1.0, y: 2.0 }, { id: 'B', label: 'B', x: 4.0, y: 1.0 },
  { id: 'C', label: 'C', x: 7.0, y: 1.5 }, { id: 'D', label: 'D', x: 9.2, y: 4.0 },
  { id: 'E', label: 'E', x: 7.0, y: 7.0 }, { id: 'F', label: 'F', x: 4.0, y: 8.2 },
  { id: 'G', label: 'G', x: 1.6, y: 5.5 },
];
const EDGES = [
  { id: 'EF', from: 'E', to: 'F', weight: 2 }, { id: 'GA', from: 'G', to: 'A', weight: 2 },
  { id: 'BC', from: 'B', to: 'C', weight: 3 }, { id: 'FG', from: 'F', to: 'G', weight: 3 },
  { id: 'CE', from: 'C', to: 'E', weight: 4 }, { id: 'AB', from: 'A', to: 'B', weight: 4 },
  { id: 'BG', from: 'B', to: 'G', weight: 5 }, { id: 'CD', from: 'C', to: 'D', weight: 5 },
  { id: 'DE', from: 'D', to: 'E', weight: 6 }, { id: 'BE', from: 'B', to: 'E', weight: 7 },
  { id: 'AF', from: 'A', to: 'F', weight: 8 },
];

export function* run(input) {
  const clustering = String(input.mode) === 'stop at 3 clusters';
  if (!['full run', 'stop at 3 clusters'].includes(String(input.mode))) throw new InputError('Pick a mode.');

  // tiny union-find (see the Union-Find topic for the full story)
  const parent = new Map(NODES.map((n) => [n.id, n.id]));
  const find = (x) => {
    let r = x;
    while (parent.get(r) !== r) r = parent.get(r);
    while (parent.get(x) !== r) { const nxt = parent.get(x); parent.set(x, r); x = nxt; }
    return r;
  };
  const union = (a, b) => parent.set(find(a), find(b));

  const mst = [];
  const rejected = [];
  let total = 0;
  let components = NODES.length;
  const snapshot = () => graphState({
    nodes: NODES.map((n) => ({ ...n })),
    edges: EDGES,
  });
  const hl = (extra = {}) => ({ found: [...mst, ...mst.flatMap((id) => { const e = EDGES.find((x) => x.id === id); return [e.from, e.to]; })], visited: [...rejected], ...extra });

  yield {
    state: snapshot(),
    highlight: {},
    explanation: `Seven cities, eleven possible cables, each with a cost. The job: connect ALL of them — directly or indirectly — for the minimum total cost. The answer is always a SPANNING TREE: ${NODES.length} nodes need exactly ${NODES.length - 1} edges, and any extra edge is a wasted cycle. Kruskal's recipe is pure greed: sort the cables by cost, take the cheapest one that doesn't create a cycle, repeat.`,
  };

  yield {
    state: snapshot(),
    highlight: { active: ['EF', 'GA'] },
    explanation: `The edges, sorted: ${EDGES.map((e) => `${e.id}(${e.weight})`).join(', ')}. The only question at each step is "would this edge close a cycle?" — which is exactly the question Union-Find answers in near-constant time: same root = already connected = cycle.`,
  };

  const stopAtComponents = clustering ? 3 : 1;
  for (const edge of EDGES) {
    if (components === stopAtComponents) break;
    const ra = find(edge.from);
    const rb = find(edge.to);
    if (ra === rb) {
      rejected.push(edge.id);
      yield {
        state: snapshot(),
        highlight: hl({ swap: [edge.id] }),
        explanation: `${edge.id} (cost ${edge.weight}): find(${edge.from}) and find(${edge.to}) return the SAME root — these cities are already connected through cheaper cables, so this edge would only close a loop. REJECTED, and not a single coin wasted on it.`,
        invariant: 'Every accepted edge joins two previously separate groups; every rejected edge would close a cycle.',
      };
      continue;
    }
    union(edge.from, edge.to);
    mst.push(edge.id);
    total += edge.weight;
    components -= 1;
    yield {
      state: snapshot(),
      highlight: hl({ active: [edge.id] }),
      explanation: `${edge.id} (cost ${edge.weight}): different roots — accepting it MERGES two groups into one. Running total: ${total}, groups remaining: ${components}.${mst.length === 1 ? ' Why is taking the cheapest safe? The CUT PROPERTY: for any split of the cities, the cheapest cable crossing the split belongs to SOME minimum spanning tree — greed can\'t go wrong here.' : ''}`,
    };
  }

  if (clustering) {
    yield {
      state: snapshot(),
      highlight: hl(),
      explanation: `Stopped early at ${stopAtComponents} groups — and look what we built: CLUSTERS. Kruskal halted before completion is exactly single-linkage hierarchical clustering: the cheap edges glued together the naturally-close nodes, and the expensive edges we never took are the gaps between clusters. One algorithm, two famous applications (compare K-Means Clustering for the centroid-based alternative).`,
    };
    return;
  }

  yield {
    state: snapshot(),
    highlight: hl(),
    explanation: `Done: ${mst.length} edges (exactly n−1), total cost ${total} — provably the minimum possible. Note what got skipped: AB and BG were cheap-ish, but by their turn their endpoints were already connected. Sorting dominates the cost: O(E log E), with Union-Find adding effectively nothing.`,
  };

  yield {
    state: snapshot(),
    highlight: hl(),
    explanation: `This is how you wire a campus with minimum fiber, how chip designers route minimal interconnect, and how network designers plan backbones. The cousin algorithm — Prim's — grows one tree outward using a Binary Heap (Priority Queue) instead of sorting all edges (better for dense graphs). And as the clustering mode shows, stop Kruskal early and data-mining falls out. Greedy + Union-Find: two site topics composed into a third.`,
  };
}

export const article = {
  sections: [
    {
      heading: 'Why This Exists',
      paragraphs: [
        `Kruskal's algorithm exists for the basic network-design question: how do we connect every vertex with the least total edge cost? The output is a minimum spanning tree, or MST. It spans because every vertex is connected. It is a tree because it has no cycles. It is minimum because no other spanning tree has lower total weight.`,
        `This problem appears whenever the cost is attached to connections rather than to paths from one source. A campus fiber plan, a power-distribution sketch, a clustering dendrogram, and a circuit-layout approximation all ask some version of "connect all the points without paying for redundant links." Kruskal is the cleanest greedy answer when the graph is naturally stored as an edge list.`,
      ],
    },
    {
      heading: 'The Naive Approach',
      paragraphs: [
        `The brute-force approach is to list every possible spanning tree, compute its total weight, and keep the cheapest. That is not practical. The number of spanning trees can be enormous even for moderately sized graphs. Exhaustive search treats the problem as if every global tree shape must be tested.`,
        `A more tempting approach is to keep taking cheap edges. That is closer, but it is incomplete. Cheap edges can close cycles. A cycle means at least one edge is redundant because the same vertices remain connected without it. The naive greedy rule needs a veto: cheap is good only when the edge joins two separate connected components.`,
      ],
    },
    {
      heading: 'The Core Insight',
      paragraphs: [
        `Kruskal's insight is to sort all edges by weight and run a cheapest-first audition. Each edge gets one question: do its endpoints currently belong to different components? If yes, accepting it merges those components and cannot create a cycle. If no, the endpoints are already connected through cheaper or equal accepted edges, so this edge would only add a loop.`,
        `The partial answer is a forest, not a single tree at first. Every accepted edge reduces the number of components by one. With n vertices, the algorithm needs exactly n - 1 accepted edges to produce one connected tree. The forest view is what makes the greedy choice safe: the algorithm is always joining islands, never decorating an island with redundant internal links.`,
      ],
    },
    {
      heading: 'Union-Find Machinery',
      paragraphs: [
        `The cycle question is a connectivity query. Union-Find, also called Disjoint Sets, is the data structure that answers it cheaply. Each vertex starts as its own set. find(x) returns the representative of x's current component. union(a, b) merges two components after an edge is accepted.`,
        `With path compression and union by rank or size, Union-Find operations are effectively constant time for ordinary input sizes. That matters because Kruskal asks find twice for every edge. Without Union-Find, the algorithm would need repeated graph searches to test whether an edge closes a cycle. The greedy idea would still be correct, but the implementation would be much slower.`,
      ],
    },
    {
      heading: 'What The Visual Proves',
      paragraphs: [
        `The visual proves that the algorithm never needs to know the final tree shape in advance. It sorts edges such as EF(2), GA(2), and BC(3), then tests each candidate against the current components. Accepted edges become the growing forest. Rejected edges are not "bad" globally; they are just unnecessary for this forest because their endpoints are already connected.`,
        `The cluster mode proves a second idea. If Kruskal stops before one component remains, the remaining components are single-linkage clusters. Cheap local connections have joined nearby vertices, while expensive edges between groups have not yet been accepted. The same sorted-edge process therefore supports both MST construction and hierarchical clustering.`,
      ],
    },
    {
      heading: 'Why The Greedy Rule Works',
      paragraphs: [
        `The proof rests on the cut property. Take any split of the vertices into two sides. The cheapest edge crossing that split is safe: there is some minimum spanning tree that contains it. If a proposed MST did not contain that cheapest crossing edge, adding the edge would create a cycle, and that cycle must include another edge crossing the same cut. Replacing the heavier crossing edge with the cheapest one cannot increase total cost.`,
        `Kruskal repeatedly applies this safe-edge logic. When an edge connects two current components, it crosses the cut between one component and the rest of the graph. Because edges are considered in sorted order, no cheaper available crossing edge was skipped unless it would have stayed inside a component. The accepted edge is therefore safe.`,
      ],
    },
    {
      heading: 'Cost And Complexity',
      paragraphs: [
        `Kruskal costs O(E log E) for sorting E edges. The Union-Find work adds O(E alpha(V)), where alpha is the inverse Ackermann function and is tiny in practice. Sorting dominates almost always. Space is O(V) for the disjoint-set parent structure plus the space used to store the edge list and the output tree.`,
        `Because a simple graph has at most about V squared edges, O(E log E) is often written as O(E log V). On sparse graphs, that is a strong fit. On dense graphs, Prim's algorithm with an adjacency matrix can be competitive at O(V squared), and Prim with a binary heap runs in O(E log V). Representation matters as much as the abstract algorithm.`,
        `Implementation details still matter. If the edge list is already nearly sorted by weight, the sort may be cheaper in practice than the asymptotic expression suggests. If edges stream in over time, a plain Kruskal run is less convenient because the global sorted order is central to the algorithm. If memory is tight, storing every candidate edge can be the real bottleneck, while Prim can work directly from adjacency data.`,
      ],
    },
    {
      heading: 'Where It Wins',
      paragraphs: [
        `Kruskal wins when the graph arrives as a list of candidate connections. You sort the list once, scan it once, and use Union-Find for the cycle veto. It is easy to explain, easy to test, and naturally stops as soon as n - 1 edges are accepted. It also handles disconnected input gracefully by returning a minimum spanning forest.`,
        `It is useful in network planning, approximate physical layout, clustering, image segmentation, and any problem where pairwise connection costs are known ahead of time. Engineers often use the MST as a baseline, then add redundancy, capacity, latency, or reliability constraints afterward. The pure MST is the cheapest connected skeleton, not the whole production design.`,
      ],
    },
    {
      heading: 'Failure Modes',
      paragraphs: [
        `Do not confuse a minimum spanning tree with a shortest-path tree. Dijkstra's algorithm optimizes paths from one source. Kruskal optimizes total cost to connect all vertices. A low-cost MST can contain a long route between two particular vertices, because pairwise route distance is not the objective.`,
        `Do not assume the MST is unique. Equal weights can create several valid minimum trees. Do not apply Kruskal directly to directed graphs; directed minimum branching is a different problem. Do not expect redundancy from a tree, because removing one accepted edge disconnects part of it. And if the original graph is disconnected, no spanning tree exists; the algorithm correctly returns a forest.`,
        `Also watch the weight model. Negative weights are allowed for MSTs, but the edge weights must represent comparable connection costs. If a domain has capacity limits, reliability requirements, or geographic constraints, those rules are not magically captured by a single number. Kruskal optimizes the graph you give it, so a bad graph model produces a cheap answer to the wrong problem.`,
      ],
    },
    {
      heading: 'Study Next',
      paragraphs: [
        `Study Union-Find first, because it is the cycle detector that makes Kruskal fast. Then compare Prim's algorithm on the same weighted graph to see a frontier-growing alternative. Binary Heap Priority Queue explains the data structure behind efficient Prim and Dijkstra implementations.`,
        `For graph context, review Breadth-First Search, Depth-First Search, and Dijkstra's Shortest Path so the difference between reachability, route cost, and global connection cost is clear. For clustering context, compare Kruskal's early-stop single-linkage behavior with K-Means Clustering. Big-O Growth Rates explains why sparse and dense graphs often prefer different MST implementations.`,
      ],
    },
  ],
};
