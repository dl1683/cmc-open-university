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
      heading: `What it is`,
      paragraphs: [
        `A* is shortest-path search with a compass. It keeps g(n), the cost from the start to a node, and h(n), an estimate of the remaining cost to the goal. It expands the node with the smallest f(n) = g(n) + h(n). Hart, Nilsson, and Raphael introduced the algorithm in 1968, and it became a standard tool for robotics, games, and route planning because a good heuristic avoids exploring large irrelevant regions.`,
        `Set h to zero and the method becomes Dijkstra's Shortest Path. Use an honest lower-bound heuristic, such as straight-line distance on a road map whose edges cannot be shorter than straight lines, and it still returns an optimal path while usually touching fewer nodes.`,
      ],
    },
    {
      heading: `How it works`,
      paragraphs: [
        `Start with the source at g = 0. Put it in a priority queue ordered by f = g + h. Pop the lowest-f node, relax its outgoing edges, and update any neighbor whose g score improves. Store parent pointers so the final route can be reconstructed when the goal is settled. The open set contains frontier nodes; the closed set contains nodes whose best route is already known under the chosen assumptions.`,
        `The heuristic controls behavior. An admissible heuristic never overestimates the true remaining cost, preserving optimality. A consistent heuristic also obeys a triangle-inequality style rule, which prevents needing to reopen settled nodes. A Binary Heap (Priority Queue) is the common implementation choice, although specialized grid pathfinders sometimes use buckets or jump-point optimizations.`,
      ],
    },
    {
      heading: `Cost and complexity`,
      paragraphs: [
        `Worst-case time is no better than Dijkstra's Shortest Path on an explicit graph: O((V + E) log V) with a binary heap, and O(V + E) memory for scores, parents, and frontier bookkeeping. In implicit search spaces, the number of expanded states can still grow exponentially with path depth if the heuristic gives little guidance.`,
        `The payoff is empirical search reduction, not a new asymptotic guarantee for every graph. On a 2D grid, Manhattan distance can focus the frontier tightly toward the target. On a maze with misleading corridors, it may still explore a large region. Big-O Growth Rates tells only part of the story; heuristic quality decides the constant and the explored subgraph.`,
      ],
    },
    {
      heading: `Real-world uses`,
      paragraphs: [
        `Game engines use A* for NPC movement on grids, navmeshes, and waypoint graphs. Robotics planners use it over discretized configuration spaces. Map routing systems combine it with hierarchical preprocessing, traffic estimates, turn penalties, and landmark heuristics. Puzzle solvers use admissible heuristics such as misplaced tiles or Manhattan distance for sliding puzzles. Beam Search vs Greedy shows a related idea in AI decoding: score partial candidates and expand the promising ones first, though beam search does not give the same optimality guarantee.`,
      ],
    },
    {
      heading: `Pitfalls and misconceptions`,
      paragraphs: [
        `The biggest misconception is that A* is automatically faster. With h = 0, it is exactly Dijkstra-style expansion. With an expensive or weak heuristic, the overhead can outweigh the savings. With an overestimating heuristic, it may return a suboptimal path faster, which is sometimes acceptable in games but not in systems that require optimal routing.`,
        `Another mistake is ignoring graph representation. On a grid, diagonal moves change which heuristic is admissible: Manhattan distance works for four-neighbor movement; Chebyshev or octile distance fits common eight-neighbor movement. If costs change over time, stale heuristics and cached paths must be invalidated.`,
      ],
    },
    {
      heading: `Study next`,
      paragraphs: [
        `Review Dijkstra's Shortest Path to understand the h = 0 baseline. Graph BFS covers the equal-cost case. Binary Heap (Priority Queue) explains the frontier. Delaunay Triangulation & Voronoi Dual and Convex Hull: Monotone Chain show geometry structures that often feed navigation meshes and spatial preprocessing. Value Iteration (Reinforcement Learning) offers a different way to propagate costs through a state space, and Beam Search vs Greedy shows heuristic ranking when optimality is intentionally traded for speed.`,
      ],
    },
  ],
};
