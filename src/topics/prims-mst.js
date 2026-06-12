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
        `Prim's algorithm finds a minimum spanning tree by growing one connected blob outward from a starting node. Unlike Kruskal (which sorts every edge globally and stitches scattered fragments), Prim maintains a single growing tree and always reaches across its boundary on the cheapest available edge. The result is identical — the same minimum total cost — but the journey is completely different.`,
        `Named after Robert C. Prim's 1957 publication (though Vojtěch Jarník discovered the same method in 1930), the algorithm answers the question: what is the cheapest way to connect all nodes if I must grow the tree piece by piece, starting from one place? This matters in real practice because Prim's greedy local choice at each step builds on decisions already made, unlike Kruskal's complete edge sort.`,
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        `Start with a single node in the tree. At each step, look at the frontier: every edge that has one endpoint inside the tree and one outside. Pick the cheapest frontier edge, add the outside endpoint to the tree, and repeat until all nodes are included. The cut property guarantees safety — the cheapest edge across any partition (inside versus outside the tree) belongs in SOME minimum spanning tree, so greedily picking it cannot trap you in a local optimum.`,
        `A priority queue (min-heap) makes this efficient. Instead of scanning all frontier edges from scratch each iteration, insert them into the heap once their inside endpoint joins the tree. The heap pops the minimum in O(log V) time. Dead edges (those now entirely inside the tree after the new node joins) are ignored; they never bubble out of the heap, a lazy-deletion pattern called "let the heap forget."`,
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        `With a binary heap, Prim runs in O(E log V): each of the V nodes is extracted once (V × log V), and each edge is pushed onto the heap at most once (E × log V). On dense graphs where E approaches V², this is faster than Kruskal's O(E log E) sort (which can degrade to O(E log V) with Union-Find, but the constant overhead is higher). On sparse graphs (E ≈ V), Kruskal's simpler sorting beats Prim's heap bookkeeping. Prim also never inspects edges far from the growing tree, making it cache-friendly on real hardware.`,
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        `Network design: connecting cities by cheapest roads, or routing cables across a dense city block where you already have the map and know every cable length. Prim's locality advantage shows when infrastructure already exists and you are solving the problem from one end. Clustering and image processing use MST algorithms to decide which groups to merge; Prim's tree-growing nature fits nicely into incremental hierarchical clustering. Any greedy MST solver (both Prim and Kruskal) appears inside higher-level algorithms; the choice between them is a runtime/density tuning knob, not a correctness distinction.`,
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        `Prim and Kruskal find the same optimal cost but in different orders — neither is "more correct." The misconception that one is fundamentally better ignores the input: dense graphs favor Prim, sparse graphs favor Kruskal. Another pitfall: forgetting that the frontier grows as the tree grows; edges that were invisible on iteration 1 become candidates by iteration 5. A naive reimplementation that re-scans all edges each step degrades to O(V³) and defeats the algorithm entirely.`,
        `Prim's kinship to Dijkstra's Shortest Path is a one-line difference: both maintain a frontier, both pop the minimum, but Dijkstra ranks by total distance-from-source while Prim ranks by edge cost alone. Mixing them up in implementation (or testing) is a silent bug — the code will compile and run, but solve the wrong problem.`,
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        `Compare Prim side by side with Kruskal's Minimum Spanning Tree — same problem, different algorithm philosophy. Then explore Binary Heap (Priority Queue) to see why the min-extraction is fast. For the cut property's full proof, review Union-Find (Disjoint Sets), which Kruskal uses. Finally, see Dijkstra's Shortest Path for the moment when "frontier ranked by edge cost" becomes "frontier ranked by distance" — two siblings born from the same greedy skeleton.`,
      ],
    },
  ],
};

