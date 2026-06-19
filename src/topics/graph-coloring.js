// Graph Coloring: assign colors to vertices so no two adjacent vertices share
// a color. Greedy coloring processes vertices in order, picking the smallest
// available color. The chromatic number is the fewest colors needed.

import { graphState } from '../core/state.js';

export const topic = {
  id: 'graph-coloring',
  title: 'Graph Coloring',
  category: 'Algorithms',
  summary: 'Assign colors to vertices so no two neighbors match — the constraint behind scheduling, register allocation, and map coloring.',
  controls: [
    { id: 'order', label: 'Vertex order', type: 'select', options: ['alphabetical', 'degree-descending'], defaultValue: 'degree-descending' },
  ],
  run,
};

// A fixed graph with enough structure to show coloring decisions.
// 7 vertices, mix of degrees, not planar-trivial, chromatic number 3.
const NODES = [
  { id: 'A', label: 'A', x: 1.0, y: 5.0 },
  { id: 'B', label: 'B', x: 3.0, y: 8.0 },
  { id: 'C', label: 'C', x: 3.0, y: 2.0 },
  { id: 'D', label: 'D', x: 5.5, y: 6.5 },
  { id: 'E', label: 'E', x: 5.5, y: 3.5 },
  { id: 'F', label: 'F', x: 8.0, y: 8.0 },
  { id: 'G', label: 'G', x: 8.0, y: 2.0 },
];

const EDGES = [
  ['A', 'B'], ['A', 'C'], ['B', 'D'], ['B', 'E'],
  ['C', 'D'], ['C', 'E'], ['D', 'E'], ['D', 'F'],
  ['E', 'G'], ['F', 'G'],
].map(([from, to]) => ({ id: `${from}${to}`, from, to }));

const COLOR_NAMES = ['red', 'blue', 'green', 'yellow', 'orange'];

function adjacency() {
  const adj = new Map();
  for (const n of NODES) adj.set(n.id, []);
  for (const e of EDGES) {
    adj.get(e.from).push(e.to);
    adj.get(e.to).push(e.from);
  }
  return adj;
}

function degree(id, adj) {
  return adj.get(id).length;
}

function snapshot(title, colorMap) {
  return graphState({
    nodes: NODES.map((n) => ({
      ...n,
      note: colorMap.has(n.id) ? COLOR_NAMES[colorMap.get(n.id)] : '',
    })),
    edges: EDGES,
  });
}

function smallestAvailable(id, adj, colorMap) {
  const usedByNeighbors = new Set();
  for (const nb of adj.get(id)) {
    if (colorMap.has(nb)) usedByNeighbors.add(colorMap.get(nb));
  }
  let c = 0;
  while (usedByNeighbors.has(c)) c++;
  return { color: c, usedByNeighbors };
}

