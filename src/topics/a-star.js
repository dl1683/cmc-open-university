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
          ? `Now re-run with the heuristic set to zero: same path, same cost — but Dijkstra settles MORE nodes to find it. The heuristic didn\'t change the answer, it changed how much of the map had to be touched. That\'s why every game\'s pathfinding and every mapping app runs A*: a good compass saves most of the work.`
          : `Now re-run with the straight-line heuristic: same path, same cost, FEWER nodes settled. h(n) prunes the detours before they\'re explored.`}`,
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
      heading: 'How to read the animation',
      paragraphs: [
        'The animation searches a weighted graph from node A (start) to node H (goal). Each node shows its current f score: f = g + h, where g is actual cost paid from A and h is straight-line distance to H.',
        'Active node (highlighted): the frontier node with the lowest f, about to be expanded. Visited nodes (dimmed): already settled -- their shortest path from A is final. Compare highlights (edges and neighbors): the algorithm is relaxing an edge, checking whether routing through the active node gives the neighbor a cheaper g.',
        'Found highlights (at the end): the optimal path, traced back through parent pointers. Nodes visited but not on the final path represent wasted work -- the heuristic\'s job is to minimize that set.',
        'Toggle the heuristic to "zero (becomes Dijkstra)" and rerun. The path and cost are identical, but more nodes are settled. The difference in visited count is the heuristic\'s entire contribution.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Many shortest-path problems carry geometric information that pure graph algorithms ignore. On a road map, a game grid, or a robot\'s workspace, the goal has a position. A search that expands equally in every direction wastes effort on nodes pointing away from the target.',
        'In 1968, Peter Hart, Nils Nilsson, and Bertram Raphael published "A Formal Basis for the Heuristic Determination of Minimum Cost Paths." Their algorithm, A*, keeps Dijkstra\'s cost accounting but adds a heuristic -- an optimistic estimate of remaining cost -- that steers expansion toward the goal. When the heuristic never overestimates (admissible), A* still guarantees the optimal path while skipping most of the graph.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'Dijkstra\'s algorithm expands nodes by cost-so-far (g) alone. It radiates outward from the source in concentric cost shells, completely unaware of where the goal sits. The path it returns is optimal -- every edge weight is accounted for -- but the search pattern is blind.',
        'On a 1,000-by-1,000 grid with start in one corner and goal in the opposite corner, Dijkstra may settle hundreds of thousands of cells before reaching the target. A human looking at the same grid would walk roughly diagonally. Dijkstra cannot, because it has no notion of "toward."',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The problem is not correctness. Dijkstra always finds the optimal path. The problem is wasted expansion. Every settled node not on the final path cost a priority-queue pop, a set of edge relaxations, and a chunk of memory that contributed nothing to the answer.',
        'On a grid with 1,000,000 cells, Dijkstra may explore 800,000 of them to find a path that touches 2,000. When the search runs repeatedly -- every game tick, every route recalculation, every robot replanning cycle -- that 400:1 ratio of wasted work to useful work is the bottleneck.',
        'Greedy best-first search avoids the waste by expanding whichever node looks closest to the goal (minimizing h alone, ignoring g). It is fast and directional, but it ignores cost already paid. Behind a wall or through a maze, greedy search can follow a long detour while a shorter path existed through a less direct route. It has no optimality guarantee.',
        'Dijkstra is blind but correct. Greedy is focused but unreliable. Neither alone solves the real problem: find the optimal path without exploring the entire graph.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Score each frontier node by estimated total path cost: f(n) = g(n) + h(n). g(n) is the cheapest known cost from start to n. h(n) is an estimate of the cheapest cost from n to the goal. Order the open set (priority queue) by f. The next node expanded is always the one sitting on the most promising complete route -- not just the cheapest partial route (Dijkstra) or the one nearest the goal (greedy).',
        'Set h = 0 everywhere: f = g, and A* becomes Dijkstra. Set g = 0: f = h, and A* becomes greedy best-first search. A* is a continuous dial between them, controlled by heuristic quality.',
        'The critical constraint: h must be admissible -- it must never overestimate the true cheapest remaining cost. When h is admissible, f(n) is a lower bound on the cost of any complete path through n. So when the goal reaches the front of the queue, no unseen node can hide a cheaper route: even its optimistic lower bound is already worse.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Two sets track progress. The open set (a priority queue ordered by f) holds frontier nodes not yet expanded. The closed set holds nodes already expanded -- their g values are final.',
        'Initialize: g(start) = 0, g(everything else) = infinity. Insert start into the open set with f = 0 + h(start).',
        'Main loop: pop the node with smallest f from the open set. If it is the goal, trace parent pointers back to start and return the path. Otherwise move it to the closed set and relax each outgoing edge: for each neighbor not in the closed set, compute candidate = g(current) + edge_weight. If candidate < g(neighbor), update g(neighbor), set neighbor\'s parent to current, recompute f(neighbor) = candidate + h(neighbor), and insert or update neighbor in the open set.',
        'Repeat until the goal is popped (success) or the open set empties (no path exists). The open set is typically a binary min-heap, giving O(log n) insert and extract-min. Bookkeeping per node: one g value, one parent pointer, one open/closed flag.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Admissibility proof sketch. Call h*(n) the true cheapest cost from n to the goal. Admissibility means h(n) <= h*(n) for every node n. Then f(n) = g(n) + h(n) <= g(n) + h*(n) = cost of the cheapest path through n. So f is a lower bound on path cost through n.',
        'When A* pops the goal node G, f(G) = g(G) + h(G) = g(G) + 0 = g(G), the actual cost of the path found. Every remaining open node n has f(n) >= f(G) (because the queue is ordered by f and G was the minimum). Since f(n) is a lower bound on the cost of any path through n, no path through any remaining node can beat g(G). The path is optimal.',
        'Consistency (monotonicity) is a stronger property. A consistent heuristic obeys the triangle inequality: for every edge (u, v) with cost c, h(u) <= c + h(v). This means f values along any path are non-decreasing, so once a node is settled, its g is final and it never needs re-expansion. Consistency turns A* into Dijkstra with a tighter frontier. Every consistent heuristic is admissible; the converse is not always true, but most natural geometric heuristics (Euclidean distance, Manhattan distance) are both.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Time depends entirely on heuristic quality. With a perfect heuristic (h = h*), A* expands only nodes on the optimal path: O(d) where d is path length. With h = 0 (Dijkstra), it expands up to all reachable nodes: O((V + E) log V) with a binary heap. Every heuristic between these extremes gives something in between.',
        'In tree-structured search spaces (puzzles, planning), branching factor b and solution depth d give worst-case O(b^d) time and space. A good heuristic shrinks the effective branching factor. Manhattan distance on the 15-puzzle reduces the effective branching factor from about 3 to about 1.5, cutting the search tree by orders of magnitude.',
        'Memory is the practical ceiling. A* stores every node it generates -- the open set, the closed set, g-scores, parent pointers. On a grid with 10 million cells, each node carrying 40 bytes of bookkeeping costs 400 MB. Double the input and the memory doubles. IDA* (iterative deepening A*) trades time for memory by re-running depth-limited searches with increasing f thresholds, using only O(bd) stack space.',
        'On an open 100x100 grid, Manhattan distance typically lets A* expand 5 to 10 times fewer nodes than Dijkstra. The path costs are identical; the work to find them is not.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Game pathfinding. Unity, Unreal, and every major engine decompose the world into a navigation mesh of convex polygons. A* finds the polygon-to-polygon path; a steering layer smooths it. Every RTS, RPG, and open-world game with moving units runs A* or a descendant (D*, Theta*, JPS).',
        'GPS and route planning. Navigation apps search continent-scale road networks. Raw A* on 50 million nodes is too slow for interactive use, so production systems combine A* with contraction hierarchies or arc flags -- precomputation that tightens the heuristic and limits the search frontier to a few thousand nodes.',
        'Robotics motion planning. A* runs over discretized configuration spaces, occupancy grids, and lattice graphs of motion primitives. The heuristic encodes kinematic constraints -- a car cannot turn instantly, so straight-line distance is replaced with Dubins or Reeds-Shepp curve length.',
        'Puzzle solving. The 15-puzzle uses Manhattan distance (sum of each tile\'s taxicab distance to its goal position). Pattern databases for Rubik\'s cube store precomputed costs of partial configurations, giving a strong admissible heuristic over the 4.3 * 10^19 state space.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'High-dimensional spaces. In robotics with 6+ joints, the configuration space has millions of cells per dimension. A* cannot store the open and closed sets. Sampling-based planners (RRT, PRM) replace exhaustive search with random probes.',
        'Memory limits. A* keeps every generated node in memory. On large or infinite search spaces, it runs out of RAM before finding the goal. IDA* fixes this by iterating depth-limited searches, using O(bd) memory, but it re-expands nodes and is slower in wall-clock time. SMA* (simplified memory-bounded A*) drops the least-promising open nodes when memory fills.',
        'Inadmissible heuristics. If h overestimates, A* can return a suboptimal path. Weighted A* (f = g + w*h, w > 1) deliberately overestimates to trade optimality for speed, returning paths at most w times the optimal cost. Games accept this tradeoff; safety-critical routing does not.',
        'Dynamic environments. A* optimizes the graph it is given. If edges change after the search (traffic, moving obstacles, time-dependent weights), the path may be stale. D* Lite and Lifelong Planning A* handle incremental replanning by reusing previous search results.',
        'Weak heuristics. When h provides no useful guidance (close to zero everywhere), A* degenerates to Dijkstra while paying the overhead of computing h at every node. An expensive heuristic (solving a sub-problem per node) can cost more in computation than it saves in pruning.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        '5x5 grid, start at (0,0), goal at (4,4). Walls block cells (1,1), (1,2), (2,3), (3,1). Movement is 4-connected (up/down/left/right), all edge weights 1. Heuristic: Manhattan distance h(r,c) = |r-4| + |c-4|.',
        'Step 1. Open = {(0,0) f=0+8=8}. Pop (0,0), settle it. Neighbors (0,1) and (1,0) both get g=1, h=7, f=8. Open = {(0,1), (1,0)}.',
        'Step 2. Pop (0,1) by tie-break. Neighbor (0,2) gets g=2, h=6, f=8. Neighbor (1,1) is a wall -- skip. Open = {(1,0), (0,2)}.',
        'Step 3. Pop (1,0). Neighbor (2,0) gets g=2, h=6, f=8. Neighbor (1,1) is a wall -- skip.',
        'Steps 4-8. The heuristic pulls expansion toward the bottom-right diagonal. Nodes in the top-left (high h, far from goal) never enter the open set because closer nodes always have lower f. When expansion reaches wall (2,3), A* routes around it: the heuristic does not know about walls, so it tries the direct approach, discovers the blockage, then expands alternatives with the next-lowest f.',
        'Result: A* finds a path of cost 8 after expanding 14 of 21 reachable nodes. Dijkstra (h=0) on the same grid expands all 21. The path is identical; the work is not. On a 50x50 grid with similar obstacle density, A* expands 3-8x fewer nodes.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Hart, Nilsson & Raphael, "A Formal Basis for the Heuristic Determination of Minimum Cost Paths" (IEEE Transactions on Systems Science and Cybernetics, 1968). The original A* paper: introduced f = g + h and proved optimality under admissible heuristics.',
        'Dechter & Pearl, "Generalized Best-First Search Strategies and the Optimality of A*" (Journal of the ACM, 1985). Proved A* is optimally efficient: no other algorithm using the same heuristic can guarantee optimality while expanding fewer nodes.',
        'Prerequisite: Dijkstra\'s Algorithm. A* with h = 0. Understanding Dijkstra first makes the role of the heuristic obvious.',
        'Simpler baseline: BFS. When all edge weights are 1, BFS is optimal and needs no priority queue. The natural starting point for shortest-path thinking.',
        'Data structure: Binary Heap. The priority queue underneath A*\'s open set. O(log n) insert and extract-min make it the standard implementation choice.',
        'Memory-bounded variant: IDA* (Iterative Deepening A*). Repeated depth-limited searches with increasing f thresholds, using O(bd) stack memory instead of storing every generated node. Essential for puzzle solving and planning where A* exhausts RAM.',
      ],
    },
  ],
};

