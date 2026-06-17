// Dijkstra's algorithm: BFS grown up. When edges have costs, "fewest hops"
// stops being "cheapest" — so always expand the cheapest known node instead.

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

// A weighted map. Note the trap: A→B→F looks short (2 edges) but costs 12;
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
      note: dist.get(n.id) === Infinity ? 'd=∞' : `d=${dist.get(n.id)}`,
    })),
    edges: EDGES,
  });

  yield {
    state: snapshot(),
    highlight: { active: ['A'] },
    explanation: `Now the edges have COSTS — kilometers, milliseconds, dollars. BFS would find the fewest edges, but look: A→B→F is 2 edges costing 5+7=12, while the long way round can be cheaper. Dijkstra's fix: track the best-known cost to every node (d=…), and always expand the CHEAPEST unsettled node — greedy, and provably right (as long as no edge cost is negative).`,
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
        explanation: `${target} is settled at cost ${dist.get(target)} — and the cheapest route is ${pathNodes.join(' → ')}${pathNodes.includes('B') ? '' : ', NOT the 2-edge shortcut through B'}. This algorithm (with a Binary Heap serving the "cheapest unsettled node" in O(log n)) runs your GPS, internet packet routing (OSPF), and game pathfinding. Greedy works here because settling cheap nodes first means no later discovery can undercut them.`,
        invariant: 'Once a node is settled, its distance is final — no cheaper route to it can ever appear.',
      };
      return;
    }

    yield {
      state: snapshot(),
      highlight: { active: [current], visited: [...settled].filter((s) => s !== current) },
      explanation: `The cheapest unsettled node is ${current} (d=${dist.get(current)}) — settle it. (A real implementation pops this from a Binary Heap instead of scanning.) Its distance can never improve again; now RELAX its edges: does going through ${current} make any neighbor cheaper?`,
    };

    for (const { edge, other } of around(current)) {
      if (settled.has(other)) continue;
      const candidate = dist.get(current) + edge.weight;
      const better = candidate < dist.get(other);
      yield {
        state: snapshot(),
        highlight: { active: [current], compare: [edge.id, other], visited: [...settled].filter((s) => s !== current) },
        explanation: `Via ${current}, reaching ${other} costs ${dist.get(current)} + ${edge.weight} = ${candidate}. Current best for ${other}: ${dist.get(other) === Infinity ? '∞ (never reached)' : dist.get(other)}. ${better ? `Better — update d(${other})=${candidate} and remember the route came through ${current}.` : 'Not better — keep the old route.'}`,
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
      heading: `Why This Exists`,
      paragraphs: [
        `Dijkstra's algorithm exists because "near" in a graph often means cheap, not few hops. In an unweighted graph, Graph BFS is enough: the first time BFS reaches a node, it has found a path with the fewest edges. But road networks, packet routes, game maps, logistics graphs, and dependency-cost graphs do not treat every edge as equal. One road might be short but slow, one network link might have high latency, and one terrain move might cost more energy than several easy moves.`,
        `The algorithm finds minimum-cost paths from one source to every reachable node when all edge weights are nonnegative. It keeps a tentative best distance for each node, repeatedly chooses the unsettled node with the smallest tentative distance, and relaxes its outgoing edges. The result is a shortest-path tree: each reachable node gets a final distance and a parent pointer that reconstructs the cheapest route from the source.`,
        `Edsger Dijkstra described the algorithm in 1959. Its lasting value is the proof that a local greedy choice is safe under the right condition. Nonnegative weights mean a path cannot become cheaper by taking more edges after it has already reached a more expensive frontier.`,
      ],
    },
    {
      heading: `Why The Obvious Approach Fails`,
      paragraphs: [
        `The first obvious approach is to try every route from the source to the destination and keep the cheapest. That is not viable. Even small graphs can contain exponentially many simple paths, and graphs with cycles contain infinitely many walks unless the search forbids revisiting nodes. Exhaustive enumeration solves the wrong problem by doing far more work than shortest paths require.`,
        `The second obvious approach is to reuse BFS. That works only when every edge has the same cost. If A to B to F uses two edges with costs 5 and 7, its total cost is 12. A longer route A to C to D to E to F with edge costs 2, 3, 2, and 2 costs only 9. BFS would prefer the two-edge path because it is shorter in hops. Dijkstra orders the frontier by accumulated cost instead.`,
        `The third tempting shortcut is greedy by edge: always take the cheapest outgoing edge from the current node. That fails because a cheap first edge can lead into an expensive dead end, while a slightly more expensive first edge can open a much cheaper overall route. Dijkstra is greedy, but its greedy choice is global over the frontier: choose the unsettled node with the smallest known source-to-node distance, not the locally cheapest next edge.`,
      ],
    },
    {
      heading: `Core Mechanism`,
      paragraphs: [
        `Initialize distance[source] = 0 and every other distance to infinity. Initialize parent pointers as empty. Maintain a set of settled nodes whose shortest distance is final, and a priority queue of unsettled candidates keyed by tentative distance.`,
        `Each iteration removes the unsettled node u with the smallest tentative distance. That node is settled. For every edge u -> v with weight w, compute candidate = distance[u] + w. If candidate is smaller than distance[v], update distance[v] and set parent[v] = u. This edge update is called relaxation. It is the only operation that improves the algorithm's knowledge.`,
        `When the algorithm settles the target, the target's distance is final and the route can be reconstructed by following parent pointers backward from target to source. If the goal is all-pairs shortest paths, Dijkstra is run from many sources or replaced by an algorithm designed for that workload. If the goal is one destination, the algorithm can stop as soon as that destination is settled.`,
      ],
    },
    {
      heading: `Why It Works`,
      paragraphs: [
        `The correctness invariant is finality. When a node u is the unsettled node with the smallest tentative distance, distance[u] is the true shortest distance from the source. Suppose a cheaper path to u existed. That path would have to leave the settled region at some edge x -> y and eventually reach u. The node y would be unsettled at that moment, and because all weights are nonnegative, the cost to y would be no greater than the cost of the alleged cheaper path to u. That would make y's tentative distance smaller than u's, contradicting the choice of u.`,
        `This is why nonnegative weights matter. Once every remaining route must add zero or positive cost, the cheapest frontier node cannot be undercut later. Negative edges break that reasoning. A path could appear expensive at first, then use a negative edge to reduce the cost of a node already settled. Dijkstra's "final" label would no longer be trustworthy.`,
        `Relaxation preserves the best-known witness. distance[v] is always the cost of some discovered path from the source to v, or infinity if no path has been found. When relaxation improves it, parent[v] records the last step of a cheaper discovered path. When relaxation does not improve it, the current witness remains better.`,
      ],
    },
    {
      heading: `Worked Example`,
      paragraphs: [
        `Use source A and target F. The direct-looking route A -> B -> F has cost 5 + 7 = 12. Another route A -> C -> D -> E -> F has cost 2 + 3 + 2 + 2 = 9. BFS would see two hops versus four hops and pick the wrong route for weighted costs.`,
        `Dijkstra starts with A at distance 0. Relaxing A sets B to 5 and C to 2. The cheapest unsettled node is C, so C is settled next. Relaxing C sets D to 5. Now B and D both have distance 5; either can be settled first depending on tie policy. If B is settled, it offers E at 11 and F at 12. If D is settled, it improves E to 7. Then E is settled and improves F to 9. When F is settled, the parent chain gives F <- E <- D <- C <- A, so the path is A -> C -> D -> E -> F with total cost 9.`,
        `Notice that the algorithm did not need to enumerate every path. It kept only the best known distance to each node and used the priority queue to decide which tentative result had become safe.`,
      ],
    },
    {
      heading: `Implementation Guidance`,
      paragraphs: [
        `Use adjacency lists for sparse graphs. Each node stores outgoing edges and weights. For undirected graphs, store each edge in both directions or make the neighbor iteration explicitly symmetric. Keep distance and parent arrays or maps keyed by node id. Use a Binary Heap (Priority Queue), Pairing Heap, Radix Heap, or another priority structure depending on weight type and performance needs.`,
        `Many JavaScript implementations avoid decrease-key by pushing a new queue entry whenever a distance improves. That is fine if stale entries are ignored. When popping (node, queuedDistance), compare queuedDistance with the current distance[node]. If they differ, skip the entry because a better one was pushed later. Without this check, the algorithm may do extra work or relax from outdated distances.`,
        `Be explicit about numeric behavior. Infinity is a convenient initial distance, but large integer weights can exceed Number's safe integer range. If exact integer path costs matter, use BigInt or constrain the weight domain. Also decide how to handle zero-weight edges, unreachable nodes, directed versus undirected edges, and target early exit before the code is buried inside an application.`,
        `For path reconstruction, update the parent only when a strictly better distance is found. If equal-cost paths matter, store multiple parents or apply a deterministic tie policy. Otherwise the shortest distance may be correct while the chosen path varies across runs or heap implementations.`,
      ],
    },
    {
      heading: `Cost And Tradeoffs`,
      paragraphs: [
        `With a simple array scan to find the cheapest unsettled node, Dijkstra takes O(V^2 + E) time. That can be reasonable for dense graphs or small teaching examples. With adjacency lists and a binary heap, the common bound is O((V + E) log V). If duplicate queue entries are pushed instead of decrease-key, the heap can hold O(E) entries, but the implementation is simpler and often fast enough.`,
        `Space is O(V + E) for the graph plus O(V) for distances, parents, and settled state, plus priority-queue storage. For road-like sparse graphs, the heap version is usually much better than O(V^2). For graphs with small nonnegative integer weights, specialized queues such as buckets or radix heaps can improve constants or asymptotic behavior.`,
        `The tradeoff is that plain Dijkstra explores outward in all cheap directions from the source. If there is a single target and a good admissible heuristic is available, A* Search can guide the frontier toward the target. If many queries are served on a mostly static road network, production systems often add preprocessing, contraction hierarchies, landmarks, caching, or domain-specific routing constraints.`,
      ],
    },
    {
      heading: `Where It Matters`,
      paragraphs: [
        `Network routing protocols such as OSPF compute shortest paths over link-state graphs. Map and logistics systems use shortest-path algorithms over road segments, travel times, restrictions, and turn costs. Games use weighted movement graphs when terrain types have different costs. Robotics planners use weighted graphs for time, energy, risk, or clearance. Compilers and program-analysis tools use shortest-path variants when costs encode transformations or dataflow facts.`,
        `Dijkstra also clarifies neighboring algorithms. Prim's Algorithm also uses a priority queue and grows a frontier, but it optimizes the total cost of connecting all nodes in a minimum spanning tree, not the path cost from one source. BFS is Dijkstra with every edge weight equal to 1 and a FIFO queue replacing the priority queue. A* is Dijkstra plus a heuristic estimate of remaining cost.`,
      ],
    },
    {
      heading: `Failure Modes`,
      paragraphs: [
        `The biggest failure mode is negative weights. If any reachable edge has negative cost, Dijkstra can settle a node too early and return a wrong answer. Use Bellman-Ford-style relaxation for negative edges, and remember that negative cycles mean no finite shortest path exists for affected nodes.`,
        `The second failure is using a graph model whose weights do not match reality. A map route weighted only by distance may ignore traffic, turns, one-way streets, road closures, and vehicle restrictions. A network route weighted only by latency may ignore capacity or policy. Dijkstra optimizes exactly the weights it is given, not the user's unstated preference.`,
        `The third failure is wrong early exit. It is safe to stop when the target is settled, not merely when the target is first discovered. Discovery gives a tentative path; settlement proves finality. Returning on first discovery recreates the BFS mistake in weighted form.`,
        `The fourth failure is assuming it is always the right graph algorithm. Equal weights call for Graph BFS. Topological shortest paths on a DAG can be solved by processing topological order. All-pairs workloads may call for repeated Dijkstra, Johnson's algorithm, Floyd-Warshall, or specialized preprocessing depending on graph size and density.`,
      ],
    },
    {
      heading: `Study Next`,
      paragraphs: [
        `Study Graph BFS first to understand the unweighted baseline and why a FIFO queue works only when all edges have equal cost. Study Binary Heap (Priority Queue) for the data structure that makes cheapest-frontier selection efficient. Study A* Search for goal-directed shortest paths with an admissible heuristic. Study Prim's Algorithm to compare a similar frontier pattern solving a different optimization problem. Study Radix Heap for nonnegative integer-key priority queues. Study Big-O Growth Rates if the O(V^2) versus O((V + E) log V) distinction is not yet intuitive.`,
      ],
    },
  ],
};
