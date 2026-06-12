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
        `Kruskal's Minimum Spanning Tree is a greedy algorithm for connecting every node in an undirected weighted graph with minimum total edge cost and no cycles. Joseph Kruskal published it in 1956. The rule is simple: sort all edges from cheapest to most expensive, then accept an edge if it connects two components that are not already connected. A spanning tree on n nodes has exactly n-1 edges, so the algorithm stops as soon as it has accepted that many.`,
        `The visualization uses seven cities and eleven possible cables. It sorts edges like EF(2), GA(2), BC(3), and so on, then lets Union-Find (Disjoint Sets) veto cycle-forming edges. On the full run, the accepted edges have total cost 19. In the cluster mode, the same process stops early at three components, showing why Kruskal is also the skeleton of single-linkage clustering.`,
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        `At the start, every node is its own component. For each sorted edge (u, v), ask find(u) and find(v). If the roots differ, accepting the edge merges two components and cannot create a cycle. If the roots match, there is already a cheaper-or-equal path between u and v in the partial forest, so this particular edge is unnecessary for the tree being built. With equal weights, a rejected edge might appear in some other valid MST, but skipping it still preserves optimality.`,
        `Correctness comes from the cut property: across any partition of the graph, the cheapest edge crossing that cut is safe to include in some MST. Kruskal repeatedly chooses the cheapest safe edge available. This is greed with a proof, not a guess. It differs from Prim's Algorithm, which grows one connected tree outward instead of sorting the global edge list.`,
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        `Kruskal costs O(E log E) for sorting plus O(E alpha(V)) for Union-Find checks, so sorting dominates. Since E is at most V^2 in a simple graph, O(E log E) is also O(E log V). Space is O(V) for the disjoint sets plus whatever stores the edge list. On sparse edge lists, Kruskal is compact and easy. On dense graphs, Prim's Algorithm with an adjacency matrix can run in O(V^2), and with a Binary Heap (Priority Queue) it runs in O(E log V). Big-O Growth Rates helps explain why density changes the winner.`,
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        `MSTs model "connect everything cheaply" problems: fiber routes, campus wiring, power distribution sketches, and network backbones. Engineers usually add reliability constraints afterward, because a pure tree has no redundancy. Kruskal also appears in image segmentation and clustering: stop before one component remains and the accepted edges form groups. K-Means Clustering answers a different clustering question with centroids, while Kruskal's early-stop version groups by nearest connecting edges. Graph BFS and Dijkstra's Shortest Path are nearby graph tools, but they solve reachability and route cost, not global network cost.`,
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        `Do not confuse an MST with a shortest-path tree. Dijkstra's Shortest Path may pick different edges because it optimizes distance from one source, not total cost to connect everyone. Do not assume the MST is unique; equal weights can create several optimal trees. Do not use Kruskal directly on directed edges; directed minimum branching is a different problem, commonly solved by Chu-Liu/Edmonds. Finally, the graph must be connected if you expect one tree. Otherwise Kruskal returns a minimum spanning forest.`,
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        `Study Union-Find (Disjoint Sets) first, because it is the cycle detector inside this page. Then compare Kruskal's Minimum Spanning Tree with Prim's Algorithm on the same graph. Review Binary Heap (Priority Queue) for frontier-based graph algorithms, Dijkstra's Shortest Path for route optimization, and K-Means Clustering for a contrasting clustering model. Tree Traversals is useful background for understanding why a spanning tree has exactly n-1 edges.`,
      ],
    },
  ],
};
