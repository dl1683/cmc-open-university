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
  yield {
    state: loopGraph('MCTS repeats four operations'),
    highlight: { active: ['select', 'expand', 'simulate', 'backprop'], found: ['stats'] },
    explanation: 'Monte Carlo Tree Search grows a tree gradually. Each iteration selects a promising path, expands one new child, simulates an outcome, and backpropagates the result into visit and value statistics.',
    invariant: 'The tree stores statistics, not guaranteed truth.',
  };

  yield {
    state: mctsGraph('Select a child with UCT'),
    highlight: { active: ['root', 'b', 'e-root-b'], compare: ['a', 'c'] },
    explanation: 'UCT chooses a child by combining average value with an exploration bonus. A child that looks good gets visits; a child that is underexplored also gets visits so it is not ignored too early.',
  };

  yield {
    state: mctsGraph('Expand one new leaf under the selected path'),
    highlight: { active: ['b', 'b2', 'e-b-b2'], found: ['rollout'] },
    explanation: 'The tree does not expand every possible move immediately. It adds one child when the selected path reaches a node that still has untried actions.',
  };

  yield {
    state: mctsGraph('Roll out from the new leaf'),
    highlight: { active: ['b2', 'rollout', 'value', 'e-b2-rollout', 'e-rollout-value'], compare: ['b1'] },
    explanation: 'A rollout estimates the value of the new state. In games this can be a random playout, a policy-guided playout, or a neural value estimate. In LLM planning it might be a simulator, test run, or verifier score.',
  };

  yield {
    state: mctsGraph('Backpropagate the result to ancestors', { root: 'N=31', b: '10/11', b2: '1/1', value: '+1' }),
    highlight: { active: ['value', 'b2', 'b', 'root', 'e-rollout-value', 'e-b-b2', 'e-root-b'], found: ['b'] },
    explanation: 'Backpropagation updates every node on the selected path: visits increase, total value changes, and the average value Q changes. The next selection step will see those new statistics.',
  };
}

function* uctExploration() {
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
    explanation: 'UCT has the shape Q + c * sqrt(log(parent visits) / child visits). Q exploits known value. The bonus explores children with fewer visits. The constant c sets how curious the search is.',
  };

  yield {
    state: visitPlot(),
    highlight: { active: ['b', 'shift'], compare: ['c'] },
    explanation: 'Early iterations spread visits across actions. As evidence arrives, visits concentrate on the action with stronger value, while the exploration term still occasionally checks alternatives.',
  };

  yield {
    state: labelMatrix(
      'Search ingredients',
      [
        { id: 'state', label: 'state' },
        { id: 'action', label: 'action' },
        { id: 'policy', label: 'policy' },
        { id: 'value', label: 'value' },
        { id: 'budget', label: 'budget' },
      ],
      [
        { id: 'game', label: 'game' },
        { id: 'agent', label: 'agent' },
      ],
      [
        ['board', 'workspace'],
        ['move', 'tool call'],
        ['prior move', 'proposal'],
        ['win prob', 'verifier'],
        ['rollouts', 'latency'],
      ],
    ),
    highlight: { active: ['policy:agent', 'value:agent', 'budget:agent'], compare: ['state:game'] },
    explanation: 'MCTS transfers cleanly only when these ingredients exist. For coding agents, state may be the repository snapshot, actions are edits or commands, and value comes from tests or verifiers.',
  };

  yield {
    state: mctsGraph('Bad value estimates can mislead the tree'),
    highlight: { active: ['a', 'b', 'c'], compare: ['rollout', 'value'] },
    explanation: 'MCTS is not magic. If rollouts are noisy, value estimates are biased, or the simulator misses important constraints, search spends budget optimizing the wrong signal.',
  };

  yield {
    state: loopGraph('Classical MCTS connects to modern verifier search'),
    highlight: { active: ['select', 'simulate', 'backprop', 'stats'], found: ['move'] },
    explanation: 'Tree of Thoughts evaluates thought states; PRM search scores reasoning steps; AlphaZero-style systems use policy and value networks inside MCTS. The reusable data structure is the same: a tree with visit counts, value estimates, and budgeted exploration.',
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
      heading: 'What it is',
      paragraphs: [
        'Monte Carlo Tree Search, or MCTS, is a best-first simulation search method. It builds a search tree incrementally, using sampled outcomes to decide which branches deserve more computation. UCT, Upper Confidence bounds applied to Trees, balances exploitation of high-value branches with exploration of under-visited branches.',
        'The core loop is selection, expansion, simulation, and backpropagation. Each node stores visits N, total value W, and average value Q. Selection uses those statistics to decide where the next simulation should go.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Selection walks from the root to a leaf by maximizing a UCT-style score such as Q + c * sqrt(log(parent visits) / child visits). Expansion adds one new child. Simulation estimates the outcome from that child, either by random rollout, a policy, a learned value function, or an external verifier. Backpropagation updates every node on the path.',
        'The algorithm is attractive because it is anytime. More iterations usually improve estimates, but there is always a current best move. That makes it useful when exhaustive search is impossible and the system has a fixed budget.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'At the root, actions A, B, and C have different visit counts and win estimates. B currently has the best average value, but C has fewer visits and therefore a larger exploration bonus. UCT computes a score for each child and selects the next branch to simulate. After a rollout returns +1, the selected leaf, its parent, and the root all update their visit and value statistics.',
        'This same shape appears in modern AI planning. AlphaZero-style systems use neural policy and value networks to guide MCTS. LLM planning systems can use a proposal model for actions and a verifier or environment rollout for value, although the quality of the simulator and verifier becomes the limiting factor.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Each iteration costs one tree descent, one expansion, one rollout or evaluation, and one backpropagation along the selected path. Total cost is the number of iterations times the rollout or verifier cost. Memory grows with the number of expanded nodes. A large branching factor or expensive simulator can dominate quickly.',
        'MCTS is robust to partial information, but not immune to bad signals. If rollouts are biased, if the value function is miscalibrated, or if the simulator omits important constraints, the search can become confidently wrong. This is the same verifier-quality lesson taught by Process Reward Models & Verifier Search.',
      ],
    },
    {
      heading: 'Primary sources and study next',
      paragraphs: [
        'Primary sources: Michael C. Fu, Monte Carlo Tree Search: A Tutorial at https://www.informs-sim.org/wsc18papers/includes/files/021.pdf and Browne et al., A Survey of Monte Carlo Tree Search Methods at https://www.incompleteideas.net/609%20dropbox/other%20readings%20and%20resources/MCTS-survey.pdf.',
        'Study Multi-Armed Bandits for exploration bonuses, Thompson Sampling for uncertainty-driven allocation, Tree Traversals for the explicit tree, Value Iteration for planning with known transitions, Tree of Thoughts Search Case Study for LLM thought search, and Process Reward Models & Verifier Search for learned step scoring.',
      ],
    },
  ],
};
