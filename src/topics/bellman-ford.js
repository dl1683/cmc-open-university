// Bellman-Ford shortest path: relax every edge V-1 times.
// Slower than Dijkstra, but handles negative weights and detects negative cycles.

import { graphState } from '../core/state.js';

export const topic = {
  id: 'bellman-ford',
  title: 'Bellman-Ford Shortest Path',
  category: 'Data Structures',
  summary: 'Find shortest paths even with negative edges: relax every edge V-1 times, then check for negative cycles.',
  controls: [],
  run,
};

// Directed graph with a negative edge (B->C costs -2) to show why
// Dijkstra fails and Bellman-Ford succeeds. No negative cycle.
const NODES = [
  { id: 'A', label: 'A', x: 1.0, y: 4.0 },
  { id: 'B', label: 'B', x: 4.0, y: 7.0 },
  { id: 'C', label: 'C', x: 4.0, y: 1.5 },
  { id: 'D', label: 'D', x: 8.0, y: 4.0 },
];

// Directed edges: A->B(1), A->C(4), B->C(-2), B->D(2), C->D(3)
const EDGES = [
  { id: 'AB', from: 'A', to: 'B', weight: 1, directed: true },
  { id: 'AC', from: 'A', to: 'C', weight: 4, directed: true },
  { id: 'BC', from: 'B', to: 'C', weight: -2, directed: true },
  { id: 'BD', from: 'B', to: 'D', weight: 2, directed: true },
  { id: 'CD', from: 'C', to: 'D', weight: 3, directed: true },
];

const SOURCE = 'A';

