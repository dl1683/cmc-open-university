// Euler path & circuit via Hierholzer's algorithm: traverse every edge exactly
// once by following edges until stuck, then splicing sub-tours — the first
// problem in graph theory (Königsberg, 1736).

import { graphState, InputError } from '../core/state.js';

export const topic = {
  id: 'euler-path-circuit',
  title: 'Euler Path & Circuit — Hierholzer\'s Algorithm',
  category: 'Algorithms',
  summary: 'Traverse every edge exactly once. Hierholzer\'s algorithm finds an Euler circuit in O(V+E) by splicing sub-tours — the first problem in graph theory (Königsberg, 1736).',
  controls: [{ type: 'select', id: 'view', label: 'View', options: ['circuit', 'path'] }],
  run,
};

// ---------- Circuit graph: all vertices have even degree ----------
// "Bowtie" — two triangles sharing vertex C.
// Degrees: A(2), B(2), C(4), D(2), E(2). All even. 6 edges.
//
//     A           D
//    / \         / \
//   B---C-------E---'
//       (shared vertex C)
//
const CIRCUIT_NODES = [
  { id: 'A', label: 'A', x: 1, y: 1 },
  { id: 'B', label: 'B', x: 1, y: 7 },
  { id: 'C', label: 'C', x: 4.5, y: 4 },
  { id: 'D', label: 'D', x: 8, y: 1 },
  { id: 'E', label: 'E', x: 8, y: 7 },
];

const CIRCUIT_EDGES = [
  { id: 'AB', from: 'A', to: 'B' },
  { id: 'BC', from: 'B', to: 'C' },
  { id: 'CA', from: 'C', to: 'A' },
  { id: 'CD', from: 'C', to: 'D' },
  { id: 'DE', from: 'D', to: 'E' },
  { id: 'EC', from: 'E', to: 'C' },
];

// ---------- Path graph: exactly 2 odd-degree vertices (S and T) ----------
// 6 vertices: S(deg 3), A(deg 2), B(deg 2), C(deg 2), D(deg 2), T(deg 3).
// 7 edges total. Euler path runs from S to T (or T to S).
//
//       A ------- T
//      / \       /|
//     S   -----B  |
//      \         |
//       C -- D --'
//
const PATH_NODES = [
  { id: 'S', label: 'S', x: 0, y: 4 },
  { id: 'A', label: 'A', x: 3, y: 1.5 },
  { id: 'B', label: 'B', x: 3, y: 4 },
  { id: 'C', label: 'C', x: 3, y: 6.5 },
  { id: 'D', label: 'D', x: 6, y: 6.5 },
  { id: 'T', label: 'T', x: 8, y: 4 },
];

const PATH_EDGES = [
  { id: 'SA', from: 'S', to: 'A' },
  { id: 'SB', from: 'S', to: 'B' },
  { id: 'SC', from: 'S', to: 'C' },
  { id: 'AT', from: 'A', to: 'T' },
  { id: 'BT', from: 'B', to: 'T' },
  { id: 'CD', from: 'C', to: 'D' },
  { id: 'DT', from: 'D', to: 'T' },
];

// Build adjacency list for an undirected graph. Each entry stores the neighbor
// id and the edge id, so we can mark edges as used.
function buildAdj(nodes, edges) {
  const adj = new Map(nodes.map((n) => [n.id, []]));
  for (const e of edges) {
    adj.get(e.from).push({ neighbor: e.to, edgeId: e.id });
    adj.get(e.to).push({ neighbor: e.from, edgeId: e.id });
  }
  return adj;
}

