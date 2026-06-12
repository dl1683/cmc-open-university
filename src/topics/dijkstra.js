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
      heading: 'What it is',
      paragraphs: [
        `Dijkstra's algorithm finds the cheapest path from a source to any reachable node in a weighted graph (a graph where edges have costs). Breadth-first search finds the path with the fewest hops, but if edges have different costs — kilometers, time, money — the fewest hops may not be the cheapest. Dijkstra replaces BFS's queue with a greedy rule: always expand the unsettled node with the lowest known cost. This guarantees that the first time you settle a node, you have found its cheapest path.`,
        `The algorithm maintains two pieces of state: the best-known distance to each node (initialized to infinity for all but the source) and a parent pointer to reconstruct paths. It repeatedly selects the cheapest unsettled node, settles it (marking its distance as final), then relaxes its outgoing edges: for each neighbor, it checks if going through the just-settled node provides a cheaper path, and if so, updates the neighbor's distance.`,
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        `Initialize all distances to infinity except the source, which is 0. Then repeat: find the unsettled node with the smallest distance, settle it, and for each unsettled neighbor of that node, compute the cost of reaching it via the just-settled node (settled node's distance + edge weight). If this cost is better than the neighbor's current best, update the neighbor's distance and parent.`,
        `The greedy strategy works because of a key invariant: once a node is settled, its distance is final. No future discovery can find a cheaper path to a settled node because all unsettled nodes have distance greater than or equal to the settled node's distance, so any path through them would be more expensive. This guarantees correctness. In practice, a binary heap (priority queue) selects the cheapest unsettled node in O(log n) instead of scanning all unsettled nodes, reducing the total time complexity.`,
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        `With a naive implementation (scanning for the cheapest unsettled node each iteration), Dijkstra runs in O(V^2 + E) with V nodes and E edges. With a binary heap for the priority queue, it is O((V + E) log V). The space complexity is O(V) for the distance and parent maps. Dijkstra fails on graphs with negative edge weights — the greedy strategy can miss cheaper paths because settling a node early might prevent discovering a better path through a negative edge. For those graphs, use the Bellman-Ford algorithm instead.`,
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        `GPS navigation systems use Dijkstra (or a variant like A*) to compute shortest routes, where edge weights are distances or travel times. Internet routers use OSPF (Open Shortest Path First), which is Dijkstra's algorithm on a graph of networks. Game pathfinding uses variants of Dijkstra to find optimal character movement. Flight planning systems use it to find cheap ticket combinations. Social networks might use it to find the minimum-cost connection between two people (where cost is social distance or barrier to contact). Network optimization and resource allocation both rely on cheapest-path algorithms to reduce costs or latency.`,
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        `The biggest mistake is using Dijkstra on a graph with negative edge weights — it will give wrong answers because the greedy "settle the cheapest node" strategy breaks. For negative weights, use Bellman-Ford. Another trap is confusing Dijkstra with BFS: BFS is simpler and faster for unweighted graphs, but Dijkstra is necessary when edges have costs. Failing to use a priority queue and instead scanning for the cheapest unsettled node each iteration makes the algorithm O(V^2), which is prohibitively slow on large graphs. A subtle bug arises if you relax edges without checking whether a node is settled: you might process a node multiple times or miss the settlement invariant. Finally, assuming the path with the fewest hops is the cheapest leads to wrong results in weighted graphs.`,
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        `Study Binary Heap (Priority Queue), which is essential for efficient Dijkstra implementation. Explore Graph BFS to understand the simpler unweighted case. Learn A* pathfinding, which is Dijkstra with a heuristic for faster search in games. Study the Bellman-Ford algorithm for graphs with negative edge weights. Understand the call stack in Recursion to see how pathfinding algorithms maintain call frames during exploration.`,
      ],
    },
  ],
};

