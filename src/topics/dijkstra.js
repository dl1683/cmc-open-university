// Dijkstra's algorithm: BFS grown up. When edges have costs, "fewest hops"
// stops being "cheapest" - so always expand the cheapest known node instead.

import { graphState } from '../core/state.js';

export const topic = {
  id: 'dijkstra',
  title: "Dijkstra's Shortest Path",
  category: 'Data Structures',
  summary: 'Find the cheapest route in a weighted graph by always expanding the cheapest known node.',
  controls: [
    { id: 'target', label: 'Destination', type: 'select', options: ['F', 'E', 'D'], defaultValue: 'F' },
  ],
  run,
};

// A weighted map. Note the trap: A->B->F looks short (2 edges) but costs 12;
// the 4-edge route through C, D, E costs 9.
const NODES = [
  { id: 'A', label: 'A', x: 1.0, y: 4.5 }, { id: 'B', label: 'B', x: 4.0, y: 7.6 },
  { id: 'C', label: 'C', x: 3.6, y: 1.6 }, { id: 'D', label: 'D', x: 6.4, y: 3.4 },
  { id: 'E', label: 'E', x: 8.0, y: 6.0 }, { id: 'F', label: 'F', x: 9.4, y: 2.6 },
];
const EDGES = [
  { id: 'AB', from: 'A', to: 'B', weight: 5 }, { id: 'AC', from: 'A', to: 'C', weight: 2 },
  { id: 'BD', from: 'B', to: 'D', weight: 4 }, { id: 'BE', from: 'B', to: 'E', weight: 6 },
  { id: 'BF', from: 'B', to: 'F', weight: 7 }, { id: 'CD', from: 'C', to: 'D', weight: 3 },
  { id: 'DE', from: 'D', to: 'E', weight: 2 }, { id: 'EF', from: 'E', to: 'F', weight: 2 },
];

const around = (id) => EDGES
  .filter((e) => e.from === id || e.to === id)
  .map((e) => ({ edge: e, other: e.from === id ? e.to : e.from }));