export function* run(input) {
  const adj = adjacency();
  const colorMap = new Map();

  // Determine vertex processing order
  let order = NODES.map((n) => n.id);
  const orderLabel = String(input.order);
  if (orderLabel === 'degree-descending') {
    order.sort((a, b) => degree(b, adj) - degree(a, adj));
  }

  const degreeList = order.map((id) => `${id}(${degree(id, adj)})`).join(', ');

  yield {
    state: snapshot('Graph Coloring: assign colors so no neighbors match', colorMap),
    highlight: {},
    explanation: `Goal: color every vertex so no edge connects two vertices of the same color. ` +
      `Processing order: ${order.join(' → ')}${orderLabel === 'degree-descending' ? ` (sorted by degree: ${degreeList})` : ''}. ` +
      `The greedy algorithm picks the smallest color not used by any already-colored neighbor.`,
  };

  for (let i = 0; i < order.length; i++) {
    const id = order[i];
    const neighbors = adj.get(id);
    const coloredNeighbors = neighbors.filter((nb) => colorMap.has(nb));

    // Show adjacency check
    const { color, usedByNeighbors } = smallestAvailable(id, adj, colorMap);
    const usedColors = [...usedByNeighbors].map((c) => COLOR_NAMES[c]);

    const neighborEdges = neighbors
      .map((nb) => EDGES.find((e) => (e.from === id && e.to === nb) || (e.from === nb && e.to === id)))
      .filter(Boolean)
      .map((e) => e.id);

    yield {
      state: snapshot(`Check neighbors of ${id}`, colorMap),
      highlight: {
        active: [id],
        compare: [...coloredNeighbors, ...neighborEdges],
        visited: [...colorMap.keys()].filter((k) => k !== id),
      },
      explanation: `Vertex ${id} has ${neighbors.length} neighbor${neighbors.length === 1 ? '' : 's'}: ${neighbors.join(', ')}. ` +
        (coloredNeighbors.length > 0
          ? `Already colored: ${coloredNeighbors.map((nb) => `${nb}=${COLOR_NAMES[colorMap.get(nb)]}`).join(', ')}. Colors blocked: {${usedColors.join(', ')}}. `
          : 'None are colored yet. No colors are blocked. ') +
        `Smallest available color: ${COLOR_NAMES[color]} (index ${color}).`,
    };

    // Assign color
    colorMap.set(id, color);

    yield {
      state: snapshot(`Color ${id} → ${COLOR_NAMES[color]}`, colorMap),
      highlight: {
        found: [id],
        visited: [...colorMap.keys()].filter((k) => k !== id),
      },
      explanation: `Assign ${COLOR_NAMES[color]} to ${id}. ` +
        `${colorMap.size} of ${NODES.length} vertices colored so far using ${new Set(colorMap.values()).size} color${new Set(colorMap.values()).size === 1 ? '' : 's'}.`,
    };
  }

  const totalColors = new Set(colorMap.values()).size;
  const colorSummary = order.map((id) => `${id}=${COLOR_NAMES[colorMap.get(id)]}`).join(', ');

  yield {
    state: snapshot(`Done: ${totalColors} colors used`, colorMap),
    highlight: {
      found: order,
    },
    explanation: `Greedy coloring complete: ${colorSummary}. Used ${totalColors} color${totalColors === 1 ? '' : 's'}. ` +
      `No edge connects two vertices of the same color. ` +
      `For this graph, ${totalColors} is the chromatic number — no valid coloring exists with fewer. ` +
      `Greedy does not always find the optimum, but sorting by degree (Welsh-Powell) often helps.`,
  };
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'Each circle is a vertex. Lines between circles are edges. The note under each vertex shows its assigned color (red, blue, green, ...) once the algorithm has processed it.',
        'Active highlight marks the vertex currently being colored. Compare highlights show its neighbors and the edges being checked for color conflicts. Visited highlights mark vertices that already have a color. Found highlights appear when a vertex receives its final color assignment.',
        'The algorithm processes vertices in the chosen order. For each vertex, it checks which colors its already-colored neighbors use, then picks the smallest color index not in that blocked set. Watch how high-degree vertices processed early force later neighbors into new colors, and how low-degree vertices often reuse an existing color.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Many real problems reduce to one constraint: things that conflict cannot share a resource. Exams with overlapping students cannot run in the same time slot. CPU values that are live at the same time cannot share a register. Radio transmitters within range of each other cannot use the same frequency. Adjacent countries on a map should not share a color.',
        'All of these are the same abstract problem. Build a graph where nodes are the things and edges connect conflicting pairs. Assign labels (colors) so no edge has the same label on both ends. Minimize the number of labels. That is graph coloring.',
        'The chromatic number chi(G) is the smallest k such that G has a valid k-coloring. Finding it exactly is NP-hard for general graphs, but greedy heuristics work well enough for most practical instances.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'Try every possible assignment. With k colors and n vertices, there are k^n candidates. Check each one for validity: walk every edge and verify the endpoints differ. Return the smallest k that has at least one valid assignment.',
        'For a 10-vertex graph and 3 colors, that is 59,049 candidate colorings. Each check walks all edges. The approach is correct — it never misses a valid coloring — but the cost is exponential in n and grows with k.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'Graph coloring is NP-complete for k >= 3 (Karp 1972). No known polynomial-time algorithm finds the chromatic number of an arbitrary graph. Brute force is doubly wasteful: it does not reuse information from partial assignments, and it does not prune assignments that are already broken.',
        'Even deciding whether a graph is 3-colorable is NP-complete. The problem is hard not because individual checks are expensive, but because the number of candidates grows exponentially and the constraint structure can force exhaustive search.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Process vertices one at a time. When you reach a vertex, its neighbors that are already colored define a set of forbidden colors. Pick the smallest color not in that set. This greedy strategy never creates a conflict because it only looks at colors already committed. It runs in O(V + E) time.',
        'The key tradeoff: greedy is fast but not optimal. The number of colors it uses depends on the vertex ordering. A bad order can force extra colors. A good order — like sorting by degree descending (Welsh-Powell) — tends to use fewer colors because high-degree vertices get colored first, when more colors are still available.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Greedy coloring: (1) Pick a vertex ordering. (2) For each vertex v in order, find the set of colors used by v\'s already-colored neighbors. (3) Assign v the smallest non-negative integer not in that set. Done.',
        'Welsh-Powell improves the ordering: sort vertices by degree in descending order. The idea is that high-degree vertices are the hardest to color because they have the most constraints. Coloring them first, when few constraints are committed, gives them more freedom.',
        'DSatur (degree of saturation) improves further: instead of a fixed order, always pick the uncolored vertex with the most distinct colors among its colored neighbors. Ties break by degree. This adaptive ordering responds to the coloring as it develops.',
        'For exact solutions, backtracking tries assigning color 1 to the first vertex, recurses, and backtracks if a dead end is reached — the same pattern as N-Queens. Branch-and-bound adds a lower bound (e.g., the clique number) to prune branches that cannot beat the best solution found so far.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Greedy never assigns a conflicting color because it checks all colored neighbors before choosing. The only question is how many colors it needs. The answer: at most Delta + 1, where Delta is the maximum degree of any vertex. Proof: when greedy reaches any vertex v, v has at most Delta neighbors, so at most Delta colors are blocked. Color Delta + 1 is always available.',
        'Brooks\' theorem (1941) tightens this: for any connected graph that is not a complete graph and not an odd cycle, chi(G) <= Delta. Complete graphs need exactly Delta + 1 colors (every vertex is adjacent to every other). Odd cycles need 3 colors. Everything else can do at least one better than the greedy worst case.',
        'For planar graphs, the Four Color Theorem (Appel and Haken 1976) guarantees chi(G) <= 4. This was the first major theorem proved with computer assistance — the proof checked 1,936 reducible configurations by machine. A simpler proof by Robertson, Sanders, Seymour, and Thomas (1997) reduced the configurations to 633.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Greedy coloring runs in O(V + E): visit each vertex once, check its neighbors once. The constant per vertex is proportional to its degree, and the sum of all degrees is 2E. Space is O(V) for the color assignment plus O(V + E) for the adjacency structure.',
        'Welsh-Powell adds an O(V log V) sort at the start. DSatur uses a priority queue, giving O((V + E) log V). Both are fast in practice.',
        'Finding the exact chromatic number is NP-hard. Backtracking with pruning works for small graphs (up to ~60 vertices in reasonable time). For larger instances, heuristics and approximation algorithms are used instead.',
        'Doubling V roughly doubles greedy runtime (it is linear in V + E for sparse graphs). Doubling E also roughly doubles runtime. The algorithm is I/O-bound on the adjacency list traversal.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'Compiler register allocation is graph coloring\'s most famous application. Build an interference graph: variables that are live at the same time are connected by edges. Colors are physical registers. Chaitin (1981) showed this reduction. The greedy simplify-select heuristic runs in O(V + E) and works well on the interference graphs compilers encounter, which tend to be sparse and nearly chordal.',
        'Exam and course scheduling: courses with shared students cannot run in the same time slot. Build a conflict graph, color it, and each color is a slot. Universities use this every semester.',
        'Wireless frequency assignment: transmitters within interference range share an edge. Colors are frequencies. Fewer colors means less spectrum is needed. Cell tower planning uses graph coloring heuristics on networks with thousands of nodes.',
        'Sudoku is graph coloring on a specific 81-vertex graph. Each cell is a vertex. Edges connect cells in the same row, column, or 3x3 box. The puzzle asks for a 9-coloring of a partially colored graph. Any Sudoku solver is implicitly a graph coloring solver.',
        'Map coloring is the original motivation. Francis Guthrie conjectured in 1852 that four colors suffice for any map. The Four Color Theorem confirmed it 124 years later.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Greedy coloring is order-dependent. The same graph can be colored with chi(G) colors under one vertex ordering and 2*chi(G) colors under another. There is no efficient way to find the best ordering in general.',
        'Finding the exact chromatic number is NP-hard, so large graphs cannot be colored optimally. Approximation is also hard: no polynomial-time algorithm can approximate the chromatic number within a factor of V^(1-epsilon) for any epsilon > 0, unless P = NP (Zuckerman 2007).',
        'Planar graphs are always 4-colorable, but finding an explicit 4-coloring in linear time is non-trivial. The Robertson et al. algorithm does it but is complex to implement. In practice, a greedy 5- or 6-coloring is often good enough and simpler.',
        'Dense graphs with high chromatic numbers offer little room for optimization — the coloring is forced. Greedy works fine here because it cannot do much worse than optimal. The hard cases are sparse graphs where the chromatic number is low but finding it is computationally expensive.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Graph: 7 vertices A-G with edges A-B, A-C, B-D, B-E, C-D, C-E, D-E, D-F, E-G, F-G. Welsh-Powell order (by degree descending): D(4), E(4), B(3), C(3), A(2), F(2), G(2).',
        'D: no colored neighbors. Assign red (0). Colors used: {red}.',
        'E: neighbors B, C, D, G. Only D is colored (red). Blocked: {red}. Assign blue (1). Colors used: {red, blue}.',
        'B: neighbors A, D, E. D=red, E=blue. Blocked: {red, blue}. Assign green (2). Colors used: {red, blue, green}.',
        'C: neighbors A, D, E. D=red, E=blue. Blocked: {red, blue}. Assign green (2). Same as B — they are not adjacent, so sharing green is fine.',
        'A: neighbors B, C. B=green, C=green. Blocked: {green}. Assign red (0). Reuses the first color.',
        'F: neighbors D, G. D=red. Blocked: {red}. Assign blue (1). Reuses the second color.',
        'G: neighbors E, F. E=blue, F=blue. Blocked: {blue}. Assign red (0). Reuses the first color.',
        'Result: 3 colors. Assignment: D=red, E=blue, B=green, C=green, A=red, F=blue, G=red. No edge connects two vertices of the same color. This graph contains a triangle (D-E-B or D-E-C), so 3 is optimal — you cannot 2-color a triangle.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Appel and Haken, "Every Planar Map is Four Colorable" (1976) — the Four Color Theorem, proved with computer assistance. Brooks, "On Colouring the Nodes of a Network" (1941) — the chi <= Delta bound for non-complete, non-odd-cycle graphs. Karp, "Reducibility Among Combinatorial Problems" (1972) — graph coloring is among the 21 original NP-complete problems. Welsh and Powell, "An Upper Bound for the Chromatic Number" (1967) — the degree-sorted greedy heuristic. Chaitin, "Register Allocation and Spilling via Graph Coloring" (1982) — the application that made graph coloring a workhorse of compiler construction.',
        'Prerequisites: graph representation for adjacency lists, graph BFS and graph DFS for traversal mechanics. Extensions: interference graph register allocation for the compiler application, backtracking and N-Queens for the exact-solution search pattern. Related: topological sort for another graph algorithm that processes vertices in a specific order. Contrast: maximum independent set and maximum clique, which are dual problems to coloring.',
      ],
    },
  ],
};
