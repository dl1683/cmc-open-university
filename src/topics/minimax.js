// Minimax with alpha-beta pruning: optimal play in two-player zero-sum
// games. Build the game tree, propagate values bottom-up (max picks
// highest child, min picks lowest), then prune branches that cannot
// change the outcome.

import { treeState, InputError } from '../core/state.js';

export const topic = {
  title: 'Minimax & Alpha-Beta Pruning',
  slug: 'minimax',
  category: 'Algorithms',
  summary: 'Optimal play in two-player games — search the game tree, prune branches that cannot affect the outcome.',
  defaultInput: '3,5|2,8|1,9|4,6',
  controls: [
    { id: 'leaves', label: 'Leaf values (pairs separated by |)', type: 'text', defaultValue: '3,5|2,8|1,9|4,6' },
  ],
  run,
};

// ---------------------------------------------------------------- helpers

function parsePairs(text) {
  const raw = String(text ?? '').trim();
  if (!raw) throw new InputError('Enter leaf values as pairs separated by | (e.g. 3,5|2,8|1,9|4,6).');
  const groups = raw.split('|').map((g) => g.trim()).filter(Boolean);
  if (groups.length < 2) throw new InputError('Need at least 2 pairs (separated by |) to build a meaningful game tree.');
  if (groups.length > 8) throw new InputError('At most 8 pairs so the tree stays readable.');
  return groups.map((g, i) => {
    const parts = g.split(',').map((s) => s.trim()).filter(Boolean);
    if (parts.length !== 2) throw new InputError(`Pair ${i + 1} ("${g}") must have exactly 2 comma-separated numbers.`);
    return parts.map((p) => {
      const v = Number(p);
      if (!Number.isFinite(v)) throw new InputError(`"${p}" is not a number.`);
      return v;
    });
  });
}

// Build a full binary tree: root (MAX) -> MIN nodes -> leaf pairs.
// Returns { nodes: Map, rootId, leafIds, minIds }.
function buildTree(pairs) {
  const nodes = new Map();
  let id = 0;
  const nextId = () => `n${id++}`;

  const rootId = nextId();
  nodes.set(rootId, { id: rootId, value: '?', left: null, right: null, role: 'MAX', depth: 0 });

  const minIds = [];
  const leafIds = [];

  // Create MIN-level nodes as children of root
  const minLevel = [];
  for (let i = 0; i < pairs.length; i++) {
    const mId = nextId();
    nodes.set(mId, { id: mId, value: '?', left: null, right: null, role: 'MIN', depth: 1 });
    minIds.push(mId);
    minLevel.push(mId);

    // Create leaf children for this MIN node
    const lId = nextId();
    const rId = nextId();
    nodes.set(lId, { id: lId, value: pairs[i][0], left: null, right: null, role: 'LEAF', depth: 2 });
    nodes.set(rId, { id: rId, value: pairs[i][1], left: null, right: null, role: 'LEAF', depth: 2 });
    nodes.get(mId).left = lId;
    nodes.get(mId).right = rId;
    leafIds.push(lId, rId);
  }

  // Wire MIN nodes as children of MAX root in a balanced binary structure.
  // If there are more than 2 MIN nodes, we insert intermediate MAX nodes.
  if (minLevel.length <= 2) {
    nodes.get(rootId).left = minLevel[0] ?? null;
    nodes.get(rootId).right = minLevel[1] ?? null;
  } else {
    // Group MIN nodes in pairs under intermediate MAX nodes
    const intermediates = [];
    for (let i = 0; i < minLevel.length; i += 2) {
      if (i + 1 < minLevel.length) {
        const iId = nextId();
        nodes.set(iId, { id: iId, value: '?', left: minLevel[i], right: minLevel[i + 1], role: 'MAX', depth: 1 });
        // Push MIN nodes down a level
        nodes.get(minLevel[i]).depth = 2;
        nodes.get(minLevel[i + 1]).depth = 2;
        // Push leaves down another level
        const fixLeafDepth = (mId) => {
          const m = nodes.get(mId);
          if (m.left) nodes.get(m.left).depth = 3;
          if (m.right) nodes.get(m.right).depth = 3;
        };
        fixLeafDepth(minLevel[i]);
        fixLeafDepth(minLevel[i + 1]);
        intermediates.push(iId);
      } else {
        intermediates.push(minLevel[i]);
      }
    }
    nodes.get(rootId).left = intermediates[0] ?? null;
    nodes.get(rootId).right = intermediates[1] ?? null;
  }

  return { nodes, rootId, leafIds, minIds };
}

