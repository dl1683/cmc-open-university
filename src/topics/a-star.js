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
        'The animation searches a weighted graph from node A (start) to node H (goal). Each node displays its current f score, where f = g + h. g is the actual cost paid so far from A. h is the straight-line distance from that node to H -- the heuristic estimate of remaining cost.',
        'Active node (highlighted): the frontier node with the lowest f, about to be expanded. Visited nodes (dimmed): already settled, meaning their shortest path from A is final. Compare highlights (edges and neighbors): the algorithm is relaxing an edge, testing whether routing through the active node gives the neighbor a cheaper g value.',
        'Found highlights (at the end): the optimal path, traced back through parent pointers. Nodes visited but not on the final path represent wasted work. The heuristic\'s job is to minimize that set.',
        'Toggle the heuristic to \'zero (becomes Dijkstra)\' and rerun. The path and cost stay identical, but more nodes get settled. The difference in visited count is the heuristic\'s entire contribution: same answer, less work.',
        {type: 'callout', text: 'A star is Dijkstra with a lower-bound compass: g preserves optimal cost accounting while h spends expansion budget toward the goal.'},
        {type: 'image', src: './assets/gifs/a-star.gif', alt: 'Animated walkthrough of the a star visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Many shortest-path problems carry geometric information that pure graph algorithms throw away. On a road map, a game grid, or a robot\'s workspace, the goal has a physical position. A search that expands equally in every direction wastes effort on nodes pointing away from the target.',
        'In 1968, Peter Hart, Nils Nilsson, and Bertram Raphael published \'A Formal Basis for the Heuristic Determination of Minimum Cost Paths.\' Their algorithm, A*, keeps Dijkstra\'s exact cost accounting but adds a heuristic -- an optimistic estimate of remaining cost -- that steers expansion toward the goal. When the heuristic never overestimates (a property called admissibility), A* still guarantees the optimal path while skipping most of the graph.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'Dijkstra\'s algorithm is the standard tool for shortest paths in weighted graphs. It expands nodes by cost-so-far (g) alone, radiating outward from the source in concentric cost shells. It has no idea where the goal sits. The path it returns is optimal -- every edge weight is accounted for -- but the search pattern is blind.',
        'On a 1,000-by-1,000 grid with start in one corner and goal in the opposite corner, Dijkstra may settle hundreds of thousands of cells before reaching the target. A human looking at the same grid would walk roughly diagonally. Dijkstra cannot do this because it has no concept of \'toward.\'',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'Dijkstra\'s correctness is not the problem. It always finds the optimal path. The problem is wasted expansion. Every settled node not on the final path cost a priority-queue pop, a set of edge relaxations, and a chunk of memory -- all contributing nothing to the answer.',
        'On a grid with 1,000,000 cells, Dijkstra may explore 800,000 of them to find a path that touches 2,000. When the search runs repeatedly -- every game tick, every route recalculation, every robot replanning cycle -- that 400:1 ratio of wasted work to useful work is the bottleneck.',
        'Greedy best-first search attacks the waste from the opposite direction. It expands whichever node looks closest to the goal (minimizing h alone, ignoring g). It is fast and directional, but it ignores cost already paid. Behind a wall or through a maze, greedy search can follow a long detour when a shorter path existed through a less direct route. It offers no optimality guarantee.',
        'Dijkstra is blind but correct. Greedy is focused but unreliable. Neither alone solves the real problem: find the optimal path without exploring the entire graph.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Score each frontier node by estimated total path cost: f(n) = g(n) + h(n). g(n) is the cheapest known cost from start to n -- exact, based on edges already traversed. h(n) is an estimate of the cheapest cost from n to the goal -- optimistic, based on geometry or domain knowledge. Order the open set (the priority queue of unexpanded nodes) by f. The next node expanded is always the one sitting on the most promising complete route, not just the cheapest partial route (Dijkstra) or the nearest to the goal (greedy).',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/8/85/Astar_progress_animation.gif', alt: 'A star search expanding a grid frontier toward a goal', caption: 'A star expansion shows how f = g + h steers the frontier without abandoning cost accounting. Source: Wikimedia Commons, Subh83, CC BY 3.0.'},
        'Set h = 0 everywhere and f = g: A* becomes Dijkstra. Set g = 0 and f = h: A* becomes greedy best-first search. A* is a continuous dial between them, controlled by heuristic quality.',
        'The critical constraint: h must be admissible, meaning it must never overestimate the true cheapest remaining cost. When h is admissible, f(n) is a lower bound on the cost of any complete path through n. So when the goal reaches the front of the queue, no unseen node can hide a cheaper route -- even its optimistic lower bound is already worse than the path in hand.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Two data structures track progress. The open set is a priority queue ordered by f, holding frontier nodes not yet expanded. The closed set holds nodes already expanded, whose g values are final.',
        'Initialize: set g(start) = 0 and g(every other node) = infinity. Insert start into the open set with f = 0 + h(start).',
        'Main loop: pop the node with smallest f from the open set. If it is the goal, trace parent pointers back to start and return the path. Otherwise move it to the closed set, then relax each outgoing edge. For each neighbor not in the closed set, compute candidate = g(current) + edge_weight. If candidate < g(neighbor), update g(neighbor), set neighbor\'s parent to current, recompute f(neighbor) = candidate + h(neighbor), and insert or update neighbor in the open set.',
        'Repeat until the goal is popped (path found) or the open set empties (no path exists). The open set is typically a binary min-heap, giving O(log n) insert and extract-min. Bookkeeping per node: one g value, one parent pointer, one open/closed flag.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Call h*(n) the true cheapest cost from n to the goal. Admissibility means h(n) <= h*(n) for every node n. Then f(n) = g(n) + h(n) <= g(n) + h*(n) = cost of the cheapest complete path through n. So f(n) is always a lower bound on the real path cost through n.',
        'When A* pops the goal node G, f(G) = g(G) + h(G) = g(G) + 0 = g(G), the actual cost of the path found. Every remaining open node n has f(n) >= f(G), because the queue is ordered by f and G was the minimum. Since f(n) is a lower bound on cost through n, no path through any remaining node can beat g(G). The path is optimal.',
        'Consistency (also called monotonicity) is a stronger property. A consistent heuristic obeys the triangle inequality: for every edge (u, v) with cost c, h(u) <= c + h(v). This guarantees that f values along any path are non-decreasing, so once a node is settled, its g is final and it never needs re-expansion. Consistency turns A* into Dijkstra with a tighter frontier. Every consistent heuristic is admissible; the converse is not always true, but most natural geometric heuristics (Euclidean distance, Manhattan distance) satisfy both properties.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Time depends entirely on heuristic quality. With a perfect heuristic (h = h*), A* expands only nodes on the optimal path: O(d) where d is path length. With h = 0 (Dijkstra), it expands up to all reachable nodes: O((V + E) log V) with a binary heap. Heuristics between these extremes land somewhere in between. Double the grid from 100x100 to 200x200 and the worst case quadruples (four times the nodes), but a good heuristic keeps the expanded set much smaller than the full grid.',
        'In tree-structured search spaces (puzzles, planning), branching factor b and solution depth d give worst-case O(b^d) time and space. A good heuristic shrinks the effective branching factor. Manhattan distance on the 15-puzzle reduces it from about 3 to about 1.5, cutting the search tree by orders of magnitude.',
        'Memory is the practical ceiling. A* stores every node it generates -- open set, closed set, g-scores, parent pointers. On a grid with 10 million cells, each node carrying 40 bytes of bookkeeping costs 400 MB. Double the input and the memory doubles. IDA* (iterative deepening A*) trades time for memory by re-running depth-limited searches with increasing f thresholds, using only O(bd) stack space.',
        'Concrete comparison: on an open 100x100 grid with Manhattan distance, A* typically expands 5 to 10 times fewer nodes than Dijkstra. The path costs are identical. The work to find them is not.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Game pathfinding. Unity, Unreal, and every major engine decompose the game world into a navigation mesh of convex polygons. A* finds the polygon-to-polygon path; a steering layer smooths it into natural movement. Every RTS, RPG, and open-world game with moving units runs A* or a descendant such as D*, Theta*, or Jump Point Search (JPS).',
        'GPS and route planning. Navigation apps search continent-scale road networks with 50+ million nodes. Raw A* is too slow for interactive use at that scale, so production systems combine A* with contraction hierarchies or arc flags -- precomputation that tightens the heuristic and limits the search frontier to a few thousand nodes per query.',
        'Robotics motion planning. A* runs over discretized configuration spaces, occupancy grids, and lattice graphs of motion primitives. The heuristic encodes kinematic constraints: a car cannot turn instantly, so straight-line distance is replaced with Dubins or Reeds-Shepp curve length to maintain admissibility.',
        'Puzzle solving. The 15-puzzle uses Manhattan distance as its heuristic -- the sum of each tile\'s taxicab distance to its goal position. Pattern databases for Rubik\'s cube store precomputed costs of partial configurations, giving a strong admissible heuristic over the 4.3 * 10^19 state space.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'High-dimensional spaces. In robotics with 6+ joints, the configuration space has millions of cells per dimension. A* cannot store the open and closed sets for a space that large. Sampling-based planners (RRT, PRM) replace exhaustive grid search with random probes.',
        'Memory limits. A* keeps every generated node in memory. On large or infinite search spaces, it runs out of RAM before finding the goal. IDA* fixes this by iterating depth-limited searches with increasing f thresholds, using O(bd) memory, but it re-expands nodes and is slower in wall-clock time. SMA* (simplified memory-bounded A*) drops the least-promising open nodes when memory fills.',
        'Inadmissible heuristics. If h overestimates the true remaining cost, A* can return a suboptimal path. Weighted A* (f = g + w*h, w > 1) deliberately overestimates to trade optimality for speed, returning paths at most w times the optimal cost. Games accept this tradeoff; safety-critical routing does not.',
        'Dynamic environments. A* optimizes the graph as it exists at search time. If edges change afterward (traffic, moving obstacles, time-dependent weights), the path may be stale. D* Lite and Lifelong Planning A* handle incremental replanning by reusing previous search results rather than starting from scratch.',
        'Weak heuristics. When h provides no useful guidance (close to zero everywhere), A* degenerates to Dijkstra while paying the overhead of computing h at every node. Conversely, an expensive heuristic that solves a sub-problem per node can cost more in computation than it saves in pruning.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Setup: 5x5 grid, start at (0,0), goal at (4,4). Walls block cells (1,1), (1,2), (2,3), and (3,1). Movement is 4-connected (up, down, left, right), all edge weights 1. Heuristic: Manhattan distance, h(r,c) = |r - 4| + |c - 4|.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/5/5d/AstarExampleEn.gif', alt: 'Animated A star example on a grid with obstacles', caption: 'A second A star trace makes the worked example easier to follow step by step. Source: Wikimedia Commons, CC0 1.0.'},
        'Step 1. Open = {(0,0) with f = 0 + 8 = 8}. Pop (0,0) and settle it. Neighbors (0,1) and (1,0) both get g = 1, h = 7, f = 8. Open = {(0,1), (1,0)}.',
        'Step 2. Pop (0,1) by tie-break. Neighbor (0,2) gets g = 2, h = 6, f = 8. Neighbor (1,1) is a wall -- skip it. Open = {(1,0), (0,2)}.',
        'Step 3. Pop (1,0). Neighbor (2,0) gets g = 2, h = 6, f = 8. Neighbor (1,1) is a wall -- skip it again.',
        'Steps 4 through 8. The heuristic pulls expansion toward the bottom-right diagonal. Nodes in the top-left have high h and never enter the open set because closer nodes always produce lower f. When expansion reaches the wall at (2,3), A* routes around it: the heuristic does not know about walls, so it tries the direct approach first, discovers the blockage, then expands alternatives with the next-lowest f.',
        'Result: A* finds a path of cost 8 after expanding 14 of 21 reachable nodes. Dijkstra (h = 0) on the same grid expands all 21. The path is identical; the work is not. On a 50x50 grid with similar obstacle density, A* typically expands 3 to 8 times fewer nodes.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Hart, Nilsson & Raphael, \'A Formal Basis for the Heuristic Determination of Minimum Cost Paths\' (IEEE Transactions on Systems Science and Cybernetics, 1968). The original A* paper. It introduced f = g + h and proved optimality under admissible heuristics.',
        'Dechter & Pearl, \'Generalized Best-First Search Strategies and the Optimality of A*\' (Journal of the ACM, 1985). Proved that A* is optimally efficient: no other algorithm using the same heuristic can guarantee optimality while expanding fewer nodes.',
        'Prerequisite: Dijkstra\'s Algorithm. A* with h = 0. Understanding Dijkstra first makes the role of the heuristic obvious.',
        'Simpler baseline: BFS. When all edge weights are 1, BFS finds the shortest path without needing a priority queue. It is the natural starting point for shortest-path thinking.',
        'Data structure: Binary Heap. The priority queue underneath A*\'s open set. O(log n) insert and extract-min make it the standard implementation choice.',
        'Memory-bounded variant: IDA* (Iterative Deepening A*). Repeated depth-limited searches with increasing f thresholds, using O(bd) stack memory instead of storing every generated node. Essential for puzzle solving and planning where A* exhausts RAM.',
      ],
    },
  ],
};

