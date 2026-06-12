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
      heading: 'What it is',
      paragraphs: [
        `A* is Dijkstra's shortest-path algorithm with a compass: instead of exploring the map in every direction equally, it uses a heuristic — an educated guess about remaining distance — to prioritize nodes that point toward the goal. You expand the node with the lowest f = g + h, where g is the cost traveled so far and h is the estimated cost remaining. As long as h never overestimates (called "admissible"), A* finds the same optimal path as Dijkstra but explores far fewer nodes.`,
        `The heuristic is what changes everything. In games like chess or pathfinding in Google Maps, a good heuristic lets the algorithm skip entire regions of the map. On this site, we use straight-line distance (Euclidean distance) as h, which is admissible because the true path weight is at least as large as the straight line. Set h to zero and A* degrades to Dijkstra — the expansion order shifts from goal-aware back to pure cost-minimization, settling more nodes to reach the same answer.`,
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        `Start at the source with g = 0. At each step, pick the unsettled node with the lowest f = g + h. Relax its edges (if you find a cheaper path to a neighbor, update that neighbor's g and record the parent). The moment you settle the goal, backtrack through parent pointers to reconstruct the path.`,
        `The key insight: h(n) tells you "I still have about this much to go." If h is honest (admissible), the first path you find to the goal is guaranteed optimal. But if h underestimates or is zero, you explore more territory before reaching the goal because no node's f score confidently points you toward success. Watch the "with heuristic" run settle far fewer nodes than the "zero heuristic" (Dijkstra) run on the same graph — both reach the goal via the same route, but A* gets there by ignoring detours, while Dijkstra must check them.`,
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        `Time and space depend on the heuristic quality. In the worst case (no heuristic, h = 0), A* is Dijkstra: O((V + E) log V) with a binary heap, where V is vertices and E is edges. With a good heuristic, you settle far fewer nodes — potentially closer to O(log V) if h is very accurate. The trade-off: computing h(n) has a cost (here, one Euclidean distance calculation per node), so the heuristic must be cheap relative to the savings it provides.`,
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        `A* is the standard pathfinding algorithm in every video game, board-game AI, and navigation system. Game developers use hand-tuned heuristics (in a grid, Chebyshev or Manhattan distance; in continuous space, Euclidean). Google Maps, Apple Maps, and most routing engines internally combine A* (or variants like Dijkstra with preprocessing) with traffic data. Robotics uses A* for motion planning: the heuristic is the straight-line distance to the goal configuration, and edges represent valid moves.`,
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        `First misconception: "A* is always faster than Dijkstra." It is not faster on every graph; it is faster *in practice* on goal-directed problems with a good heuristic. A bad or expensive heuristic can slow you down more than you save. Second pitfall: an inadmissible heuristic (one that overestimates) breaks the optimality guarantee; you may find a suboptimal path faster. Third: A* still explores many nodes in an open field with no obstacles — the heuristic helps you skip detours, but if the true shortest path is wide open, Dijkstra and A* settle nearly the same set.`,
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        `After A*, study Dijkstra's Shortest Path to understand what A* optimizes away. Graph BFS covers level-order exploration with no weights. Binary Heap (Priority Queue) is the data structure A* depends on to quickly find the next node to settle. For games, look at minimax or alpha-beta pruning, which use heuristic-like estimates (board evaluation) to skip branches. In modern routing, study the Bellman-Ford algorithm and how preprocessing (like contraction hierarchies) combines with A*-style heuristics.`,
      ],
    },
  ],
};

