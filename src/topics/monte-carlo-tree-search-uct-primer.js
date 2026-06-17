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
      heading: 'Why this exists',
      paragraphs: [
        'Many decision problems sit between two simpler worlds. Exhaustive minimax or dynamic programming is too expensive because the tree is enormous. Pure random simulation is too wasteful because the choices are not equally promising.',
        'Monte Carlo Tree Search exists for that middle ground. It treats computation as a budget to allocate. The algorithm grows only the parts of the tree that have earned attention, while still reserving some budget for choices that have not been tested enough.',
        'That budget framing is the reason MCTS remains useful outside board games. When a system can try only a limited number of plans, proofs, tool calls, or action sequences, it needs a disciplined way to spend samples on both promising and uncertain branches.',
      ],
    },
    {
      heading: 'The core idea',
      paragraphs: [
        'Each node stores statistics, not a final truth: visit count N, accumulated value W, and average value Q = W / N. A child with high Q looks promising. A child with low N is still uncertain.',
        'UCT, Upper Confidence bounds applied to Trees, turns that tension into a score: Q + c * sqrt(log(N_parent) / N_child). The first term exploits observed value. The second term explores children that have received too little attention. The constant c controls how aggressively the search pays for uncertainty.',
      ],
    },
    {
      heading: 'The mechanics',
      paragraphs: [
        'One iteration has four phases. Selection walks down existing tree edges by UCT. Expansion adds one untried child at the selected frontier. Simulation estimates the outcome from that child with a rollout, learned value model, test run, environment call, or verifier. Backpropagation updates every node on the selected path.',
        'The final move is usually chosen by visit count at the root, not by a single lucky value estimate. A heavily visited child has survived repeated attempts to disprove it. That makes the root policy more stable than choosing the largest Q after a small number of samples.',
      ],
    },
    {
      heading: 'Invariant and proof idea',
      paragraphs: [
        'The local invariant is accounting: after k iterations, a node has N equal to the number of simulations whose selected path passed through that node, W equal to the sum of backed-up rewards for those simulations, and Q equal to W / N when N is positive. Backpropagation is the operation that preserves this invariant.',
        'The exploration term is the self-correction mechanism. If a child is ignored while its parent keeps receiving visits, log(N_parent) rises while N_child stays fixed, so the child becomes more attractive. If a child is selected often, its bonus shrinks and it must keep winning on value. Under clean bandit assumptions this is what makes UCB-style allocation converge toward better arms. In tree search, the same idea is useful, but the assumptions depend on rollout quality and game dynamics.',
      ],
    },
    {
      heading: 'How the visual model teaches it',
      paragraphs: [
        'In the select-expand-rollout-backprop view, read the first frame as the whole loop, then follow the highlighted path from root to B. That highlight means B receives the next simulation; it does not mean B is permanently best.',
        'When B2 appears, the tree is spending one expansion on one new child, not materializing the full game tree. When rollout and value light up, the algorithm is producing one sample. In the backprop frame, check that only B2, B, and root change statistics. That is the accounting invariant in motion.',
        'In the UCT exploration view, read the score table left to right. Q is the current value estimate, N is how much evidence exists, the bonus is the uncertainty payment, and score is the selection priority. The visit plot then shows the expected behavior: early spread, later concentration, and occasional revisits to weaker branches because their uncertainty term never disappears completely.',
      ],
    },
    {
      heading: 'Cost and behavior',
      paragraphs: [
        'One iteration costs a descent through the current tree, optional child creation, one evaluation, and a backpropagation over the same path. If depth is d and the evaluation costs E, the rough cost is O(d + E) per iteration. Memory is O(number of expanded nodes).',
        'The algorithm is anytime. After ten iterations it has a current recommendation; after ten thousand it usually has a better one. That property matters in games, robotics, and agent planning because the caller can stop at a latency or compute budget instead of waiting for complete search.',
      ],
    },
    {
      heading: 'Design checklist',
      paragraphs: [
        'Before using MCTS, define the state representation, legal-action generator, transition rule, terminal condition, value signal, and budget. If any of those are vague, the tree will look scientific while optimizing a poorly specified process. For agent workflows, this means deciding exactly what counts as an action and exactly which verifier produces the backed-up value.',
        'Tune exploration against the evaluation noise. A high exploration constant keeps checking uncertain branches, which helps when early values are unreliable. A low constant commits faster, which helps when the value signal is strong and budget is tight. The right value is empirical; log visit counts and root choices under different budgets instead of treating c as a magic constant.',
      ],
    },
    {
      heading: 'Testing search quality',
      paragraphs: [
        'Use small games or toy planning problems where the optimal move is known. Check that more iterations improve the root choice on average, that visit counts concentrate on stronger actions, and that the algorithm still explores an initially under-sampled winner. These tests catch sign errors in reward backup and mistakes in the UCT formula.',
        'For noisy or learned evaluators, compare against ablations: random rollouts only, policy priors only, value-only selection, and exhaustive search on small instances. MCTS earns its complexity only when the loop beats simpler ways to spend the same compute.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'MCTS is strong when legal actions can be generated, states can be advanced or evaluated, and many imperfect samples are more useful than one shallow heuristic. Go programs, game-playing systems, robot planning, program search, and verifier-guided reasoning all fit this shape when the value signal is meaningful.',
        'It also fits domains where action quality is uneven. If one branch starts producing better evidence, the tree naturally gives it more simulations without deleting the alternatives.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'MCTS fails when the simulator lies, the verifier rewards the wrong thing, rollouts are too noisy, or evaluations are so expensive that the search cannot gather enough samples. It also struggles when the branching factor is huge and there is no policy to propose plausible actions.',
        'For LLM planning, the warning is sharper: search does not create a trustworthy objective. If the proposal model and verifier share the same blind spot, MCTS can spend more computation becoming confidently wrong.',
        'It can also overfit the search budget. A move that looks best after 100 rollouts may not be best after 10,000, and a production system may only have time for 100. Treat the chosen budget as part of the algorithm, not as an implementation detail.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'Suppose the root has actions A, B, and C. B has the best current average value, C has fewer visits, and A is middling on both. UCT computes all three scores. If B still wins after paying C its exploration bonus, B receives the next descent.',
        'The selected path reaches B2, a new leaf. A rollout returns +1. Backpropagation increments B2, B, and root, adds +1 to their accumulated values, and changes their averages. On the next iteration, the tree is not starting over; it is selecting with a slightly better map of the search space.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Primary sources: Michael C. Fu, Monte Carlo Tree Search: A Tutorial at https://www.informs-sim.org/wsc18papers/includes/files/021.pdf and Browne et al., A Survey of Monte Carlo Tree Search Methods at https://www.incompleteideas.net/609%20dropbox/other%20readings%20and%20resources/MCTS-survey.pdf.',
        'Study Multi-Armed Bandits for exploration bonuses, Thompson Sampling for uncertainty-driven allocation, Tree Traversals for the explicit tree, Value Iteration for planning with known transitions, Tree of Thoughts Search Case Study for LLM thought search, and Process Reward Models & Verifier Search for learned step scoring.',
      ],
    },
  ],
};
