// A* search: Dijkstra with a sense of direction. A heuristic — a hint of
// the remaining distance — lets it ignore nodes that point away from the
// goal. Set the heuristic to zero and watch it become Dijkstra again.

import { graphState } from '../core/state.js';

export const topic = {
  id: 'a-star',
  title: 'A* Search',
  category: 'Data Structures',
  summary: 'Shortest path with a compass: expand by g + h, and skip everything pointing away from the goal.',
  controls: [
    { id: 'heuristic', label: 'Heuristic h(n)', type: 'select', options: ['straight-line distance', 'zero (becomes Dijkstra)'], defaultValue: 'straight-line distance' },
  ],
  run,
};

// Node positions ARE the geometry: edge weights are at least the straight-line
// distance between endpoints, so the heuristic never overestimates (admissible).
const NODES = [
  { id: 'A', label: 'A', x: 1.0, y: 5.0 }, { id: 'B', label: 'B', x: 3.0, y: 7.5 },
  { id: 'C', label: 'C', x: 3.0, y: 2.5 }, { id: 'D', label: 'D', x: 5.0, y: 8.0 },
  { id: 'E', label: 'E', x: 5.0, y: 5.0 }, { id: 'F', label: 'F', x: 5.0, y: 2.0 },
  { id: 'G', label: 'G', x: 7.0, y: 6.5 }, { id: 'I', label: 'I', x: 7.0, y: 3.0 },
  { id: 'H', label: 'H', x: 9.0, y: 5.0 },
];
const EDGES = [
  { id: 'AB', from: 'A', to: 'B', weight: 4 }, { id: 'AC', from: 'A', to: 'C', weight: 3.5 },
  { id: 'BD', from: 'B', to: 'D', weight: 2.5 }, { id: 'BE', from: 'B', to: 'E', weight: 4 },
  { id: 'CE', from: 'C', to: 'E', weight: 4 }, { id: 'CF', from: 'C', to: 'F', weight: 2.5 },
  { id: 'DG', from: 'D', to: 'G', weight: 3 }, { id: 'EG', from: 'E', to: 'G', weight: 3 },
  { id: 'EI', from: 'E', to: 'I', weight: 3.5 }, { id: 'FI', from: 'F', to: 'I', weight: 2.5 },
  { id: 'GH', from: 'G', to: 'H', weight: 3 }, { id: 'IH', from: 'I', to: 'H', weight: 3 },
];
const GOAL = 'H';

const byId = new Map(NODES.map((n) => [n.id, n]));
const straightLine = (id) => {
  const n = byId.get(id);
  const goal = byId.get(GOAL);
  return Math.hypot(n.x - goal.x, n.y - goal.y);
};
const around = (id) => EDGES
  .filter((e) => e.from === id || e.to === id)
  .map((e) => ({ edge: e, other: e.from === id ? e.to : e.from }));