// ---------- Hierholzer's algorithm (generator) ----------
function* hierholzer(nodes, edges, startId) {
  const adj = buildAdj(nodes, edges);
  const usedEdge = new Set();      // edge ids already traversed
  const traversed = [];             // edge ids in traversal order
  const circuit = [];               // final vertex sequence

  // Current pointer indexes into each adjacency list so we skip consumed entries
  const ptr = new Map(nodes.map((n) => [n.id, 0]));

  const snapshot = () => graphState({
    nodes: nodes.map((n) => {
      const deg = adj.get(n.id).filter((e) => !usedEdge.has(e.edgeId)).length;
      return { ...n, note: `deg ${deg}` };
    }),
    edges,
  });

  // Compute degrees for intro
  const degrees = new Map(nodes.map((n) => [n.id, adj.get(n.id).length]));
  const oddNodes = nodes.filter((n) => degrees.get(n.id) % 2 !== 0);

  const isCircuit = oddNodes.length === 0;
  const introKind = isCircuit ? 'circuit' : 'path';
  const degreeList = nodes.map((n) => `${n.id}(${degrees.get(n.id)})`).join(', ');

  yield {
    state: snapshot(),
    highlight: {},
    explanation: `${nodes.length} vertices, ${edges.length} edges. Vertex degrees: ${degreeList}. ${oddNodes.length === 0 ? 'All degrees are even — an Euler circuit exists. Hierholzer\'s algorithm will find a closed walk that uses every edge exactly once.' : `Exactly 2 odd-degree vertices (${oddNodes.map((n) => n.id).join(', ')}) — an Euler path exists from one to the other. Hierholzer\'s algorithm starts at an odd vertex and builds the path by splicing sub-tours.`}`,
  };

  // The stack-based iterative version of Hierholzer's.
  // Push start vertex. While stack is non-empty: if the top vertex still has
  // unused edges, follow one and push the neighbor. Otherwise pop and add to
  // the circuit (in reverse).
  const stack = [startId];

  yield {
    state: snapshot(),
    highlight: { active: [startId] },
    explanation: `Start at vertex ${startId}. Push it onto the traversal stack. The algorithm will follow unused edges greedily until it gets stuck, then backtrack to splice in sub-tours from vertices that still have unused edges.`,
  };

  while (stack.length > 0) {
    const v = stack[stack.length - 1];

    // Find an unused edge from v
    let found = false;
    while (ptr.get(v) < adj.get(v).length) {
      const entry = adj.get(v)[ptr.get(v)];
      if (usedEdge.has(entry.edgeId)) {
        ptr.set(v, ptr.get(v) + 1);
        continue;
      }
      // Use this edge
      usedEdge.add(entry.edgeId);
      traversed.push(entry.edgeId);
      stack.push(entry.neighbor);
      ptr.set(v, ptr.get(v) + 1);
      found = true;

      yield {
        state: snapshot(),
        highlight: {
          active: [entry.neighbor],
          compare: [entry.edgeId],
          visited: traversed.filter((eid) => eid !== entry.edgeId),
          found: [...new Set(circuit)],
        },
        explanation: `From ${v}, follow edge ${entry.edgeId} to ${entry.neighbor}. Mark edge ${entry.edgeId} as used (${usedEdge.size}/${edges.length} edges used). Stack: [${stack.join(', ')}].`,
      };
      break;
    }

    if (!found) {
      // No unused edges from v — backtrack and add v to the circuit
      stack.pop();
      circuit.push(v);

      const remaining = edges.length - usedEdge.size;

      yield {
        state: snapshot(),
        highlight: {
          active: [v],
          found: [...new Set(circuit)],
          visited: traversed,
          compare: stack.length > 0 ? [stack[stack.length - 1]] : [],
        },
        explanation: `Vertex ${v} has no unused edges — stuck. Pop ${v} from the stack and append it to the ${introKind}. ${introKind[0].toUpperCase() + introKind.slice(1)} so far: [${circuit.join(' -> ')}]. ${remaining > 0 ? `${remaining} edges remain; the algorithm backtracks to find a vertex with unused edges and will splice a sub-tour there.` : 'All edges accounted for.'}`,
      };
    }
  }

  // Final result
  const pathStr = circuit.join(' -> ');
  yield {
    state: snapshot(),
    highlight: {
      found: [...new Set(circuit)],
      visited: traversed,
    },
    explanation: `Hierholzer\'s algorithm complete. Euler ${introKind}: ${pathStr}. Every edge was traversed exactly once. Total: ${edges.length} edges, ${circuit.length} vertices in the walk. Time complexity: O(V + E) — each edge is followed once and each vertex is pushed/popped a bounded number of times. Space: O(E) for the used-edge set and the stack.`,
  };
}

