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
        'Read each node as a partial record of simulated games. Wins divided by visits is the current value estimate, active marks the path being selected, and found marks the node whose statistics changed.',
        'The safe inference rule is budgeted evidence. A child with few visits is uncertain, so UCT can select it even when its current win rate is lower.',
        {type: 'image', src: './assets/gifs/monte-carlo-tree-search-uct-primer.gif', alt: 'Animated walkthrough of the monte carlo tree search uct primer visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Monte Carlo Tree Search, or MCTS, exists for decision trees too large to search completely. A game tree branches at every legal move, and the number of leaves grows exponentially with depth.',
        'Instead of proving the value of every move, MCTS samples possible futures. It spends computation on branches whose statistics can still change the root decision.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is minimax search. Build the game tree to a depth limit, score the leaves, and back up values assuming both players choose their best moves.',
        'This works when the branching factor is small enough and the evaluation function is trustworthy. Chess engines made this approach powerful with alpha-beta pruning and strong position evaluators.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is that some games have huge branching factors and weak hand-written evaluators. Go was the classic case: many legal moves exist, and local-looking positions can depend on far-away stones.',
        'If a position has 250 legal moves and the search looks 20 plies ahead, the raw tree has 250^20 leaves. Pruning helps only when the evaluator gives reliable early ordering, and many domains do not provide that.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/7/74/Normal_Distribution_PDF.svg', alt: 'Normal distribution curves with different means and variances', caption: 'UCB-style bonuses are an uncertainty policy: estimates with fewer samples keep a wider plausible range. Source: Wikimedia Commons, Inductiveload, public domain.'},
        'Treat each move as an experiment arm with an uncertain value. The algorithm should prefer moves that have won often, but it must also revisit moves with too few samples.',
        'UCT, which means Upper Confidence bounds applied to Trees, uses a score with two parts: average reward plus an exploration bonus. The bonus shrinks as a child receives more visits.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Each iteration performs selection, expansion, simulation, and backpropagation. Selection walks from the root by UCT score until it reaches a node with an untried action.',
        'Expansion adds one child, simulation estimates the result from that child, and backpropagation updates every node on the selected path. After many iterations, the root chooses the child with the strongest visit evidence.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The accounting invariant is that a node records exactly the simulations that passed through it. Backpropagation preserves this by adding one visit and the same result to every ancestor on the path.',
        'The exploration term prevents permanent neglect. If a parent is visited often while one child is ignored, the child bonus grows relative to its sample count until the algorithm tests it again.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'One iteration costs O(d + r), where d is tree depth walked during selection and backpropagation, and r is rollout length or evaluation cost. Memory is O(m), where m is the number of expanded nodes.',
        'Quality improves with iterations rather than with a fixed complete search depth. If the budget doubles from 10,000 to 20,000 simulations, the tree does roughly twice as much sampling and reduces uncertainty most on contested moves.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/4/46/Colored_neural_network.svg', alt: 'Layered neural network diagram with colored nodes', caption: 'AlphaGo-style systems combine tree search with learned policy and value networks instead of pure random rollouts. Source: Wikimedia Commons, Glosser.ca, CC BY-SA 3.0.'},
        'MCTS is used in game playing, planning, synthesis search, molecule design, and systems that can simulate candidate actions. The fit is strongest when the simulator is cheaper than exhaustive reasoning.',
        'Modern neural systems often replace random rollouts with learned policy and value models. The tree still provides lookahead, while the model makes each simulation more informative.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'MCTS fails when simulations are cheap but uninformative. If rollout outcomes do not correlate with good play or good plans, the tree stores noise with confidence.',
        'It also struggles with enormous action spaces under tiny budgets. If there are 1,000 legal actions and only 100 iterations, most actions are barely touched, so the visit counts cannot stabilize.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'At the root, suppose A has 8 wins in 12 visits, B has 9 in 10, and C has 2 in 8. With parent visits N = 30 and c = 1.4, A scores 8/12 + 1.4 * sqrt(ln 30 / 12), about 1.412.',
        'B scores 9/10 + 1.4 * sqrt(ln 30 / 10), about 1.716. C scores 2/8 + 1.4 * sqrt(ln 30 / 8), about 1.163. Selection picks B, then a rollout result updates B and the root before the next iteration recalculates the scores.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Study Coulom on Monte Carlo tree search, Kocsis and Szepesvari on UCT, Auer et al. on UCB1, and Silver et al. on AlphaGo. The chain is useful because UCT is bandit theory placed inside a tree.',
        'Next study Multi-Armed Bandits for exploration bonuses, Minimax and Alpha-Beta Pruning for the classical baseline, and Reinforcement Learning for value functions that replace random rollouts.',
      ],
    },
  ],
};