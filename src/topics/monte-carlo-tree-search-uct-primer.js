// Monte Carlo Tree Search: choose where to simulate next with UCT, expand the
// tree gradually, and backpropagate rollout results into visit statistics.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'monte-carlo-tree-search-uct-primer',
  title: 'Monte Carlo Tree Search & UCT Primer',
  category: 'AI & ML',
  summary: 'Balance exploitation and exploration in a search tree: select by UCT, expand a leaf, simulate an outcome, and backpropagate visits and value.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['select expand rollout backprop', 'uct exploration'], defaultValue: 'select expand rollout backprop' },
  ],
  run,
};

function labelMatrix(title, rows, columns, labelsByRow) {
  const labels = [''];
  const codes = new Map([['', 0]]);
  const code = (label) => {
    if (!codes.has(label)) {
      codes.set(label, labels.length);
      labels.push(label);
    }
    return codes.get(label);
  };
  return matrixState({ title, rows, columns, values: labelsByRow.map((row) => row.map(code)), format: (value) => labels[value] });
}

function mctsGraph(title, notes = {}) {
  return graphState({
    nodes: [
      { id: 'root', label: 'root', x: 0.8, y: 4.0, note: notes.root ?? 'N=30' },
      { id: 'a', label: 'A', x: 2.8, y: 2.0, note: notes.a ?? '8/12' },
      { id: 'b', label: 'B', x: 2.8, y: 4.0, note: notes.b ?? '9/10' },
      { id: 'c', label: 'C', x: 2.8, y: 6.0, note: notes.c ?? '2/8' },
      { id: 'b1', label: 'B1', x: 5.0, y: 3.2, note: notes.b1 ?? 'leaf' },
      { id: 'b2', label: 'B2', x: 5.0, y: 4.8, note: notes.b2 ?? 'new' },
      { id: 'rollout', label: 'rollout', x: 7.2, y: 4.0, note: notes.rollout ?? 'simulate' },
      { id: 'value', label: 'value', x: 9.0, y: 4.0, note: notes.value ?? '+1/-1' },
    ],
    edges: [
      { id: 'e-root-a', from: 'root', to: 'a' },
      { id: 'e-root-b', from: 'root', to: 'b' },
      { id: 'e-root-c', from: 'root', to: 'c' },
      { id: 'e-b-b1', from: 'b', to: 'b1' },
      { id: 'e-b-b2', from: 'b', to: 'b2' },
      { id: 'e-b2-rollout', from: 'b2', to: 'rollout' },
      { id: 'e-rollout-value', from: 'rollout', to: 'value' },
    ],
  }, { title });
}

function loopGraph(title) {
  return graphState({
    nodes: [
      { id: 'select', label: 'select', x: 1.0, y: 4.0, note: 'UCT' },
      { id: 'expand', label: 'expand', x: 3.0, y: 2.3, note: 'new child' },
      { id: 'simulate', label: 'rollout', x: 5.2, y: 2.3, note: 'playout' },
      { id: 'backprop', label: 'backprop', x: 7.4, y: 4.0, note: 'update' },
      { id: 'stats', label: 'stats', x: 5.2, y: 6.0, note: 'N,W,Q' },
      { id: 'move', label: 'move', x: 9.2, y: 4.0, note: 'best child' },
    ],
    edges: [
      { id: 'e-select-expand', from: 'select', to: 'expand' },
      { id: 'e-expand-simulate', from: 'expand', to: 'simulate' },
      { id: 'e-simulate-backprop', from: 'simulate', to: 'backprop' },
      { id: 'e-backprop-stats', from: 'backprop', to: 'stats' },
      { id: 'e-stats-select', from: 'stats', to: 'select' },
      { id: 'e-backprop-move', from: 'backprop', to: 'move' },
    ],
  }, { title });
}