export function* run(input) {
  const useHeuristic = String(input.heuristic) !== 'zero (becomes Dijkstra)';
  const h = (id) => (useHeuristic ? straightLine(id) : 0);
  const fmt = (x) => (Number.isInteger(x) ? String(x) : x.toFixed(1));

  const g = new Map(NODES.map((n) => [n.id, Infinity]));
  g.set('A', 0);
  const parent = new Map();
  const settled = new Set();

  const snapshot = () => graphState({
    nodes: NODES.map((n) => ({
      ...n,
      note: g.get(n.id) === Infinity ? '' : `f=${fmt(g.get(n.id) + h(n.id))}`,
    })),
    edges: EDGES,
  });

  yield {
    state: snapshot(),
    highlight: { active: ['A'], found: [GOAL] },
    explanation: useHeuristic
      ? `Dijkstra explores outward in every direction — even AWAY from the goal — because it only knows the cost so far (g). A* adds a HEURISTIC h(n): an optimistic estimate of the cost remaining (here: straight-line distance to ${GOAL}). It expands the node with the lowest f = g + h: "cheap so far AND pointing the right way." As long as h never overestimates, the answer is still guaranteed optimal.`
      : `Heuristic set to ZERO: f = g + 0 = g, so this run expands by cost-so-far alone… which is EXACTLY Dijkstra. Watch how many nodes it settles compared to the straight-line-heuristic run — the heuristic is the only difference between them.`,
  };

  while (true) {
    let current = null;
    let bestF = Infinity;
    for (const [id, cost] of g) {
      if (!settled.has(id) && cost + h(id) < bestF) { bestF = cost + h(id); current = id; }
    }
    if (current === null) break;
    settled.add(current);

    if (current === GOAL) {
      const pathNodes = [];
      let walk = GOAL;
      while (walk !== undefined) { pathNodes.unshift(walk); walk = parent.get(walk); }
      const pathEdges = pathNodes.slice(1).map((n, i) => {
        const a = pathNodes[i];
        return EDGES.find((e) => (e.from === a && e.to === n) || (e.from === n && e.to === a)).id;
      });
      yield {
        state: snapshot(),
        highlight: { found: [...pathNodes, ...pathEdges], visited: [...settled].filter((s) => !pathNodes.includes(s)) },
        explanation: `Goal reached: ${pathNodes.join(' → ')} at total cost ${fmt(g.get(GOAL))}, after settling ${settled.size} of ${NODES.length} nodes. ${useHeuristic
          ? `Now re-run with the heuristic set to zero: same path, same cost — but Dijkstra settles MORE nodes to find it. The heuristic didn't change the answer, it changed how much of the map had to be touched. That's why every game's pathfinding and every mapping app runs A*: a good compass saves most of the work.`
          : `Now re-run with the straight-line heuristic: same path, same cost, FEWER nodes settled. h(n) prunes the detours before they're explored.`}`,
        invariant: 'With an admissible heuristic (h never overestimates), A* always returns the optimal path.',
      };
      return;
    }

    yield {
      state: snapshot(),
      highlight: { active: [current], visited: [...settled].filter((s) => s !== current) },
      explanation: `Lowest f is ${current}: f = g + h = ${fmt(g.get(current))} + ${fmt(h(current))} = ${fmt(g.get(current) + h(current))}. ${useHeuristic && h(current) > 0 ? 'Cheap so far AND close to the goal as the crow flies — worth expanding.' : 'Settle it and relax its edges.'}`,
    };

    for (const { edge, other } of around(current)) {
      if (settled.has(other)) continue;
      const candidate = g.get(current) + edge.weight;
      if (candidate < g.get(other)) {
        g.set(other, candidate);
        parent.set(other, current);
        yield {
          state: snapshot(),
          highlight: { active: [current], compare: [edge.id, other], visited: [...settled].filter((s) => s !== current) },
          explanation: `Via ${current}: ${other} now reachable at g=${fmt(candidate)}${useHeuristic ? `, and h(${other})=${fmt(h(other))} more to go by straight line → f=${fmt(candidate + h(other))}` : ''}. Updated.`,
        };
      }
    }
  }
}

export const article = {
  sections: [
    {
      heading: 'Why This Exists',
      paragraphs: [
        'A* exists because shortest-path search often knows more than edge weights. On a road map, a game grid, or a robot workspace, the target has a position. Expanding equally in every direction wastes effort when many nodes clearly point away from the goal. A* uses that extra geometric or domain knowledge without giving up optimality when the heuristic is honest.',
        'The algorithm was introduced by Hart, Nilsson, and Raphael in 1968 and became a standard tool for games, robotics, navigation, puzzle solving, and planning. Its appeal is direct: keep the reliability of Dijkstra-style cost accounting, but add a compass that estimates how much cost remains.',
      ],
    },
    {
      heading: 'Naive Baseline',
      paragraphs: [
        'The obvious baseline is Dijkstra shortest path. Start from the source, always expand the unsettled node with the lowest known cost from the start, and relax outgoing edges. With nonnegative weights it is correct, general, and simple to reason about. If all you know is graph cost, it is the right baseline.',
        'The failure is wasted expansion. Dijkstra has no concept of direction. If the target is east, it may still settle many cheap nodes to the west before reaching the goal. On large maps, grids, and implicit state spaces, that can mean exploring thousands or millions of states that were never plausible parts of the final route.',
      ],
    },
    {
      heading: 'Core Insight',
      paragraphs: [
        'A* adds one number to each frontier node. The algorithm keeps g(n), the cost already paid from the start to node n, and h(n), an estimate of the remaining cost from n to the goal. It expands the node with the smallest f(n) = g(n) + h(n). The frontier is ordered by estimated total route cost, not just cost already spent.',
        'Set h(n) to zero for every node and A* becomes Dijkstra. Use straight-line distance on a map where every path is at least as long as the straight line, and A* keeps the same optimal answer while often touching far fewer nodes. The heuristic does not replace path cost. It guides which pending path deserves attention next.',
      ],
    },
    {
      heading: 'Algorithm Loop',
      paragraphs: [
        'The implementation maintains an open set and usually a closed set. The open set contains discovered frontier nodes ordered by f. The closed set contains nodes whose best route is finalized under the assumptions being used. Each node also stores its best known g score and a parent pointer so the final path can be reconstructed.',
        'The loop is compact. Pop the lowest-f node. If it is the goal, follow parent pointers backward to build the path. Otherwise, relax each outgoing edge. If reaching a neighbor through the current node gives a lower g score, update the neighbor cost, update its parent, recompute f, and keep it in the open set.',
      ],
    },
    {
      heading: 'Heuristic Rules',
      paragraphs: [
        'The safety rule is admissibility. A heuristic is admissible if it never overestimates the true remaining cost to the goal. It can be too low, even zero, but it must not be too high. With an admissible heuristic, A* will not discard a path that could still beat the current best route.',
        'A stronger property is consistency. A consistent heuristic obeys a triangle-inequality style rule: moving from node u to neighbor v should not make the estimated remaining cost drop by more than the edge cost. Consistency prevents settled nodes from needing to be reopened, which makes implementations simpler and closer to Dijkstra behavior.',
      ],
    },
    {
      heading: 'What The Visual Proves',
      paragraphs: [
        'The visual shows two runs over the same graph. With straight-line distance, the frontier is pulled toward the goal because f includes both cost already paid and remaining-distance estimate. With h set to zero, the run becomes Dijkstra and expands more evenly from the start.',
        'The important comparison is not the final path. A correct heuristic should keep the final path and cost the same. The comparison is how much of the graph was touched before the goal was settled. A* earns its keep by reducing explored states while respecting the same shortest-path answer.',
      ],
    },
    {
      heading: 'Why It Works',
      paragraphs: [
        'The proof idea is based on lower bounds. If h(n) never overestimates, then f(n) is a lower bound on the cost of any complete path that goes through n. When the goal is the frontier node with the smallest f, no other open node can hide a cheaper solution, because even its optimistic lower bound is not better.',
        'This is why an overestimating heuristic changes the contract. It may find a path faster, but it can skip a route that looked too expensive only because h was too large. In games that may be acceptable. In routing, robotics safety, or verification tasks, the heuristic must match the required guarantee.',
      ],
    },
    {
      heading: 'Data Structures',
      paragraphs: [
        'A* usually uses a priority queue for the open set. A binary heap is common and gives O(log V) insert and pop operations. The implementation also needs maps for g scores, parent pointers, and membership state. Some languages avoid decrease-key by inserting a new priority entry and ignoring stale entries when popped.',
        'Grid pathfinding can use specialized queues, bitsets, buckets, or jump-point optimizations. Road networks often use preprocessing, landmarks, contraction hierarchies, or bidirectional search. These are not replacements for the A* idea. They are ways to make the frontier and heuristic cheaper or sharper for a particular graph family.',
      ],
    },
    {
      heading: 'Complexity',
      paragraphs: [
        'Worst-case complexity on an explicit graph is no better than Dijkstra: O((V + E) log V) with a binary heap and O(V + E) memory for graph storage, frontier bookkeeping, scores, and parents. If the heuristic is zero or nearly useless, A* may settle almost the same nodes as Dijkstra while doing extra h computations.',
        'The practical win is explored-subgraph reduction. On an open grid, Manhattan or Euclidean distance can focus the search tightly. In a maze with misleading walls, the heuristic may point toward a blocked corridor and still force broad exploration. Big-O describes the ceiling; heuristic quality determines the actual search footprint.',
      ],
    },
    {
      heading: 'Where It Wins',
      paragraphs: [
        'Game engines use A* for movement over grids, waypoint graphs, and navigation meshes. Robotics systems use it over discretized configuration spaces, occupancy grids, and motion primitives. Map routing systems use related ideas with road hierarchies, traffic weights, turn costs, and landmark lower bounds.',
        'Puzzle solvers use admissible heuristics such as misplaced tiles, Manhattan distance, or pattern databases. Planning systems use A* when states are generated on demand instead of stored as a complete graph. In all of these cases, the search space is large enough that directional guidance matters.',
      ],
    },
    {
      heading: 'Failure Modes',
      paragraphs: [
        'A* is not automatically faster. A weak heuristic gives little guidance. An expensive heuristic can cost more than it saves. An overestimating heuristic can return a suboptimal path. A stale heuristic can mislead a system whose weights changed because of traffic, terrain, dynamic obstacles, or updated permissions.',
        'The graph model can also be wrong. Missing obstacles, one-way edges, turn penalties, terrain costs, time windows, or collision constraints are not fixed by a clever heuristic. A* optimizes the graph it is given. If that graph is a poor model of the world, the path can be mathematically optimal and practically bad.',
      ],
    },
    {
      heading: 'Study Next',
      paragraphs: [
        'Study Dijkstra Shortest Path first, because A* with h = 0 is exactly that baseline. Then read Graph BFS for equal-cost search, Binary Heap for the frontier, Priority Queue patterns, Admissible and consistent heuristics in path planning texts, and Big-O Growth for worst-case framing.',
        'For spatial systems, continue with Delaunay Triangulation and Voronoi Dual, Convex Hull Monotone Chain, Quadtree Spatial Index, R-Tree, Navigation Mesh concepts, Value Iteration, Beam Search, and RRT-Star Motion Planning Tree. The broader lesson is to score partial candidates with a bound that is useful enough to prune work but honest enough to preserve the guarantee.',
      ],
    },
  ],
};
