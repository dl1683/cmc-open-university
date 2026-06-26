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
        'Six nodes (A through F) sit on a weighted graph. Each node carries a label d=... that tracks the cheapest known cost to reach it from the source A. Initially d(A) = 0 and every other node shows d=inf, meaning no route has been found yet.',
        {
          type: 'callout',
          text: 'Dijkstra is BFS with the frontier ordered by total known cost instead of hop count.',
        },
        'The highlighted node is the one currently being settled -- it has the smallest tentative distance among all unsettled nodes. In a real implementation a min-heap returns this node in O(log V) time. Dimmed nodes are already settled: their distances are final and can never improve. When an edge flashes, the algorithm is performing a relaxation check: it computes dist[active] + edge weight and compares it to the neighbor\'s current distance.',
        'If the new value is smaller, the neighbor\'s label updates and a parent pointer records the route. If not, nothing changes. Relaxation is the only operation that improves distances. Every other part of the algorithm -- extraction, settling, iteration -- exists to decide which relaxations to attempt and in what order.',
        'At the end, the green path traces parent pointers from the target back to A. The critical moment to watch: the two-hop route A-B-F costs 5 + 7 = 12, but the four-hop route A-C-D-E-F costs 2 + 3 + 2 + 2 = 9. The longer path wins because Dijkstra measures cost, not hops. That reversal is the entire point of the algorithm.',
        {type: 'image', src: './assets/gifs/dijkstra.gif', alt: 'Animated walkthrough of the dijkstra visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'In 1956, Edsger Dijkstra needed a demonstration program for the ARMAC computer in Amsterdam. He chose shortest-path computation on a 64-city road map and designed the algorithm in about twenty minutes at a cafe terrace, without pencil or paper. The resulting three-page paper, "A Note on Two Problems in Connexion with Graphs" (Numerische Mathematik, 1959), became one of the most cited works in computer science.',
        'The problem it solves: given a graph where every edge carries a nonnegative cost -- kilometers, milliseconds, dollars, energy -- find the cheapest path from a source node to every reachable node. Road networks have distances, packet networks have latencies, game maps have terrain penalties. In all of these, "nearest" means lowest accumulated cost, not fewest edges traversed.',
        'The output is a shortest-path tree rooted at the source. Each reachable node stores a final distance and a parent pointer. Following parent pointers backward from any node reconstructs the cheapest route to it. This tree structure is the backbone of GPS navigation, internet routing protocols, and game AI pathfinding.',
        'Before Dijkstra, shortest-path algorithms either enumerated paths (exponential) or relied on matrix methods (cubic in the number of nodes). Dijkstra showed that a single greedy pass -- always settle the cheapest node -- produces correct results in near-linear time with a good priority queue. The insight was so clean that it spawned an entire family of algorithms: A*, Bellman-Ford extensions, contraction hierarchies, and hub labeling all descend from or contrast against Dijkstra.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'Breadth-first search (BFS) solves shortest paths when every edge has the same cost. BFS uses a FIFO queue: when a node is discovered, it goes to the back of the queue, and nodes are processed front-to-back. Because every edge adds exactly one unit of distance, processing nodes layer by layer guarantees that the first time BFS reaches a node, it has found the path with the fewest hops.',
        'BFS runs in O(V + E) time, uses O(V) space for the queue and visited set, and requires no heap. For unweighted graphs -- social network friend-distance, maze solving with uniform step cost, web crawling by link depth -- BFS is the correct and optimal algorithm.',
        'The implementation is also straightforward. Mark the source as visited, enqueue it, then loop: dequeue a node, inspect each neighbor, enqueue any unvisited neighbor and mark it visited. Parent pointers recorded during enqueue let you reconstruct the shortest path. No comparison of costs is needed because all costs are implicitly 1.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'BFS treats every edge as cost 1. The moment edges carry different weights, hop count and total cost diverge. In this animation\'s graph, the two-hop path A-B-F costs 5 + 7 = 12. The four-hop path A-C-D-E-F costs 2 + 3 + 2 + 2 = 9. BFS would declare A-B-F the winner because it has fewer edges. It would overshoot the true cheapest path by 33%.',
        'The structural failure: a FIFO queue preserves discovery order, but discovery order no longer reflects accumulated cost. A node discovered in two hops through expensive edges can be costlier than one discovered in four hops through cheap edges. Processing nodes in discovery order means you might settle an expensive node before a cheaper route to it has even been found.',
        'Brute-force enumeration is worse. A graph with V nodes can have up to (V-1)! simple paths between two nodes. A graph with cycles has infinitely many walks. Even for modest sizes -- say 20 nodes with average degree 4 -- exhaustive path enumeration is computationally infeasible. You need a strategy that finds the cheapest path without examining all of them.',
        'You could try running BFS and then correcting: discover all paths, pick the cheapest. But "discover all paths" is the exponential enumeration you were trying to avoid. The problem demands an algorithm that makes irrevocable decisions -- settling nodes permanently -- while guaranteeing those decisions are correct. That requires a different queue discipline.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Replace the FIFO queue with a priority queue (min-heap) keyed on tentative distance from the source. Instead of processing nodes in discovery order, always extract and finalize the node with the smallest accumulated cost. Because all edge weights are nonnegative, any future path to this node must pass through nodes with equal or greater tentative cost, and adding nonnegative edges to those costs can only make the total larger. The smallest tentative distance is therefore safe to lock in permanently.',
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/57/Dijkstra_Animation.gif/250px-Dijkstra_Animation.gif',
          alt: 'Dijkstra algorithm animation showing a weighted graph frontier expanding from the source',
          caption: 'Dijkstra frontier expansion on a weighted graph. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Dijkstra_Animation.gif.',
        },
        'This single substitution -- priority queue for FIFO queue -- transforms BFS into Dijkstra. The FIFO queue enforced "fewest hops first." The priority queue enforces "cheapest cost first." Everything else -- the relaxation step, the parent pointers, the loop structure -- remains nearly identical.',
        'The nonnegative-weight requirement is not a limitation but a structural contract. It is what makes the greedy choice irrevocable. If an edge could subtract cost, a longer detour through a more expensive intermediate node might circle back and undercut a node you already settled. The greedy extraction would be premature and the output would be wrong. This is exactly the scenario that Bellman-Ford is designed to handle.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Initialization: set dist[source] = 0 and dist[v] = infinity for every other node v. Clear all parent pointers. Insert the source into a min-heap with priority 0. The heap represents the frontier -- nodes that have been reached but not yet settled.',
        'Main loop: extract the node u with the smallest tentative distance from the heap. Mark u as settled. For each outgoing edge (u, v) with weight w, compute candidate = dist[u] + w. If candidate < dist[v], then routing through u gives a cheaper path to v than anything found so far: update dist[v] = candidate, set parent[v] = u, and insert v into the heap with its new priority (or decrease its key if the heap supports that operation). This update is called relaxation, borrowed from the physical metaphor of a spring snapping to a shorter length.',
        'Termination: if you only need the shortest path to one target, stop as soon as that target is extracted from the heap -- its distance is final. If you need shortest paths to all reachable nodes, continue until the heap is empty. At that point, dist[v] holds the true shortest distance for every reachable v, and following parent pointers from any v back to the source reconstructs the optimal route.',
        'Implementation detail: many textbook heaps do not support decrease-key efficiently. A common workaround is lazy deletion: insert a new entry for v with the updated distance, and skip stale entries (where the extracted distance exceeds the current dist[v]) when they surface. This uses more heap space but avoids the complexity of a decrease-key heap. Both approaches produce the same output.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Claim: when node u is extracted from the min-heap, dist[u] equals the true shortest-path distance from the source to u. This is the greedy invariant, and the entire correctness argument rests on it.',
        'Proof by contradiction. Suppose some cheaper path P to u exists at the moment u is extracted. P starts at the source (which is settled) and ends at u (which is unsettled). Therefore P must cross at least one boundary from a settled node x to an unsettled node y. When x was settled, the edge (x, y) was relaxed, so dist[y] <= dist[x] + weight(x, y). The remainder of P from y to u traverses only nonnegative edges, so cost(P) >= dist[y]. But u was extracted because dist[u] is the minimum tentative distance among all unsettled nodes, meaning dist[u] <= dist[y]. Combining: cost(P) >= dist[y] >= dist[u]. P is not cheaper. Contradiction.',
        'The proof hinges entirely on "nonnegative edges" in one step: the claim that the sub-path from y to u cannot subtract cost. If even one edge along that sub-path were negative, cost(P) could drop below dist[y], and the greedy extraction of u would be premature. This is not a corner case -- it is a structural impossibility that the algorithm relies on at every single extraction.',
        'A second property follows: once settled, a node\'s distance never changes. No future relaxation can improve it because every future relaxation originates from a node with equal or greater tentative distance, and adding a nonnegative edge weight cannot produce a smaller total. This monotonicity is what makes the algorithm terminate: each extraction is final, so at most V extractions occur.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'With a binary heap: O((V + E) log V) time. Each of the V extract-min operations costs O(log V). Each of the up-to-E relaxations may trigger a heap insert or decrease-key, each costing O(log V). Space is O(V + E) for the graph representation plus O(V) for distances, parent pointers, and the heap. For a road network with V = 10,000 intersections and E = 30,000 road segments, that is roughly 40,000 heap operations times log2(10,000) ~ 14, about 560,000 comparisons. Fast on any modern machine.',
        'With an unsorted array (no heap): O(V^2 + E) time. Each extraction scans all V entries to find the minimum, costing O(V) per extraction and O(V^2) total. Relaxations are O(1) each since you just update the array. This wins on dense graphs where E approaches V^2, because the O(V^2) extraction cost matches the edge count and you avoid log-factor overhead per relaxation.',
        'With a Fibonacci heap: O(V log V + E) time. Decrease-key is O(1) amortized, so all E relaxations cost O(E) total rather than O(E log V). Extract-min is still O(log V) amortized. This is the theoretically optimal bound for Dijkstra. In practice, Fibonacci heaps have large constant factors and complex bookkeeping, so binary heaps or pairing heaps usually win for real-world graph sizes up to millions of nodes.',
        'Scaling intuition: on sparse graphs (E ~ V), doubling V roughly doubles the work with a binary heap since log V grows negligibly. A road network growing from 10,000 to 20,000 intersections increases heap operations from ~40K to ~80K, and log V from ~14 to ~15. The work roughly doubles, not quadruples. With the array version, doubling V quadruples the extraction cost -- the difference between O(V log V) and O(V^2) becomes dramatic at scale.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'GPS navigation. Road networks are sparse weighted graphs with millions of intersections. Google Maps, Apple Maps, and OpenStreetMap routing engines use Dijkstra as the foundation, augmented by preprocessing techniques like contraction hierarchies and hub labeling that precompute shortcuts to accelerate queries from seconds to microseconds. Edge weights encode travel time, distance, or fuel cost depending on the routing mode.',
        'Internet routing. OSPF (Open Shortest Path First), one of the most widely deployed interior gateway protocols, runs Dijkstra on link-state graphs. Each router floods its local link costs to every other router in the autonomous system. Then each router independently runs Dijkstra to compute a forwarding table: for each destination network, the table records which next-hop neighbor lies on the cheapest path. A topology change triggers a new Dijkstra computation across every affected router.',
        'Game pathfinding. Terrain tiles with different movement costs -- road = 1, forest = 2, swamp = 4, mountain = impassable -- form a weighted grid graph. Dijkstra finds the optimal path from a unit to its destination. A* extends Dijkstra by adding an admissible heuristic (typically Euclidean or Manhattan distance to the goal) that biases the search toward the target, pruning nodes that are geometrically far away. A* is structurally Dijkstra with a modified priority: f(v) = dist[v] + h(v) instead of f(v) = dist[v].',
        'Beyond these marquee applications, Dijkstra appears in network delay estimation, logistics fleet routing, VLSI chip wire routing, social network proximity (where edge weights encode interaction frequency), compiler register allocation (interference graphs with spill costs), and any domain where the problem reduces to cheapest path in a nonnegative weighted graph.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Negative edge weights. A single negative edge can break the greedy invariant. Suppose edge (B, C) has weight -10: settling B at dist 5 seems correct, but later discovering the path A-C-B with a negative-weight detour could yield dist(B) = -3. Dijkstra would never find this because B is already settled. Bellman-Ford handles negative weights by relaxing all edges V - 1 times at O(VE) cost. If a negative-weight cycle is reachable, no finite shortest path exists; Bellman-Ford detects this by checking for further improvements on a V-th pass.',
        'Point-to-point queries on massive graphs. Plain Dijkstra expands outward from the source in all cheap directions, visiting many nodes irrelevant to the target. On a continental road network (tens of millions of nodes), a single Dijkstra query can visit millions of nodes. Bidirectional Dijkstra launches two searches -- one from source, one from target -- and terminates when they meet, roughly halving the search space. A* with Euclidean heuristic prunes even further, often visiting under 1% of the graph.',
        'Unweighted graphs. When every edge costs 1, Dijkstra degenerates into BFS with unnecessary heap overhead. BFS processes nodes in O(V + E) with a simple FIFO queue and no log factor. Using Dijkstra on an unweighted graph is correct but wasteful -- like sorting a list that is already sorted.',
        'All-pairs shortest paths on dense graphs. Running Dijkstra from each of V nodes costs O(V(V + E) log V). Floyd-Warshall solves all-pairs in O(V^3) with tiny constants and no heap, and handles negative edges too. For sparse graphs with negative edges, Johnson\'s algorithm runs one Bellman-Ford pass to reweight all edges nonnegative, then launches V Dijkstra passes -- combining the best of both.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Graph: six nodes A-F. Edges: A-B(5), A-C(2), B-D(4), B-E(6), B-F(7), C-D(3), D-E(2), E-F(2). Source: A. Target: F. Initialize dist = {A:0, B:inf, C:inf, D:inf, E:inf, F:inf}. Heap contains (0, A).',
        'Extract A (dist 0). Relax A-B: 0 + 5 = 5 < inf, so dist[B] = 5, parent[B] = A. Relax A-C: 0 + 2 = 2 < inf, so dist[C] = 2, parent[C] = A. Heap: [(2, C), (5, B)]. Two neighbors reached; C is cheaper despite B being listed first in the edge list.',
        'Extract C (dist 2). Only unsettled neighbor via C-D: 2 + 3 = 5 < inf, so dist[D] = 5, parent[D] = C. Heap: [(5, B), (5, D)]. Node D is reachable at cost 5 through C. Note that B also has dist 5 -- a tie. The algorithm can break ties arbitrarily without affecting correctness.',
        'Extract B (dist 5). Relax B-D: 5 + 4 = 9 > 5 (current dist[D]), skip -- the route through C is already cheaper. Relax B-E: 5 + 6 = 11 < inf, so dist[E] = 11, parent[E] = B. Relax B-F: 5 + 7 = 12 < inf, so dist[F] = 12, parent[F] = B. Heap: [(5, D), (11, E), (12, F)]. At this point, B\'s two-hop route to F (cost 12) is the best known. It will not survive.',
        'Extract D (dist 5). Relax D-E: 5 + 2 = 7 < 11, so dist[E] = 7, parent[E] = D. The route through B (cost 11) just lost to the route through C-D (cost 7). Heap: [(7, E), (12, F)]. This is the first visible payoff of the greedy strategy: settling cheap nodes first lets their cheap onward edges propagate before expensive routes get committed.',
        'Extract E (dist 7). Relax E-F: 7 + 2 = 9 < 12, so dist[F] = 9, parent[F] = E. The two-hop shortcut A-B-F (cost 12) just lost again. Heap: [(9, F)]. The four-hop route A-C-D-E-F now leads at cost 9.',
        'Extract F (dist 9). F is the target -- stop. Trace parent pointers: F <- E <- D <- C <- A. Shortest path: A -> C -> D -> E -> F, total cost 9. The two-hop route A -> B -> F would have cost 12, which is 33% more expensive. Fewer edges does not mean cheaper -- that is the lesson this algorithm exists to teach.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'E. W. Dijkstra, "A Note on Two Problems in Connexion with Graphs," Numerische Mathematik, 1959. Three pages long, one of the most cited papers in computer science. M. L. Fredman and R. E. Tarjan, "Fibonacci Heaps and Their Uses in Improved Network Optimization Algorithms," JACM, 1987, for the O(V log V + E) improvement. T. H. Cormen, C. E. Leiserson, R. L. Rivest, C. Stein, Introduction to Algorithms (CLRS), Chapter 24, for the standard textbook treatment with correctness proof.',
        'Prerequisites: BFS (the unweighted baseline this algorithm generalizes) and Binary Heap / Priority Queue (the data structure that makes frontier extraction O(log V) instead of O(V)). Understanding both is essential -- Dijkstra is literally BFS with a heap swap, and the heap\'s properties are what make the complexity bounds work.',
        'Direct extensions: A* Search adds an admissible heuristic h(v) to steer Dijkstra toward a known target, reducing visited nodes without sacrificing optimality. Bellman-Ford handles negative edge weights at O(VE) cost by relaxing all edges V - 1 times. Floyd-Warshall solves all-pairs shortest paths in O(V^3). Johnson\'s algorithm reweights edges via one Bellman-Ford pass then runs V Dijkstra passes -- best for sparse graphs with negative edges.',
        'Structural twin: Prim\'s minimum spanning tree algorithm uses the same priority-queue frontier pattern but extracts the cheapest edge to an unsettled node rather than the cheapest total distance. The code is nearly identical; the semantic difference is what gets finalized at each step (tree edge vs. shortest distance). Studying both side by side reveals how a single data structure -- the priority queue -- solves two fundamentally different graph problems.',
      ],
    },
  ],
};
