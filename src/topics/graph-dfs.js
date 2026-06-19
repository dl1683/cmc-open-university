// Depth-first search on a graph: commit to one path, backtrack when stuck.
// The stack (or recursion) remembers where to resume.

import { graphState, InputError } from '../core/state.js';

export const topic = {
  id: 'graph-dfs',
  title: 'Graph DFS',
  category: 'Data Structures',
  summary: 'Explore a graph by diving deep before backtracking — the stack decides the path.',
  controls: [
    { id: 'target', label: 'Search for node', type: 'select', options: ['G', 'F', 'H'], defaultValue: 'G' },
  ],
  run,
};

// Same network as Graph BFS so students can compare traversal orders directly.
const NODES = [
  { id: 'A', label: 'A', x: 1.0, y: 5.0 }, { id: 'B', label: 'B', x: 3.2, y: 7.5 },
  { id: 'C', label: 'C', x: 3.2, y: 2.5 }, { id: 'D', label: 'D', x: 5.6, y: 8.4 },
  { id: 'E', label: 'E', x: 5.6, y: 5.0 }, { id: 'F', label: 'F', x: 5.6, y: 1.4 },
  { id: 'G', label: 'G', x: 8.2, y: 6.6 }, { id: 'H', label: 'H', x: 8.2, y: 2.8 },
];
const EDGES = [
  ['A', 'B'], ['A', 'C'], ['B', 'D'], ['B', 'E'], ['C', 'E'], ['C', 'F'],
  ['D', 'G'], ['E', 'G'], ['F', 'H'], ['G', 'H'],
].map(([from, to]) => ({ id: `${from}${to}`, from, to }));

const neighbors = (id) => EDGES
  .filter((e) => e.from === id || e.to === id)
  .map((e) => (e.from === id ? e.to : e.from));
const edgeBetween = (a, b) => EDGES.find((e) => (e.from === a && e.to === b) || (e.from === b && e.to === a));