function nodeLabel(node) {
  const tag = node.role === 'LEAF' ? '' : `${node.role} `;
  return `${tag}${node.value}`;
}

// ---------------------------------------------------------------- run

export function* run(input) {
  const pairs = parsePairs(input.leaves);

  const { nodes, rootId } = buildTree(pairs);

  const evaluated = new Set();  // ids whose value is final
  const pruned = new Set();     // ids skipped by alpha-beta

  const snapshot = () => treeState(
    [...nodes.values()].map((n) => ({
      id: n.id,
      value: nodeLabel(n),
      left: n.left,
      right: n.right,
    })),
    rootId,
  );

  // Step 1: Show the initial tree
  yield {
    state: snapshot(),
    highlight: { active: [rootId] },
    explanation: 'The game tree is built. The root is a MAX node (our turn). Its children are MIN nodes (opponent\'s turn). Leaves hold static evaluation scores. Our goal: find the move that guarantees the best outcome assuming the opponent plays optimally.',
  };

  // Step 2: Show leaf values
  const allLeafIds = [...nodes.values()].filter((n) => n.role === 'LEAF').map((n) => n.id);
  yield {
    state: snapshot(),
    highlight: { active: allLeafIds },
    explanation: `The leaves are the positions we can evaluate directly — game-over states or positions at our search depth limit. Values: ${allLeafIds.map((id) => nodes.get(id).value).join(', ')}. Now we propagate these values upward. Each MAX node picks the highest child; each MIN node picks the lowest.`,
  };

  // ---- Phase 1: Plain minimax (no pruning) ----

  // Recursive minimax evaluation
  function* minimax(nodeId) {
    const node = nodes.get(nodeId);
    if (node.role === 'LEAF') {
      evaluated.add(nodeId);
      yield {
        state: snapshot(),
        highlight: { active: [nodeId], visited: [...evaluated].filter((x) => x !== nodeId) },
        explanation: `Leaf node: value is ${node.value}. This is a terminal evaluation — no further search needed. Return ${node.value} to the parent.`,
      };
      return node.value;
    }

    const children = [node.left, node.right].filter(Boolean);
    const isMax = node.role === 'MAX';

    yield {
      state: snapshot(),
      highlight: { active: [nodeId], visited: [...evaluated] },
      explanation: `Enter ${node.role} node. ${isMax ? 'Maximizer picks the highest child value.' : 'Minimizer picks the lowest child value.'} Evaluate children left to right.`,
    };

    let best = isMax ? -Infinity : Infinity;
    for (const childId of children) {
      const childVal = yield* minimax(childId);
      if (isMax) {
        best = Math.max(best, childVal);
      } else {
        best = Math.min(best, childVal);
      }
    }

    node.value = best;
    evaluated.add(nodeId);

    yield {
      state: snapshot(),
      highlight: { found: [nodeId], visited: [...evaluated].filter((x) => x !== nodeId) },
      explanation: `${node.role} node evaluates to ${best}. ${isMax ? `Picked the maximum among children: ${children.map((c) => nodes.get(c).value).join(', ')}.` : `Picked the minimum among children: ${children.map((c) => nodes.get(c).value).join(', ')}.`}`,
    };

    return best;
  }

  yield* minimax(rootId);

  const minimaxValue = nodes.get(rootId).value;

  yield {
    state: snapshot(),
    highlight: { found: [rootId], visited: [...evaluated] },
    explanation: `Minimax complete. The game value is ${minimaxValue} — this is the best score the maximizer can guarantee against optimal play. But we visited every node. With branching factor b and depth d, that is O(b^d) nodes. Now let’s see how alpha-beta pruning skips entire subtrees without changing the result.`,
  };

  // ---- Phase 2: Alpha-beta pruning ----

  // Reset values for the alpha-beta pass
  for (const n of nodes.values()) {
    if (n.role !== 'LEAF') n.value = '?';
  }
  evaluated.clear();
  // Mark leaves as evaluated
  for (const n of nodes.values()) {
    if (n.role === 'LEAF') evaluated.add(n.id);
  }

  yield {
    state: snapshot(),
    highlight: { active: [rootId] },
    explanation: `Alpha-beta pass. Same tree, same leaf values, but now we track two bounds: alpha (best the maximizer can guarantee so far) and beta (best the minimizer can guarantee so far). When alpha >= beta, the remaining children cannot affect the outcome — prune them.`,
  };

  function* alphaBeta(nodeId, alpha, beta) {
    const node = nodes.get(nodeId);
    if (node.role === 'LEAF') {
      evaluated.add(nodeId);
      yield {
        state: snapshot(),
        highlight: { active: [nodeId], visited: [...evaluated].filter((x) => x !== nodeId), removed: [...pruned] },
        explanation: `Leaf: value ${node.value}. α=${alpha}, β=${beta}. Return ${node.value} to parent.`,
      };
      return node.value;
    }

    const children = [node.left, node.right].filter(Boolean);
    const isMax = node.role === 'MAX';

    yield {
      state: snapshot(),
      highlight: { active: [nodeId], visited: [...evaluated], removed: [...pruned] },
      explanation: `Enter ${node.role} node with α=${alpha}, β=${beta}. ${isMax ? 'Maximizer: raise α as better moves are found.' : 'Minimizer: lower β as better (for min) moves are found.'}`,
    };

    let localAlpha = alpha;
    let localBeta = beta;
    let best = isMax ? -Infinity : Infinity;

    for (let i = 0; i < children.length; i++) {
      const childId = children[i];

      // Check for pruning before evaluating this child
      if (localAlpha >= localBeta) {
        // Prune this child and any remaining siblings
        pruned.add(childId);
        // Also mark all descendants as pruned
        const markPruned = (nId) => {
          if (!nId) return;
          pruned.add(nId);
          const nd = nodes.get(nId);
          if (nd.left) markPruned(nd.left);
          if (nd.right) markPruned(nd.right);
        };
        markPruned(childId);

        yield {
          state: snapshot(),
          highlight: { active: [nodeId], visited: [...evaluated], removed: [...pruned] },
          explanation: `PRUNE! α=${localAlpha} >= β=${localBeta}. ${isMax ? 'The minimizer above already has a path scoring ' + localBeta + ', so it will never choose this branch — skip remaining children.' : 'The maximizer above already has a path scoring ' + localAlpha + ', so it will never choose this branch — skip remaining children.'} This is the alpha-beta cutoff: the entire subtree rooted here is irrelevant.`,
          invariant: 'Pruned branches cannot contain a value that would change the minimax result at any ancestor.',
        };
        continue;
      }

      const childVal = yield* alphaBeta(childId, localAlpha, localBeta);

      if (isMax) {
        best = Math.max(best, childVal);
        localAlpha = Math.max(localAlpha, best);
      } else {
        best = Math.min(best, childVal);
        localBeta = Math.min(localBeta, best);
      }
    }

    node.value = best;
    evaluated.add(nodeId);

    yield {
      state: snapshot(),
      highlight: { found: [nodeId], visited: [...evaluated], removed: [...pruned] },
      explanation: `${node.role} node evaluates to ${best} (same as before). α=${localAlpha}, β=${localBeta}. ${pruned.size > 0 ? `Pruned ${pruned.size} node${pruned.size === 1 ? '' : 's'} so far — less work, same answer.` : 'No pruning happened yet.'}`,
    };

    return best;
  }

  yield* alphaBeta(rootId, -Infinity, Infinity);

  const abValue = nodes.get(rootId).value;

  yield {
    state: snapshot(),
    highlight: { found: [rootId], visited: [...evaluated], removed: [...pruned] },
    explanation: `Alpha-beta complete. Result: ${abValue} — identical to the full minimax value (${minimaxValue}). ${pruned.size > 0 ? `But we skipped ${pruned.size} node${pruned.size === 1 ? '' : 's'} (shown dimmed). ` : ''}Without pruning: O(b^d) nodes. With perfect move ordering, alpha-beta cuts this to O(b^(d/2)) — effectively doubling the search depth for the same compute budget.`,
    invariant: 'Alpha-beta pruning never changes the minimax value. It only removes nodes that provably cannot influence the root’s decision.',
  };
}

