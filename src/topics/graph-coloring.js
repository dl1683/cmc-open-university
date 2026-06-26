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
        'Each circle is a vertex in the graph. Lines between circles are edges, representing conflicts — two vertices connected by an edge cannot share the same color. The note beneath each vertex shows its assigned color name (red, blue, green) once the algorithm has processed it. Uncolored vertices have no note.',
        'The active highlight marks the vertex currently being colored. Compare highlights show its neighbors and the edges being checked for color conflicts. Visited highlights mark vertices that already carry a committed color. Found highlights flash when a vertex receives its final color assignment.',
        'Watch the order of processing. When set to degree-descending (Welsh-Powell), vertices with the most edges go first. Notice how a high-degree vertex colored early constrains many future neighbors, while a low-degree vertex processed later often reuses a color that is already in play. The blocked-color set grows and shrinks depending on which neighbors are already colored.',
        'The total color count at the end is the number of distinct colors greedy needed. Compare it to the chromatic number (the theoretical minimum). For this graph, they match — greedy with Welsh-Powell ordering finds the optimum.',
        {type: 'callout', text: 'Graph coloring turns conflict into adjacency: once conflicts are edges, a color is any reusable resource that no neighbor can share.'},
        {type: 'image', src: './assets/gifs/graph-coloring.gif', alt: 'Animated walkthrough of the graph coloring visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Dozens of real problems share one constraint pattern: things that conflict cannot share a resource. University exams with overlapping students cannot occupy the same time slot. Variables alive at the same point in a compiled program cannot occupy the same CPU register. Radio transmitters within interference range cannot broadcast on the same frequency. Adjacent countries on a map should not share a color.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8a/Four_Colour_Map_Example.svg/250px-Four_Colour_Map_Example.svg.png', alt: 'Example map colored with four colors so adjacent regions differ', caption: 'Map coloring is the original conflict-to-adjacency picture: neighboring regions are constraints, colors are reusable labels. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Four_Colour_Map_Example.svg'},
        'Every one of these reduces to the same abstract problem. Build a graph where each node is a thing (exam, variable, transmitter, country) and each edge connects a pair that conflicts. Assign labels — called colors by convention — so that no edge has the same label on both endpoints. Then minimize the number of labels. That is graph coloring.',
        'The chromatic number, written chi(G), is the smallest k such that the graph G has a valid k-coloring. It captures the minimum number of distinct resources needed to satisfy every constraint simultaneously. Finding chi(G) exactly is NP-hard for general graphs, but fast heuristics get close enough for most practical instances.',
        'Francis Guthrie posed the earliest version of this question in 1852 while coloring a map of England: do four colors always suffice for any map? That deceptively simple question took 124 years to settle and launched an entire subfield of combinatorics.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'Try every possible assignment. With k colors and n vertices, there are k^n candidate colorings. For each candidate, walk every edge and verify the two endpoints carry different colors. If at least one candidate is valid, k colors suffice. Start with k=1, increment until a valid coloring is found, and that k is chi(G).',
        'For a 10-vertex graph and 3 colors, this means 3^10 = 59,049 candidate colorings, each requiring a pass over all edges. For 20 vertices and 4 colors, it is 4^20 — over one trillion candidates. The approach is correct — it exhaustively covers every possibility — but its exponential cost makes it useless beyond toy graphs.',
        'The deeper waste is structural. Brute force treats every candidate independently. It learns nothing from the partial assignment that already violated a constraint three vertices in. It re-examines colorings that differ only in vertices whose neighborhoods were already settled.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'Richard Karp proved in 1972 that graph coloring is NP-complete for k >= 3. This means no known algorithm can determine the chromatic number of an arbitrary graph in time polynomial in the number of vertices. If someone found one, it would imply P = NP and collapse the entire hierarchy of computational complexity classes.',
        'The hardness is subtle. Deciding whether a graph is 2-colorable is easy — it is equivalent to checking bipartiteness with a BFS, which runs in O(V + E). But 3-colorability jumps to NP-complete. Adding just one more color to the palette moves the problem from linear-time solvable to (as far as anyone knows) exponential.',
        'Approximation offers no escape. Zuckerman proved in 2007 that no polynomial-time algorithm can approximate chi(G) within a factor of V^(1 - epsilon) for any epsilon > 0, unless P = NP. In plain terms, even getting a rough estimate of the chromatic number is as hard as finding it exactly.',
        'This is the wall that motivates heuristics. We cannot solve the problem optimally in general, but we can solve it well enough for the structured graphs that arise in practice. The greedy approach is the starting point.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Instead of evaluating complete colorings, process vertices one at a time. When you reach a vertex, look only at its already-colored neighbors. Those neighbors define a set of forbidden colors. Pick the smallest color index not in that forbidden set. Because the algorithm never revisits a committed color, it never creates a conflict. The entire process runs in O(V + E) time.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/90/Petersen_graph_3-coloring.svg/250px-Petersen_graph_3-coloring.svg.png', alt: 'Three-coloring of the Petersen graph vertices', caption: 'The Petersen graph coloring makes the local rule concrete: every edge connects two different colors, even when the graph is highly constrained. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Petersen_graph_3-coloring.svg'},
        'The tradeoff is optimality for speed. Greedy always produces a valid coloring, but the number of colors it uses depends on the order in which vertices are processed. A bad ordering can force greedy to use many more colors than chi(G). A good ordering — such as sorting by vertex degree in descending order, known as the Welsh-Powell heuristic — tends to use fewer colors because high-degree vertices are colored first, when the fewest constraints have been committed.',
        'This shift — from global search over complete assignments to local decisions at each vertex — is the same pattern that makes Dijkstra fast for shortest paths and Kruskal fast for spanning trees. Commit locally, never revisit, and accept that the result may not be globally optimal.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Greedy coloring proceeds in three steps. First, fix a vertex ordering v1, v2, ..., vn. Second, for each vertex vi in that order, compute the set of colors already assigned to vi\'s neighbors. Third, assign vi the smallest non-negative integer not in that set. The output is a valid coloring using at most Delta + 1 colors, where Delta is the maximum vertex degree.',
        'Welsh-Powell (1967) improves the ordering step. Sort vertices by degree in descending order before the greedy pass. The rationale: high-degree vertices participate in the most constraints. Coloring them first, when very few other colors are committed, gives them the widest choice. Lower-degree vertices colored later are easier to accommodate because they have fewer neighbors to conflict with.',
        'DSatur, introduced by Brelaz in 1979, goes further with an adaptive ordering. Instead of fixing the order up front, it dynamically selects the uncolored vertex with the highest saturation — the number of distinct colors among its already-colored neighbors. Ties break by vertex degree. DSatur responds to the coloring as it develops, which often lets it match the chromatic number on graphs where static orderings overshoot.',
        'For exact solutions, backtracking builds partial colorings vertex by vertex, pruning branches as soon as a conflict is detected. Branch-and-bound adds a lower bound — typically the clique number omega(G), since any clique of size k requires k distinct colors — and abandons branches that cannot beat the best complete coloring found so far. This finds chi(G) exactly but takes exponential time in the worst case.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Greedy never assigns a conflicting color because it checks every colored neighbor before choosing. The remaining question is: how many colors does it need? The answer is at most Delta + 1. The proof is one sentence: when greedy reaches vertex v, at most Delta neighbors exist, so at most Delta colors are blocked, and color number Delta + 1 is always available.',
        'Brooks\' theorem (1941) sharpens the bound. For any connected graph that is neither a complete graph nor an odd cycle, chi(G) <= Delta. Complete graphs K_n need exactly n colors because every vertex is adjacent to every other. Odd cycles (triangles, pentagons, heptagons) need exactly 3 colors. Every other connected graph can be colored with at most Delta colors — one fewer than greedy\'s worst-case guarantee.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a4/Four_Colour_Planar_Graph.svg/250px-Four_Colour_Planar_Graph.svg.png', alt: 'Planar map and corresponding four-colored graph', caption: 'The Four Color Theorem converts a planar map into a planar graph, then colors vertices so adjacent regions differ. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Four_Colour_Planar_Graph.svg'},
        'For planar graphs — graphs that can be drawn on a flat surface without edge crossings — the Four Color Theorem (Appel and Haken, 1976) guarantees chi(G) <= 4. This was the first major theorem proved with essential computer assistance. The proof reduced the infinite class of planar graphs to 1,936 unavoidable configurations and checked each by machine. Robertson, Sanders, Seymour, and Thomas published a simpler proof in 1997 that reduced the configurations to 633, but still required a computer for the case analysis.',
        'The Five Color Theorem, by contrast, has a short human-readable proof using Euler\'s formula (V - E + F = 2 for planar graphs) and an inductive argument. It is the easy half: every planar graph has a vertex of degree at most 5, so removing it, coloring the rest by induction, and reinserting it always leaves at least one color free. The jump from five to four is what took a century.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Greedy coloring runs in O(V + E) time. Each vertex is visited once. For each vertex, the algorithm scans its adjacency list to collect forbidden colors — the scan over all vertices touches each edge exactly twice (once from each endpoint), giving a total of 2E neighbor lookups. Space is O(V) for the color assignment array plus O(V + E) for the adjacency list representation.',
        'Welsh-Powell adds an O(V log V) sort before the greedy pass. The sort is dominated by the greedy pass for any graph with at least as many edges as vertices (true for most graphs). DSatur uses a priority queue keyed by saturation degree, giving O((V + E) log V) total. Both remain practical for graphs with millions of vertices.',
        'Finding chi(G) exactly costs exponential time. Backtracking with pruning can handle graphs of up to roughly 60-80 vertices in reasonable time, depending on structure. Lawler\'s dynamic programming algorithm runs in O(2.4423^n) — faster than brute force but still exponential. For larger instances, practitioners rely on heuristics and accept a coloring that may use one or two more colors than necessary.',
        'Scaling behavior of greedy is predictable. Doubling V in a sparse graph (E proportional to V) roughly doubles runtime. Doubling V in a dense graph (E proportional to V^2) roughly quadruples runtime because the adjacency scans grow with degree. Memory scales with V + E regardless.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Compiler register allocation is graph coloring\'s most important industrial application. The compiler builds an interference graph where each node is a program variable and each edge connects two variables that are simultaneously live — meaning both hold values that will be used later. Colors are physical CPU registers. Greg Chaitin showed this reduction in 1981. His simplify-select heuristic, a variant of greedy coloring, runs in O(V + E) and produces near-optimal register assignments for the sparse, nearly chordal interference graphs that compilers encounter in practice.',
        'University exam scheduling is a direct application. Each exam is a vertex. Two exams share an edge if at least one student is enrolled in both. Colors are time slots. Minimizing colors minimizes the number of slots needed to schedule all exams without conflicts. The same structure applies to course timetabling, conference session planning, and hospital shift scheduling.',
        'Wireless frequency assignment uses graph coloring on networks of transmitters. Two transmitters within interference range share an edge. Colors are frequency channels. Fewer colors means less radio spectrum is consumed, which is valuable because spectrum is a finite and regulated resource. Cell tower planning uses coloring heuristics on graphs with thousands of nodes, and the resulting frequency plans are updated as towers are added or removed.',
        'Sudoku is graph coloring on a fixed 81-vertex graph. Each cell is a vertex. Edges connect cells that share a row, column, or 3x3 box — 20 neighbors per cell. A Sudoku puzzle is a partially colored graph, and solving it means extending to a valid 9-coloring. Every constraint-propagation technique in a Sudoku solver is implicitly a graph coloring technique.',
        'Map coloring is the historical origin. Francis Guthrie noticed in 1852 that four colors sufficed to color the counties of England so that neighboring counties differed. He conjectured this held for any map. The Four Color Theorem confirmed it in 1976, making map coloring the bridge between recreational mathematics and one of the deepest results in graph theory.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Greedy coloring is order-sensitive to the point of unreliability. The crown graph K_{n,n} (a complete bipartite graph minus a perfect matching) has chi = 2 but can be colored with n colors by greedy under a worst-case vertex ordering. The gap between greedy\'s output and the optimum can be arbitrarily large. No efficient algorithm is known for finding the ordering that minimizes greedy\'s color count.',
        'Exact computation is intractable for large graphs. Since no polynomial-time approximation within V^(1-epsilon) exists (assuming P != NP), the chromatic number is effectively unknowable for graphs beyond a few hundred vertices. Practitioners must accept heuristic solutions without performance guarantees.',
        'Planar graphs are always 4-colorable in theory, but computing an explicit 4-coloring in linear time requires the Robertson-Sanders-Seymour-Thomas algorithm, which is notoriously complex to implement correctly. Most practical systems settle for a 5- or 6-coloring via greedy, trading one or two extra colors for implementation simplicity.',
        'Dense graphs with high chromatic numbers leave little room for any algorithm to improve. When chi(G) is close to V, greedy performs near-optimally because almost every color is forced. The difficult regime is sparse graphs with low chromatic numbers: the coloring exists but finding it is computationally expensive, and greedy\'s performance depends heavily on ordering luck.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Consider the 7-vertex graph used in the animation: vertices A through G, with edges A-B, A-C, B-D, B-E, C-D, C-E, D-E, D-F, E-G, F-G. The degrees are D:4, E:4, B:3, C:3, A:2, F:2, G:2. Welsh-Powell ordering (sorted by degree descending) processes them as D, E, B, C, A, F, G.',
        'Step 1 — D: no neighbors are colored yet. The forbidden set is empty. Assign the smallest color: red (index 0). One color in use.',
        'Step 2 — E: neighbors are B, C, D, G. Only D is colored (red). Forbidden set: {red}. Smallest available color: blue (index 1). Two colors in use.',
        'Step 3 — B: neighbors are A, D, E. D is red, E is blue. Forbidden set: {red, blue}. Smallest available color: green (index 2). Three colors in use.',
        'Step 4 — C: neighbors are A, D, E. D is red, E is blue. Forbidden set: {red, blue}. Smallest available color: green (index 2). C and B are not adjacent, so sharing green creates no conflict.',
        'Step 5 — A: neighbors are B and C, both green. Forbidden set: {green}. Smallest available color: red (index 0). Reuses an existing color.',
        'Step 6 — F: neighbors are D (red) and G (uncolored). Forbidden set: {red}. Smallest available color: blue (index 1). Reuses an existing color.',
        'Step 7 — G: neighbors are E (blue) and F (blue). Forbidden set: {blue}. Smallest available color: red (index 0). Reuses an existing color.',
        'Final assignment: D=red, E=blue, B=green, C=green, A=red, F=blue, G=red. Three colors total. Verify correctness: check every edge — A-B (red-green), A-C (red-green), B-D (green-red), B-E (green-blue), C-D (green-red), C-E (green-blue), D-E (red-blue), D-F (red-blue), E-G (blue-red), F-G (blue-red). All endpoints differ. The graph contains the triangle B-D-E (three mutually adjacent vertices), which forces at least 3 colors. So 3 is optimal — greedy with Welsh-Powell found the chromatic number.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Appel and Haken, "Every Planar Map is Four Colorable," Illinois Journal of Mathematics (1977) — the original computer-assisted proof of the Four Color Theorem. Robertson, Sanders, Seymour, and Thomas, "The Four-Colour Theorem," Journal of Combinatorial Theory Series B (1997) — a simplified but still computer-dependent proof. Brooks, "On Colouring the Nodes of a Network," Proceedings of the Cambridge Philosophical Society (1941) — the chi(G) <= Delta bound for non-complete, non-odd-cycle graphs.',
        'Karp, "Reducibility Among Combinatorial Problems" (1972) — graph k-coloring appears among the original 21 NP-complete problems. Welsh and Powell, "An Upper Bound for the Chromatic Number of a Graph and Its Application to Timetabling Problems," The Computer Journal (1967) — the degree-sorted greedy heuristic. Brelaz, "New Methods to Color the Vertices of a Graph," Communications of the ACM (1979) — the DSatur adaptive-ordering algorithm.',
        'Chaitin, "Register Allocation and Spilling via Graph Coloring," SIGPLAN Notices (1982) — the reduction that made graph coloring a workhorse of compiler backends. Zuckerman, "Linear Degree Extractors and the Inapproximability of Max Clique and Chromatic Number," Theory of Computing (2007) — the V^(1-epsilon) inapproximability result.',
        'Prerequisites: graph representation (adjacency lists) and graph traversal (BFS, DFS). Study next: register allocation for the compiler application, backtracking for exact coloring via search, and maximum clique as the dual problem. Related topics: bipartite checking (the easy case of 2-coloring), topological sort (another algorithm driven by vertex ordering), and constraint satisfaction problems (the general framework that graph coloring instantiates).',
      ],
    },
  ],
};
