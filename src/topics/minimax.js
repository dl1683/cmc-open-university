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
        'The tree is a game tree, meaning each path is one possible future sequence of moves. MAX nodes represent the player trying to make the score larger, and MIN nodes represent the opponent trying to make the score smaller. Leaves are evaluated positions, either terminal outcomes or depth-limited estimates.',
        'The first pass visits every leaf and propagates values upward. The second pass carries alpha and beta bounds: alpha is what MAX can already guarantee, and beta is what MIN can already force. When alpha is at least beta, remaining children cannot change any ancestor choice.',
        {type: 'callout', text: 'Alpha-beta pruning is minimax with proof-carrying bounds: skipped nodes are skipped because they cannot change the root value.'},
        {type: 'image', src: './assets/gifs/minimax.gif', alt: 'Animated walkthrough of the minimax visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Two-player zero-sum games have direct conflict: one player improves exactly when the other player worsens. Chess, checkers, tic-tac-toe, and many simplified planning problems can be modeled this way. The central question is which move gives the best guaranteed result if the opponent also plays well.',
        'Minimax gives the value of a game tree under perfect play. Alpha-beta pruning exists because the full tree grows too fast, but many branches can be proven irrelevant before evaluation. It keeps the minimax answer while reducing search work.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is exhaustive search. Generate every legal move, every reply, and continue until terminal positions or a fixed depth. Score the leaves and back up the values: MAX takes the largest child value, while MIN takes the smallest.',
        'This works on small games. Tic-tac-toe can be searched completely, and the backed-up root value tells whether the start is a win, loss, or draw under optimal play. The method is easy to trust because it leaves no future unexamined.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/da/Tic-tac-toe-game-tree.svg/500px-Tic-tac-toe-game-tree.svg.png', alt: 'Top of a tic-tac-toe game tree with branching game states', caption: 'Even tic-tac-toe creates a branching game tree; larger games make exhaustive search infeasible. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Tic-tac-toe-game-tree.svg.'},
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is exponential growth. If each position has b legal moves and the search looks d plies ahead, the tree has O(b to the d) leaves. With b = 35 and d = 10, that is about 2.76e15 leaves before internal nodes are counted.',
        'Most branches do not need full evaluation. If MAX already has a move worth 7, and another candidate line lets MIN force the score down to 3, MAX will never choose that line. Exhaustive minimax wastes work proving details inside branches that have already lost the comparison.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Minimax values are bounded while the search runs. Alpha is a lower bound on what MAX can secure from explored choices, and beta is an upper bound on what MIN can force in the current line. When the lower bound reaches the upper bound, the current line cannot improve the ancestor decision.',
        'Alpha-beta pruning is not a guess about which moves look promising. It is a proof that a remaining subtree is dominated by a choice already available elsewhere. Move ordering affects how soon the proof appears, but not the value returned by the algorithm.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/1/1b/Decision_tree_model.png', alt: 'Decision tree model diagram with branches ending in leaves', caption: 'Minimax is a decision tree with alternating objectives, and alpha-beta cuts branches once bounds prove they cannot win. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Decision_tree_model.png.'},
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Start at the root with alpha = negative infinity and beta = positive infinity. Search depth-first. At a MAX node, evaluate children and raise alpha when a better child is found; at a MIN node, evaluate children and lower beta when a worse-for-MAX child is found.',
        'After each child, test whether alpha is at least beta. At a MIN node, this means MIN can hold the line to beta or lower while MAX already has alpha elsewhere. At a MAX node, the symmetric bound says remaining siblings cannot affect the root decision.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Correctness rests on the minimax recurrence. The value of a MAX node is the maximum of child values, and the value of a MIN node is the minimum of child values. Alpha and beta summarize explored alternatives that ancestors can enforce.',
        'At a MIN node, once beta is no larger than alpha, MIN has found a reply with value no more than beta while MAX already has another route worth at least alpha. Since MIN will not choose a child that gives MAX more when a lower child is available, the remaining children cannot make this branch attractive to MAX.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Plain minimax visits O(b to the d) nodes. Alpha-beta has the same worst case when move ordering is bad, but with perfect move ordering it behaves like O(b to the d over 2). That is roughly like halving the exponent of the search depth.',
        'For b = 35 and d = 8, full minimax has about 2.25e12 leaves. Perfectly ordered alpha-beta behaves closer to 35 to the fourth power, or about 1.5 million leaves. Space is O(d) for depth-first recursion before optional transposition tables are added.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Alpha-beta search powered decades of chess, checkers, Othello, and Connect Four programs. It is strongest in deterministic perfect-information games with moderate branching factor and useful evaluation functions. Chess engines still use alpha-beta descendants combined with strong move ordering and learned evaluation.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Hidden information breaks the tree model because a player does not know the full state. Poker and bridge need information-set methods rather than plain minimax. Randomness adds chance nodes, so games with dice need expectiminimax or sampling.',
        'The horizon effect is another failure. A fixed-depth search may miss a forced loss just beyond the cutoff and overvalue the position. Engines use quiescence search, extensions, and better evaluation to avoid stopping in tactically unstable states.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/2/23/Directed_graph_no_background.svg', alt: 'Directed graph with arrows between nodes', caption: 'Hidden state, chance, and repeated positions push the clean tree model toward richer directed state graphs. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Directed_graph_no_background.svg.'},
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Use the default leaves 3,5|2,8|1,9|4,6. Each pair belongs to a MIN node, and the root is MAX. Plain minimax gives min(3,5)=3, min(2,8)=2, min(1,9)=1, and min(4,6)=4, so the root chooses max(3,2,1,4)=4.',
        'Alpha-beta starts with alpha at negative infinity. After the first MIN node returns 3, root alpha becomes 3. At the second MIN node, the first leaf is 2, so beta becomes 2; because beta 2 is no larger than alpha 3, the leaf 8 is pruned.',
        'At the third MIN node, the first leaf is 1, so leaf 9 is pruned for the same reason. At the fourth MIN node, leaf 4 gives beta 4, which is greater than alpha 3, so leaf 6 must be checked. The final root value is still 4, but two leaves were never evaluated.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Study von Neumann for the minimax theorem, Shannon for early computer chess search, and Knuth and Moore for alpha-beta pruning analysis. These sources separate the game-theory value from the engineering problem of searching enough of the tree.',
        'Study DFS and recursion before implementing minimax, then study Iterative Deepening, Transposition Table, and Quiescence Search for engine practice. Study Monte Carlo Tree Search for high-branching games and Expectiminimax for games with chance nodes.',
      ],
    },
  ],
};