export function* run(input) {
  const target = String(input.target);
  if (!NODES.some((n) => n.id === target)) throw new InputError('Pick a node from the list.');

  const discovered = new Map(); // node -> discovery time
  const finished = new Map();   // node -> finish time
  const parent = new Map();
  let time = 0;

  const snapshot = () => graphState({
    nodes: NODES.map((n) => ({
      ...n,
      note: discovered.has(n.id)
        ? (finished.has(n.id)
          ? `${discovered.get(n.id)}/${finished.get(n.id)}`
          : `${discovered.get(n.id)}/–`)
        : '',
    })),
    edges: EDGES,
  });

  yield {
    state: snapshot(),
    highlight: { active: ['A'] },
    explanation: `DFS explores a graph by committing to one path as deep as possible before backtracking. The engine is a STACK — explicit or via the call stack in recursion. Mission: find ${target} starting from A. Watch the discovery/finish timestamps: they reveal the structure of the search.`,
  };

  // Iterative DFS using an explicit stack.
  // We push {node, neighborIndex} frames to simulate the recursive call stack,
  // which lets us compute accurate discovery and finish times.
  const stack = [{ node: 'A', ni: 0 }];
  const visited = new Set(['A']);
  time++;
  discovered.set('A', time);
  const done = []; // fully finished nodes

  yield {
    state: snapshot(),
    highlight: { active: ['A'] },
    explanation: `Push A onto the stack and mark it discovered (time ${time}). The stack is the memory of where to backtrack. Unlike BFS's queue, LIFO order means we always continue the deepest unfinished path.`,
    invariant: 'Every node on the stack is on the current exploration path from the source.',
  };

  while (stack.length > 0) {
    const frame = stack[stack.length - 1];
    const current = frame.node;
    const nbrs = neighbors(current);

    // Find next unvisited neighbor
    let pushed = false;
    while (frame.ni < nbrs.length) {
      const next = nbrs[frame.ni];
      frame.ni++;
      if (!visited.has(next)) {
        visited.add(next);
        parent.set(next, current);
        time++;
        discovered.set(next, time);
        stack.push({ node: next, ni: 0 });

        if (next === target) {
          // Found the target — reconstruct path
          const pathNodes = [];
          let walk = target;
          while (walk !== undefined) { pathNodes.unshift(walk); walk = parent.get(walk); }
          const pathEdges = pathNodes.slice(1).map((n, i) => edgeBetween(pathNodes[i], n).id);

          yield {
            state: snapshot(),
            highlight: { found: [target], active: [current], visited: done },
            explanation: `Discovered ${target} (time ${discovered.get(target)}) — found it via the path ${pathNodes.join(' → ')}.`,
          };
          yield {
            state: snapshot(),
            highlight: { found: [...pathNodes, ...pathEdges], visited: done },
            explanation: `DFS found a path, but unlike BFS, this path is NOT guaranteed to be the shortest by hop count. DFS commits to depth, so it may find a longer route than necessary. The path ${pathNodes.join(' → ')} has ${pathNodes.length - 1} edge${pathNodes.length - 1 === 1 ? '' : 's'}. For shortest paths in unweighted graphs, use BFS. DFS shines for cycle detection, topological sorting, and problems where you need to explore all reachable nodes with minimal memory.`,
            invariant: 'DFS visits every reachable node exactly once. The stack height never exceeds V.',
          };
          return;
        }

        const edge = edgeBetween(current, next);
        yield {
          state: snapshot(),
          highlight: {
            active: [next],
            compare: [edge.id],
            visited: done,
          },
          explanation: `From ${current}, dive deeper to ${next} (discovery time ${discovered.get(next)}). Push ${next} onto the stack. DFS always picks the deepest unexplored frontier — the stack enforces this by making the most recent push the next to process. Stack: [${stack.map((f) => f.node).join(', ')}].`,
          invariant: 'The stack represents the current path from A to the active node.',
        };
        pushed = true;
        break;
      }
    }

    if (!pushed) {
      // All neighbors visited — backtrack
      stack.pop();
      time++;
      finished.set(current, time);
      done.push(current);
      yield {
        state: snapshot(),
        highlight: {
          active: stack.length > 0 ? [stack[stack.length - 1].node] : [],
          visited: done,
        },
        explanation: `All of ${current}'s neighbors are visited. Finish ${current} (time ${finished.get(current)}) and pop it off the stack — backtrack${stack.length > 0 ? ` to ${stack[stack.length - 1].node}` : ''}. The discovery/finish interval [${discovered.get(current)}, ${finished.get(current)}] captures everything reachable from ${current}. ${stack.length > 0 ? `Stack: [${stack.map((f) => f.node).join(', ')}].` : 'Stack is empty — search is complete.'}`,
        invariant: 'A node is finished only when all its descendants are finished first (parenthesis property).',
      };
    }
  }

  yield {
    state: snapshot(),
    highlight: { visited: done },
    explanation: `DFS explored all reachable nodes without finding ${target}. Every node has a discovery/finish timestamp pair. These timestamps encode the entire DFS tree structure: if [d_u, f_u] contains [d_v, f_v], then v is a descendant of u in the DFS tree.`,
  };
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'Each node displays two numbers separated by a slash: discovery time / finish time. A node with only a discovery time (like "3/–") is currently on the stack — DFS is still exploring its subtree. A node with both numbers (like "3/8") is finished — DFS has explored everything reachable from it and backtracked.',
        'Node colors encode three states. Unvisited nodes have no timestamp — DFS has not reached them. Active nodes (highlighted) are on the stack, forming the current path from the source. Visited/finished nodes have both timestamps and are grayed — DFS is done with them.',
        'The stack contents shown at each step are the current path from source to frontier. When the stack grows, DFS is diving deeper. When it shrinks, DFS is backtracking because a dead end was reached. The finish timestamps always appear in reverse depth order: the deepest node on a path finishes first.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Trémaux invented the idea around 1882 as a maze-solving method: walk forward, mark your path, and when you hit a dead end or a corridor already marked, turn around and backtrack to the last unmarked fork. Nearly a century later, Tarjan (1972) formalized this as depth-first search on general graphs, adding discovery and finish timestamps, edge classification, and showing that a single DFS pass could find strongly connected components in linear time. DFS became the backbone of graph algorithms — cycle detection, topological sort, SCC decomposition, articulation points, and bridges all reduce to properties of a single DFS traversal.',
        'The core need: many graph problems do not care about shortest paths. They care about structure — is there a cycle? What depends on what? Which nodes are mutually reachable? DFS answers all of these in one O(V + E) pass using only O(V) memory for the stack, no matter how wide the graph is.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The natural first instinct for exploring a graph is breadth-first search: use a queue, visit all neighbors at distance 1 before any at distance 2, and expand level by level. BFS finds shortest hop-count paths and works well when the target is shallow or when shortest distance is the goal.',
        'BFS pays for this guarantee with memory. The queue holds the entire frontier — every node at the current distance. On a graph where each node has 10 neighbors, the frontier at depth d can hold 10^d nodes. On a balanced binary tree with a million leaves, the last level alone queues 500,000 nodes. If you never needed shortest paths and only wanted structural properties, that memory is wasted.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'BFS reveals distance but nothing about depth structure. It cannot tell you whether the graph has a cycle, what order to process dependencies in, or which nodes are ancestors versus siblings in the exploration. The queue processes nodes by distance, which answers "how far?" but not "what depends on what?"',
        'BFS also cannot classify edges. When BFS encounters an already-visited node, it knows the node was seen — but not whether it is an ancestor on the current path (indicating a cycle) or a node from a completely different branch (harmless). Cycle detection requires distinguishing "on the current stack" from "already finished." Topological sort requires finish-time ordering. Strongly connected components require both discovery and finish times. BFS provides none of these.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Push the source onto a stack and stamp it with a discovery time. Peek at the top of the stack. If the current node has an unvisited neighbor, push that neighbor, stamp it discovered, and continue. If all neighbors are visited, pop the current node, stamp it finished, and backtrack. The stack is the engine: LIFO order means DFS always continues the deepest unfinished path before anything shallower.',
        'Recursion does the same thing implicitly. A recursive call on a neighbor is a push; returning from that call is a pop. Trémaux’s 1882 maze version uses no call stack but follows the same logic: commit to one corridor, remember where to resume, never enter the same passage twice. The explicit-stack version avoids stack overflow on deep graphs and makes it easy to pause, resume, and inspect the traversal state.',
        'Edge classification falls directly out of the timestamps. When DFS examines an edge (u, v): if v is undiscovered, the edge is a tree edge and v becomes u’s child in the DFS forest. If v is discovered but not yet finished (still on the stack), the edge is a back edge pointing to an ancestor — this proves a cycle exists. If v is already finished with discover(v) > discover(u), the edge is a forward edge skipping down to a descendant already explored. If v is finished with discover(v) < discover(u), the edge is a cross edge linking separate branches. In undirected graphs, only tree edges and back edges can occur because every edge is traversed in both directions.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Every node is discovered exactly once and finished exactly once. The stack ensures a node is not finished until everything reachable from it through unvisited edges has been discovered and finished first. This produces the parenthesis property: for any two nodes u and v, either the interval [discover(u), finish(u)] fully contains [discover(v), finish(v)], or the two intervals are completely disjoint. There is never partial overlap.',
        'The parenthesis property makes DFS a structural X-ray. Containment means ancestor-descendant in the DFS tree. Disjointness means neither is an ancestor of the other. A back edge to a node still on the stack proves a cycle: the stack path from that ancestor to the current node, plus the back edge, forms a closed loop. No back edges means no cycles — exactly the condition for a directed acyclic graph. The white-path theorem completes the picture: v is a descendant of u in the DFS tree if and only if, at the moment u is discovered, there exists a path from u to v consisting entirely of undiscovered nodes.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Time: O(V + E). DFS visits every vertex once and examines every edge once (twice in undirected graphs, once per direction). Space: O(V) for the visited set plus O(V) worst-case for the stack. The stack reaches depth V on a path graph (a single chain of nodes) but holds only about 20 frames on a balanced binary tree with a million nodes.',
        'Doubling the edges doubles the work. Doubling the vertices adds at most one stack frame per vertex. DFS and BFS have identical O(V + E) time, but DFS stores only the current root-to-frontier path while BFS stores the entire level-width frontier. On a binary tree with a million leaves, DFS holds 20 frames; BFS queues 500,000.',
        'Recursive DFS uses the call stack, typically limited to around 10,000 frames. A chain of a million nodes overflows it. The fix is mechanical: replace recursion with an explicit stack on the heap. The cost per node stays constant — one discovery, one finish, one scan of its adjacency list.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'Topological sort: process nodes in reverse finish-time order. A node finishes only after all its descendants finish, so reversing finish order puts every dependency before the things that depend on it. Make, npm, apt, and course prerequisite planners all rely on this.',
        'Cycle detection: a directed graph has a cycle if and only if DFS finds a back edge. Build systems and package managers run DFS on the dependency graph before doing any work. A back edge means circular dependency; they report it instead of deadlocking.',
        'Strongly connected components: Tarjan’s algorithm runs a single DFS with low-link values to find maximal groups of mutually reachable vertices. Kosaraju’s algorithm uses two DFS passes (one on the original graph, one on the transpose). Both run in O(V + E).',
        'Articulation points and bridges: a single DFS pass with low-link tracking identifies vertices and edges whose removal disconnects the graph. Network reliability analysis uses this.',
        'Maze generation: DFS carves corridors by committing to one direction and backtracking at dead ends — Trémaux’s original use case. Backtracking algorithms for N-queens, Sudoku, and SAT solvers are DFS over the search tree of partial assignments. Compiler control-flow analysis uses DFS to find dominators, loops, and unreachable code.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'DFS does not find shortest paths. It may reach a target via a long detour when a two-hop path exists. For shortest unweighted paths, use BFS. For shortest weighted paths, use Dijkstra.',
        'On graphs with high branching factor and shallow targets, DFS can waste time burrowing deep before finding something one level away. Iterative deepening DFS (IDDFS) fixes this by running DFS with increasing depth limits — it combines DFS memory efficiency with BFS’s level-order optimality, at the cost of re-exploring shallow nodes.',
        'Recursive DFS overflows the call stack on deep graphs (millions of nodes in a chain). The explicit-stack conversion is straightforward but a common source of bugs around the timing of discovery and finish events. DFS is also inherently sequential — the stack imposes a total order on exploration, making it harder to parallelize than BFS.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Consider a 6-node directed graph: edges A→B, A→D, B→C, C→A, C→D, D→E, E→F, F→D. DFS from A, visiting neighbors in alphabetical order.',
        'Step 1: Discover A (d=1). Stack: [A]. Push neighbor B. Step 2: Discover B (d=2). Stack: [A, B]. Push neighbor C. Step 3: Discover C (d=3). Stack: [A, B, C]. Examine edge C→A: A is discovered but not finished (on the stack), so C→A is a back edge — cycle detected (A→B→C→A). Examine edge C→D: D is undiscovered, so C→D is a tree edge. Step 4: Discover D (d=4). Stack: [A, B, C, D]. Push neighbor E. Step 5: Discover E (d=5). Stack: [A, B, C, D, E]. Push neighbor F. Step 6: Discover F (d=6). Stack: [A, B, C, D, E, F]. Examine edge F→D: D is discovered but not finished (on the stack), so F→D is a back edge — second cycle (D→E→F→D).',
        'F has no more neighbors. Finish F (f=7), pop. Back to E: no more neighbors. Finish E (f=8), pop. Back to D: no more neighbors. Finish D (f=9), pop. Back to C: no more neighbors. Finish C (f=10), pop. Back to B: no more neighbors. Finish B (f=11), pop. Back to A: examine edge A→D. D is already finished and discover(D)=4 > discover(A)=1, so A→D is a forward edge — A is an ancestor of D in the DFS tree (via the tree path A→B→C→D), and this edge skips down to that descendant. Finish A (f=12), pop. Stack empty.',
        'Final timestamps: A[1/12], B[2/11], C[3/10], D[4/9], E[5/8], F[6/7]. Tree edges: A→B, B→C, C→D, D→E, E→F. Back edges: C→A, F→D (both prove cycles). Forward edge: A→D (skips from ancestor to descendant already explored via a longer tree path). Every interval nests cleanly: A[1/12] contains B[2/11] contains C[3/10] contains D[4/9] contains E[5/8] contains F[6/7]. This is the parenthesis property — a single chain of containment because the DFS tree here is a single path.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Trémaux (~1882) devised the first known depth-first exploration as a maze-solving algorithm. Tarjan (1972, "Depth-First Search and Linear Graph Algorithms") formalized DFS on general graphs, introduced timestamps and edge classification, and used them to find strongly connected components in linear time. Hopcroft and Tarjan (1973, Algorithm 447) gave practical implementations. Cormen, Leiserson, Rivest, and Stein (CLRS, chapters 22–23) cover DFS, topological sort, and SCC algorithms with full proofs.',
        'Study BFS next to understand the queue-vs-stack tradeoff: BFS finds shortest unweighted paths; DFS finds structural properties. Study Topological Sort to see why reversing DFS finish order schedules dependencies correctly. Study Tarjan’s SCC algorithm for the most elegant application of DFS timestamps and low-link values. Study Articulation Points and Bridges for DFS-based network reliability analysis. Review the Stack data structure — DFS is "use a stack to remember where to backtrack" — and Recursion, since recursive DFS is the clearest form and the explicit-stack version is a mechanical translation of it.',
      ],
    },
  ],
};
