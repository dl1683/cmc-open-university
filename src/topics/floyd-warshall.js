// Floyd-Warshall: all-pairs shortest paths via a 2D distance matrix updated
// through V rounds. In round k, every pair (i,j) asks: is it cheaper to go
// through vertex k? Three nested loops, no priority queue, handles negative
// weights, detects negative cycles.

import { matrixState } from '../core/state.js';

export const topic = {
  id: 'floyd-warshall',
  title: 'Floyd-Warshall',
  category: 'Algorithms',
  summary: 'All-pairs shortest paths in O(V³): three nested loops update a distance matrix by testing every intermediate vertex.',
  controls: [],
  run,
};

// 4-node directed graph.
// Edges: 1->2(3), 1->3(8), 2->3(2), 3->4(1), 4->1(5).
const V = 4;
const LABELS = ['1', '2', '3', '4'];
const INF = Infinity;

// Adjacency: direct edge weights. INF means no direct edge.
function initialDist() {
  // dist[i][j] = weight of direct edge i->j, 0 on diagonal, INF otherwise.
  const d = [
    [0,   3,   8,   INF],
    [INF, 0,   2,   INF],
    [INF, INF, 0,   1  ],
    [5,   INF, INF, 0  ],
  ];
  return d;
}

const headers = LABELS.map((l) => ({ id: l, label: l }));

function fmt(v) {
  if (v === INF) return '∞';
  if (v === -INF) return '-∞';
  return String(v);
}

function snapshot(dist, title) {
  return matrixState({
    title,
    rows: headers,
    columns: headers,
    values: dist.map((row) => row.map((v) => (v === INF ? 9999 : v === -INF ? -9999 : v))),
    format: (v) => (v >= 9999 ? '∞' : v <= -9999 ? '-∞' : String(v)),
  });
}

