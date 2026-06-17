// Prim's algorithm: the other road to the minimum spanning tree. Where
// Kruskal sorts all edges and merges a forest, Prim grows ONE tree outward,
// always taking the cheapest edge on its frontier. Same graph, same answer,
// different journey — compare them side by side.

import { graphState, InputError } from '../core/state.js';

export const topic = {
  id: 'prims-mst',
  title: "Prim's Algorithm",
  category: 'Data Structures',
  summary: 'Grow one tree outward, always crossing the frontier on the cheapest edge — the MST, built the other way.',
  controls: [
    { id: 'start', label: 'Start from', type: 'select', options: ['A', 'D'], defaultValue: 'A' },
  ],
  run,
};

// The exact graph from Kruskal's topic, so the two algorithms can be compared.
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
    explanation: `Same seven cities and eleven cables as Kruskal's Minimum Spanning Tree — but a different philosophy. Kruskal thinks globally: sort EVERY edge, merge a forest. Prim thinks locally: start somewhere (${start}), and grow ONE tree outward, always crossing the frontier on the cheapest available cable. A Binary Heap (Priority Queue) serves that "cheapest frontier edge" in O(log n).`,
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
      heading: 'What it is',
      paragraphs: [
        `Prim's Algorithm builds a minimum spanning tree by growing one connected tree outward from a chosen start node. Kruskal's Minimum Spanning Tree sorts every edge globally and merges scattered components; Prim keeps one component and repeatedly crosses its frontier on the cheapest edge. The visualization uses the same seven-city, eleven-edge graph as Kruskal, with a start choice of A or D, so the order changes but the final minimum cost remains 19.`,
        `The naive approach is again to search over whole spanning trees. The practical greedy temptation is to keep extending the current tree somehow. Prim makes that safe by choosing the cheapest edge across the exact cut between the current tree and the outside world. Edges fully inside the tree are ignored because they would only create cycles.`,
        `The algorithm is usually credited to Robert Prim's 1957 paper, though Vojtech Jarnik described the idea in 1930 and Edsger Dijkstra rediscovered it in 1959. It is a cut-property algorithm: at any moment, split the graph into nodes already in the tree and nodes outside it. The cheapest edge crossing that split is safe to add to some MST.`,
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        `Start with one node marked inside the tree. The frontier is every edge with exactly one endpoint inside. Pick the lightest frontier edge, add the outside endpoint, and repeat until all vertices are inside. In the demo, each step highlights the current frontier, then marks the cheapest cable as active before adding the new city. Edges that become fully internal stop mattering, because adding them would create a cycle.`,
        `Efficient implementations keep frontier edges in a min-priority queue. A Binary Heap (Priority Queue) pops the cheapest candidate in O(log V), while lazy deletion ignores stale edges whose endpoints are already both inside. This makes Prim feel like Dijkstra's Shortest Path: both pop the best frontier item. The ranking differs. Dijkstra ranks by total distance from the source; Prim ranks by single edge weight across the cut.`,
        `Correctness is the cut property repeated. At each step, any spanning tree must eventually cross from the current tree to an outside vertex. Taking the cheapest such crossing cannot make the final tree worse, so the local frontier decision is globally safe.`,
      ],
    },
    {
      heading: 'Core insight',
      paragraphs: [
        'Watch the growing tree boundary. Prim keeps one connected component and repeatedly chooses the cheapest edge that leaves it. The highlighted frontier is the set of candidate ways to expand the current tree by one vertex.',
        'The tempting confusion is to compare it with shortest paths. Prim does not care how far a vertex is from the start; it cares about the cheapest next connection to the existing tree. That is why it builds a minimum spanning tree, not routes from a source.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        `With adjacency lists and a binary heap, Prim runs in O(E log V) time and O(E) space for queued edges. With an adjacency matrix and no heap, it can run in O(V^2), which is attractive for dense graphs where E is close to V^2. With Fibonacci heaps, the textbook bound improves to O(E + V log V), though constants make that rarer in ordinary code. Kruskal's sorting cost is also O(E log V), so real choice depends on graph representation, density, and implementation simplicity.`,
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        `Prim fits problems where the graph is already local to a growing region: laying cable from an existing hub, expanding a road plan outward, or connecting points in a dense geometric graph. Image segmentation and clustering sometimes use MSTs as an intermediate structure; K-Means Clustering is a different centroid-based view of grouping. In network design, a pure MST is a cost baseline, not a complete production plan, because real systems also need redundancy, capacity, and failure tolerance. Big-O Growth Rates matters here because dense and sparse graphs push you toward different MST implementations.`,
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        `Prim and Kruskal both find an optimal MST; neither is more correct. Equal weights can produce different valid trees, and the start node can change the growth order without changing the minimum total cost. Another common bug is using total path distance by accident, which turns the implementation into Dijkstra's Shortest Path and solves the wrong problem. Also remember that Prim assumes an undirected connected graph. If the graph is disconnected, it builds a minimum spanning forest only if you restart it from each component.`,
        `It is also the wrong abstraction when the product needs redundancy or directed reachability. A minimum spanning tree is intentionally fragile: remove one chosen edge and the tree disconnects. Real network design often starts with an MST cost baseline, then adds capacity, backup paths, and reliability constraints.`,
      ],
    },
    {
      heading: 'Implementation checklist',
      paragraphs: [
        'Represent the graph as adjacency lists when it is sparse. Keep a visited set for vertices already in the tree. Push frontier edges into a min-heap, and when an edge is popped, ignore it if both endpoints are already visited. That lazy-deletion version is simple and reliable.',
        'For dense graphs, an adjacency matrix with a best-known connection cost per outside vertex can be simpler and competitive. The right implementation depends on graph density more than on the abstract algorithm name.',
        'If the graph may be disconnected, either report that no spanning tree exists or run Prim from every unvisited component and call the result a minimum spanning forest. Do not silently return a partial tree as if it connected everything.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Start at A. The frontier contains A-G with weight 2, A-B with weight 4, and A-F with weight 8. Prim takes A-G because it is the cheapest edge crossing from the current tree to the outside. Now the tree has A and G, and new edges from G enter the frontier.',
        'The algorithm never chooses an edge just because it is globally small. It chooses the smallest edge that crosses the current cut. That distinction is why Prim grows one connected tree while Kruskal may build several fragments before they merge.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The cut property is the proof. At any step, divide vertices into the tree side and the outside side. Every spanning tree must cross that cut at least once. If the cheapest crossing edge were excluded from an optimal tree, swapping it in for a more expensive crossing would not increase total cost.',
        'That exchange argument is why a local frontier choice is safe. Prim is not guessing from the start node outward; it is repeatedly taking an edge that some minimum spanning tree can contain.',
      ],
    },
    {
      heading: 'What to watch in production',
      paragraphs: [
        'Real network design usually needs more than an MST. Capacity, latency, directed links, redundancy, maintenance windows, and geographic constraints can make the minimum-cost tree a bad deployed network. Use it as a baseline or subroutine, not as a complete design policy.',
        'For implementation, watch stale heap edges. The heap may contain edges that were frontier edges when pushed but are internal by the time they pop. The visited check is what keeps the tree acyclic.',
        'If edge weights can change while the algorithm is running, snapshot the graph or restart. Prim assumes a fixed weighted graph. Mixing edges from different versions can produce a tree that is neither minimum nor meaningful.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        `Compare Prim's Algorithm directly with Kruskal's Minimum Spanning Tree on this site's shared graph. Then study Binary Heap (Priority Queue), because the heap is the usual frontier engine. Union-Find (Disjoint Sets) explains Kruskal's cycle checks, while Graph BFS gives the simpler unweighted frontier pattern. Finish with Dijkstra's Shortest Path to see how changing one priority rule turns an MST algorithm into a shortest-route algorithm.`,
      ],
    },
  ],
};