// ---------- Circuit view ----------
function* circuitView() {
  yield* hierholzer(CIRCUIT_NODES, CIRCUIT_EDGES, 'C');
}

// ---------- Path view ----------
function* pathView() {
  // Start at an odd-degree vertex (S has degree 3)
  yield* hierholzer(PATH_NODES, PATH_EDGES, 'S');
}

// ---------- Main run ----------
export function* run(input) {
  const view = String(input.view);
  if (view === 'circuit') yield* circuitView();
  else if (view === 'path') yield* pathView();
  else throw new InputError('Pick a view: circuit or path.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'Each vertex displays its remaining unused degree — the number of edges still available to traverse. The highlighted vertex is where the algorithm currently stands. When it follows an edge, that edge joins the visited set and cannot be reused.',
        {
          type: 'callout',
          text: 'Euler traversal is a degree-parity problem before it is a path-construction problem.',
        },
        'Watch for the moment the algorithm gets stuck: no unused edges leave the current vertex. It pops that vertex onto the final path and backtracks up the stack. This backtracking is where sub-tour splicing happens — the algorithm revisits a vertex that still has unused edges, extends from there, and weaves the new sub-tour into the result.',
        'In circuit mode every vertex has even degree, so the walk ends where it started. In path mode exactly two vertices have odd degree; the walk starts at one and finishes at the other. The final step shows the complete edge sequence.',
        {type: 'image', src: './assets/gifs/euler-path-circuit.gif', alt: 'Animated walkthrough of the euler path circuit visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'In 1736, Leonhard Euler asked whether a walk through the city of Königsberg could cross each of its seven bridges exactly once. He proved it could not — because more than two landmasses had an odd number of bridges. This was the first theorem in graph theory: Euler showed that the question depends entirely on vertex degrees, not on the particular layout of the graph.',
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/5/5d/Konigsberg_bridges.png',
          alt: 'Historical diagram of the Konigsberg bridges problem',
          caption: 'The Konigsberg bridge puzzle became graph theory once landmasses were vertices and bridges were edges. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Konigsberg_bridges.png',
        },
        'Carl Hierholzer published an efficient construction in 1873 (posthumously). Rather than checking permutations, his method builds the walk greedily and splices sub-tours, finishing in linear time. The algorithm matters today in DNA sequence assembly, circuit board testing, network routing, and combinatorial sequence generation.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'Try all possible orderings of the edges. Start anywhere, pick an unused edge, follow it, repeat. If you get stuck before using every edge, backtrack and try a different choice.',
        'This is a brute-force search over all E! permutations of the edges. For a tiny graph with 7 edges that is 5,040 orderings — manageable. For 20 edges it is 2.4 * 10^18. The search space is factorial, and most orderings fail early because arbitrary choices create dead ends long before every edge is consumed.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'Factorial growth makes brute force useless beyond toy graphs. But the deeper problem is that without understanding the structural conditions, you cannot even know whether a valid walk exists before you start searching. You could exhaust every permutation only to discover that some vertex has an odd degree that makes completion impossible.',
        'What is needed: first a quick test for existence, then an efficient construction that builds the walk directly when one exists.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'The existence of an Euler traversal is entirely determined by vertex degrees. A connected graph has an Euler circuit if and only if every vertex has even degree. It has an Euler path (but not a circuit) if and only if exactly two vertices have odd degree — and the path must run between those two vertices. If more than two vertices have odd degree, no Euler path or circuit exists at all.',
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/5/55/Seven_bridges.svg',
          alt: 'Graph abstraction of the seven bridges of Konigsberg',
          caption: 'The graph abstraction exposes the odd-degree vertices that make the original bridge walk impossible. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Seven_bridges.svg',
        },
        'Why does even degree matter? When you arrive at a vertex through one edge, you need a different unused edge to leave on. Even degree guarantees that edges pair off — every arrival has a matching departure. Odd-degree vertices break this pairing: one arrival is left without an exit. Two such vertices are tolerable (they become the start and end of a path), but three or more make the walk impossible.',
        'This transforms the problem from "search all orderings" to "count odd-degree vertices" — an O(V + E) check instead of an O(E!) search. Once existence is confirmed, the remaining task is pure construction.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Hierholzer\'s algorithm constructs the walk after the degree check confirms one exists. Start at any vertex for a circuit, or at an odd-degree vertex for a path. Follow unused edges greedily, marking each as used. When you reach a vertex with no unused edges, you are stuck — pop this vertex onto the output and backtrack along the stack.',
        'Eventually you reach a vertex that still has unused edges. Continue from there, building a sub-tour that gets spliced into the result during backtracking. The splicing is implicit: because you are using a stack, the sub-tour\'s vertices interleave naturally with the main tour\'s vertices in the output.',
        'Implementation detail: maintain a stack of vertices (the current trail) and a pointer into each vertex\'s adjacency list so you skip already-used edges in O(1). When you get stuck, pop to the output. When the stack empties, the output (read in order) is the Euler circuit or path.',
        'This iterative stack-based version avoids deep recursion on large graphs. The classic recursive formulation does the same work but risks stack overflow when E is large.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Even degree guarantees that a greedy walk from any starting vertex will always return to its start, forming a closed sub-tour. You cannot get stuck at a non-starting vertex because every arrival consumed one edge, and even degree ensures another unused edge remains for departure.',
        'The sub-tour might not use all edges. But every vertex on the sub-tour that still has unused edges has an even number of them — the sub-tour consumed one arrival and one departure, preserving parity. So starting a new greedy walk from that vertex produces another closed sub-tour. Splicing it into the main tour at the shared vertex preserves the "every edge exactly once" property.',
        'For an Euler path with two odd-degree vertices s and t: imagine adding a virtual edge between s and t. Now all degrees are even, and an Euler circuit exists through that virtual edge. Remove the virtual edge and the remaining walk is an Euler path from s to t. Hierholzer\'s handles this by simply starting at s — the odd degree at s means the greedy walk terminates at t rather than looping back.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Time: O(V + E). Every edge is followed exactly once (each adjacency-list entry is consumed once via the pointer). Every vertex is pushed and popped from the stack at most degree(v)/2 + 1 times, and the sum of degrees is 2E, so total stack operations are O(E). The degree-parity existence check is itself O(V + E).',
        'Space: O(E) for the used-edge set and the traversal stack. The adjacency list and edge pointers take O(V + E). The output circuit stores E + 1 vertices; a path stores E vertices.',
        'Compare with brute force: on a 20-edge graph, Hierholzer\'s does roughly 40 operations versus 2.4 * 10^18 for exhaustive search. On a million-edge graph, Hierholzer\'s finishes in milliseconds.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'De Bruijn sequences: a de Bruijn sequence of order n over alphabet {0,1} is a cyclic string where every n-bit binary pattern appears exactly once as a substring. Build a de Bruijn graph where nodes are (n-1)-bit strings and edges are n-bit strings connecting prefix to suffix. Every node has in-degree 2 and out-degree 2 — an Euler circuit on this directed graph reads off the de Bruijn sequence. This is how shift-register sequences are generated for testing, hashing, and combinatorics.',
        'DNA sequence assembly: short sequencing reads are decomposed into k-mers. A de Bruijn graph on these k-mers represents the genome, and finding an Euler path through it reconstructs the original sequence. Modern assemblers (Velvet, SPAdes) are built on this principle.',
        'Chinese postman problem: a mail carrier must traverse every street. If the graph is Eulerian, the optimal route is the Euler circuit itself. If not, the Chinese postman algorithm duplicates the minimum-weight set of edges to make all degrees even, then finds the Euler circuit on the augmented graph.',
        'Circuit board testing: test probes must touch every trace on a PCB. An Euler path through the connectivity graph visits every trace exactly once with minimum probe movement.',
        'Snowplow and street-sweeper routing: municipal vehicles must drive every road segment at least once. Euler circuits provide the theoretical lower bound; the Chinese postman extension handles non-Eulerian street networks.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Hamiltonian path (visiting every vertex exactly once) looks similar but is NP-complete. Do not confuse the two: Euler visits every edge; Hamilton visits every vertex. The degree-parity conditions that make Euler paths tractable have no counterpart for Hamiltonian paths.',
        'Real-world route networks are rarely Eulerian. Streets have odd-degree intersections, dead ends, and one-way segments. The Chinese postman problem (duplicating edges to make degrees even) is the practical extension, requiring minimum-weight matching on odd-degree vertices — no longer just Hierholzer\'s.',
        'Directed Euler circuits require a different condition: every vertex must have equal in-degree and out-degree. Hierholzer\'s algorithm adapts straightforwardly, but the existence check changes. Mixed graphs (some directed, some undirected edges) make the problem NP-complete.',
        'Disconnected graphs: an Euler circuit requires the graph to be connected (all edges in one component). If the graph has multiple edge-bearing components, no single Euler walk can cover all edges. Checking connectivity is a prerequisite.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Circuit graph: 5 vertices (A, B, C, D, E), 6 edges. Two triangles sharing vertex C. Degrees: A(2), B(2), C(4), D(2), E(2) — all even, so an Euler circuit exists. Start at C.',
        'Stack-based trace. Push C. From C, adjacency list is [A, B, D, E]. Follow C-A (edge CA), push A. Stack: [C, A]. From A, list is [B, C]. Follow A-B (edge AB), push B. Stack: [C, A, B]. From B, list is [A, C]. Edge BA = AB already used. Follow B-C (edge BC), push C. Stack: [C, A, B, C].',
        'From C (top of stack), edges CA and BC are used. Follow C-D (edge CD), push D. Stack: [C, A, B, C, D]. From D, follow D-E (edge DE), push E. Stack: [C, A, B, C, D, E]. From E, follow E-C (edge EC), push C. Stack: [C, A, B, C, D, E, C].',
        'From C (top of stack) — all 4 edges used (CA, BC, CD, EC). Stuck. Pop C to output: [C]. E has no unused edges, pop E: [C, E]. Pop D: [C, E, D]. C again fully consumed, pop: [C, E, D, C]. Pop B: [C, E, D, C, B]. Pop A: [C, E, D, C, B, A]. Pop C (bottom): [C, E, D, C, B, A, C]. Stack empty.',
        'Read the output in order: C -> E -> D -> C -> B -> A -> C. All 6 edges used exactly once. The second triangle\'s walk (C-D-E-C) was spliced into the middle of the first triangle\'s walk (C-A-B-C). This is Hierholzer\'s sub-tour splicing: the backtracking phase interleaves the two sub-tours at their shared vertex C.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Euler, L. (1736), "Solutio problematis ad geometriam situs pertinentis" — the Königsberg bridges paper that founded graph theory. Hierholzer, C. (1873), "Ueber die Möglichkeit, einen Linienzug ohne Wiederholung und ohne Unterbrechung zu umfahren" — the constructive algorithm. Cormen, Leiserson, Rivest, and Stein (CLRS), Problem 22-3 covers the Euler tour as a graph algorithm exercise.',
        'Prerequisites: graph representation (adjacency lists are the natural storage for Hierholzer\'s pointer-advancing trick) and graph DFS (the sub-tour splicing is a form of DFS backtracking).',
        'Natural extensions: Chinese postman problem (minimum-weight edge duplication to make a non-Eulerian graph Eulerian), de Bruijn sequences (Euler circuits on de Bruijn graphs), and the Euler tour technique for trees (a DFS-based linearization used in lowest common ancestor queries and subtree aggregation).',
        'Contrast with Hamiltonian path (visit every vertex once) — superficially similar but NP-complete, with no degree-based existence condition and no known polynomial algorithm.',
      ],
    },
  ],
};
