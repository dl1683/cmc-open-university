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
    { heading: 'How to read the animation', paragraphs: [
        'The animation processes graph edges in nondecreasing weight order. The active edge is the one being tested, accepted edges are already in the forest, and rejected edges are edges whose endpoints are already connected.',
        {
          type: 'callout',
          text: 'Kruskal is safe because every accepted edge is the cheapest available bridge across a component cut.',
        },
        'A component is a group of vertices already connected by accepted edges. Each accepted edge reduces the component count by one, and each rejected edge proves that a cheaper path already connects the same endpoints.',
        'In clustering mode, the same process stops before one component remains. The remaining components are single-linkage clusters: cheap edges joined close points, while expensive crossing edges stayed outside the forest.',
      
        {type: 'image', src: './assets/gifs/kruskal-mst.gif', alt: 'Animated walkthrough of the kruskal mst visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},], },
    { heading: 'Why this exists', paragraphs: [
        'A weighted graph is a set of vertices joined by edges that have costs. A minimum spanning tree, or MST, connects every vertex with no cycle and with the smallest possible total edge weight.',
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d2/Minimum_spanning_tree.svg/330px-Minimum_spanning_tree.svg.png',
          alt: 'Weighted planar graph with the minimum spanning tree emphasized',
          caption: 'A minimum spanning tree keeps enough edges to connect every vertex while deleting every redundant cycle. Source: Wikimedia Commons, File:Minimum spanning tree.svg.',
        },
        'This problem appears when the cost is paid for building connections, not for shortest travel from one source. Cable layout, power distribution, circuit wiring, and clustering all need enough links to connect everything without buying redundant cycles.',
      ], },
    { heading: 'The obvious approach', paragraphs: [
        'The obvious approach is to list every spanning tree, add its edge weights, and keep the lightest one. This is logically correct because the answer must be somewhere in that list.',
        'It even works by hand on four or five vertices. The method fails because the number of candidate trees explodes faster than the graph looks complicated.',
      ], },
    { heading: 'The wall', paragraphs: [
        'A complete graph on n labeled vertices has n^(n-2) spanning trees by Cayley formula. Ten vertices have 100,000,000 trees; twenty vertices have about 2.6e23, so enumeration is not a slow algorithm but a nonstarter.',
        'A second wall appears if you greedily take cheap edges without a cycle test. The next cheap edge may connect two vertices already linked through accepted edges, adding cost while destroying the tree property.',
      ], },
    { heading: 'The core insight', paragraphs: [
        'The safe greedy move is not simply cheap edge first. It is cheap edge first, unless the edge closes a cycle inside the forest already built.',
        'Union-Find supplies the missing test. If the endpoints have different representatives, the edge merges two components; if they have the same representative, the edge is redundant.',
      ], },
    { heading: 'How it works', paragraphs: [
        'Sort all E edges by weight. Scan that list once, test each edge with find on its two endpoints, accept it only when the endpoints are in different components, and union those components after acceptance.',
        'The partial result is a forest, meaning a set of trees. It starts with V one-vertex trees and stops after V minus 1 accepted edges, when one connected tree remains.',
      ], },
    { heading: 'Why it works', paragraphs: [
        'The cut property is the correctness argument. For any split of the vertices into two nonempty sides, the lightest edge crossing that split belongs to some MST.',
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f7/Msp-the-cut-correct.svg/500px-Msp-the-cut-correct.svg.png',
          alt: 'Cut property diagram for a minimum spanning tree',
          caption: 'The cut-property picture shows why the cheapest edge crossing a cut can be accepted without regret. Source: Wikimedia Commons, File:Msp-the-cut-correct.svg.',
        },
        'If an MST omits that lightest crossing edge, adding it creates a cycle with some other crossing edge. Swapping out the heavier crossing edge keeps the graph connected and cannot increase total weight, so Kruskal preserves the invariant that the accepted forest is contained in some MST.',
      ], },
    { heading: 'Cost and complexity', paragraphs: [
        'Sorting the edges costs O(E log E), and that dominates the algorithm. Union-Find with path compression and union by rank costs O(E alpha(V)) total after sorting, where alpha grows so slowly it is effectively constant on real inputs.',
        'When the edge list doubles, the sort roughly doubles the items and adds one comparison level. Memory is O(V) for Union-Find plus O(E) for the edge list and O(V) for the output tree.',
      ], },
    { heading: 'Real-world uses', paragraphs: [
        'Network planners use MSTs as a baseline for connecting sites with minimum cable or fiber. Hardware and VLSI tools use MST-like lower bounds before detailed routing adds geometry constraints.',
        'Kruskal also gives single-linkage clustering when stopped early. In metric TSP approximation, an MST is a cheap lower bound and a starting point for the double-tree 2-approximation.',
      ], },
    { heading: 'Where it fails', paragraphs: [
        'An MST is not a shortest-path tree. It minimizes total construction cost, so the route between two particular vertices inside the tree can be much longer than their shortest path in the original graph.',
        'It also has no redundancy. Removing any edge disconnects the tree, so production networks usually start from the MST as a cost floor and then add backup links for reliability.',
      ], },
    { heading: 'Worked example', paragraphs: [
        'Use six vertices and nine edges: A-B(4), A-C(2), B-C(1), B-D(3), C-D(5), C-E(7), D-E(6), D-F(8), E-F(9). Sorted order is B-C(1), A-C(2), B-D(3), A-B(4), C-D(5), D-E(6), C-E(7), D-F(8), E-F(9).',
        'Accept B-C for total 1, accept A-C for total 3, and accept B-D for total 6. Reject A-B and C-D because their endpoints already share a component; accept D-E for total 12, reject C-E, then accept D-F for total 20.',
        'The final tree has five edges for six vertices: B-C, A-C, B-D, D-E, and D-F. Every accepted edge merged two components, and every rejected edge would have closed a cycle.',
      ], },
    { heading: 'Sources and study next', paragraphs: [
        'Primary sources are Boruvka 1926, Kruskal 1956, Jarnik 1930, Prim 1957, and later MST work by Pettie and Ramachandran. The proof to remember is the cut property, because it is the reason the greedy choice is safe.',
        'Study Union-Find next because it makes the cycle test cheap. Then compare Prim algorithm, Dijkstra shortest path, graph representations, and single-linkage clustering so the objective differences stay clear.',
      ], },
  ],
};