// ---------------------------------------------------------------- article

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'The tree is a game tree. Each internal node is labeled MAX or MIN: MAX nodes represent the player trying to maximize the score, MIN nodes represent the opponent trying to minimize it. Leaves hold static evaluation scores from your input.',
        'Internal nodes start as "?" and fill in as the algorithm propagates values upward. At a MAX level the node takes the highest child value; at a MIN level, the lowest.',
        'The animation runs two passes. Pass one is plain minimax: every node is visited and evaluated. Pass two is alpha-beta pruning: some nodes are dimmed and skipped. These dimmed nodes are pruned branches -- subtrees the algorithm proved irrelevant without examining them. The root value is identical in both passes.',
        'Watch the alpha and beta bounds reported at each step. Alpha is the best the maximizer can guarantee so far; beta is the best the minimizer can guarantee. When alpha >= beta at any node, the remaining children are pruned. The cascade is the payoff: pruning one node often eliminates its entire subtree.',
        {type: 'callout', text: 'Alpha-beta pruning is minimax with proof-carrying bounds: skipped nodes are skipped because they cannot change the root value.'},
      
        {type: 'image', src: './assets/gifs/minimax.gif', alt: 'Animated walkthrough of the minimax visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Two-player zero-sum games -- chess, checkers, Go, tic-tac-toe -- have a clean mathematical structure: one player\'s gain is the other\'s loss. The question is always the same: what is the best move, assuming the opponent also plays optimally?',
        'Von Neumann proved in 1928 that every finite two-player zero-sum game with perfect information has a determinate value -- both players have optimal strategies, and the outcome under mutual optimal play is fixed. Minimax is the algorithm that computes that value.',
        'Shannon made the idea practical in 1950 by proposing two strategies for chess-playing programs: the A-strategy (full minimax to terminal states) and the B-strategy (selective search with depth-limited evaluation). Every chess engine since descends from that framework.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'Search the full game tree to terminal states. Score each terminal position (+1 win, -1 loss, 0 draw, or a heuristic evaluation at a depth limit). Propagate scores upward: the player whose turn it is picks the score that favors them -- maximize if it is your turn, minimize if it is the opponent\'s.',
        'This is minimax in its pure form. It works perfectly for small games. Tic-tac-toe has about 255,168 possible games and is solved instantly. Nim, Connect Four endgames, and simple card games are fully solvable the same way. The algorithm is correct by construction: it considers every possible future and picks the best guaranteed outcome. Cost: O(b^d) nodes, where b is the branching factor and d is the depth.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'Game trees grow exponentially. Chess has an average branching factor b of about 35 and games average about 80 moves deep. That is 35^80, roughly 10^123 nodes. Even searching just 10 moves ahead (20 plies) means 35^20, about 10^30 nodes -- far beyond any computer.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/da/Tic-tac-toe-game-tree.svg/500px-Tic-tac-toe-game-tree.svg.png', alt: 'Top of a tic-tac-toe game tree with branching game states', caption: 'Even tic-tac-toe creates a branching game tree; larger games make exhaustive search infeasible. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Tic-tac-toe-game-tree.svg.'},
        'But most of those nodes are irrelevant. If you already know a move guarantees a score of 5, and a new branch reveals the opponent can force a score of 3, that branch is dead. The opponent will never let you score higher than 3 there, and you already have 5 elsewhere. The full search wastes time proving what is already known.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Minimax is the base: alternate maximize and minimize layers. The maximizer picks the highest child value, the minimizer picks the lowest, all the way from leaves to root. The root value is the game\'s outcome under optimal play by both sides.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/1/1b/Decision_tree_model.png', alt: 'Decision tree model diagram with branches ending in leaves', caption: 'Minimax is a decision tree with alternating objectives, and alpha-beta cuts branches once bounds prove they cannot win. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Decision_tree_model.png.'},
        'Alpha-beta pruning adds two bounds that travel with the search. Alpha is the best score the maximizer can guarantee so far -- the floor. Beta is the best score the minimizer can guarantee -- the ceiling. Together they form a window [alpha, beta]. Any value outside this window is irrelevant: the maximizer will not accept less than alpha, and the minimizer will not accept more than beta.',
        'Start at the root with alpha = -infinity and beta = +infinity (no constraints yet). Recurse depth-first into the first child, passing alpha and beta down. At a leaf, return the evaluation. At a MAX node, each child\'s return value is a candidate for raising alpha. At a MIN node, each child\'s return value is a candidate for lowering beta.',
        'After evaluating each child, check: is beta <= alpha? If so, stop -- prune the remaining children. The bounds prove they cannot affect the result. This is the alpha-beta cutoff.',
        'The bounds tighten as the search progresses. If the first child of a MAX node returns a high value, alpha rises immediately, and later branches face a tighter window. Examining the best move first produces the tightest bounds and the most pruning. This is why move ordering is the single most important practical optimization.',
        'With perfect move ordering (best move always examined first), the tree shrinks from O(b^d) to O(b^(d/2)). The search effectively doubles its depth for the same compute budget.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The pruned subtrees are provably irrelevant. If the maximizer already has a move scoring alpha = 5, and the current MIN node has found a child scoring 3, the MIN node will return at most 3 (it picks the lowest). The maximizer will never choose this branch over the 5 it already has. Every remaining child of this MIN node is dead weight -- even if one scored 100, the MIN node would still return 3 or less.',
        'The invariant is: at every point during search, the true minimax value of the current subtree lies between alpha and beta. When beta <= alpha, the window is empty. No value in the remaining subtree can fall inside the window, so the subtree cannot influence the root\'s decision.',
        'Correctness is guaranteed by Von Neumann\'s minimax theorem. The game has a fixed value under optimal play. Alpha-beta computes exactly this value because it only discards branches where the bound analysis proves domination. The pruning is a logical consequence of the alternating maximize-minimize structure, not a heuristic shortcut.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Without pruning, minimax visits O(b^d) nodes -- every leaf in the game tree. With alpha-beta and perfect move ordering, the count drops to O(b^(d/2)). This means searching the same depth with an effective branching factor of the square root of b, or equivalently, searching twice as deep for the same cost.',
        'In practice, move ordering is never perfect but still powerful. Good heuristics -- captures before quiet moves in chess, killer moves, history heuristic -- typically achieve close to the theoretical best. Random ordering gives O(b^(3d/4)), still a large win over full minimax.',
        'Space is O(d) for the recursion stack. Only the current path from root to the active leaf needs to be in memory. Alpha and beta are passed as parameters; no global state beyond the game position is required.',
        'Concrete example: chess with b = 35 and a 12-ply search. Full minimax: 35^12, about 1.6 times 10^18 nodes. Alpha-beta with good ordering: roughly 35^6, about 1.8 billion nodes -- tractable on modern hardware in seconds. The same budget under full minimax would reach only 6 plies.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'Chess engines from the 1960s through Deep Blue (1997) and modern Stockfish all use alpha-beta or its descendants (principal variation search, negascout, aspiration windows). Stockfish, rated above any human, runs alpha-beta at its core with an NNUE neural network for leaf evaluation.',
        'Chinook solved checkers in 2007 using alpha-beta with endgame databases. Othello programs like Edax use alpha-beta with move ordering tuned for the game\'s specific structure. Connect Four was solved completely with alpha-beta in 1988.',
        'The technique applies to any two-player zero-sum perfect-information game. Go programs before AlphaGo (2016) used alpha-beta with pattern-based evaluation. Beyond board games, adversarial decisions in cybersecurity, auction theory, and competitive pricing can be framed as two-player zero-sum search, and the pruning insight transfers directly.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Imperfect information kills the premise. Poker, bridge, and Stratego have hidden state -- you do not know the opponent\'s cards or pieces. Minimax over the visible state is wrong because it ignores the information asymmetry. These games need counterfactual regret minimization (poker) or information-set Monte Carlo search (bridge, Stratego).',
        'Stochastic games (backgammon, dice-based combat) require expectiminimax, which adds chance nodes that average over random outcomes. Plain minimax cannot handle the branching over probabilistic events.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/2/23/Directed_graph_no_background.svg', alt: 'Directed graph with arrows between nodes', caption: 'Hidden state, chance, and repeated positions push the clean tree model toward richer directed state graphs. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Directed_graph_no_background.svg.'},
        'Very high branching factors defeat alpha-beta even with pruning. Go has b around 250; even O(b^(d/2)) is too large for meaningful depth. Monte Carlo tree search sidesteps this by sampling random playouts instead of exhaustive search, which is why MCTS displaced alpha-beta for Go.',
        'The horizon effect is a subtler failure: alpha-beta at a fixed depth can miss tactics just beyond the search horizon. A losing capture sequence might appear to "disappear" because the final losing move is one ply past the depth limit. Quiescence search -- extending the search at tactical positions -- is the standard fix.',
        'Finally, alpha-beta is only as good as its evaluation function. When search cannot reach terminal states, the leaf evaluator determines play quality. Chess engines spent decades hand-tuning evaluation; neural network evaluators (NNUE, AlphaZero-style networks) transformed the field because better leaf scores make every search depth more effective.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Default input: 3,5|2,8|1,9|4,6. The tree has depth 3: a MAX root, four MIN children (one per pair), and eight leaves.',
        'Plain minimax first. MIN node A has leaves 3 and 5; it picks min(3, 5) = 3. MIN node B has leaves 2 and 8; it picks min(2, 8) = 2. MIN node C: min(1, 9) = 1. MIN node D: min(4, 6) = 4. These four MIN values propagate to the MAX root, which picks max(3, 2, 1, 4) = 4. All 12 non-root nodes are visited.',
        'Alpha-beta pass. Start at the root with alpha = -infinity, beta = +infinity. Recurse into MIN node A. Its first leaf returns 3; beta at A drops to 3. Second leaf returns 5; min(3, 5) = 3, so A evaluates to 3. Back at the root, alpha rises to 3 (the maximizer now guarantees at least 3).',
        'Recurse into MIN node B with alpha = 3, beta = +infinity. First leaf returns 2. The MIN node now has a candidate of 2, so beta at B drops to 2. Check: beta (2) <= alpha (3). Cutoff -- prune B\'s remaining child (the leaf with value 8). The maximizer already has 3 from node A; this MIN node will return at most 2. The maximizer will never pick this branch. One subtree pruned.',
        'Continue to MIN node C with alpha = 3. First leaf returns 1; beta at C drops to 1. Check: beta (1) <= alpha (3). Cutoff again -- prune C\'s second child (value 9). Two subtrees pruned.',
        'MIN node D with alpha = 3. First leaf returns 4; beta at D drops to 4. Beta (4) > alpha (3), so no prune yet. Second leaf returns 6; min(4, 6) = 4. D evaluates to 4. Back at the root, alpha rises to max(3, 4) = 4.',
        'Final result: 4, identical to full minimax. But alpha-beta skipped 2 leaf nodes and their evaluations. On deeper trees the savings compound exponentially.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Von Neumann, "Zur Theorie der Gesellschaftsspiele" (1928) -- proved the minimax theorem for finite two-player zero-sum games. Shannon, "Programming a Computer for Playing Chess" (1950) -- proposed the A-strategy and B-strategy that founded computer chess. Knuth and Moore, "An Analysis of Alpha-Beta Pruning" (1975) -- proved the O(b^(d/2)) optimal complexity and analyzed move-ordering effects.',
        'Study next by role. Monte Carlo Tree Search (MCTS) replaces exhaustive minimax with statistical sampling -- essential for high-branching games like Go. Expectiminimax extends minimax to stochastic games by adding chance nodes. Iterative deepening depth-first search (IDDFS) lets alpha-beta search progressively deeper under a time budget. Game trees are the data structure underlying all of this; understanding tree traversal and DFS makes the recursion pattern concrete.',
      ],
    },
    {
      heading: 'Learning map',
      paragraphs: [
        'Prerequisites: Recursion, because minimax is a recursive function on the game tree. DFS, because the search pattern is depth-first traversal with backtracking. Trees, because the game tree is the data structure being searched.',
        'This unlocks: MCTS (the modern alternative for high-branching games), Expectiminimax (minimax with chance nodes), iterative deepening (searching deeper under time constraints), transposition tables (caching repeated positions to avoid redundant subtrees), and game-tree complexity analysis (why some games are harder than others).',
      ],
    },
    {
      heading: 'Micro checks',
      paragraphs: [
        {
          type: 'bullets',
          items: [
            'Can you trace minimax on a 4-leaf tree and get the correct root value?',
            'Can you explain why a MIN node returning 2 under a MAX node with alpha = 3 triggers a cutoff?',
            'Can you state what alpha and beta each represent in one sentence?',
            'Can you explain why perfect move ordering cuts the tree from O(b^d) to O(b^(d/2))?',
            'Can you name a game where alpha-beta fails and state the specific reason?',
          ],
        },
      ],
    },
    {
      heading: 'Try this now',
      paragraphs: [
        'Change the leaf values to 7,2|5,1|3,8|6,4 and trace the alpha-beta pass on paper before running the visualization. After MIN node 1 returns min(7, 2) = 2, alpha at the root rises to 2. MIN node 2\'s first child returns 5 -- no prune since 5 > 2. Second child returns 1, so MIN node 2 evaluates to 1. Predict: does MIN node 3 or 4 get pruned? Run the visualization to check.',
        'Try worst-case ordering: 1,2|3,4|5,6|7,8. Values ascend left to right, so the best moves are examined last. Count how many nodes get pruned. Then try 8,7|6,5|4,3|2,1 (descending order). The difference in pruning between these two inputs is the move-ordering effect in action -- same tree, same minimax value, vastly different work.',
      ],
    },
  ],
};