export function* run() {
  const dist = initialDist();

  // Show initial matrix.
  yield {
    state: snapshot(dist, 'Initial distance matrix'),
    highlight: {},
    explanation: `Start with the direct edge weights. dist[i][j] = weight of the edge from i to j, 0 on the diagonal, ∞ where no direct edge exists. Edges: 1→2(3), 1→3(8), 2→3(2), 3→4(1), 4→1(5). This matrix is the answer to "what is the cheapest path using zero intermediate vertices?" Floyd-Warshall will now try every vertex as a potential intermediate stop.`,
  };

  // Main algorithm: for each intermediate vertex k.
  for (let k = 0; k < V; k++) {
    const kLabel = LABELS[k];
    const updates = [];

    yield {
      state: snapshot(dist, `Round k=${kLabel}: try vertex ${kLabel} as intermediate`),
      highlight: { active: headers.map((h) => `${h.id}:${kLabel}`).concat(headers.map((h) => `${kLabel}:${h.id}`)) },
      explanation: `Round k=${kLabel}: for every pair (i,j), ask "is it cheaper to route through vertex ${kLabel}?" That means checking dist[i][${kLabel}] + dist[${kLabel}][j] < dist[i][j]. The highlighted row and column show the costs through vertex ${kLabel}.`,
    };

    for (let i = 0; i < V; i++) {
      for (let j = 0; j < V; j++) {
        if (i === k || j === k || i === j) continue;
        const through = dist[i][k] + dist[k][j];
        if (through < dist[i][j]) {
          const iLabel = LABELS[i];
          const jLabel = LABELS[j];
          const oldVal = dist[i][j];
          dist[i][j] = through;
          updates.push({ i: iLabel, j: jLabel, old: oldVal, via: through });
        }
      }
    }

    if (updates.length > 0) {
      const desc = updates.map((u) =>
        `dist[${u.i}][${u.j}]: ${fmt(u.old)} → ${u.via}`
      ).join('. ');
      const changedCells = updates.map((u) => `${u.i}:${u.j}`);
      yield {
        state: snapshot(dist, `After k=${kLabel}`),
        highlight: { found: changedCells },
        explanation: `After routing through vertex ${kLabel}: ${desc}. Each update means a cheaper path was found by detouring through ${kLabel}. The DP recurrence: dist[i][j] = min(dist[i][j], dist[i][${kLabel}] + dist[${kLabel}][j]).`,
      };
    } else {
      yield {
        state: snapshot(dist, `After k=${kLabel} (no changes)`),
        highlight: {},
        explanation: `No pair improved by routing through vertex ${kLabel}. Every existing path was already as cheap or cheaper than any detour through ${kLabel}.`,
      };
    }
  }

  // Check for negative cycles: diagonal entries < 0.
  const negCycle = [];
  for (let i = 0; i < V; i++) {
    if (dist[i][i] < 0) negCycle.push(LABELS[i]);
  }

  const diagCells = LABELS.map((l) => `${l}:${l}`);
  if (negCycle.length > 0) {
    yield {
      state: snapshot(dist, 'Negative cycle detected!'),
      highlight: { active: diagCells },
      explanation: `Negative cycle detected at node(s) ${negCycle.join(', ')}: a diagonal entry went below zero, meaning a round-trip through that vertex gets cheaper every lap. Shortest paths are undefined for affected pairs.`,
    };
  } else {
    yield {
      state: snapshot(dist, 'Final all-pairs shortest paths'),
      highlight: { found: diagCells },
      explanation: `All diagonal entries are zero — no negative cycles. The matrix now holds the shortest path between every pair of vertices. Read it: dist[1][4]=6 means the cheapest route from 1 to 4 costs 6 (path: 1→2→3→4, costing 3+2+1). dist[4][2]=8 means 4→1→2 costs 5+3. Three nested loops, O(V³), no priority queue needed.`,
      invariant: 'After round k, dist[i][j] holds the shortest path from i to j using only vertices {1,...,k} as intermediates.',
    };
  }
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'The grid is a V-by-V distance matrix. Row i, column j holds the shortest known cost from vertex i to vertex j. Cells showing ∞ mean no path has been discovered yet. Cells showing 0 on the diagonal mean "the cost from a vertex to itself is zero."',
        'Each round introduces one intermediate vertex k. The algorithm highlights row k and column k because those are the two legs of any detour through k: the cost to reach k (column k) and the cost to leave k (row k). For every other cell (i,j), the algorithm checks whether dist[i][k] + dist[k][j] is cheaper than the current dist[i][j].',
        {type: 'callout', text: 'Floyd-Warshall turns one allowed intermediate vertex into a global matrix update: every cell asks whether routing through k makes its current path cheaper.'},
        'Green cells are improvements: a cheaper path was found by routing through k. After all V rounds, every vertex has been tried as an intermediate, and no cell can improve further. The diagonal stays zero unless the graph contains a negative-weight cycle, in which case the affected diagonal entry drops below zero.',
      
        {type: 'image', src: './assets/gifs/floyd-warshall.gif', alt: 'Animated walkthrough of the floyd warshall visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Some problems need the shortest path between every pair of vertices, not just from a single source. Routing tables in small networks need to answer any source-destination query instantly. Transitive closure asks whether vertex i can reach vertex j, for all i and j. Graph diameter is the largest finite entry in the all-pairs distance matrix. Each of these requires computing V² distances.',
        'Robert Floyd published "Algorithm 97: Shortest Path" in Communications of the ACM in 1962. Stephen Warshall published "A Theorem on Boolean Matrices" in JACM the same year, solving transitive closure with the identical three-loop structure but using OR/AND instead of min/add. Bernard Roy discovered the same recurrence independently in 1959. The result is a single algorithm that solves all-pairs shortest paths, transitive closure, and negative-cycle detection with three nested loops over a distance matrix.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'You already know single-source shortest paths. The natural way to get all-pairs distances is to run Dijkstra from every vertex and collect the V result vectors into a V-by-V table.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/2/23/Directed_graph_no_background.svg', alt: 'Directed graph with nodes connected by arrows', caption: 'All-pairs shortest paths begin with a directed graph, but Floyd-Warshall moves the work into a matrix of every source-target pair. Source: Wikimedia Commons, David W., public domain.'},
        'Cost: O(V(V + E) log V) with a binary heap. For sparse graphs this is reasonable. For dense graphs where E approaches V², the total becomes O(V³ log V), and the log V factor starts to matter. The approach also requires building and maintaining a priority queue V separate times, which adds implementation weight.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'Dijkstra cannot handle negative edge weights. Its greedy invariant -- "the smallest tentative distance is safe to finalize" -- breaks when a negative edge could retroactively reduce a settled distance. So the repeated-Dijkstra plan fails on any graph with negative edges.',
        'Bellman-Ford handles negative weights from a single source in O(VE), but running it from every vertex costs O(V²E), which is O(V⁴) on dense graphs.',
        'Repeated single-source algorithms also waste structural opportunity. The intermediate vertex k is useful for every pair (i,j) simultaneously, but single-source algorithms process one source at a time and cannot share that work. A different formulation is needed -- one that operates on the entire matrix at once.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Floyd-Warshall is dynamic programming over the set of allowed intermediate vertices. Define dp[i][j][k] as the shortest path from i to j using only vertices 0 through k as intermediates. The recurrence is:',
        'dp[i][j][k] = min(dp[i][j][k-1], dp[i][k][k-1] + dp[k][j][k-1]).',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/2e/Floyd-Warshall_example.svg/960px-Floyd-Warshall_example.svg.png', alt: 'Floyd-Warshall example showing path composition through intermediate vertices', caption: 'The red and blue boxes show how a shortest path is assembled from subpaths through an intermediate vertex. Source: Wikimedia Commons, Floyd-Warshall example.'},
        'The first term: the shortest path that avoids vertex k. The second term: a path that goes from i to k, then from k to j, with both legs restricted to intermediates 0 through k-1. The better of the two wins.',
        'Base case: dp[i][j][-1] is the direct edge weight from i to j (or ∞ if no edge exists, 0 on the diagonal). After V rounds, dp[i][j][V-1] is the true shortest path with all vertices available as intermediates.',
        'The three-dimensional table collapses to a two-dimensional matrix updated in place. During round k, the values dist[i][k] and dist[k][j] do not change -- any path from i to k that re-uses k as an intermediate would contain a cycle through k, which cannot help in a graph without negative cycles. So reading the "old" row-k and column-k values from the current matrix is safe.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Initialize: set dist[i][j] to the direct edge weight from i to j, 0 on the diagonal, ∞ where no edge exists. Optionally maintain a predecessor matrix next[i][j] = j for each existing edge, to reconstruct actual paths later.',
        'Main loop: for k = 0 to V-1, for each pair (i,j), check whether dist[i][k] + dist[k][j] < dist[i][j]. If so, update dist[i][j] and set next[i][j] = next[i][k]. The k loop must be outermost because k is the DP dimension -- each round extends the set of allowed intermediates by one vertex.',
        'After the main loop, check the diagonal. If dist[i][i] < 0 for any i, vertex i sits on a negative-weight cycle. Shortest paths through that cycle are undefined because you can keep looping to reduce the cost without bound.',
        'To reconstruct the actual shortest path from i to j, follow the chain: i, next[i][j], next[next[i][j]][j], and so on until you reach j.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Correctness follows by induction on k. Base case: with no intermediates allowed, the shortest path from i to j is the direct edge weight -- which is exactly what the initial matrix stores.',
        'Inductive step: assume the matrix is correct for intermediates {0, ..., k-1}. The shortest path from i to j through {0, ..., k} either skips vertex k (so it equals dp[i][j][k-1], already correct) or passes through k, splitting into i-to-k and k-to-j, each using only {0, ..., k-1} as intermediates. Both subpath costs are correct by hypothesis, so the min of the two terms gives the correct answer for dp[i][j][k].',
        'The in-place update is safe because dist[i][k] and dist[k][j] are never modified during round k. A path from i to k cannot benefit from using k as an intermediate (that would create a cycle through k), so dist[i][k] after round k equals dist[i][k] before round k.',
        'Negative-cycle detection works because dist[i][i] starts at 0. If routing through intermediates produces dist[i][i] < 0, a round-trip from i back to i with negative total weight exists.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Time: O(V³). Three nested loops, each running V iterations, with O(1) work in the innermost body (one addition, one comparison, one possible assignment). The cost depends only on V, not on E. When V doubles, the runtime grows by a factor of 8.',
        'Space: O(V²) for the distance matrix, updated in place. Add a second V² matrix if you need path reconstruction.',
        'The constant factor is small: the inner loop is one addition and one branch. No priority queue, no adjacency-list pointer chasing, no heap operations. On dense graphs (E near V²), Floyd-Warshall matches or beats V runs of Dijkstra because V³ has a smaller constant than V × (V + E) log V. On sparse graphs with non-negative weights, Johnson\'s algorithm achieves O(V² log V + VE), which can be much less than V³.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'Small dense graphs where you need all-pairs distances. The implementation is five lines of pseudocode and the constant is tiny. Routing tables in networks with a few hundred nodes compute all-pairs distances once and answer queries by table lookup.',
        'Transitive closure: swap min with OR and addition with AND. The same three-loop structure answers "can i reach j?" for every pair. This is Warshall\'s 1962 formulation -- same algorithm, different semiring.',
        'Graph diameter and closeness centrality both read directly from the final matrix. Diameter is the largest finite entry. Closeness centrality for vertex i is the inverse of the sum of row i.',
        'Negative-cycle detection in financial models: represent currency exchange rates as log-weights on edges. A negative cycle means a profitable round-trip arbitrage. Floyd-Warshall flags it via negative diagonal entries without needing a separate detection pass.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'V³ is impractical for large graphs. A 10,000-vertex graph requires 10¹² operations. Road networks, social graphs, and the web have millions of vertices -- Floyd-Warshall cannot touch them.',
        'V² space is equally prohibitive at scale. A million-vertex graph would need a trillion-entry matrix. At 4 bytes per entry, that is 4 TB.',
        'When only a few source-destination pairs matter, computing all V² distances wastes almost all the work. Dijkstra from a single source, or A* for a single pair, is the right tool for sparse queries.',
        'Floyd-Warshall provides no useful partial results. The matrix is not correct until all V rounds finish. You cannot stop early for one pair the way Dijkstra halts when the target is settled.',
        'Path reconstruction requires a second V² matrix. Without it, you get distances but not actual paths.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        '4 vertices, 5 edges: 1→2(3), 1→3(8), 2→3(2), 3→4(1), 4→1(5). Initialize dist with direct edge weights, 0 on the diagonal, ∞ for missing edges.',
        'Initial matrix:',
        '     1    2    3    4\n1  [ 0    3    8    ∞ ]\n2  [ ∞    0    2    ∞ ]\n3  [ ∞    ∞    0    1 ]\n4  [ 5    ∞    ∞    0 ]',
        'k=1 (try vertex 1 as intermediate): dist[4][2] = min(∞, dist[4][1] + dist[1][2]) = min(∞, 5+3) = 8. dist[4][3] = min(∞, 5+8) = 13. Two cells improve. The matrix now includes paths that route through vertex 1.',
        'k=2 (try vertex 2): dist[1][3] = min(8, dist[1][2] + dist[2][3]) = min(8, 3+2) = 5. Going 1→2→3 costs 5, beating the direct edge of 8.',
        'k=3 (try vertex 3): dist[1][4] = min(∞, 5+1) = 6. dist[2][4] = min(∞, 2+1) = 3. dist[4][4] stays 0. Paths that use vertex 3 to reach vertex 4 now appear.',
        'k=4 (try vertex 4): dist[2][1] = min(∞, 3+5) = 8. dist[3][1] = min(∞, 1+5) = 6. dist[3][2] = min(∞, 6+3) = 9. Paths looping back through vertex 4 fill the remaining ∞ entries.',
        'Final matrix:',
        '     1    2    3    4\n1  [ 0    3    5    6 ]\n2  [ 8    0    2    3 ]\n3  [ 6    9    0    1 ]\n4  [ 5    8   13    0 ]',
        'All diagonal entries are 0 -- no negative cycles. Verify: dist[1][4] = 6 via 1→2→3→4 (3+2+1). dist[4][2] = 8 via 4→1→2 (5+3). Every pair has its shortest distance.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Floyd, R.W. (1962). "Algorithm 97: Shortest Path." Communications of the ACM, 5(6), 345. The three-loop matrix algorithm for all-pairs shortest distances. Warshall, S. (1962). "A Theorem on Boolean Matrices." Journal of the ACM, 9(1), 11-12. Transitive closure via the same structure with OR/AND instead of min/add. Roy (1959) independently discovered the same recurrence.',
        'Prerequisites: adjacency matrix representation and dynamic programming. Floyd-Warshall operates on a V-by-V matrix, and the "allowed intermediate vertices" set is the DP dimension.',
        'Bellman-Ford: single-source shortest paths with negative weights in O(VE). The right choice when you need distances from one vertex in a graph with negative edges, not all pairs.',
        'Dijkstra: single-source shortest paths with non-negative weights in O((V+E) log V). Faster than Floyd-Warshall when you only need one source and edges are non-negative.',
        'Johnson\'s algorithm: reweights edges with one Bellman-Ford run to eliminate negatives, then runs Dijkstra from every vertex. Cost: O(V² log V + VE). Beats Floyd-Warshall on sparse graphs; comparable on dense graphs.',
        'Transitive closure: the boolean version of Floyd-Warshall. Same structure, different semiring.',
      ],
    },
  ],
};