export function* run() {
  const dist = new Map(NODES.map((n) => [n.id, Infinity]));
  const parent = new Map();
  dist.set(SOURCE, 0);
  const V = NODES.length;

  const snapshot = () => graphState({
    nodes: NODES.map((n) => ({
      ...n,
      note: dist.get(n.id) === Infinity ? 'd=∞' : `d=${dist.get(n.id)}`,
    })),
    edges: EDGES,
  });

  yield {
    state: snapshot(),
    highlight: { active: [SOURCE] },
    explanation: `Bellman-Ford finds shortest paths from source ${SOURCE} even when edges have negative weights. Initialize: dist[${SOURCE}]=0, all others ∞. The algorithm relaxes every edge V−1=${V - 1} times. Why V−1? A shortest path in a graph with no negative cycle has at most V−1 edges, so V−1 passes guarantee every shortest path is discovered.`,
  };

  // V-1 relaxation passes
  for (let pass = 1; pass < V; pass++) {
    let anyImproved = false;

    yield {
      state: snapshot(),
      highlight: { active: [SOURCE] },
      explanation: `Pass ${pass} of ${V - 1}: scan every edge and relax if the path through the source end is cheaper. Unlike Dijkstra, we do not pick the cheapest node — we brute-force all edges. This is slower (O(VE) vs O((V+E) log V)) but it works with negative weights because we do not finalize any node early.`,
    };

    for (const edge of EDGES) {
      const { from, to, weight, id: edgeId } = edge;
      const fromDist = dist.get(from);
      if (fromDist === Infinity) {
        yield {
          state: snapshot(),
          highlight: { compare: [edgeId, from, to] },
          explanation: `Edge ${from}→${to} (weight ${weight}): dist[${from}]=∞, so this edge cannot improve dist[${to}] yet. Skip.`,
        };
        continue;
      }
      const candidate = fromDist + weight;
      const currentDist = dist.get(to);
      const better = candidate < currentDist;

      if (better) {
        dist.set(to, candidate);
        parent.set(to, from);
        anyImproved = true;
      }

      yield {
        state: snapshot(),
        highlight: better
          ? { active: [from, to, edgeId] }
          : { compare: [edgeId, from, to] },
        explanation: better
          ? `Edge ${from}→${to} (weight ${weight}): dist[${from}]+${weight} = ${candidate} < ${currentDist === Infinity ? '∞' : currentDist} = dist[${to}]. Update dist[${to}]=${candidate}. ${weight < 0 ? 'This negative edge reduced the cost — Dijkstra would miss this because it already finalized ' + to + '.' : ''}`
          : `Edge ${from}→${to} (weight ${weight}): dist[${from}]+${weight} = ${candidate} ≥ ${currentDist} = dist[${to}]. No improvement.`,
      };
    }

    if (!anyImproved) {
      yield {
        state: snapshot(),
        highlight: { found: NODES.map((n) => n.id) },
        explanation: `Pass ${pass} made no improvements. All distances are final — we can stop early. This early-exit optimization is the basis of the SPFA variant (Shortest Path Faster Algorithm), which uses a queue to avoid re-scanning edges that cannot improve.`,
      };
      break;
    }
  }

  // Negative-cycle detection: V-th pass
  let hasNegCycle = false;
  for (const edge of EDGES) {
    const { from, to, weight, id: edgeId } = edge;
    const fromDist = dist.get(from);
    if (fromDist === Infinity) continue;
    if (fromDist + weight < dist.get(to)) {
      hasNegCycle = true;
      yield {
        state: snapshot(),
        highlight: { removed: [edgeId, from, to] },
        explanation: `Negative-cycle check: edge ${from}→${to} still improves dist[${to}] on pass V. This means a negative-weight cycle is reachable — shortest paths are undefined for nodes on or reachable from this cycle.`,
      };
      break;
    }
  }

  if (!hasNegCycle) {
    // Build final path display
    const pathTo = (target) => {
      const path = [];
      let walk = target;
      while (walk !== undefined) { path.unshift(walk); walk = parent.get(walk); }
      return path;
    };
    const allPaths = NODES.filter((n) => n.id !== SOURCE && dist.get(n.id) !== Infinity)
      .map((n) => `${n.id}: ${pathTo(n.id).join('→')} (cost ${dist.get(n.id)})`);

    yield {
      state: snapshot(),
      highlight: { found: NODES.map((n) => n.id) },
      explanation: `No distance decreased on pass V — no negative cycle exists. Final shortest paths from ${SOURCE}: ${allPaths.join('; ')}. Notice dist[C]=−1 via A→B→C: the negative edge B→C(−2) made the path through B cheaper than the direct A→C(4). Dijkstra would have finalized C=4 on first visit and never discovered the −1 path.`,
    };
  }
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'Each node carries a distance label (d=...). The source starts at 0; everything else starts at infinity. The algorithm works in passes. Each pass scans every edge and asks: can I reach this destination cheaper by going through this edge? If yes, the distance label updates.',
        'Green highlights mark a successful relaxation: the edge produced a cheaper path, so the destination\'s distance dropped. Blue highlights mark an edge that was checked but could not improve the current best distance.',
        'The pass number appears at the top of each scan. After V−1 passes, a final check pass runs. If any edge still reduces a distance on that extra pass, a negative cycle exists and the affected shortest paths are undefined.',
        'Pay special attention to edge B→C with weight −2. This negative edge is why the algorithm exists. Watch how it reduces C\'s distance below the direct A→C path of cost 4, producing a final distance of −1 for C. Dijkstra would finalize C at 4 and never reconsider it.',
        {type: 'callout', text: 'Bellman-Ford replaces greedy finalization with repeated relaxation so negative edges can revise earlier distance beliefs.'},
      
        {type: 'image', src: './assets/gifs/bellman-ford.gif', alt: 'Animated walkthrough of the bellman ford visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Shortest-path algorithms find the cheapest route from a source to every other node. Dijkstra\'s algorithm (1959) solves this in O((V+E) log V) with a priority queue, but it assumes every edge weight is zero or positive. Some real graphs have negative edges. Currency exchange rates can make a multi-hop conversion cheaper than a direct one. Network routing protocols assign negative costs to preferred links. Game maps let certain paths restore resources. In these settings, Dijkstra returns wrong answers without warning.',
        'Richard Bellman (1958) and Lester Ford (1956) independently developed an algorithm that handles negative edges. It trades speed for generality: O(VE) instead of O((V+E) log V), but it works on any graph and can detect negative-weight cycles — loops where the total weight is negative, making shortest paths undefined because you could circle forever and keep reducing cost. Dijkstra has no mechanism for this detection.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'For unweighted graphs, BFS finds shortest paths in O(V+E) by expanding level by level. For weighted graphs, Dijkstra extends BFS with a priority queue: always finalize the unvisited node with the smallest tentative distance. Because every edge adds nonnegative cost, the finalized distance can never be beaten by a longer path. This greedy choice makes Dijkstra fast and correct on road networks, latency graphs, and any domain where travel always costs something.',
        'A reasonable engineer reaches for Dijkstra first. It handles most shortest-path problems well. The trouble starts only when some edges have negative weight.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'Dijkstra\'s greedy finalization relies on one property: extending a path never makes it cheaper. With nonnegative weights, once a node has the smallest tentative distance in the priority queue, no undiscovered path can beat it — any such path would have to pass through nodes with equal or larger tentative distances, then add nonnegative weight. A negative edge breaks this. A longer path through a negative edge can undercut a shorter path that was already finalized.',
        'Concrete example: edges A→B(1), A→C(5), C→B(−10). Dijkstra pops B first at distance 1 and finalizes it. But the path A→C→B costs 5 + (−10) = −5, which is cheaper. Dijkstra never reconsiders B. The answer is wrong.',
        'The fix must let a node\'s distance improve more than once. Bellman-Ford does this by running V−1 full passes over all edges, letting improvements propagate one hop further each time.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Set dist[source] = 0 and dist[v] = ∞ for every other node. Initialize parent pointers as empty.',
        'Run V−1 passes. Each pass scans every edge (u, v, w) in the graph. If dist[u] + w < dist[v], set dist[v] = dist[u] + w and record parent[v] = u. This single operation — relaxation — is the only thing the algorithm does.',
        'After V−1 passes, run one more scan over all edges. If any distance still decreases, the graph contains a negative-weight cycle reachable from the source. Report it. Otherwise, the dist array holds the true shortest-path distances and the parent pointers reconstruct the paths.',
        'Edge ordering within a pass does not affect correctness. If the edges happen to follow a topological order, one pass suffices. In the worst case, each pass propagates shortest-path knowledge one hop further from the source, so V−1 passes always cover every possible shortest path.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The correctness argument is induction on pass number. Claim: after pass k, dist[v] is at most the weight of the shortest path from source to v using at most k edges.',
        'Base case (k = 0): dist[source] = 0, all others infinity. The only 0-edge path is the source to itself, which has weight 0. Correct.',
        'Inductive step: assume the claim holds after pass k−1. Take any shortest path from source to v using at most k edges, and let its last edge be (u, v). By hypothesis, dist[u] already holds a value at most equal to the shortest (k−1)-edge path to u. During pass k, edge (u, v) is scanned, so dist[v] gets updated to at most dist[u] + w(u, v), which is at most the shortest k-edge path to v.',
        'After V−1 passes, the claim covers paths using up to V−1 edges. A shortest path in a graph without negative cycles never visits a node twice — removing a non-negative cycle from the path cannot increase its weight. So every shortest path uses at most V−1 edges, and the distances are exact.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/85/Bellman-Ford_worst-case_example.svg/250px-Bellman-Ford_worst-case_example.svg.png', alt: 'Bellman-Ford worst-case example requiring multiple passes', caption: 'Worst-case edge order shows why distance information may advance only one edge per pass. Source: Wikimedia Commons.'},
        'The V-th pass exploits this bound. If any relaxation succeeds on pass V, some "shortest path" needs V or more edges, which means it passes through a node twice — only possible if a negative cycle exists.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Time: O(VE). The algorithm runs V−1 passes, each scanning all E edges with O(1) relaxation. The negative-cycle check adds one more O(E) pass. For dense graphs where E approaches V², total work is O(V³). For sparse graphs where E is proportional to V, total work is O(V²).',
        'Concrete scaling: a 1,000-node sparse graph with 3,000 edges needs about 3 million relaxation checks. Double to 2,000 nodes and 6,000 edges: 12 million checks. Quadrupling, because both the pass count (V−1) and the edge count grow together. Dijkstra at O((V+E) log V) handles million-node road networks in seconds; Bellman-Ford on the same input takes minutes.',
        'Space: O(V + E). Distance and parent arrays use O(V). The edge list uses O(E). No priority queue needed, making the implementation simpler than Dijkstra.',
        'SPFA (Shortest Path Faster Algorithm) is the main practical optimization. Instead of scanning all edges every pass, SPFA maintains a queue of nodes whose distances changed and only re-scans their outgoing edges. On most sparse graphs, SPFA runs close to Dijkstra speed. But adversarial inputs force it back to O(VE), so the worst case is unchanged. The early-exit optimization in the animation — stopping when a full pass makes no changes — does not improve worst-case complexity but often halves the number of passes.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'Currency arbitrage detection. Model currencies as nodes and exchange rates as edge weights using −log(rate). A negative cycle means a loop of trades that multiplies your money: USD→EUR→GBP→USD yields more USD than you started with. Bellman-Ford\'s V-th pass detects these cycles directly. Trading firms run variants of this algorithm continuously against live rate feeds.',
        'Routing protocols. RIP (Routing Information Protocol), one of the oldest internet routing protocols, is distributed Bellman-Ford. Each router keeps a distance vector — its best known distance to every destination — and periodically sends it to neighbors. When a neighbor receives a vector, it relaxes its own distances. RIP\'s "count to infinity" problem, where routers slowly increment a dead route\'s cost until hitting the maximum of 16, is a direct consequence of Bellman-Ford\'s iterative convergence.',
        'Network flow. Successive shortest-path algorithms for min-cost max-flow use Bellman-Ford to find augmenting paths in residual graphs, which naturally contain negative edges from reverse-flow cancellation.',
        'Constraint satisfaction. A system of difference constraints x_j − x_i ≤ w_ij maps to a graph where edge (i, j) has weight w_ij. Bellman-Ford solves the system in O(VE). A negative cycle means the constraints are infeasible. This appears in job scheduling (task A must finish at least 3 hours before task B) and temporal reasoning in AI planners.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Speed. O(VE) is far slower than Dijkstra\'s O((V+E) log V) when edges are nonnegative. On a road network with millions of nodes and tens of millions of edges, Bellman-Ford is impractical where Dijkstra, A*, or contraction hierarchies handle the job easily.',
        'Negative cycles. Bellman-Ford detects them but cannot fix them. If the application needs a shortest simple path (no repeated nodes) in a graph with negative cycles, the problem is NP-hard.',
        'No heuristic guidance. Dijkstra can be extended to A* with an admissible heuristic for goal-directed search. Bellman-Ford processes all edges uniformly — it has no frontier to guide.',
        'DAGs have a better option. Topological-order relaxation finds shortest paths in O(V+E), faster than both Dijkstra and Bellman-Ford. If the graph is known to be acyclic, Bellman-Ford is the wrong tool.',
        'Johnson\'s algorithm beats it for all-pairs shortest paths. Instead of running Bellman-Ford from every source (O(V²E)), Johnson runs Bellman-Ford once to reweight edges, then runs V Dijkstra searches. Total: O(VE + V² log V), which dominates Floyd-Warshall\'s O(V³) on sparse graphs.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Graph: 5 nodes (S, A, B, C, D), edges: S→A(6), S→B(7), A→C(5), A→D(−4), B→A(−2), B→C(8), C→D(2), D→B(3). Two negative edges: A→D(−4) and B→A(−2). Source: S. V = 5, so V−1 = 4 passes.',
        'Initialize: dist = [S:0, A:∞, B:∞, C:∞, D:∞].',
        'Pass 1 — Scan all 8 edges: S→A: 0+6 = 6 < ∞, dist[A] = 6. S→B: 0+7 = 7 < ∞, dist[B] = 7. A→C: 6+5 = 11 < ∞, dist[C] = 11. A→D: 6+(−4) = 2 < ∞, dist[D] = 2. B→A: 7+(−2) = 5 < 6, dist[A] = 5. B→C: 7+8 = 15 > 11, skip. C→D: 11+2 = 13 > 2, skip. D→B: 2+3 = 5 < 7, dist[B] = 5. After pass 1: dist = [S:0, A:5, B:5, C:11, D:2].',
        'Pass 2 — S→A: 6 > 5, skip. S→B: 7 > 5, skip. A→C: 5+5 = 10 < 11, dist[C] = 10. A→D: 5+(−4) = 1 < 2, dist[D] = 1. B→A: 5+(−2) = 3 < 5, dist[A] = 3. B→C: 5+8 = 13 > 10, skip. C→D: 10+2 = 12 > 1, skip. D→B: 1+3 = 4 < 5, dist[B] = 4. After pass 2: dist = [S:0, A:3, B:4, C:10, D:1].',
        'Pass 3 — A→C: 3+5 = 8 < 10, dist[C] = 8. A→D: 3+(−4) = −1 < 1, dist[D] = −1. B→A: 4+(−2) = 2 < 3, dist[A] = 2. D→B: −1+3 = 2 < 4, dist[B] = 2. After pass 3: dist = [S:0, A:2, B:2, C:8, D:−1].',
        'Pass 4 — A→C: 2+5 = 7 < 8, dist[C] = 7. A→D: 2+(−4) = −2 < −1, dist[D] = −2. B→A: 2+(−2) = 0 < 2, dist[A] = 0. D→B: −2+3 = 1 < 2, dist[B] = 1. After pass 4: dist = [S:0, A:0, B:1, C:7, D:−2].',
        'Negative-cycle check (pass 5): A→D: 0+(−4) = −4 < −2. Distance decreased — negative cycle detected. The cycle is A→D→B→A with total weight (−4)+3+(−2) = −3. Looping through this cycle reduces cost indefinitely, so no finite shortest path exists for nodes on or reachable from this cycle.',
        'Compare: the animation graph (A, B, C, D) has no negative cycle. Edge B→C(−2) creates a cheaper path A→B→C = 1+(−2) = −1, beating the direct A→C = 4. Dijkstra would finalize C at 4 on first visit and miss the −1 path entirely.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Richard Bellman, "On a Routing Problem," Quarterly of Applied Mathematics 16(1), 1958. Bellman framed single-source shortest paths as dynamic programming over the number of edges — the pass structure comes directly from this formulation. Lester Ford Jr., "Network Flow Theory," RAND Corporation report P-923, 1956. Ford independently described the relaxation method two years earlier.',
        'Study Dijkstra\'s algorithm to understand the speed advantage when edges are nonnegative: O((V+E) log V) with a binary heap, finalizing each node exactly once. Understanding both algorithms clarifies the exact tradeoff: Dijkstra is faster but restricted; Bellman-Ford is slower but universal.',
        'For all-pairs shortest paths, study Floyd-Warshall (O(V³), handles negative edges, detects negative cycles via the diagonal) and Johnson\'s algorithm (Bellman-Ford + V Dijkstra runs, O(VE + V² log V), better on sparse graphs).',
        'For practical speedups, study SPFA: it queues only nodes with changed distances and re-scans only their outgoing edges. On sparse graphs without adversarial structure, SPFA approaches Dijkstra speed while handling negative edges.',
        'Prerequisite: if relaxation is unfamiliar, study BFS for unweighted shortest paths first. BFS expands level by level; Bellman-Ford generalizes this to weighted graphs by replacing BFS levels with relaxation passes over all edges.',
      ],
    },
  ],
};
