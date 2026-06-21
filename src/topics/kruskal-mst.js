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
    explanation: `Seven cities, eleven possible cables, each with a cost. The job: connect ALL of them — directly or indirectly — for the minimum total cost. The answer is always a SPANNING TREE: ${NODES.length} nodes need exactly ${NODES.length - 1} edges, and any extra edge is a wasted cycle. Kruskal's recipe is pure greed: sort the cables by cost, take the cheapest one that does not create a cycle, repeat.`,
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
      explanation: `${edge.id} (cost ${edge.weight}): different roots — accepting it MERGES two groups into one. Running total: ${total}, groups remaining: ${components}.${mst.length === 1 ? ' Why is taking the cheapest safe? The CUT PROPERTY: for any split of the cities, the cheapest cable crossing the split belongs to SOME minimum spanning tree — the greedy choice remains safe here.' : ''}`,
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
    explanation: `Done: ${mst.length} edges (exactly n-1), total cost ${total} — provably the minimum possible. Note what got skipped: AB and BG were cheap-ish, but by their turn their endpoints were already connected. Sorting dominates the cost: O(E log E), with Union-Find adding effectively nothing.`,
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
      heading: 'How to read the animation',
      paragraphs: [
        'Edges are processed in sorted order, lightest first. The active (highlighted) edge is the one being tested. Green edges have been accepted into the MST: their endpoints were in separate components, so no cycle was created. Dimmed edges were rejected because both endpoints already belonged to the same component.',
        {
          type: 'callout',
          text: 'Kruskal is safe because every accepted edge is the cheapest available bridge across a component cut.',
        },
        'Watch the component count. It starts at V (every node alone) and drops by one each time an edge is accepted. After V minus 1 acceptances, one connected tree remains. Rejections matter too: each one proves that a cheaper route already exists between those endpoints through previously accepted edges.',
        'In clustering mode, the algorithm stops early at three components. The remaining groups are single-linkage clusters: cheap edges glued nearby nodes together, and the expensive edges that would have merged the clusters were never accepted.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Given a weighted graph, connect every vertex using the least total edge weight. The result is a minimum spanning tree (MST): it spans because every vertex is reachable, it is a tree because it has no cycles, and it is minimum because no other spanning tree weighs less.',
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d2/Minimum_spanning_tree.svg/330px-Minimum_spanning_tree.svg.png',
          alt: 'Weighted planar graph with the minimum spanning tree emphasized',
          caption: 'A minimum spanning tree keeps enough edges to connect every vertex while deleting every redundant cycle. Source: Wikimedia Commons, File:Minimum spanning tree.svg.',
        },
        'This is the oldest problem in combinatorial optimization. Boruvka solved it in 1926 for the Moravian electrical network. Kruskal published his sort-and-merge method in 1956. Prim independently described the grow-one-tree approach in 1957, rediscovering work Jarnik had done in 1930.',
        'The problem appears whenever cost attaches to connections rather than to paths from a single source. Campus fiber plans, power-distribution networks, circuit-layout approximations, and clustering dendrograms all ask the same question: connect all the points without paying for redundant links.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'Try every spanning tree and pick the lightest one. A spanning tree on n vertices uses exactly n minus 1 edges and has no cycles. Enumerate all such trees, sum the weights, keep the minimum.',
        'The idea is correct in principle. On a small graph you can list the trees by hand. For four vertices in a complete graph there are 16 spanning trees. You could check all 16.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        "Cayley's formula: a complete graph on n labeled vertices has n^(n-2) spanning trees. For 10 vertices that is 10^8 (a hundred million). For 20 vertices it is 20^18, roughly 2.6 times 10^23. Enumeration is not slow; it is physically impossible at any useful scale.",
        'The natural greedy impulse -- keep taking cheap edges -- almost works, but it hits a second wall: cycles. If you grab cheap edges without checking connectivity, you can add an edge whose endpoints are already reachable through previously accepted edges. That creates a cycle, which wastes cost and breaks the tree property. Without a fast cycle test, you need a graph traversal per candidate edge, pushing the total to O(E^2) or worse.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Kruskal sorts all E edges by weight. Then it scans the sorted list once. For each edge, it asks one question: are the two endpoints in the same connected component? If no, accept the edge (it merges two components). If yes, reject it (it would close a cycle). Stop after accepting V minus 1 edges.',
        "The cycle question is a connectivity query, and Union-Find answers it in near-constant time. Each vertex starts as its own singleton set. find(x) returns the representative of x's component. When an edge is accepted, union(a, b) merges the two sets. With path compression and union by rank, each operation costs O(alpha(V)) amortized, where alpha is the inverse Ackermann function -- effectively constant for any graph that fits in memory.",
        'The partial result is a forest, not a single tree. Each accepted edge reduces the component count by one. After n minus 1 acceptances, the forest has merged into one spanning tree.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The cut property: for any partition of the vertices into two non-empty sides, the lightest edge crossing that partition belongs to some minimum spanning tree.',
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f7/Msp-the-cut-correct.svg/500px-Msp-the-cut-correct.svg.png',
          alt: 'Cut property diagram for a minimum spanning tree',
          caption: 'The cut-property picture shows why the cheapest edge crossing a cut can be accepted without regret. Source: Wikimedia Commons, File:Msp-the-cut-correct.svg.',
        },
        'Proof. Suppose T is an MST that does not contain the lightest crossing edge e. Adding e to T creates a cycle. That cycle must include at least one other edge f that also crosses the same partition (otherwise the cycle could not close). Since weight(e) is at most weight(f), swapping f for e produces a spanning tree whose total weight is at most that of T. So e belongs to some MST.',
        'Kruskal applies this property at every step. When an edge connects two different components, those components define a partition of the vertices. Because edges are processed in sorted order, no cheaper crossing edge was skipped (any cheaper edge that crossed this partition would have been processed earlier and either accepted or found both endpoints in the same component). The accepted edge is the cheapest available crossing, so by the cut property it is safe.',
        'The preservation argument ties it together. Before the first step, the empty set is trivially a subset of every MST. Each accepted edge preserves the invariant: the accepted set is a subset of some MST. After V minus 1 acceptances, the subset spans all vertices and is itself an MST.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Sorting E edges costs O(E log E). The Union-Find work across all edges is O(E alpha(V)), which is negligible. Total time: O(E log E). Since E is at most V^2, log E is at most 2 log V, so this is equivalently O(E log V). Space: O(V) for the Union-Find parent array, plus the edge list and output tree.',
        'What happens when the graph doubles in size? If both V and E double, the sort does roughly twice as much work per element (one extra comparison level) but the Union-Find cost barely changes. Sorting dominates in practice.',
        "Compared to Prim: Prim with a binary heap runs O((V+E) log V). On sparse graphs (E near V), both are similar. On dense graphs (E near V^2), Prim with an adjacency matrix runs O(V^2), which avoids the sort entirely. Prim with a Fibonacci heap achieves O(E + V log V), the best known bound for deterministic MST on dense graphs. Kruskal shines when the input is already an edge list and the graph is sparse.",
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'Network design. Connect campus buildings, data-center racks, or cell towers with minimum total cable. Kruskal fits naturally when the input is a list of candidate connections with costs, because sort-and-scan matches that format directly.',
        'Circuit design. VLSI layout computes rectilinear MSTs (Manhattan distances between pins) as a lower bound on total wire length. The MST sets the wiring budget; detailed routing refines from there.',
        'Clustering. Stop Kruskal before one component remains and the current components are single-linkage clusters. The cheap edges glued nearby nodes; the expensive unprocessed edges mark cluster boundaries. This is the basis of single-linkage hierarchical clustering.',
        'TSP approximation. On metric graphs (symmetric, triangle-inequality weights), doubling the MST edges and shortcutting gives a tour at most twice the optimal length. The MST lower-bounds the TSP, making it the backbone of the 2-approximation.',
        'Image segmentation. The Felzenszwalb-Huttenlocher method builds an MST over pixels weighted by color difference, then cuts heavy edges to form segments.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        "MST is not shortest paths. Kruskal minimizes total connection cost. Dijkstra minimizes path distance from one source. An MST can contain a long route between two particular vertices, because pairwise distance is not the objective.",
        "Directed graphs need a different algorithm. The minimum-cost arborescence (directed spanning tree rooted at a given vertex) is solved by Edmonds' algorithm (Chu-Liu/Edmonds, 1965), which is structurally different from Kruskal.",
        'No redundancy. A tree has exactly V minus 1 edges. Remove any one and the tree disconnects. Real network designs start from the MST cost baseline, then add backup links for fault tolerance.',
        'Uniqueness is not guaranteed. When multiple edges share the same weight, different tie-breaking orders can produce different MSTs. All such MSTs have the same total weight, but the edge sets may differ. If the application depends on a specific tree (not just minimum cost), ties must be broken deterministically.',
        "Distributed MST is harder. Kruskal requires a global sort, which means one machine must see all edges. Boruvka's algorithm, where each component independently finds its cheapest outgoing edge, parallelizes naturally and is the basis for distributed MST implementations.",
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Six vertices (A through F), nine edges: A-B(4), A-C(2), B-C(1), B-D(3), C-D(5), C-E(7), D-E(6), D-F(8), E-F(9).',
        'Sort by weight: B-C(1), A-C(2), B-D(3), A-B(4), C-D(5), D-E(6), C-E(7), D-F(8), E-F(9).',
        'B-C(1): Find(B) = B, Find(C) = C. Different components. Accept. Union(B,C). Components: {B,C}, {A}, {D}, {E}, {F}. Total: 1.',
        'A-C(2): Find(A) = A, Find(C) = B (through path compression). Different. Accept. Union(A,B). Components: {A,B,C}, {D}, {E}, {F}. Total: 3.',
        'B-D(3): Find(B) = B (root of {A,B,C}), Find(D) = D. Different. Accept. Union(B,D). Components: {A,B,C,D}, {E}, {F}. Total: 6.',
        'A-B(4): Find(A) and Find(B) both reach the same root. Same component. Reject -- this edge would create a cycle through A-C-B.',
        'C-D(5): Find(C) and Find(D) share a root. Same component. Reject.',
        'D-E(6): Find(D) is in {A,B,C,D}, Find(E) = E. Different. Accept. Total: 12.',
        'C-E(7): both in the same component now. Reject. D-F(8): Find(D) is in the big component, Find(F) = F. Different. Accept. All six vertices connected. Total: 20.',
        'Final MST: B-C(1), A-C(2), B-D(3), D-E(6), D-F(8). Five edges, total weight 20. Every acceptance joined two previously separate components. Every rejection prevented a cycle.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        "Boruvka, \"O jistem problemu minimalnim,\" 1926 -- the oldest MST algorithm, designed for Moravia's electrical network. Each round finds the cheapest edge from each component and merges. O(log V) rounds, each parallelizable. Kruskal, \"On the Shortest Spanning Subtree of a Graph and the Traveling Salesman Problem,\" 1956 -- the sort-and-merge approach. Prim, \"Shortest Connection Networks,\" Bell System Technical Journal, 1957. Jarnik, 1930 -- described the grow-one-tree method decades before Prim. Pettie and Ramachandran, 2002 -- the provably optimal deterministic MST algorithm.",
        'Prerequisite: Union-Find (Disjoint Sets) powers the cycle test. Without it, cycle detection costs O(V+E) per edge and the algorithm degrades to O(E^2).',
        "Same structure, different objective: Prim's Algorithm grows one tree outward using a priority queue instead of a global sort. Compare both on this site's shared seven-node graph.",
        "Same greedy family: Dijkstra's Shortest Path uses the same priority-queue loop as Prim but ranks by total distance from the source, not single edge weight.",
        'Graph foundations: Breadth-First Search and Depth-First Search for unweighted traversal and component discovery.',
      ],
    },
  ],
};
