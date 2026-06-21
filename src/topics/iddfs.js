// Iterative deepening depth-first search: run DFS with depth limit 0, then 1,
// then 2, … until the goal is found. BFS memory with DFS space.

import { graphState, InputError } from '../core/state.js';

export const topic = {
  id: 'iddfs',
  title: 'Iterative Deepening DFS',
  category: 'Searching',
  summary: 'Run depth-limited DFS with limits 0, 1, 2, … — BFS optimality with DFS memory.',
  controls: [
    { id: 'target', label: 'Search for node', type: 'select', options: ['I', 'G', 'F'], defaultValue: 'I' },
  ],
  run,
};

// A tree with branching factor 3 and depth 3.
// Layout: root at top, children spread horizontally.
const NODES = [
  { id: 'A', label: 'A', x: 5.0, y: 9.0 },
  { id: 'B', label: 'B', x: 2.0, y: 6.5 },
  { id: 'C', label: 'C', x: 5.0, y: 6.5 },
  { id: 'D', label: 'D', x: 8.0, y: 6.5 },
  { id: 'E', label: 'E', x: 1.0, y: 4.0 },
  { id: 'F', label: 'F', x: 2.5, y: 4.0 },
  { id: 'G', label: 'G', x: 4.0, y: 4.0 },
  { id: 'H', label: 'H', x: 5.5, y: 4.0 },
  { id: 'I', label: 'I', x: 7.0, y: 4.0 },
  { id: 'J', label: 'J', x: 8.5, y: 4.0 },
  { id: 'K', label: 'K', x: 0.5, y: 1.5 },
  { id: 'L', label: 'L', x: 1.5, y: 1.5 },
  { id: 'M', label: 'M', x: 3.0, y: 1.5 },
];
const EDGES = [
  ['A', 'B'], ['A', 'C'], ['A', 'D'],
  ['B', 'E'], ['B', 'F'],
  ['C', 'G'], ['C', 'H'],
  ['D', 'I'], ['D', 'J'],
  ['E', 'K'], ['E', 'L'],
  ['F', 'M'],
].map(([from, to]) => ({ id: `${from}${to}`, from, to }));

// For a tree: children in defined order, parent excluded.
const childrenOf = (id) => EDGES
  .filter((e) => e.from === id)
  .map((e) => e.to);
const parentOf = (id) => {
  const edge = EDGES.find((e) => e.to === id);
  return edge ? edge.from : undefined;
};
const edgeBetween = (a, b) =>
  EDGES.find((e) => (e.from === a && e.to === b) || (e.from === b && e.to === a));
