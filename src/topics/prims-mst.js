// Prim\'s algorithm: the other road to the minimum spanning tree. Where
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
      
        {type: 'image', src: './assets/gifs/prims-mst.gif', alt: 'Animated walkthrough of the prims mst visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'A minimum spanning tree connects every vertex in a weighted undirected graph with the least possible total edge weight. It uses V minus 1 edges and contains no cycles. The problem appears whenever connection is required but redundant links are not part of the first cost target.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d2/Minimum_spanning_tree.svg/330px-Minimum_spanning_tree.svg.png', alt: 'Planar weighted graph with the minimum spanning tree highlighted', caption: 'A minimum spanning tree keeps only the edges needed to connect every vertex at minimum total cost. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Minimum_spanning_tree.svg.'},
        'Prim exists as a grow-one-tree solution. Instead of sorting all edges globally like Kruskal, it keeps one connected component and repeatedly adds the cheapest edge leaving that component. The algorithm matches settings where a network is built outward from an existing connected region.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The brute-force approach is to try every spanning tree and choose the lightest. This is conceptually correct because the answer must be one of those trees. It is also unusable beyond tiny graphs.',
        'A tempting greedy shortcut is to keep grabbing cheap nearby edges. That intuition is close, but it needs a precise boundary. Without tracking the inside/outside frontier, a cheap edge can create a cycle or distract from the cheapest safe crossing edge.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The enumeration wall is combinatorial. Cayley\'s formula says a complete graph on n labeled vertices has n^(n-2) spanning trees. For 15 vertices that is about 1.9 * 10^15 candidates, before even summing weights.',
        'The greedy wall is safety. An edge is not safe merely because it is cheap; it must connect the current tree to an outside vertex. Prim\'s frontier gives the greedy choice the missing proof condition.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Maintain a cut: vertices already in the tree on one side, all other vertices on the other side. The cheapest edge crossing that cut is safe to accept. After accepting it, the outside endpoint joins the tree and creates a new cut.',
        'The priority queue is just the data structure for that cut. It stores candidate frontier edges by weight and lets the algorithm find the cheapest one quickly. The visited set prevents edges that are now internal from creating cycles.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Start with any vertex inside the tree. Add all edges from that vertex to outside vertices into a min-priority queue. Repeatedly pop the lightest edge; if it reaches an unvisited vertex, accept it and add that new vertex\'s outgoing edges.',
        'Lazy deletion keeps implementation simple. Some heap entries become stale because both endpoints are already inside the tree by the time they pop. The algorithm discards those entries and continues until V minus 1 edges have been accepted.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The cut property is the correctness argument. For any split of vertices, the lightest edge crossing the split belongs to some minimum spanning tree. Prim always chooses such an edge for the split defined by its current tree.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/52/Data_Queue.svg/250px-Data_Queue.svg.png', alt: 'Queue diagram showing data entering and leaving an ordered structure', caption: 'A priority queue is the frontier container in efficient Prim implementations, though it removes by minimum key rather than arrival order. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Data_Queue.svg.'},
        'If an MST does not contain the chosen edge e, adding e creates a cycle. That cycle must contain another edge f crossing the same cut. Since e is no heavier than f, replacing f with e gives a spanning tree no heavier than the original, so accepting e is safe.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'With adjacency lists and a binary heap, Prim runs in O((V + E) log V) time. Each edge can enter the heap from an endpoint, and each heap operation costs logarithmic time. Space is O(V + E) for the graph, visited set, and heap.',
        'With an adjacency matrix and no heap, Prim runs in O(V^2). That can be better on dense graphs because scanning V entries per step avoids many heap updates. Doubling a sparse graph roughly doubles work with a small log increase; doubling a dense matrix graph roughly quadruples the scan work.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Prim is useful for first-pass network design: fiber routes, campus cabling, rack connections, power distribution sketches, and other minimum-connection plans. The tree is often only a baseline because real systems later add redundant links. Still, the MST tells the minimum possible connection cost.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/2/23/Directed_graph_no_background.svg', alt: 'Directed graph with nodes connected by arrows', caption: 'Network design starts from graph structure even when the final MST itself is undirected. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Directed_graph_no_background.svg.'},
        'MSTs also appear in image segmentation, clustering, and approximation algorithms. In each case, the graph encodes similarity or cost, and the tree exposes a cheap connected skeleton. Prim is natural when the graph is available by adjacency from a starting point.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Prim does not solve directed minimum arborescence; that is Edmonds\' algorithm. It also does not handle disconnected graphs as one tree. Starting in one component only spans that component unless the implementation deliberately returns a forest.',
        'A minimum spanning tree has no redundancy. Remove one accepted edge and the tree disconnects. Real network design usually starts with an MST cost baseline and then adds reliability, capacity, latency, and policy constraints.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Use vertices A, B, C, D, E, F and edges A-B(4), A-C(2), B-C(1), B-D(3), C-D(5), C-E(7), D-E(6), D-F(8), and E-F(9). Start at A, so the frontier is A-C(2) and A-B(4). Accept A-C(2).',
        'The tree is now {A, C}. Add C-B(1), C-D(5), and C-E(7), while A-B(4) remains. Accept C-B(1), then add B-D(3), and accept B-D(3).',
        'The tree is {A, C, B, D}. Add D-E(6) and D-F(8), and discard internal edges when they pop. Accept D-E(6), then D-F(8). The MST edges are A-C, C-B, B-D, D-E, and D-F, with total weight 20.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Boruvka, 1926, for the first MST algorithm; Jarnik, 1930, for the grow-one-tree approach; Prim, Shortest Connection Networks, 1957; and Dijkstra, 1959, for the independent rediscovery. Standard algorithms texts prove the cut property and compare heap choices.',
        'Study next: Kruskal MST for the global-sort alternative, Union-Find for cycle detection in Kruskal, Binary Heap for the priority queue, Dijkstra for the similar frontier loop with a different key, and Boruvka for parallel MST construction.',
      ],
    },
  ],
};