function visitPlot() {
  return plotState({
    axes: { x: { label: 'iterations' }, y: { label: 'visits' } },
    series: [
      { id: 'a', label: 'A', points: [{ x: 1, y: 1 }, { x: 5, y: 3 }, { x: 10, y: 5 }, { x: 20, y: 8 }, { x: 40, y: 13 }] },
      { id: 'b', label: 'B', points: [{ x: 1, y: 1 }, { x: 5, y: 2 }, { x: 10, y: 4 }, { x: 20, y: 10 }, { x: 40, y: 22 }] },
      { id: 'c', label: 'C', points: [{ x: 1, y: 1 }, { x: 5, y: 2 }, { x: 10, y: 3 }, { x: 20, y: 4 }, { x: 40, y: 5 }] },
    ],
    markers: [{ id: 'shift', x: 20, y: 10, label: 'B wins budget' }],
  }, { title: 'Visits concentrate as evidence arrives' });
}

function* selectExpandRolloutBackprop() {
  const r2 = (v) => Math.round(v * 100) / 100;

  const loop = loopGraph('MCTS repeats four operations');
  const phaseNodes = ['select', 'expand', 'simulate', 'backprop'];
  const phaseCount = phaseNodes.length;

  yield {
    state: loop,
    highlight: { active: phaseNodes, found: ['stats'] },
    explanation: `Monte Carlo Tree Search grows a tree gradually. Each iteration repeats ${phaseCount} phases (${phaseNodes.join(', ')}): select a promising path, expand one new child, simulate an outcome, and backpropagate the result into visit and value statistics.`,
    invariant: `The tree stores statistics (${phaseCount} phases per iteration), not guaranteed truth.`,
  };

  const selectNotes = { root: 'N=30', a: '8/12', b: '9/10', c: '2/8' };
  const rootN = 30;
  const aW = 8, aN = 12, bW = 9, bN = 10, cW = 2, cN = 8;

  yield {
    state: mctsGraph('Select a child with UCT'),
    highlight: { active: ['root', 'b', 'e-root-b'], compare: ['a', 'c'] },
    explanation: `UCT chooses among the root's children (N=${rootN}). A=${aW}/${aN} (Q=${r2(aW / aN)}), B=${bW}/${bN} (Q=${r2(bW / bN)}), C=${cW}/${cN} (Q=${r2(cW / cN)}). A child that looks good gets visits; a child that is underexplored also gets visits so it is not ignored too early.`,
  };

  const nodesPerIteration = 1;

  yield {
    state: mctsGraph('Expand one new leaf under the selected path'),
    highlight: { active: ['b', 'b2', 'e-b-b2'], found: ['rollout'] },
    explanation: `The tree grows by exactly ${nodesPerIteration} node per iteration. It adds one child when the selected path reaches a node that still has untried actions, rather than expanding every possible move immediately.`,
  };

  const rolloutWin = +1;
  const rolloutLoss = -1;

  yield {
    state: mctsGraph('Roll out from the new leaf'),
    highlight: { active: ['b2', 'rollout', 'value', 'e-b2-rollout', 'e-rollout-value'], compare: ['b1'] },
    explanation: `A rollout estimates the value of the new state and produces a result of ${rolloutWin} (win) or ${rolloutLoss} (loss). In games this can be a random playout, a policy-guided playout, or a neural value estimate. In LLM planning it might be a simulator, test run, or verifier score.`,
  };

  const bpNotes = { root: 'N=31', b: '10/11', b2: '1/1', value: '+1' };
  const newRootN = 31;
  const newBW = 10, newBN = 11, newB2W = 1, newB2N = 1;

  yield {
    state: mctsGraph('Backpropagate the result to ancestors', bpNotes),
    highlight: { active: ['value', 'b2', 'b', 'root', 'e-rollout-value', 'e-b-b2', 'e-root-b'], found: ['b'] },
    explanation: `Backpropagation updates every node on the selected path: root N rose from ${rootN} to ${newRootN}, B went from ${bW}/${bN} to ${newBW}/${newBN}, and the new leaf B2 is now ${newB2W}/${newB2N}. The next selection step will see those updated statistics.`,
  };
}

