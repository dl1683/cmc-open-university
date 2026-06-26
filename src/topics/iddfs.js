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
    { heading: 'How to read the animation', paragraphs: [
        'Each pass starts at the root with a depth limit. Depth is the number of edges from the root, so the root has depth 0. Active nodes are on the current DFS stack, and visited nodes have been expanded during the current limit.',
        {type: 'callout', text: 'IDDFS buys BFS depth order with DFS memory by proving one depth limit empty before paying for the next.'},
        'When a node is exactly at the limit, the algorithm turns back even if children exist. The safe inference rule is that after limit k finishes without a goal, no goal exists at depth k or less. The repeated shallow visits are the price paid for small memory.',
      
        {type: 'image', src: './assets/gifs/iddfs.gif', alt: 'Animated walkthrough of the iddfs visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},],
    },
    { heading: 'Why this exists', paragraphs: [
        'Search problems often need the shallowest solution. Breadth-first search gives that guarantee, but it stores the whole frontier. Depth-first search stores only one path, but it can dive past a shallow goal.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1f/Depth-first-tree.svg/500px-Depth-first-tree.svg.png', alt: 'Tree labeled by depth-first expansion order', caption: 'A depth-first expansion keeps one root-to-leaf path active, which is the memory behavior IDDFS preserves. Source: Wikimedia Commons: https://commons.wikimedia.org/wiki/File:Depth-first-tree.svg'},
        'Iterative deepening depth-first search exists to combine those two properties on trees. It runs depth-limited DFS at limit 0, then 1, then 2, and so on. Richard Korf analyzed this as an optimal admissible tree search in 1985.',
      ], },
    { heading: 'The obvious approach', paragraphs: [
        'Breadth-first search is the obvious choice for shallowest goal. It expands all nodes at depth 0, then depth 1, then depth 2. The first goal found is shallowest by edge count.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/da/Tic-tac-toe-game-tree.svg/500px-Tic-tac-toe-game-tree.svg.png', alt: 'Top of a tic-tac-toe game tree', caption: 'A game tree shows why frontier size explodes: every ply multiplies the number of states a BFS queue would have to hold. Source: Wikimedia Commons: https://commons.wikimedia.org/wiki/File:Tic-tac-toe-game-tree.svg'},
        'Depth-first search is the obvious choice for memory. It keeps one root-to-current path and a small amount of sibling state. It is cheap to store but has no built-in preference for shallow goals.',
      ], },
    { heading: 'The wall', paragraphs: [
        'BFS memory grows as the frontier. With branching factor b and goal depth d, the frontier near depth d can contain b^d nodes. For b = 10 and d = 6, that is about 1,000,000 nodes waiting in the queue.',
        'DFS has the opposite failure. On a very deep or infinite branch, it may never return to a shallow goal on another branch. Even on finite trees, it can report a deeper goal before a shallower one.',
      ], },
    { heading: 'The core insight', paragraphs: [
        'Use DFS as a depth prover. A DFS limited to k explores every node up to depth k while using stack memory. If it fails, the algorithm has proved that the goal is not above the next depth.',
        'Restarting from the root looks wasteful, but most nodes in an exponentially growing tree live near the deepest level. The repeated shallow work is small compared with the final pass when b is larger than 1.',
      ], },
    { heading: 'How it works', paragraphs: [
        'Set limit = 0 and run DFS from the root. Before expanding a node, compare its depth with the limit. If depth equals the limit and the node is not the goal, return without pushing children.',
        'If the goal is not found, increase the limit by 1 and run DFS again from the root. Stop at the first limit that finds a goal. If the tree is finite and all limits are exhausted, no goal exists.',
      ], },
    { heading: 'Why it works', paragraphs: [
        'Correctness follows from exhaustive depth prefixes. Iteration k explores every node at depths 0 through k. If the shallowest goal is at depth d, iterations 0 through d - 1 prove no shallower goal exists, and iteration d reaches it.',
        'The memory bound follows from the DFS stack. At limit d, the active path has at most d + 1 nodes, plus sibling iterator state. IDDFS never stores the whole frontier the way BFS does.',
      ], },
    { heading: 'Cost and complexity', paragraphs: [
        'Time is O(b^d), the same asymptotic order as BFS on a uniform tree. The extra work is re-expanding shallow nodes. For b = 10, the overhead is about 10/9, or 11%, because the final level dominates the total.',
        'Space is O(bd) or O(d) depending on how child iteration is represented. Compared with BFS space O(b^d), this is the whole trade: a small constant-factor time tax buys exponential memory savings.',
      ], },
    { heading: 'Real-world uses', paragraphs: [
        'Game engines use iterative deepening with alpha-beta search. Each deeper pass gives better move ordering and can be stopped when the clock runs out. The result is anytime behavior: the engine always has the best completed-depth answer.',
        'Puzzle solvers use IDA*, the cost-threshold version of the same idea. The 15-puzzle and Rubik-style searches use depth-first memory while a heuristic guides which threshold comes next. Logic systems use depth limits to avoid getting trapped forever down one branch.',
      ], },
    { heading: 'Where it fails', paragraphs: [
        'IDDFS is weak when branching factor is low. With b = 2, repeated work can nearly double total expansions. If memory can hold the frontier, BFS may be simpler and faster.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/57/Tree_edges.svg/500px-Tree_edges.svg.png', alt: 'Depth-first search tree with tree, back, forward, and cross edges', caption: 'General graphs add edge cases that pure tree IDDFS avoids; cycles and repeated states change the memory story. Source: Wikimedia Commons: https://commons.wikimedia.org/wiki/File:Tree_edges.svg'},
        'General graphs add cycles and repeated states. A visited set per iteration can prevent loops, but it costs memory. Path checking keeps memory low but may revisit the same state through different paths many times.',
      ], },
    { heading: 'Worked example', paragraphs: [
        'Use branching factor 3 with root A and goal I at depth 2. Limit 0 expands A only, so 1 node is expanded. Limit 1 expands A, B, C, D, so 4 nodes are expanded.',
        'Limit 2 expands A, then B with E and F, then C with G and H, then D with I, where it stops. That pass expands 10 nodes before finding the goal. Total IDDFS expansions are 1 + 4 + 10 = 15, while BFS to depth 2 would expand up to 13 nodes but store a frontier of 9.',
      ], },
    { heading: 'Sources and study next', paragraphs: [
        'Primary source: Korf, Depth-First Iterative-Deepening: An Optimal Admissible Tree Search, 1985. The paper explains why iterative deepening is time-optimal and space-efficient for brute-force tree search.',
        'Study DFS for the stack mechanics and BFS for the shallowest-goal guarantee. Study A*, IDA*, alpha-beta pruning, and Dijkstra next to see how depth limits change when costs or heuristics enter the problem.',
      ], },
  ],
};
