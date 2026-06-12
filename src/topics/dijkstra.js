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
      heading: `What it is`,
      paragraphs: [
        `Dijkstra's algorithm finds minimum-cost paths from one source to every reachable node in a graph whose edge weights are nonnegative. Edsger Dijkstra described it in 1959 after thinking about a shortest-route problem between Dutch cities. The move is greedy: repeatedly settle the unsettled node with the smallest known distance, then improve its neighbors through edge relaxation.`,
        `This is what Graph BFS becomes when edges have prices. BFS treats every edge as cost 1, so fewest hops equals lowest cost. Once edges represent seconds, dollars, risk, or distance, a two-edge route can be worse than a five-edge route. The algorithm keeps the best known cost to each node and a parent pointer so the winning route can be reconstructed.`,
      ],
    },
    {
      heading: `How it works`,
      paragraphs: [
        `Initialize every distance to infinity except the source, which is 0. Put reachable candidates in a priority structure ordered by distance. Pop the cheapest unsettled node; its distance is now final. For each outgoing edge, compute candidate = distance(current) + edge weight. If that candidate beats the neighbor's current distance, update the neighbor and remember current as its parent.`,
        `The proof rests on nonnegative weights. When the cheapest unsettled node is selected, every alternative route to it would have to pass through another unsettled node whose distance is already no smaller, then add a nonnegative edge. That route cannot improve the answer. A Binary Heap (Priority Queue) makes the cheapest-node selection efficient; a plain Queue would lose the cost ordering.`,
      ],
    },
    {
      heading: `Cost and complexity`,
      paragraphs: [
        `If you scan all unsettled nodes to find the cheapest one, time is O(V^2 + E). With a binary heap and adjacency lists, the usual bound is O((V + E) log V). Some implementations push duplicate heap entries instead of decreasing keys; the asymptotic shape is similar but the heap may hold O(E) entries. Distance and parent maps take O(V) space, plus the graph storage and priority queue.`,
        `Negative edges break the greedy finality proof. A later negative edge could make an already settled node cheaper. Use Bellman-Ford-style relaxation for negative weights, and avoid negative cycles entirely because no finite shortest path exists there. Big-O Growth Rates explains why the heap version matters on sparse road-like graphs.`,
      ],
    },
    {
      heading: `Real-world uses`,
      paragraphs: [
        `Network routing protocols such as OSPF run shortest-path-first calculations over link-state graphs. Mapping systems use variants plus preprocessing, traffic models, and A* Search-style heuristics. Games use it when movement costs differ by terrain. Robotics planners use weighted graphs for energy, risk, or time. Prim's Algorithm for minimum spanning trees looks similar because it also grows a frontier with a priority queue, but it optimizes total connection cost, not path cost from one source.`,
      ],
    },
    {
      heading: `Pitfalls and misconceptions`,
      paragraphs: [
        `Do not use it merely because the input is a graph. If every edge has equal cost, Graph BFS is simpler and faster. If the graph is a dependency DAG, Topological Sort answers ordering, not route cost. If the graph has negative edges, this greedy method can return wrong answers.`,
        `Another practical pitfall is forgetting stale priority-queue entries. If a node's distance improves after an older, worse entry was pushed, popping the stale entry later must be ignored. Production code usually checks whether the popped distance still equals the current best distance before relaxing edges.`,
      ],
    },
    {
      heading: `Study next`,
      paragraphs: [
        `Study Graph BFS for the unweighted version, then Binary Heap (Priority Queue) for the data structure that makes the frontier fast. A* Search adds a heuristic to reduce search around a goal. Prim's Algorithm reuses the priority-queue frontier for spanning trees. Queue and Big-O Growth Rates fill in the implementation and scaling background.`,
      ],
    },
  ],
};
