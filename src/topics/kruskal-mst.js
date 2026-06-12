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
      heading: 'What it is',
      paragraphs: [
        `Kruskal's algorithm is a greedy method for building the minimum spanning tree (MST) of a weighted graph — a subset of edges that connects all nodes with the lowest total cost and no cycles. Devised by Joseph Kruskal in 1956, it ranks as one of the simplest and most elegant graph algorithms in computer science. The core idea is ruthlessly greedy: sort edges by weight from cheapest to most expensive, then walk through them in order, accepting each edge unless it would create a cycle. A spanning tree of n nodes always has exactly n−1 edges, so once you've accepted n−1 edges, you're done.`,
        `The algorithm's power comes from pairing this simple greedy rule with Union-Find (Disjoint Sets), which answers the cycle question in near-constant time. Before Union-Find existed, checking for cycles meant depth-first search on each edge — expensive. With Union-Find, each cycle check is O(α(n)), where α is the inverse Ackermann function, so small it's effectively constant for all practical graph sizes.`,
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        `The algorithm maintains a Union-Find structure with one component per node initially. Sort all edges by weight. Loop through edges in ascending order: for each edge, query whether its two endpoints already share a root in the Union-Find tree. If yes, adding that edge would close a cycle, so skip it. If no, they belong to separate components, so merge them with a union operation and add the edge to the MST. As soon as you've accepted n−1 edges, all n nodes are in a single component and the MST is complete.`,
        `Why is greedy correct? The cut property of graphs: for any partition of the nodes into two disjoint sets, the cheapest edge crossing that partition belongs to some minimum spanning tree. This holds at every step of Kruskal's. When you accept an edge, you're picking the globally cheapest option available, and the cut property guarantees it will appear in an optimal solution. Rejection is equally sound — if an edge would form a cycle, there's already a path of cheaper-or-equal edges connecting its endpoints, so that edge can never be part of any MST.`,
        `Halting Kruskal early (before n−1 edges are accepted) yields clusters of connected nodes — exactly the output of single-linkage hierarchical clustering. The edges you accepted are bridges between closely-related points; the edges you never reached are the gaps between natural clusters. This duality makes Kruskal a bridge between graph optimization and unsupervised learning.`,
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        `Time complexity is O(E log E + E·α(n)), where E is the number of edges and α(n) is the inverse Ackermann function. Sorting dominates: E log E accounts for ordering the edges. Union-Find's contribution is negligible in practice — E·α(n) is effectively linear. Space is O(n + E) for the graph and O(n) for the Union-Find structure. For dense graphs (E close to n²), Prim's algorithm using a Binary Heap (Priority Queue) can be faster because it doesn't sort all edges upfront; for sparse graphs, Kruskal's is often simpler and equally fast.`,
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        `Fiber-optic network design: connecting cities with minimum cable length. Chip routing: layers of circuitry must be interconnected with minimal wire, area, and power loss. Power grid expansion: extending transmission lines to cover a region at minimum cost. Telephone and water networks likewise benefit from MST planning. In data science, stopping Kruskal early produces single-linkage clusters, used in hierarchical clustering to form dendrograms and identify natural breakpoints in data. Modern applications include wireless sensor networks (placing base stations to cover an area with minimum power) and phylogenetic tree construction in biology (inferring ancestor relationships at minimum evolutionary distance).`,
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        `Mistake 1: assuming the MST is unique. Multiple edges can have the same weight; different MSTs may exist with equal total cost. Kruskal returns one of them. Mistake 2: thinking the algorithm is greedy and therefore slower. Greedy choices are *safe* here because of the cut property; the algorithm is not slower, just provably optimal. Mistake 3: confusing MST with shortest path. Dijkstra's Shortest Path finds the minimum-cost route between two specific nodes; MST connects all nodes with minimum total cost. Mistake 4: using MST for undirected graphs with directed edges. The algorithm assumes all edges are bidirectional (undirected); for directed acyclic graphs, you need alternatives like Edmond's algorithm for minimum spanning arborescences.`,
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        `Deepen your understanding of cycle detection and merging by studying Union-Find (Disjoint Sets), the data structure that makes Kruskal efficient. Compare Kruskal to Prim's algorithm, which builds the tree incrementally using a Binary Heap (Priority Queue) and excels on dense graphs. If you want single-linkage clustering without building an MST explicitly, jump to K-Means Clustering for a centroid-based alternative. For shortest-path variants, see Dijkstra's Shortest Path. Finally, the cut property and matroid theory behind Kruskal belong to advanced algorithm design — once you're comfortable here, modern greedy algorithms become much easier to verify.`,
      ],
    },
  ],
};
