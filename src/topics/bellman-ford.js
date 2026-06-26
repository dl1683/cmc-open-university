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
        'Each node carries a distance label (d=...). The source starts at 0; every other node starts at infinity, meaning "no known path yet." The algorithm works in passes — one pass means scanning every edge in the graph exactly once.',
        'For each edge, the algorithm asks: can I reach this destination cheaper by going through this source node? If yes, the destination\'s distance label drops. This operation is called relaxation. Green highlights mark a successful relaxation. Blue highlights mark an edge that was checked but could not improve the current best distance.',
        'The pass number appears at the top of each scan. After V−1 passes (where V is the number of nodes), a final check pass runs. If any edge still reduces a distance on that extra pass, a negative-weight cycle exists and the shortest paths through it are undefined.',
        'Watch edge B→C with weight −2 closely. This negative edge is the reason Bellman-Ford exists. It reduces C\'s distance below the direct A→C path of cost 4, producing a final distance of −1 for C. Dijkstra would finalize C at 4 on first extraction from the priority queue and never reconsider it.',
        {type: 'callout', text: 'Bellman-Ford replaces greedy finalization with repeated relaxation so negative edges can revise earlier distance beliefs.'},
        {type: 'image', src: './assets/gifs/bellman-ford.gif', alt: 'Animated walkthrough of the bellman ford visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'The single-source shortest-path problem asks: given a weighted directed graph and a starting node, find the minimum-cost path from that node to every other node. "Cost" is the sum of edge weights along the path. Dijkstra\'s algorithm (1959) solves this in O((V+E) log V) using a priority queue, but it assumes all edge weights are zero or positive.',
        'Some real graphs have negative edges. Currency exchange rates can make a multi-hop conversion cheaper than a direct one — converting USD→EUR→GBP may yield a better GBP rate than converting USD→GBP directly. Network routing protocols assign negative costs to preferred links to steer traffic. Game maps let certain paths restore resources, effectively giving negative travel cost.',
        'In all these settings, Dijkstra returns wrong answers silently. Richard Bellman (1958) and Lester Ford Jr. (1956) independently developed an algorithm that handles negative edges correctly. It trades speed for generality: O(VE) versus O((V+E) log V). It also detects negative-weight cycles — loops whose total edge weight is negative, which make shortest paths undefined because you could circle forever and keep reducing cost.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'For unweighted graphs, BFS (breadth-first search) finds shortest paths in O(V+E) by expanding one level at a time. Every edge has cost 1, so the first time BFS reaches a node is automatically the cheapest. For weighted graphs with nonnegative edges, Dijkstra extends BFS using a min-priority queue: always finalize the unvisited node with the smallest tentative distance.',
        'Because every edge adds nonnegative cost, once Dijkstra extracts a node from the queue, no undiscovered path can beat its current distance. Any such path would pass through nodes with equal or larger tentative distances, then add nonnegative weight on top. This greedy invariant is what makes Dijkstra both fast and correct on road networks, latency graphs, and any domain where travel always costs something.',
        'A reasonable engineer reaches for Dijkstra first. It handles most shortest-path problems. The trouble starts only when some edges carry negative weight.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'Dijkstra\'s greedy finalization depends on a single property: extending a path never makes it cheaper. With nonnegative weights, once a node has the smallest tentative distance in the priority queue, no future path through other nodes can undercut it. A negative edge destroys this. A longer path that detours through a negative edge can beat a shorter path that was already finalized.',
        'Concrete example: three nodes A, B, C with edges A→B(1), A→C(5), C→B(−10). Dijkstra pops B first at distance 1 and marks it done. But the path A→C→B costs 5 + (−10) = −5, which is cheaper. Dijkstra never reconsiders B. The answer is wrong, and the algorithm gives no warning.',
        'The fix must allow a node\'s distance to improve more than once. Dijkstra processes each node exactly once by design, so patching it is not enough — a fundamentally different approach is needed.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Bellman-Ford\'s insight comes from a counting argument about shortest paths. In a graph with V nodes and no negative cycles, any shortest path visits each node at most once — visiting a node twice would create a cycle, and removing a non-negative cycle from the path cannot increase its total weight. A path that visits each node at most once uses at most V−1 edges.',
        'This means that after one complete pass over all edges (relaxing each one), the algorithm has found all shortest paths that use exactly one edge. After two passes, it has found all shortest paths that use at most two edges. After k passes, it has found all shortest paths using at most k edges. So V−1 passes are always sufficient to find every shortest path in the graph.',
        'The beauty is that correctness does not depend on edge ordering within a pass. Lucky orderings converge faster, but any ordering works given enough passes. This makes the algorithm dead simple: just keep relaxing every edge, V−1 times, and you are done.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Initialize: set dist[source] = 0 and dist[v] = infinity for every other node v. Set parent[v] = null for all nodes. The parent array will reconstruct actual paths after the algorithm finishes.',
        'Run V−1 passes. Each pass iterates over every edge (u, v, w) in the graph and performs relaxation: if dist[u] + w < dist[v], update dist[v] = dist[u] + w and set parent[v] = u. Relaxation is the only operation the algorithm performs — no priority queue, no visited set, no adjacency structure beyond a flat edge list.',
        'After V−1 passes, run one more scan over all edges. If any relaxation still succeeds — meaning some dist[v] can still decrease — the graph contains a negative-weight cycle reachable from the source. Report it. If no relaxation succeeds, the dist array holds exact shortest-path distances and the parent pointers let you reconstruct every path by tracing parent[v] back to the source.',
        'Edge ordering within a pass does not affect correctness, only convergence speed. If edges happen to follow a topological order, one pass suffices. In the worst case (edges in reverse topological order), each pass propagates distance knowledge exactly one hop further, and all V−1 passes are needed.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The correctness proof is induction on the pass number. Claim: after pass k, dist[v] is at most the weight of the true shortest path from source to v using at most k edges.',
        'Base case (k = 0): dist[source] = 0 and all others are infinity. The only zero-edge path is source to itself with weight 0. The claim holds.',
        'Inductive step: assume the claim holds after pass k−1. Consider any shortest path from source to v that uses exactly k edges, and let its last edge be (u, v) with weight w. By the inductive hypothesis, dist[u] is already at most the weight of the shortest (k−1)-edge path to u. During pass k, edge (u, v) is scanned and the relaxation condition fires: dist[v] gets set to at most dist[u] + w, which is at most the weight of the shortest k-edge path to v.',
        'After V−1 passes, the claim covers paths using up to V−1 edges. Since any shortest path in a graph without negative cycles uses at most V−1 edges (as argued in "The core insight"), the distances are exact.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/85/Bellman-Ford_worst-case_example.svg/250px-Bellman-Ford_worst-case_example.svg.png', alt: 'Bellman-Ford worst-case example requiring multiple passes', caption: 'Worst-case edge order shows why distance information may advance only one edge per pass. Source: Wikimedia Commons.'},
        'The V-th pass exploits this bound directly. If any relaxation succeeds on pass V, then some "shortest path" requires V or more edges, meaning it visits a node twice. That is only possible when a negative cycle exists — a non-negative cycle would not reduce the path weight, so it would have been skipped in the true shortest path.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Time: O(VE). The algorithm runs V−1 passes, each scanning all E edges with O(1) work per relaxation. The negative-cycle check adds one more O(E) pass. For dense graphs where E approaches V², total work is O(V cubed). For sparse graphs where E is proportional to V, total work is O(V squared).',
        'Concrete scaling: a 1,000-node sparse graph with 3,000 edges requires roughly 3 million relaxation checks (999 passes times 3,000 edges). Double to 2,000 nodes and 6,000 edges: about 12 million checks. The cost quadruples because both the pass count and the edge count grow together. Compare Dijkstra with a binary heap: on the same 2,000-node graph, it does about 6,000 times log(2,000) = roughly 66,000 operations.',
        'Space: O(V + E). The distance and parent arrays take O(V). The edge list takes O(E). No priority queue is needed, which makes the implementation simpler than Dijkstra — literally three nested loops (passes, edges, relaxation check).',
        'SPFA (Shortest Path Faster Algorithm) is the main practical optimization. Instead of scanning all edges every pass, SPFA maintains a queue of nodes whose distances changed and only re-scans their outgoing edges. On most real-world sparse graphs, SPFA runs close to Dijkstra speed. But adversarial inputs force SPFA back to O(VE), so the worst case is unchanged. The early-exit optimization — stopping when a full pass produces no changes — does not improve worst-case complexity but often halves the number of passes in practice.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Currency arbitrage detection. Model currencies as nodes and exchange rates as edge weights using −log(rate). A negative cycle in this graph means a loop of trades that multiplies your money: for example, USD→EUR→GBP→USD yields more USD than you started with. Bellman-Ford\'s V-th pass detects these cycles directly. Trading firms run variants of this algorithm continuously against live rate feeds.',
        'Internet routing. RIP (Routing Information Protocol), one of the oldest internet routing protocols, is distributed Bellman-Ford. Each router maintains a distance vector — its best known cost to every destination — and periodically sends it to neighbors. When a router receives a neighbor\'s vector, it relaxes its own distances. RIP\'s "count to infinity" problem, where routers slowly increment a dead route\'s cost until hitting the maximum hop count of 16, is a direct consequence of Bellman-Ford\'s iterative convergence behavior.',
        'Min-cost network flow. Successive shortest-path algorithms for minimum-cost maximum-flow problems use Bellman-Ford to find augmenting paths in residual graphs. Residual graphs naturally contain negative edges from reverse-flow cancellation, so Dijkstra cannot be used without reweighting.',
        'Difference constraint systems. A system of constraints like x_j − x_i <= w_ij maps directly to a graph where edge (i, j) has weight w_ij. Running Bellman-Ford on this graph solves the entire system in O(VE). A negative cycle means the constraints are infeasible — no assignment satisfies all of them simultaneously. This technique appears in job scheduling (task A must finish at least 3 hours before task B starts) and temporal reasoning in AI planners.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Speed on nonnegative graphs. O(VE) is far slower than Dijkstra\'s O((V+E) log V) when all edges are nonnegative. On a road network with millions of nodes and tens of millions of edges, Bellman-Ford is impractical where Dijkstra, A*, or contraction hierarchies handle the job in milliseconds.',
        'Negative cycles are detected but not resolved. Bellman-Ford identifies that a negative cycle exists, but it cannot produce a shortest simple path (one that visits no node twice) in such a graph. The shortest simple path problem in graphs with negative cycles is NP-hard — no known polynomial-time algorithm exists.',
        'No heuristic guidance. Dijkstra can be extended to A* search by adding an admissible heuristic that estimates remaining distance to the goal, pruning large portions of the search space. Bellman-Ford processes all edges uniformly on every pass — it has no concept of a frontier or a goal direction.',
        'DAGs have a better option. If the graph is a directed acyclic graph (DAG), processing nodes in topological order and relaxing each node\'s outgoing edges yields shortest paths in O(V+E) — faster than both Dijkstra and Bellman-Ford, and it handles negative edges. If you know the graph is acyclic, Bellman-Ford is the wrong tool.',
        'Johnson\'s algorithm dominates for all-pairs problems. Rather than running Bellman-Ford from every source at O(V squared times E), Johnson\'s algorithm runs Bellman-Ford once to compute a potential function that reweights all edges to be nonnegative, then runs V independent Dijkstra searches. Total cost: O(VE + V squared log V), which beats Floyd-Warshall\'s O(V cubed) on sparse graphs.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Graph: 5 nodes (S, A, B, C, D) with 8 edges: S→A(6), S→B(7), A→C(5), A→D(−4), B→A(−2), B→C(8), C→D(2), D→B(3). Two negative edges exist: A→D with weight −4 and B→A with weight −2. Source node: S. Since V = 5, we need V−1 = 4 passes.',
        'Initialize: dist = [S:0, A:infinity, B:infinity, C:infinity, D:infinity].',
        'Pass 1 — scan all 8 edges in order. S→A: 0+6 = 6 < infinity, so dist[A] = 6. S→B: 0+7 = 7 < infinity, so dist[B] = 7. A→C: 6+5 = 11 < infinity, so dist[C] = 11. A→D: 6+(−4) = 2 < infinity, so dist[D] = 2. B→A: 7+(−2) = 5 < 6, so dist[A] drops to 5. B→C: 7+8 = 15 > 11, no improvement. C→D: 11+2 = 13 > 2, no improvement. D→B: 2+3 = 5 < 7, so dist[B] drops to 5. Result after pass 1: [S:0, A:5, B:5, C:11, D:2].',
        'Pass 2 — S→A: 0+6 = 6 > 5, skip. S→B: 0+7 = 7 > 5, skip. A→C: 5+5 = 10 < 11, dist[C] = 10. A→D: 5+(−4) = 1 < 2, dist[D] = 1. B→A: 5+(−2) = 3 < 5, dist[A] = 3. D→B: 1+3 = 4 < 5, dist[B] = 4. Result: [S:0, A:3, B:4, C:10, D:1].',
        'Pass 3 — A→C: 3+5 = 8 < 10, dist[C] = 8. A→D: 3+(−4) = −1 < 1, dist[D] = −1. B→A: 4+(−2) = 2 < 3, dist[A] = 2. D→B: (−1)+3 = 2 < 4, dist[B] = 2. Result: [S:0, A:2, B:2, C:8, D:−1]. Notice how the negative edge A→D keeps pulling D\'s distance down, and that improvement ripples through D→B→A on each subsequent pass.',
        'Pass 4 — A→C: 2+5 = 7 < 8, dist[C] = 7. A→D: 2+(−4) = −2 < −1, dist[D] = −2. B→A: 2+(−2) = 0 < 2, dist[A] = 0. D→B: (−2)+3 = 1 < 2, dist[B] = 1. Result: [S:0, A:0, B:1, C:7, D:−2]. Distances are still changing on the last pass — that is suspicious.',
        'Negative-cycle check (pass 5): scan edges again. A→D: 0+(−4) = −4 < −2. A distance decreased on pass V, so a negative cycle exists. The cycle is A→D→B→A with total weight (−4)+3+(−2) = −3. Every trip around this cycle reduces total cost by 3, so no finite shortest path exists for any node reachable from the cycle.',
        'Contrast with the animation graph (A, B, C, D), which has no negative cycle. There, edge B→C(−2) creates a cheaper path A→B→C = 1+(−2) = −1, beating the direct A→C = 4. The algorithm converges within V−1 passes. Dijkstra would finalize C at 4 on first extraction and miss the −1 path entirely.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Richard Bellman, "On a Routing Problem," Quarterly of Applied Mathematics 16(1), 1958. Bellman formulated single-source shortest paths as dynamic programming over the number of edges — the pass structure of the algorithm comes directly from this recurrence. Lester Ford Jr., "Network Flow Theory," RAND Corporation report P-923, 1956. Ford independently described the relaxation method two years earlier in the context of network flow.',
        'Study Dijkstra\'s algorithm next to understand the speed advantage when edges are nonnegative: O((V+E) log V) with a binary heap, each node finalized exactly once. Understanding both algorithms clarifies the fundamental tradeoff: Dijkstra is faster but restricted to nonnegative weights; Bellman-Ford is slower but handles any edge weight and detects negative cycles.',
        'For all-pairs shortest paths, study Floyd-Warshall (O(V cubed), handles negative edges, detects negative cycles when a diagonal entry goes negative) and Johnson\'s algorithm (one Bellman-Ford run plus V Dijkstra runs, O(VE + V squared log V), superior on sparse graphs).',
        'For practical speedups on graphs with negative edges, study SPFA: it queues only nodes whose distances changed and re-scans only their outgoing edges. On real-world sparse graphs, SPFA often approaches Dijkstra-level speed while still handling negative edges correctly.',
        'Prerequisite: if the concept of relaxation is unfamiliar, start with BFS for unweighted shortest paths. BFS explores one level (hop) at a time; Bellman-Ford generalizes this to weighted graphs by replacing BFS levels with full relaxation passes over every edge.',
      ],
    },
  ],
};
