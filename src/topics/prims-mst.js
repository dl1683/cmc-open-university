// Prim's algorithm: the other road to the minimum spanning tree. Where
// Kruskal sorts all edges and merges a forest, Prim grows ONE tree outward,
// always taking the cheapest edge on its frontier. Same graph, same answer,
// different journey — compare them side by side.

import { graphState, InputError } from '../core/state.js';

export const topic = {
  id: 'prims-mst',
  title: "Prim\'s Algorithm",
  category: 'Data Structures',
  summary: 'Grow one tree outward, always crossing the frontier on the cheapest edge — the MST, built the other way.',
  controls: [
    { id: 'start', label: 'Start from', type: 'select', options: ['A', 'D'], defaultValue: 'A' },
  ],
  run,
};

// The exact graph from Kruskal\'s topic, so the two algorithms can be compared.
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
  const start = String(input.start);
  if (!['A', 'D'].includes(start)) throw new InputError('Pick a start node.');

  const inTree = new Set([start]);
  const mst = [];
  let total = 0;
  const snapshot = () => graphState({ nodes: NODES, edges: EDGES });
  const frontier = () => EDGES.filter((e) => inTree.has(e.from) !== inTree.has(e.to));
  const hl = (extra = {}) => ({ found: [...mst, ...inTree], ...extra });

  yield {
    state: snapshot(),
    highlight: { found: [start] },
    explanation: `Same seven cities and eleven cables as Kruskal\'s Minimum Spanning Tree — but a different philosophy. Kruskal thinks globally: sort EVERY edge, merge a forest. Prim thinks locally: start somewhere (${start}), and grow ONE tree outward, always crossing the frontier on the cheapest available cable. A Binary Heap (Priority Queue) serves that "cheapest frontier edge" in O(log n).`,
  };

  while (inTree.size < NODES.length) {
    const candidates = frontier();
    const best = [...candidates].sort((a, b) => a.weight - b.weight)[0];
    yield {
      state: snapshot(),
      highlight: hl({ compare: candidates.map((e) => e.id), active: [best.id] }),
      explanation: `The FRONTIER — every edge with one foot inside the tree, one foot outside — has ${candidates.length} edges: ${candidates.map((e) => `${e.id}(${e.weight})`).join(', ')}. The heap pops the cheapest: ${best.id} at cost ${best.weight}. The cut property guarantees this edge is safe: it is the cheapest way across the inside/outside divide, so SOME minimum tree must use it.`,
      invariant: 'The tree-so-far is always a subtree of some minimum spanning tree.',
    };
    const newNode = inTree.has(best.from) ? best.to : best.from;
    inTree.add(newNode);
    mst.push(best.id);
    total += best.weight;
    yield {
      state: snapshot(),
      highlight: hl({ active: [newNode] }),
      explanation: `${newNode} joins the tree (${inTree.size} of ${NODES.length} nodes, running cost ${total}). Note what happened to the frontier: ${newNode}'s other edges just became candidates, and any edge now INSIDE the tree silently stopped mattering.`,
    };
  }

  yield {
    state: snapshot(),
    highlight: hl(),
    explanation: `Complete: ${mst.length} edges, total cost ${total} — the SAME minimum total Kruskal finds on this graph (it must be: both are provably optimal), though the edges joined in a different ORDER: Prim grew a connected blob from ${start}, Kruskal stitched scattered cheap fragments. Try starting from D — different growth story, same final cost.`,
  };

  yield {
    state: snapshot(),
    highlight: hl(),
    explanation: 'When to choose which: Prim with a heap runs O(E log V) and shines on DENSE graphs (and never touches edges far from the tree); Kruskal\'s sort-everything approach suits sparse edge lists and parallelizes nicely. Prim is also a one-line edit away from Dijkstra\'s Shortest Path — same loop, but Dijkstra ranks the frontier by total distance from the source instead of single edge cost. Two greedy siblings, one frontier, different questions.',
  };
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'The animation runs Prim\'s algorithm on the same seven-node weighted graph used in Kruskal\'s topic. You pick a start node (A or D) and watch one tree grow outward.',
        {type: 'callout', text: 'Prim is safe because every accepted edge is the cheapest bridge across the current tree boundary.'},
        'Green nodes and edges are already in the growing tree. Highlighted edges are the current frontier: every edge with one endpoint inside the tree and one outside. The active edge is the cheapest frontier edge being accepted. When a new node joins, its edges to outside nodes enter the frontier, and any edge now fully internal silently drops out.',
        'Watch the frontier shrink and shift as the tree expands. Each acceptance is justified by the cut property: the cheapest edge crossing the inside/outside boundary belongs to some MST. The final tree has V minus 1 edges and the same minimum total cost regardless of which start node you pick.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Connect every node in a weighted graph at minimum total edge cost. The answer is a minimum spanning tree: V minus 1 edges, no cycles, total weight as low as possible.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d2/Minimum_spanning_tree.svg/330px-Minimum_spanning_tree.svg.png', alt: 'Planar weighted graph with the minimum spanning tree highlighted', caption: 'A minimum spanning tree keeps only the edges needed to connect every vertex at minimum total cost. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Minimum_spanning_tree.svg.'},
        'MST algorithms are among the oldest in graph theory. Boruvka published the first one in 1926 for an electrical network in Moravia. Jarnik described the grow-one-tree approach in 1930. Prim rediscovered it at Bell Labs in 1957 while designing telephone networks. Dijkstra independently found the same idea in 1959.',
        'Where Kruskal sorts all edges globally and merges scattered fragments, Prim grows one connected tree outward from a chosen start vertex. At each step, the frontier is every edge with one endpoint inside the tree and one outside. Prim takes the cheapest frontier edge, adds the new vertex, and repeats. No Union-Find is needed because the tree is always one connected component; the only data structure required is a priority queue.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'Try all spanning trees and pick the lightest. A spanning tree on n vertices uses n minus 1 edges and has no cycles. Enumerate every such tree, sum its weights, keep the minimum.',
        'For a small graph this is feasible. With four nodes in a complete graph there are 16 spanning trees. But the count explodes fast.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        "Cayley\'s formula: n labeled vertices yield n^(n-2) spanning trees. For 15 cities that is 15^13, roughly 1.9 times 10^15. For 20 cities, 20^18, roughly 2.6 times 10^23. Enumeration is physically impossible.",
        'The natural greedy impulse is to keep extending the tree on whatever cheap edge is nearby. That impulse is almost right, but without structure it breaks. If you grow the tree by grabbing any cheap edge touching any tree vertex without maintaining a proper frontier, you risk missing cheaper edges elsewhere. And without tracking which vertices are already inside the tree, you can accidentally add edges that create cycles.',
        "Prim\'s structure solves both problems. The frontier is precisely the set of edges with one endpoint in the tree and one outside. A priority queue extracts the cheapest frontier edge in O(log V). The visited set prevents cycles. The cut property proves that the cheapest frontier edge is always safe.",
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Start with one node marked inside the tree. The frontier is every edge with exactly one endpoint inside. Pick the lightest frontier edge, add the outside endpoint to the tree, and repeat until all vertices are inside.',
        'Efficient implementations keep frontier edges in a min-priority queue. A binary heap pops the cheapest candidate in O(log V). Lazy deletion handles stale entries: when an edge pops and both endpoints are already inside, discard it and pop the next one.',
        'This makes Prim feel like Dijkstra\'s Shortest Path: both pop the best item from a priority-queue frontier. The difference is the ranking key. Dijkstra ranks by total distance from the source (accumulated path cost). Prim ranks by single edge weight across the cut (no accumulation). Dijkstra finds shortest paths; Prim finds the lightest spanning tree.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The cut property: split the vertices into the current tree and everything else. The cheapest edge crossing that split belongs to some MST.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/52/Data_Queue.svg/250px-Data_Queue.svg.png', alt: 'Queue diagram showing data entering and leaving an ordered structure', caption: 'A priority queue is the frontier container in efficient Prim implementations, though it removes by minimum key rather than arrival order. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Data_Queue.svg.'},
        'Proof. Suppose an MST T does not contain the cheapest crossing edge e. Adding e to T creates exactly one cycle. That cycle must include another edge f that also crosses the same cut (otherwise the cycle stays on one side and cannot close). Since weight(e) is at most weight(f), replacing f with e yields a spanning tree no heavier than T. So some MST contains e.',
        'Prim applies this at every step. The tree side and the outside side define a cut. The priority queue delivers the cheapest crossing edge. By the cut property, accepting it is safe. After V minus 1 acceptances, the tree spans all vertices and is itself an MST.',
        'The exchange argument is why a local frontier choice is globally optimal. Prim is not guessing from the start node outward; it is repeatedly taking an edge that some minimum spanning tree must contain.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'With adjacency lists and a binary heap: O((V+E) log V) time. Each vertex enters the tree once. Each edge is considered at most twice (once from each endpoint). Each heap operation costs O(log V). Space: O(V+E) for the adjacency lists and heap.',
        'With an adjacency matrix and no heap: O(V^2). Maintain an array of cheapest-known edge cost per outside vertex. Each step scans the array in O(V) to find the minimum, then updates neighbors. On dense graphs where E is close to V^2, this beats the heap version because the O(V^2) scan replaces O(E log V) heap operations.',
        'With a Fibonacci heap: O(E + V log V). The Fibonacci heap supports decrease-key in O(1) amortized, reducing the total key-update cost from O(E log V) to O(E). The V extract-min operations still cost O(V log V). This is the best known bound for Prim on dense graphs, though constant factors make it rare in practice.',
        'Doubling the graph: if V and E both double, the binary-heap version roughly doubles its work (the log factor grows by one). The adjacency-matrix version quadruples. Choose the representation that matches the graph density.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'Cable routing. Connect campus buildings, data-center racks, or cell towers with minimum total fiber. Prim is natural here because the construction crew starts at one building and extends outward, matching the algorithm\'s single-tree growth.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/2/23/Directed_graph_no_background.svg', alt: 'Directed graph with nodes connected by arrows', caption: 'Network design starts from graph structure even when the final MST itself is undirected. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Directed_graph_no_background.svg.'},
        'Circuit design. VLSI layout approximates minimum interconnect for nets of pins. The rectilinear MST (Manhattan distances) gives a lower bound on total wire length. Chip routers refine from there, but the MST sets the budget.',
        'Network backbone planning. ISPs and power utilities use MSTs as a first pass for minimum-cost topology. The pure tree is then augmented with redundant links for fault tolerance, but the minimum connected cost sets the baseline.',
        'Image segmentation. Build an MST over pixels weighted by color difference. Cut the heaviest edges and the remaining components are segments (Felzenszwalb-Huttenlocher method).',
        'Steiner tree approximation. When only a subset of vertices must be connected (the Steiner vertices), the problem becomes NP-hard. The MST of the required vertices gives a 2-approximation and is the starting point for practical heuristics.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Directed graphs need arborescences (directed spanning trees rooted at a given vertex). The minimum-cost arborescence is found by Edmonds\' algorithm, which has a completely different structure from Prim.',
        'No redundancy. A spanning tree is intentionally minimal: remove one edge and the tree disconnects. Real network design starts with an MST cost baseline, then adds capacity, backup paths, and reliability constraints.',
        'Disconnected graphs. Prim grows one tree from the start vertex. If the graph has multiple connected components, Prim only spans the start component. Kruskal naturally returns a minimum spanning forest without special handling.',
        'Equal weights can produce different valid trees depending on the start vertex and tie-breaking. All such trees share the same total weight, but the edge sets may differ.',
        "Do not confuse Prim with Dijkstra. Prim\'s key is the weight of the single edge connecting to the tree. Dijkstra\'s key is the total accumulated distance from the source. Using total distance by mistake turns the implementation into Dijkstra and solves the wrong problem.",
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Six vertices, nine edges: A-B(4), A-C(2), B-C(1), B-D(3), C-D(5), C-E(7), D-E(6), D-F(8), E-F(9). We trace Prim from A.',
        'Tree: {A}. Frontier: A-C(2), A-B(4). Cheapest: A-C(2). Accept. Tree: {A,C}.',
        "Frontier adds C-B(1), C-D(5), C-E(7). A-B(4) remains. Cheapest: C-B(1). Accept. Tree: {A,C,B}.",
        'Frontier adds B-D(3). A-B(4) is now internal (both endpoints in tree), silently dropped. Cheapest: B-D(3). Accept. Tree: {A,C,B,D}.',
        'Frontier adds D-E(6), D-F(8). C-D(5) is now internal, dropped. Cheapest: D-E(6). Accept. Tree: {A,C,B,D,E}.',
        'Frontier adds E-F(9). C-E(7) is now internal. Cheapest: D-F(8). Accept. Tree: {A,C,B,D,E,F}. Done.',
        'MST edges: A-C(2), C-B(1), B-D(3), D-E(6), D-F(8). Total weight: 20.',
        'Kruskal on the same graph finds the same five edges in a different order (B-C first, since it is globally cheapest). Both algorithms produce the same MST because all edge weights are distinct, which guarantees uniqueness.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        "Boruvka, \"O jistem problemu minimalnim,\" 1926 -- the oldest MST algorithm, designed for the Moravian electrical network. Jarnik, 1930 -- first description of the grow-one-tree approach. Prim, \"Shortest Connection Networks,\" Bell System Technical Journal, 1957. Dijkstra, 1959 -- independently found the same algorithm in the same paper as his shortest-path method.",
        "Prerequisite gap: Union-Find (Disjoint Sets) is not used by Prim, but Kruskal needs it for cycle detection. Understanding both MST algorithms together requires it.",
        "Same greedy structure: Dijkstra\'s Shortest Path uses the same priority-queue frontier loop. The only difference is the ranking key: Dijkstra ranks by total distance from the source, Prim ranks by single edge weight. Understanding one makes the other almost free.",
        'Graph foundations: Breadth-First Search and Depth-First Search teach unweighted traversal. BFS is the unweighted version of Prim\'s frontier expansion.',
        "Parallel MST: Boruvka\'s algorithm (1926) independently finds the cheapest edge leaving each component per round, then merges. O(log V) rounds, each embarrassingly parallel. Modern parallel MST implementations are Boruvka-based.",
        "Contrasting alternative: Kruskal\'s Minimum Spanning Tree solves the same problem with a different strategy -- global sort and forest merge versus local frontier growth. Compare both on this site\'s shared graph.",
      ],
    },
  ],
};