function* uctExploration() {
  const r2 = (v) => Math.round(v * 100) / 100;

  const parentN = 30;
  const c = Math.sqrt(2);
  const qA = 0.67, nA = 12;
  const qB = 0.90, nB = 10;
  const qC = 0.25, nC = 8;
  const bonusA = r2(c * Math.sqrt(Math.log(parentN) / nA));
  const bonusB = r2(c * Math.sqrt(Math.log(parentN) / nB));
  const bonusC = r2(c * Math.sqrt(Math.log(parentN) / nC));
  const scoreA = r2(qA + bonusA);
  const scoreB = r2(qB + bonusB);
  const scoreC = r2(qC + bonusC);
  const winner = scoreB >= scoreA && scoreB >= scoreC ? 'B' : scoreA >= scoreC ? 'A' : 'C';
  const winnerScore = scoreB >= scoreA && scoreB >= scoreC ? scoreB : scoreA >= scoreC ? scoreA : scoreC;

  yield {
    state: labelMatrix(
      'UCT score',
      [
        { id: 'a', label: 'A' },
        { id: 'b', label: 'B' },
        { id: 'c', label: 'C' },
      ],
      [
        { id: 'q', label: 'Q' },
        { id: 'n', label: 'N' },
        { id: 'bonus', label: 'bonus' },
        { id: 'score', label: 'score' },
      ],
      [
        ['0.67', '12', '0.43', '1.10'],
        ['0.90', '10', '0.47', '1.37'],
        ['0.25', '8', '0.52', '0.77'],
      ],
    ),
    highlight: { found: ['b:score'], active: ['b:q', 'b:bonus'], compare: ['c:bonus'] },
    explanation: `UCT = Q + c·sqrt(ln(N)/n) with c=${r2(c)}, parent N=${parentN}. A: Q=${qA}, N=${nA}, bonus=${bonusA}, score=${scoreA}. B: Q=${qB}, N=${nB}, bonus=${bonusB}, score=${scoreB}. C: Q=${qC}, N=${nC}, bonus=${bonusC}, score=${scoreC}. ${winner} wins selection with score ${winnerScore}.`,
  };

  const plot = visitPlot();
  const shiftX = plot.markers[0].x;
  const seriesCount = plot.series.length;

  yield {
    state: plot,
    highlight: { active: ['b', 'shift'], compare: ['c'] },
    explanation: `Early iterations spread visits across all ${seriesCount} series. Around iteration ${shiftX} evidence concentrates visits on the stronger action, while the exploration term still occasionally checks alternatives.`,
  };

  const ingredientRows = [
    { id: 'state', label: 'state' },
    { id: 'action', label: 'action' },
    { id: 'policy', label: 'policy' },
    { id: 'value', label: 'value' },
    { id: 'budget', label: 'budget' },
  ];
  const ingredientCols = [
    { id: 'game', label: 'game' },
    { id: 'agent', label: 'agent' },
  ];
  const ingredientCount = ingredientRows.length;
  const domainCount = ingredientCols.length;

  yield {
    state: labelMatrix(
      'Search ingredients',
      ingredientRows,
      ingredientCols,
      [
        ['board', 'workspace'],
        ['move', 'tool call'],
        ['prior move', 'proposal'],
        ['win prob', 'verifier'],
        ['rollouts', 'latency'],
      ],
    ),
    highlight: { active: ['policy:agent', 'value:agent', 'budget:agent'], compare: ['state:game'] },
    explanation: `MCTS transfers cleanly only when ${ingredientCount} ingredients (${ingredientRows.map(r => r.label).join(', ')}) exist across ${domainCount} domains (${ingredientCols.map(c => c.label).join(', ')}). For coding agents, state may be the repository snapshot, actions are edits or commands, and value comes from tests or verifiers.`,
  };

  const badGraph = mctsGraph('Bad value estimates can mislead the tree');
  const nodeCount = badGraph.nodes.length;

  yield {
    state: badGraph,
    highlight: { active: ['a', 'b', 'c'], compare: ['rollout', 'value'] },
    explanation: `MCTS is not magic. The tree has ${nodeCount} nodes, and if rollouts are noisy, value estimates are biased, or the simulator misses important constraints, search spends budget optimizing the wrong signal.`,
  };

  const modernLoop = loopGraph('Classical MCTS connects to modern verifier search');
  const statsNode = modernLoop.nodes.find(n => n.id === 'stats');
  const trackedStats = statsNode.note;

  yield {
    state: modernLoop,
    highlight: { active: ['select', 'simulate', 'backprop', 'stats'], found: ['move'] },
    explanation: `Tree of Thoughts evaluates thought states; PRM search scores reasoning steps; AlphaZero-style systems use policy and value networks inside MCTS. The reusable data structure is the same: a tree tracking ${trackedStats} per node, with visit counts, value estimates, and budgeted exploration.`,
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'select expand rollout backprop') yield* selectExpandRolloutBackprop();
  else if (view === 'uct exploration') yield* uctExploration();
  else throw new InputError('Pick an MCTS view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        {type: 'callout', text: 'MCTS spends search where samples can still change the move choice, while UCT keeps uncertain branches alive.'},
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a6/MCTS_Algorithm.png/250px-MCTS_Algorithm.png', alt: 'Monte Carlo tree search phases: selection, expansion, simulation, and backpropagation', caption: 'The four MCTS phases are selection, expansion, rollout, and backpropagation. Source: Wikimedia Commons, Yusha, CC BY-SA 4.0.'},
        'The animation shows a game tree growing one node at a time. Each node carries two numbers: wins and visits (e.g., 9/10 means 9 wins out of 10 simulations). Active highlights trace the path the algorithm is currently walking. Found markers show nodes whose statistics just changed.',
        'In the select-expand-rollout-backprop view, follow the four phases in sequence. The first frame shows the full loop. Subsequent frames highlight one phase each: selection walks from root to a frontier node by UCB1 scores, expansion adds one child, rollout simulates to a terminal state, and backpropagation updates win/visit counts on every ancestor.',
        'In the UCT exploration view, the score table breaks UCB1 into parts: Q (win rate), N (visit count), exploration bonus, and total score. The visit plot shows how iterations concentrate on stronger moves over time. Read the table left to right, then watch the plot confirm the pattern.',
      
        {type: 'image', src: './assets/gifs/monte-carlo-tree-search-uct-primer.gif', alt: 'Animated walkthrough of the monte carlo tree search uct primer visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Some games have too many positions to search exhaustively. Go has roughly 10^170 legal board positions and a branching factor around 250. Chess has about 10^47 positions. Even with alpha-beta pruning, exhaustive search is impossible at these scales.',
        'Coulom (2006) and Kocsis and Szepesvári (2006) introduced Monte Carlo Tree Search and its UCT variant to solve this problem. Instead of evaluating every position, MCTS samples: it plays thousands of simulated games, tracks which moves lead to wins, and gradually builds a partial tree that concentrates on promising moves.',
        'The key idea is treating computation as a budget. The algorithm does not try to see the whole tree. It grows only the branches that have earned attention, while reserving some budget for branches that have not been tested enough to dismiss.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The classical approach to perfect-information games is minimax: build the complete game tree, evaluate every leaf as a win or loss, and propagate values upward. Each player assumes the opponent plays optimally. For small games this works. Tic-tac-toe has 255,168 possible games, and minimax solves it completely.',
        'Alpha-beta pruning improves minimax by skipping branches that cannot affect the result. If a move is already proven worse than an alternative, its subtree is pruned. This roughly halves the effective depth of search, reducing b^d to about b^(d/2). For chess with branching factor ~35, alpha-beta plus a hand-crafted evaluation function (material count, king safety, pawn structure) produces strong play.',
        'The evaluation function is the critical piece: it scores non-terminal positions so the search does not need to reach the end of every game. In chess, decades of expert knowledge encode what makes a position good. The approach works because chess positions decompose into features that humans understand.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'Go breaks both pillars of the minimax approach. The branching factor is around 250 legal moves per position, and games run about 150 moves deep. Alpha-beta pruning reduces 250^150 to roughly 250^75, which is still absurdly large. No amount of pruning makes exhaustive search feasible.',
        'The evaluation function wall is worse. In chess, a piece advantage almost always translates to a winning position. In Go, the value of a stone group depends on the global board state. A cluster of stones that looks dead can become alive depending on stones placed on the opposite side of the board. No one succeeded in writing a static evaluator that captured these long-range dependencies. Before MCTS, the strongest Go programs played at weak amateur level.',
        'MCTS sidesteps both walls. It does not need to evaluate positions statically because it simulates games to completion. It does not need to search the full tree because it allocates simulation budget to branches that earn it through results.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/7/74/Normal_Distribution_PDF.svg', alt: 'Normal distribution curves with different means and variances', caption: 'UCB-style bonuses are an uncertainty policy: estimates with fewer samples keep a wider plausible range. Source: Wikimedia Commons, Inductiveload, public domain.'},
        'Each node stores statistics, not truth: visit count N, total wins W, and average win rate Q = W/N. A child with high Q looks promising but might be lucky. A child with low N is uncertain and might be underestimated.',
        'UCT (Upper Confidence bounds applied to Trees) turns that tension into a formula: UCB1 = w_i/n_i + c * sqrt(ln(N) / n_i). The first term is exploitation: prefer children that win often. The second term is exploration: prefer children that have been visited rarely relative to their parent. The constant c controls the tradeoff. With c = sqrt(2), UCB1 is theoretically optimal for the multi-armed bandit setting (Auer et al. 2002). In practice, c is tuned per domain.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Each MCTS iteration has four phases. Selection: starting from the root, choose children by UCB1 score until reaching a node with untried actions or a terminal state. This walks the tree along the currently most promising path. Expansion: add one new child node for an untried action. The tree grows by exactly one node per iteration, not by materializing the entire game tree.',
        'Simulation (rollout): from the new node, play moves to a terminal state. In classical MCTS, moves are chosen uniformly at random. In AlphaGo, a policy network proposes moves and a value network estimates the outcome, replacing or supplementing the random rollout. The result is a single number: +1 for a win, -1 for a loss, or a continuous value estimate.',
        'Backpropagation: walk back up the path from the new node to the root. At every node on the path, increment the visit count and add the simulation result to the win total. After backpropagation, every ancestor of the simulated node has updated statistics. The next selection pass will see those changes.',
        'After the budget of iterations is spent, the algorithm chooses the root child with the most visits, not the highest win rate. Visit count is more reliable because a child visited 5,000 times with a 60% win rate carries far more evidence than a child visited 20 times with a 95% win rate.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The accounting invariant is the foundation: after k iterations, every node on any selected path has its visit count incremented and its win total adjusted by exactly the simulation results that passed through it. Backpropagation preserves this invariant. No information is lost or double-counted.',
        'The exploration term is the self-correction mechanism. If a child is ignored while its parent accumulates visits, ln(N_parent) grows while n_child stays fixed, making the exploration bonus larger. Eventually the bonus forces the algorithm to revisit that child. If a child is visited often, its bonus shrinks and it must survive on exploitation alone. This guarantees that every child is visited infinitely often as iterations grow, so no move is permanently ignored.',
        'Under the assumptions of the multi-armed bandit setting, UCB1 achieves logarithmic regret: the number of times it pulls a suboptimal arm grows as O(ln(n)), not O(n). In tree search the assumptions are weaker because child node values depend on the policy below them, but the exploration-exploitation balance still drives convergence toward stronger play with more iterations.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Each iteration costs O(d) for selection (walking down the tree of depth d), O(1) for expansion (adding one node), O(L) for simulation (playing L moves to terminal state), and O(d) for backpropagation (updating d ancestors). Total per iteration: O(d + L). For Go, d is at most 150 and L is at most 150, so each iteration is cheap. Quality scales with the number of iterations: more simulations produce better statistics.',
        'Memory is O(number of expanded nodes). The tree stores only nodes that have been visited, not the entire game tree. In practice, a few hundred thousand nodes fit comfortably in memory even for Go.',
        'The algorithm is anytime: it returns its current best move whenever stopped. Ten iterations give a rough answer. Ten thousand give a much better one. This matters for real-time systems where the caller sets a time or compute budget. AlphaGo ran 100,000+ simulations per move; a mobile game might run 1,000.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/4/46/Colored_neural_network.svg', alt: 'Layered neural network diagram with colored nodes', caption: 'AlphaGo-style systems combine tree search with learned policy and value networks instead of pure random rollouts. Source: Wikimedia Commons, Glosser.ca, CC BY-SA 3.0.'},
        'Go is the landmark success. AlphaGo (Silver et al. 2016) combined MCTS with deep neural networks for policy and value estimation, defeating the world champion in 2016. AlphaGo Zero (2017) removed human game data entirely, learning from self-play MCTS alone.',
        'General game playing uses MCTS because it requires no domain-specific evaluation function: give it the rules, and it plays. Planning under uncertainty benefits when the planner can simulate outcomes: robot motion planning, scheduling, and resource allocation. Combinatorial optimization problems like chemical synthesis planning and drug discovery use MCTS to explore large action spaces where greedy heuristics get stuck.',
        'More recently, MCTS structures appear in LLM reasoning: Tree of Thoughts evaluates branching thought paths, and process reward models score intermediate reasoning steps. The reusable structure is the same: a tree with visit counts, value estimates, and budgeted exploration.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Games with deep tactics and reliable evaluation functions do not need MCTS. Chess engines using alpha-beta with hand-tuned evaluation functions remained competitive with MCTS-based approaches for decades, because the evaluation function is accurate and the branching factor is manageable. Alpha-beta searches deeper than MCTS can simulate.',
        'MCTS struggles when rollouts are uninformative. If random play produces outcomes that do not correlate with optimal play, the backed-up statistics are noise. This is why AlphaGo replaced random rollouts with neural network evaluation. Without a meaningful value signal, more iterations do not help.',
        'Real-time constraints limit MCTS because each iteration takes time. If the system can only afford 50 iterations, the statistics may not stabilize. High branching factors make this worse: with 1,000 legal actions, 50 iterations barely visit each child once.',
        'For agent and LLM planning, the deepest failure mode is a misleading value signal. If the verifier or simulator rewards the wrong thing, MCTS will spend its entire budget becoming confidently wrong. Search does not create a trustworthy objective; it optimizes whatever signal it is given.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'A simple game tree has root with three children: A (8 wins / 12 visits), B (9/10), and C (2/8). The root has N = 30 total visits. Compute UCB1 for each child with c = 1.4.',
        'Child A: Q = 8/12 = 0.667. Exploration bonus = 1.4 * sqrt(ln(30) / 12) = 1.4 * sqrt(3.401 / 12) = 1.4 * 0.532 = 0.745. UCB1 = 0.667 + 0.745 = 1.412.',
        'Child B: Q = 9/10 = 0.900. Bonus = 1.4 * sqrt(ln(30) / 10) = 1.4 * sqrt(0.340) = 1.4 * 0.583 = 0.816. UCB1 = 0.900 + 0.816 = 1.716.',
        'Child C: Q = 2/8 = 0.250. Bonus = 1.4 * sqrt(ln(30) / 8) = 1.4 * sqrt(0.425) = 1.4 * 0.652 = 0.913. UCB1 = 0.250 + 0.913 = 1.163.',
        'B wins selection (highest UCB1 = 1.716). Notice C gets the largest exploration bonus (0.913) because it has the fewest visits, but B still wins because its exploitation term (0.900) dominates. The algorithm descends into B, finds an untried child B2, expands it, runs a rollout that returns +1 (a win). Backpropagation updates: B2 becomes 1/1, B becomes 10/11, root becomes N = 31. On the next iteration, the updated statistics shift all three UCB1 scores.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Coulom 2006, "Efficient Selectivity and Backup Operators in Monte-Carlo Tree Search," introduced MCTS for computer Go. Kocsis and Szepesvári 2006, "Bandit-Based Monte-Carlo Planning," formalized the UCT algorithm by applying UCB1 to tree search. Silver et al. 2016, "Mastering the Game of Go with Deep Neural Networks and Tree Search," combined MCTS with deep learning in AlphaGo. Auer, Cesa-Bianchi, and Fischer 2002, "Finite-Time Analysis of the Multiarmed Bandit Problem," proved the UCB1 regret bound that UCT builds on.',
        'Study next: Multi-Armed Bandits for the exploration-exploitation theory UCB1 comes from. Minimax and Alpha-Beta Pruning for the classical game tree search that MCTS replaces. Reinforcement Learning and Q-Learning for model-free alternatives that learn value functions without tree search. Policy Gradient Methods for how AlphaGo Zero trains the policy network used inside MCTS. A* Search for heuristic-guided search in deterministic shortest-path problems.',
      ],
    },
  ],
};