export function* run(input) {
  const target = String(input.target);
  const dist = new Map(NODES.map((n) => [n.id, Infinity]));
  const parent = new Map();
  dist.set('A', 0);
  const settled = new Set();

  const snapshot = () => graphState({
    nodes: NODES.map((n) => ({
      ...n,
      note: dist.get(n.id) === Infinity ? 'd=inf' : `d=${dist.get(n.id)}`,
    })),
    edges: EDGES,
  });

  yield {
    state: snapshot(),
    highlight: { active: ['A'] },
    explanation: `Now the edges have COSTS - kilometers, milliseconds, dollars. BFS would find the fewest edges, but look: A->B->F is 2 edges costing 5+7=12, while the long way round can be cheaper. Dijkstra's fix: track the best-known cost to every node (d=...), and always expand the CHEAPEST unsettled node - greedy, and provably right (as long as no edge cost is negative).`,
  };

  while (true) {
    let current = null;
    for (const [id, d] of dist) {
      if (!settled.has(id) && d < (current === null ? Infinity : dist.get(current))) current = id;
    }
    if (current === null) break;
    settled.add(current);

    if (current === target) {
      const pathNodes = [];
      let walk = target;
      while (walk !== undefined) { pathNodes.unshift(walk); walk = parent.get(walk); }
      const pathEdges = pathNodes.slice(1).map((n, i) => {
        const a = pathNodes[i];
        return EDGES.find((e) => (e.from === a && e.to === n) || (e.from === n && e.to === a)).id;
      });
      yield {
        state: snapshot(),
        highlight: { found: [...pathNodes, ...pathEdges], visited: [...settled].filter((s) => !pathNodes.includes(s)) },
        explanation: `${target} is settled at cost ${dist.get(target)} - and the cheapest route is ${pathNodes.join(' -> ')}${pathNodes.includes('B') ? '' : ', NOT the 2-edge shortcut through B'}. This algorithm (with a Binary Heap serving the "cheapest unsettled node" in O(log n)) runs your GPS, internet packet routing (OSPF), and game pathfinding. Greedy works here because settling cheap nodes first means no later discovery can undercut them.`,
        invariant: 'Once a node is settled, its distance is final - no cheaper route to it can ever appear.',
      };
      return;
    }

    yield {
      state: snapshot(),
      highlight: { active: [current], visited: [...settled].filter((s) => s !== current) },
      explanation: `The cheapest unsettled node is ${current} (d=${dist.get(current)}) - settle it. (A real implementation pops this from a Binary Heap instead of scanning.) Its distance can never improve again; now RELAX its edges: does going through ${current} make any neighbor cheaper?`,
    };

    for (const { edge, other } of around(current)) {
      if (settled.has(other)) continue;
      const candidate = dist.get(current) + edge.weight;
      const better = candidate < dist.get(other);
      yield {
        state: snapshot(),
        highlight: { active: [current], compare: [edge.id, other], visited: [...settled].filter((s) => s !== current) },
        explanation: `Via ${current}, reaching ${other} costs ${dist.get(current)} + ${edge.weight} = ${candidate}. Current best for ${other}: ${dist.get(other) === Infinity ? 'inf (never reached)' : dist.get(other)}. ${better ? `Better - update d(${other})=${candidate} and remember the route came through ${current}.` : 'Not better - keep the old route.'}`,
      };
      if (better) {
        dist.set(other, candidate);
        parent.set(other, current);
      }
    }
  }
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'The graph has six nodes (A through F) connected by weighted edges. Each node carries a distance label d=... showing the cheapest known cost to reach it from the source. At the start, the source A has d=0 and every other node has d=inf (unreached).',
        {
          type: 'callout',
          text: 'Dijkstra is BFS with the frontier ordered by total known cost instead of hop count.',
        },
        'The active node (highlighted) is the unsettled node with the smallest tentative distance. This is what a priority queue (min-heap) would return. Visited nodes (dimmed) are settled: their distances are final and will never change. When an edge flashes, a relaxation check is happening: the algorithm tests whether routing through the active node gives the neighbor a cheaper path.',
        'The relaxation arithmetic is shown explicitly: dist[active] + edge weight versus the neighbor\'s current distance. If the new value wins, the neighbor\'s label updates. If not, nothing changes. This is the only operation that improves the algorithm\'s knowledge.',
        'At the end, the green path traces parent pointers from target back to source. The cost along that path equals the target\'s settled distance. Watch for the moment the short two-hop route through B (cost 12) loses to the longer four-hop route through C, D, E (cost 9). That moment is the reason Dijkstra exists.',
      
        {type: 'image', src: './assets/gifs/dijkstra.gif', alt: 'Animated walkthrough of the dijkstra visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'In 1956, Edsger Dijkstra wanted to demonstrate the ARMAC computer in Amsterdam. He picked shortest-path computation on a 64-city road map. He designed the algorithm in about twenty minutes at a cafe terrace, without pencil and paper, reasoning purely in his head. The three-page paper appeared in 1959: "A Note on Two Problems in Connexion with Graphs." It became one of the most cited papers in computer science.',
        'The problem: given a graph where every edge carries a nonnegative cost (kilometers, milliseconds, dollars, energy), find the cheapest path from one source to all reachable nodes. Road networks have distances, packet networks have latencies, game maps have terrain penalties. In all of these, "nearest" means cheapest total cost, not fewest hops.',
        'The output is a shortest-path tree rooted at the source. Every reachable node gets a final distance and a parent pointer. Following parent pointers backward from any node reconstructs the cheapest route to it. This tree is the foundation of GPS navigation, internet routing, and game AI pathfinding.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'BFS solves shortest paths in unweighted graphs. It uses a FIFO queue: discover a node, push it to the back, process nodes front-to-back. Because every edge adds exactly one unit of distance, layer-by-layer expansion guarantees that the first time BFS reaches a node, it has found the shortest path in hops.',
        'BFS runs in O(V + E), needs no heap, and is simple to implement. For graphs where every edge has the same cost, it is the right tool.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'BFS treats every edge as cost 1. Once edges carry different weights, hop count and total cost diverge. In the animation\'s graph, the two-hop path A-B-F costs 5 + 7 = 12. The four-hop path A-C-D-E-F costs 2 + 3 + 2 + 2 = 9. BFS would choose the two-hop path. It would be wrong by 3 cost units.',
        'The structural problem: a FIFO queue preserves discovery order, but discovery order no longer corresponds to total cost. A node reached in two hops might be more expensive than one reached in four. To find cheapest paths, you need to process nodes in order of accumulated cost, not in order of discovery.',
        'Brute-force enumeration is not an alternative. Even small graphs have exponentially many simple paths. Graphs with cycles have infinitely many walks. You need a strategy that finds the cheapest path without trying them all.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Replace BFS\'s FIFO queue with a priority queue keyed by tentative distance. Always extract and finalize the node with the smallest tentative cost. Because all edge weights are nonnegative, no future path through a more expensive unsettled node can circle back and undercut the node you just finalized. The cheapest tentative distance is safe to lock in.',
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/57/Dijkstra_Animation.gif/250px-Dijkstra_Animation.gif',
          alt: 'Dijkstra algorithm animation showing a weighted graph frontier expanding from the source',
          caption: 'Dijkstra frontier expansion on a weighted graph. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Dijkstra_Animation.gif.',
        },
        'This single substitution -- priority queue for FIFO queue -- turns BFS into Dijkstra. The FIFO queue guaranteed "fewest hops first." The priority queue guarantees "cheapest cost first."',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Set dist[source] = 0 and dist[v] = infinity for all other nodes. Clear all parent pointers. Insert the source into a min-heap keyed by tentative distance.',
        'Loop: extract the node u with the smallest tentative distance from the heap. Mark u as settled (finalized). For each edge (u, v) with weight w, compute candidate = dist[u] + w. If candidate < dist[v], update dist[v] = candidate and set parent[v] = u. Push v into the heap with its new distance (or decrease its key if your heap supports it). This update step is called relaxation.',
        'Stop when the target node is extracted (if you only need one shortest path) or when the heap is empty (if you want shortest paths to all reachable nodes). Reconstruct any shortest path by following parent pointers backward from destination to source.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Claim: when node u is extracted from the min-heap, dist[u] is the true shortest-path distance from the source.',
        'Proof sketch by contradiction. Suppose a cheaper path P to u existed. P must at some point cross from a settled node x to an unsettled node y (because the source is settled and u is not yet settled when extracted). Since x is settled, dist[x] is correct. When x was settled, the edge (x, y) was relaxed, so dist[y] <= dist[x] + weight(x, y). The rest of P from y to u adds only nonnegative edges, so the total cost of P is at least dist[y]. But u was extracted because dist[u] is the smallest tentative distance among all unsettled nodes, meaning dist[u] <= dist[y]. The "cheaper" path P costs at least dist[y] >= dist[u]. That contradicts the assumption that P is cheaper. So dist[u] is correct.',
        'The proof rests entirely on the nonnegative-weight assumption. If an edge from y toward u could subtract cost, the continuation from y to u might total less than dist[y], and the greedy extraction of u would be premature. This is exactly why negative edges break the algorithm.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Binary heap (standard implementation): O((V + E) log V) time. Each of the V extractions costs O(log V). Each of the at-most-E relaxations costs O(log V) for the heap insert or decrease-key. Space: O(V + E) for the graph, O(V) for distances, parents, and heap.',
        'Array scan (no heap): O(V^2 + E) time. Each extraction scans all V entries to find the minimum. No log factor per edge, so this wins on dense graphs where E is close to V^2.',
        'Fibonacci heap (theoretical best): O(V log V + E) time. Decrease-key is O(1) amortized, so all E relaxations contribute only O(E). In practice, the constant factors and implementation complexity mean binary heaps win for most real graph sizes.',
        'Scaling behavior: on a sparse graph with a binary heap, doubling V roughly doubles the work plus a negligible log factor. A road network with 10,000 intersections needs about 140,000 heap operations. At 20,000, about 300,000. The log grows so slowly you barely notice it. With the array version, doubling V quadruples the extraction cost.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'GPS navigation. Road networks are sparse weighted graphs with millions of nodes. Dijkstra, and its preprocessed descendants like contraction hierarchies and hub labeling, power the routing engines in Google Maps, Apple Maps, and OpenStreetMap. The weights are travel times or distances; the output is the turn-by-turn route.',
        'Internet routing. OSPF (Open Shortest Path First), one of the most widely deployed interior gateway protocols, runs Dijkstra on link-state graphs. Each router floods its local link costs to every other router, then each router independently runs Dijkstra to build a forwarding table.',
        'Game pathfinding. Terrain with different movement costs (road = 1, swamp = 3, mountain = impassable) produces a weighted graph. Dijkstra finds the optimal path. A* extends Dijkstra by adding an admissible heuristic that steers the search toward the goal, but A* is Dijkstra with a heuristic bias, not a different algorithm.',
        'Social network distance, logistics routing, network delay computation, and any problem reducible to "cheapest path in a nonnegative weighted graph."',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Negative edge weights break the greedy invariant. If a reachable edge has negative cost, Dijkstra can settle a node too early and produce the wrong answer. Bellman-Ford handles negative weights by relaxing all edges V - 1 times, at O(VE) cost. If negative-weight cycles exist, no finite shortest path exists for affected nodes; Bellman-Ford detects this.',
        'Point-to-point queries on huge graphs. Plain Dijkstra radiates outward from the source in all cheap directions. Bidirectional Dijkstra runs two searches (one from source, one from target) and stops when they meet, roughly halving the visited nodes. A* with a good heuristic (Euclidean distance on a map) prunes even more aggressively, often visiting a small fraction of the graph.',
        'Unweighted graphs. If every edge has cost 1, Dijkstra degenerates into BFS with unnecessary heap overhead. Use BFS directly: O(V + E) with a FIFO queue.',
        'All-pairs shortest paths on dense graphs. Running Dijkstra from every node gives O(V(V + E) log V). Floyd-Warshall solves all-pairs in O(V^3) with small constants and handles negative edges. Johnson\'s algorithm uses one Bellman-Ford pass to reweight edges nonnegative, then runs Dijkstra from each node -- best for sparse graphs with negative edges.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Graph: six nodes A-F. Edges with weights: A-B(5), A-C(2), B-D(4), B-E(6), B-F(7), C-D(3), D-E(2), E-F(2). Source: A. Target: F.',
        'Initialize: dist = {A:0, B:inf, C:inf, D:inf, E:inf, F:inf}. Heap: [(0, A)].',
        'Extract A (dist 0). Relax A-B: 0 + 5 = 5 < inf, set dist[B] = 5, parent[B] = A. Relax A-C: 0 + 2 = 2 < inf, set dist[C] = 2, parent[C] = A. Heap: [(2, C), (5, B)].',
        'Extract C (dist 2). Relax C-D: 2 + 3 = 5 < inf, set dist[D] = 5, parent[D] = C. Heap: [(5, B), (5, D)].',
        'Extract B (dist 5, tie with D). Relax B-D: 5 + 4 = 9 > 5, skip. Relax B-E: 5 + 6 = 11 < inf, set dist[E] = 11, parent[E] = B. Relax B-F: 5 + 7 = 12 < inf, set dist[F] = 12, parent[F] = B. Heap: [(5, D), (11, E), (12, F)]. At this moment, B\'s route to F looks best at 12. It will not survive.',
        'Extract D (dist 5). Relax D-E: 5 + 2 = 7 < 11, update dist[E] = 7, parent[E] = D. The path through B to E (cost 11) just lost to the path through C and D (cost 7). Heap: [(7, E), (12, F)].',
        'Extract E (dist 7). Relax E-F: 7 + 2 = 9 < 12, update dist[F] = 9, parent[F] = E. The direct B-F shortcut (cost 12) just lost again. Heap: [(9, F)].',
        'Extract F (dist 9). F is the target -- stop. Trace parents: F <- E <- D <- C <- A. Shortest path: A -> C -> D -> E -> F, total cost 9. The two-hop route A -> B -> F would have cost 12. Fewer edges does not mean cheaper.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'E. W. Dijkstra, "A Note on Two Problems in Connexion with Graphs," Numerische Mathematik, 1959. Three pages, one of the most cited works in computer science. M. L. Fredman and R. E. Tarjan, "Fibonacci Heaps and Their Uses in Improved Network Optimization Algorithms," JACM, 1987, for the O(V log V + E) improvement.',
        'Prerequisites: BFS (the unweighted baseline this algorithm generalizes) and Binary Heap / Priority Queue (the data structure that makes frontier extraction O(log V) instead of O(V)).',
        'Extensions: A* Search adds a heuristic to steer Dijkstra toward a known target. Bellman-Ford handles negative edge weights at O(VE) cost. Floyd-Warshall solves all-pairs shortest paths in O(V^3). Johnson\'s algorithm reweights edges via Bellman-Ford, then runs V Dijkstra passes for sparse graphs with negative edges.',
        'Contrasting alternative: Prim\'s algorithm uses the same priority-queue frontier pattern but solves minimum spanning tree, not shortest paths. The code structure is nearly identical; the key difference is what each extraction finalizes (tree edge vs. shortest distance).',
      ],
    },
  ],
};