export function* run(input) {
  const target = String(input.target);
  if (!NODES.some((n) => n.id === target)) {
    throw new InputError('Pick a node from the list.');
  }

  // Track which nodes have been visited across ALL iterations (for display)
  // and which are visited in the CURRENT iteration.
  const iterVisited = new Set();
  let totalExpansions = 0;

  const snapshot = (notes) => graphState({
    nodes: NODES.map((n) => ({
      ...n,
      note: notes.get(n.id) || '',
    })),
    edges: EDGES,
  });

  yield {
    state: snapshot(new Map()),
    highlight: { active: ['A'] },
    explanation: `Iterative deepening DFS searches a tree by running depth-limited DFS repeatedly: first with limit 0 (only the root), then limit 1 (root + children), then limit 2, and so on. Each iteration is a complete DFS that turns back at the depth limit. Goal: find ${target}. Watch the same shallow nodes get re-expanded in every iteration — that repeated work is the price of using O(bd) memory instead of O(b^d).`,
  };

  // Run DFS with increasing depth limits.
  for (let limit = 0; limit <= 4; limit++) {
    iterVisited.clear();
    const notes = new Map();

    yield {
      state: snapshot(notes),
      highlight: { active: ['A'] },
      explanation: `Iteration ${limit}: run DFS with depth limit ${limit}. Every node at depth <= ${limit} will be explored. Nodes deeper than ${limit} are invisible to this pass.`,
    };

    // Iterative DFS with depth limit using explicit stack.
    const stack = [{ node: 'A', depth: 0, ci: 0 }];
    iterVisited.add('A');
    notes.set('A', `d=0`);
    totalExpansions++;

    let found = false;

    while (stack.length > 0) {
      const frame = stack[stack.length - 1];
      const current = frame.node;
      const children = childrenOf(current);

      if (current === target) {
        // Found the target — reconstruct path.
        const pathNodes = [];
        let walk = target;
        while (walk !== undefined) { pathNodes.unshift(walk); walk = parentOf(walk); }
        const pathEdges = pathNodes.slice(1).map((n, i) => edgeBetween(pathNodes[i], n).id);

        yield {
          state: snapshot(notes),
          highlight: { found: [target], active: stack.map((f) => f.node).filter((n) => n !== target), visited: [...iterVisited].filter((n) => n !== target) },
          explanation: `Found ${target} at depth ${frame.depth} during iteration ${limit}. Total node expansions across all iterations: ${totalExpansions}.`,
        };
        yield {
          state: snapshot(notes),
          highlight: { found: [...pathNodes, ...pathEdges], visited: [...iterVisited].filter((n) => !pathNodes.includes(n)) },
          explanation: `Path: ${pathNodes.join(' → ')} (${pathNodes.length - 1} edge${pathNodes.length - 1 === 1 ? '' : 's'}). This is the shallowest path — IDDFS guarantees it because iteration ${limit} is the first iteration whose depth limit reaches ${target}. Earlier iterations explored all shallower nodes exhaustively without finding it. The re-expansion overhead across ${limit > 0 ? limit : 'zero'} earlier iteration${limit !== 1 ? 's' : ''} is a constant factor: most of the work was in the last iteration.`,
          invariant: 'IDDFS finds the shallowest goal because it exhausts every depth before trying the next.',
        };
        return;
      }

      // Try next unvisited child within depth limit.
      let pushed = false;
      while (frame.ci < children.length) {
        const child = children[frame.ci];
        frame.ci++;
        if (frame.depth + 1 <= limit) {
          iterVisited.add(child);
          notes.set(child, `d=${frame.depth + 1}`);
          totalExpansions++;
          stack.push({ node: child, depth: frame.depth + 1, ci: 0 });

          const edge = edgeBetween(current, child);
          yield {
            state: snapshot(notes),
            highlight: {
              active: [child],
              compare: [edge.id],
              visited: [...iterVisited].filter((n) => n !== child),
            },
            explanation: `Descend to ${child} (depth ${frame.depth + 1}). ${frame.depth + 1 === limit ? `Depth limit ${limit} reached — ${child}'s children are invisible this iteration.` : `Depth ${frame.depth + 1} < limit ${limit}, so ${child}'s children can still be explored.`} Stack: [${stack.map((f) => f.node).join(', ')}].`,
          };
          pushed = true;
          break;
        }
      }

      if (!pushed) {
        // All children explored or beyond depth limit — backtrack.
        stack.pop();
        if (stack.length > 0) {
          yield {
            state: snapshot(notes),
            highlight: {
              active: [stack[stack.length - 1].node],
              visited: [...iterVisited],
            },
            explanation: `Backtrack from ${current} to ${stack[stack.length - 1].node}. ${frame.depth === limit ? `${current} was at the depth limit — its subtree was cut off.` : `All of ${current}'s children are done.`}`,
          };
        }
      }
    }

    if (!found) {
      yield {
        state: snapshot(notes),
        highlight: { visited: [...iterVisited] },
        explanation: `Iteration ${limit} complete. Explored ${iterVisited.size} node${iterVisited.size === 1 ? '' : 's'} with depth limit ${limit}. ${target} not found — it must be deeper. Total expansions so far: ${totalExpansions}. Next: increase the limit to ${limit + 1} and start over from the root.`,
      };
    }
  }

  yield {
    state: snapshot(new Map()),
    highlight: { visited: [...NODES.map((n) => n.id)] },
    explanation: `All iterations complete. ${target} was not found in the tree. Total expansions: ${totalExpansions}.`,
  };
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'Each iteration starts fresh from the root with a new depth limit. The depth label beside each node (d=0, d=1, ...) shows its distance from the root. Active nodes are on the current DFS stack. Visited nodes have been expanded in this iteration.',
        {type: 'callout', text: 'IDDFS buys BFS depth order with DFS memory by proving one depth limit empty before paying for the next.'},
        'Watch the same shallow nodes reappear in every iteration. A appears in iteration 0, then again in iterations 1, 2, and so on. B, C, D appear from iteration 1 onward. This re-expansion is the cost of IDDFS — and the animation makes it visible so you can see why it is acceptable.',
        'When a node is at exactly the depth limit, the algorithm turns back. Its children exist in the tree but are invisible to this pass. The next iteration increases the limit by one and re-explores everything from scratch, reaching one level deeper.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Richard Korf published "Depth-First Iterative-Deepening: An Optimal Admissible Tree Search" in 1985. The paper posed a clean question: can you get BFS\'s guarantee of finding the shallowest goal while using only DFS\'s O(bd) memory? The answer is yes, and the trick is embarrassingly simple — run DFS repeatedly with increasing depth limits.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1f/Depth-first-tree.svg/500px-Depth-first-tree.svg.png', alt: 'Tree labeled by depth-first expansion order', caption: 'A depth-first expansion keeps one root-to-leaf path active, which is the memory behavior IDDFS preserves. Source: Wikimedia Commons: https://commons.wikimedia.org/wiki/File:Depth-first-tree.svg'},
        'BFS guarantees the shallowest goal but stores the entire frontier in a queue. On a tree with branching factor b and goal at depth d, the frontier at depth d holds up to b^d nodes. For b=10 and d=6, that is a million nodes in the queue. DFS uses only O(bd) memory (the current path from root to frontier), but it can dive arbitrarily deep down a wrong branch and miss a shallow goal entirely. IDDFS combines DFS\'s memory with BFS\'s depth-optimality.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'BFS is the natural choice when you want the shallowest goal. It explores every node at depth 0, then depth 1, then depth 2, expanding level by level. The first time it reaches the goal, the path is guaranteed shortest by hop count.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/da/Tic-tac-toe-game-tree.svg/500px-Tic-tac-toe-game-tree.svg.png', alt: 'Top of a tic-tac-toe game tree', caption: 'A game tree shows why frontier size explodes: every ply multiplies the number of states a BFS queue would have to hold. Source: Wikimedia Commons: https://commons.wikimedia.org/wiki/File:Tic-tac-toe-game-tree.svg'},
        'DFS is the natural choice when memory matters. It stores only the current root-to-frontier path — O(bd) space on a tree with branching factor b and maximum depth d. It will find a goal if one exists, but not necessarily the shallowest one.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'BFS memory is exponential. The queue at depth d can hold b^d nodes. A chess game tree with b=35 and d=10 would need 35^10 entries (about 2.7 * 10^15) in the queue. No machine has that much RAM. BFS is correct but physically impossible on large search spaces.',
        'DFS memory is linear but it offers no depth guarantee. On an infinite or very deep tree, DFS can walk down the leftmost branch forever and never find a goal sitting at depth 2 on the right. Even on finite trees, DFS may return a deep goal when a shallow one exists — it has no mechanism to prefer shallower solutions.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Set the depth limit to 0. Run a complete DFS from the root, but whenever a node is at the limit, do not expand its children — treat it as a leaf. If the goal is found, stop. If not, increment the limit and restart DFS from the root.',
        'Each iteration is a standard DFS with one extra check: before pushing a child, verify that the child\'s depth does not exceed the current limit. The stack holds at most (limit + 1) frames, so memory is O(bd) where b is the branching factor and d is the depth limit.',
        'The goal is found during the first iteration whose limit reaches the goal\'s depth. Every shallower depth has already been exhaustively explored and proven goal-free. This is exactly the BFS guarantee: the shallowest goal is found first.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Correctness follows from exhaustive expansion at each depth level. Iteration k explores every node at depth 0 through k. If the shallowest goal is at depth d, iterations 0 through d-1 explored every node at depths 0 through d-1 without finding it, proving no goal exists above depth d. Iteration d then finds the goal — and since DFS visits every node at depth d, it cannot miss it.',
        'The overhead of re-expansion looks wasteful but is bounded. The total number of node expansions across all iterations is: N(0) + N(1) + ... + N(d), where N(k) is the number of nodes at depths 0 through k. On a uniform tree with branching factor b, N(k) = 1 + b + b^2 + ... + b^k = (b^(k+1) - 1)/(b - 1). The last iteration alone contributes N(d). The sum of all previous iterations is N(d-1) + N(d-2) + ... + N(0). This sum is at most N(d) * b/(b-1). For b=10, the overhead factor is 10/9 = 1.11 — only 11% more work than the last iteration. For b=2, it is 2/1 = 2.0 — 100% overhead, meaning double the work. As b grows, the overhead vanishes because the last level dominates.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Time: O(b^d), the same asymptotic cost as BFS. The re-expansion adds a constant factor of b/(b-1). For b=10, IDDFS expands about 11% more nodes than a single BFS pass to the same depth. For b=2, it expands about twice as many. The overhead is never worse than a constant factor because the last iteration dominates.',
        'Space: O(bd). The DFS stack holds at most d+1 frames, each frame stores one node reference. No queue, no visited set across iterations, no frontier. This is the entire point: exponential memory savings over BFS.',
        'Concrete numbers on a tree with b=3 and goal at depth 2. BFS expands 1 + 3 + 9 = 13 nodes. IDDFS: iteration 0 expands 1 node, iteration 1 expands 1 + 3 = 4 nodes, iteration 2 expands 1 + 3 + 9 = 13 nodes. Total: 1 + 4 + 13 = 18 expansions. Overhead: 18/13 = 1.38, or 38% more work — but memory was O(3*2) = 6 instead of O(9) for the BFS frontier.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Game-playing AI. Chess engines combine iterative deepening with alpha-beta pruning. Each iteration searches one ply deeper, and the move ordering from the previous iteration dramatically improves alpha-beta cutoffs in the next. The engine can also stop at any iteration and return the best move found so far — iterative deepening gives anytime behavior.',
        'Puzzle solving. The 15-puzzle, Rubik\'s Cube, and Sokoban solvers use IDA* (iterative deepening A*), which replaces the depth limit with an f-cost threshold. Each iteration runs DFS but turns back when f = g + h exceeds the threshold. IDA* inherits IDDFS\'s O(bd) memory while using a heuristic to cut the effective branching factor.',
        'Pathfinding in large state spaces. When the goal depth is unknown and the branching factor is high, IDDFS is the default uninformed search. It is the textbook recommendation for search problems where BFS runs out of memory.',
        'Theorem provers and logic programming. Prolog\'s depth-first strategy can loop on infinite branches. Iterative deepening Prolog (depth-bounded search with increasing limits) guarantees completeness without abandoning Prolog\'s stack-based execution model.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Low branching factor. When b=2, the overhead is 100% — IDDFS does twice the work of a single pass. On a binary tree, BFS or bidirectional BFS may be preferable if memory allows. The advantage of IDDFS grows with b; it is most compelling when b >= 10.',
        'Known goal depth. If you already know the target is at depth d, a single DFS with limit d finds it without re-expansion. IDDFS pays for not knowing the depth. Use it when the depth is unknown.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/57/Tree_edges.svg/500px-Tree_edges.svg.png', alt: 'Depth-first search tree with tree, back, forward, and cross edges', caption: 'General graphs add edge cases that pure tree IDDFS avoids; cycles and repeated states change the memory story. Source: Wikimedia Commons: https://commons.wikimedia.org/wiki/File:Tree_edges.svg'},
        'Graph search with cycles. On a tree, IDDFS needs no visited set because there are no repeated states. On a general graph, cycles can cause infinite loops within a single iteration. Adding a visited set per iteration restores correctness but uses O(b^d) memory for the set — the same cost as BFS. Path-checking (only avoiding ancestors on the current stack) uses O(bd) memory but may re-expand nodes reached by different paths.',
        'Uniform-cost search problems. When edges have different weights and you want the cheapest path (not just the shallowest), IDDFS does not apply directly. IDA* extends the idea by using cost thresholds instead of depth limits, but that is a different algorithm.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Tree with branching factor 3 and goal I at depth 2. Nodes: A (root), B/C/D (depth 1), E/F/G/H/I/J (depth 2).',
        'Iteration 0 (limit=0): Expand A. A is not the goal. 1 node expanded. Done — increase limit.',
        'Iteration 1 (limit=1): Expand A, then B (depth 1), C (depth 1), D (depth 1). Each depth-1 node is at the limit, so their children are not explored. 4 nodes expanded. Still no I. Done — increase limit.',
        'Iteration 2 (limit=2): Expand A, then B, then E (depth 2), F (depth 2) — backtrack to A. Expand C, then G (depth 2), H (depth 2) — backtrack to A. Expand D, then I (depth 2) — found. 10 nodes expanded this iteration.',
        'Total: 1 + 4 + 10 = 15 expansions. BFS would have expanded 1 + 3 + 9 = 13 nodes to reach depth 2. Overhead: 15/13 = 1.15 (15%). But BFS stored up to 9 nodes in the queue (the full depth-2 frontier); IDDFS stored at most 3 nodes on the stack (the path A-D-I).',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Korf, "Depth-First Iterative-Deepening: An Optimal Admissible Tree Search" (Artificial Intelligence, 1985). Proved IDDFS is asymptotically optimal in time and space among brute-force searches on trees. The paper also introduced IDA* as the heuristic extension.',
        'Prerequisite: Graph DFS — understand the stack-based traversal that IDDFS runs as a subroutine. Prerequisite: Graph BFS — understand the level-order guarantee that IDDFS replicates with less memory.',
        'Extension: A* Search — when you have a heuristic, A* finds optimal paths with an open set instead of brute force. Memory-bounded extension: IDA* — iterative deepening with an f-cost threshold instead of a depth limit, combining IDDFS\'s memory savings with A*\'s heuristic guidance. Contrast: Dijkstra\'s Shortest Path — for weighted graphs where depth does not equal cost.',
      ],
    },
  ],
};
