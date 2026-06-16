// Offline RL support constraints: static logged data, behavior-policy support,
// OOD action extrapolation, conservative Q-values, and deployment gates.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'offline-rl-support-constraint-extrapolation-case-study',
  title: 'Offline RL Support Constraint & Extrapolation Case Study',
  category: 'AI & ML',
  summary: 'An offline-RL primer: learn from static logs while tracking behavior-policy support, OOD actions, extrapolation error, pessimistic Q-values, and evaluation gates.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['dataset support', 'conservative update'], defaultValue: 'dataset support' },
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
  return matrixState({
    title,
    rows,
    columns,
    values: labelsByRow.map((row) => row.map(code)),
    format: (value) => labels[value],
  });
}

function offlineGraph(title, { risky = false } = {}) {
  return graphState({
    nodes: [
      { id: 'logs', label: 'logs', x: 0.8, y: 3.5, note: 'static' },
      { id: 'beh', label: 'beh pi', x: 2.3, y: 2.0, note: 'old policy' },
      { id: 'data', label: 'D', x: 2.3, y: 5.0, note: 's,a,r,s2' },
      { id: 'support', label: 'support', x: 4.2, y: 3.5, note: risky ? 'holes' : 'map' },
      { id: 'q', label: 'Q', x: 5.9, y: 2.0, note: risky ? 'over' : 'fit' },
      { id: 'pi', label: 'new pi', x: 5.9, y: 5.0, note: 'improve' },
      { id: 'ope', label: 'OPE', x: 7.7, y: 2.0, note: 'eval' },
      { id: 'sim', label: 'sim', x: 7.7, y: 5.0, note: 'stress' },
      { id: 'gate', label: 'gate', x: 9.2, y: 3.5, note: risky ? 'block' : 'ship' },
    ],
    edges: [
      { id: 'e-logs-beh', from: 'logs', to: 'beh' },
      { id: 'e-logs-data', from: 'logs', to: 'data' },
      { id: 'e-beh-support', from: 'beh', to: 'support', weight: 'prob' },
      { id: 'e-data-support', from: 'data', to: 'support', weight: 'cover' },
      { id: 'e-support-q', from: 'support', to: 'q', weight: risky ? 'gap' : 'mask' },
      { id: 'e-q-pi', from: 'q', to: 'pi', weight: risky ? 'OOD' : 'safe' },
      { id: 'e-q-ope', from: 'q', to: 'ope' },
      { id: 'e-pi-sim', from: 'pi', to: 'sim' },
      { id: 'e-ope-gate', from: 'ope', to: 'gate' },
      { id: 'e-sim-gate', from: 'sim', to: 'gate' },
    ],
  }, { title });
}

function* datasetSupport() {
  yield {
    state: offlineGraph('Offline RL starts with static logged experience'),
    highlight: { active: ['logs', 'beh', 'data', 'e-logs-beh', 'e-logs-data'], compare: ['pi'] },
    explanation: 'Offline RL tries to learn a better policy from a fixed dataset of transitions. Unlike online RL, the learner cannot safely try arbitrary new actions to discover what happens.',
  };

  yield {
    state: labelMatrix(
      'Support map',
      [
        { id: 'seen', label: 'seen' },
        { id: 'rare', label: 'rare' },
        { id: 'mix', label: 'mixed' },
        { id: 'ood', label: 'OOD' },
      ],
      [
        { id: 'meaning', label: 'means' },
        { id: 'policy', label: 'policy' },
      ],
      [
        ['many logs', 'learn'],
        ['few logs', 'caution'],
        ['many pi', 'slice'],
        ['no logs', 'avoid'],
      ],
    ),
    highlight: { active: ['seen:policy', 'rare:policy', 'ood:policy'], found: ['mix:meaning'] },
    explanation: 'The key data structure is a support map over state-action regions. Actions well covered by the behavior policy are learnable; out-of-distribution actions are guesses unless constrained or tested.',
    invariant: 'A Q-value for an unsupported action is a story, not evidence.',
  };

  yield {
    state: offlineGraph('OOD actions create extrapolation error', { risky: true }),
    highlight: { active: ['support', 'q', 'pi', 'gate', 'e-support-q', 'e-q-pi'], compare: ['data'] },
    explanation: 'Function approximation can assign high Q-values to actions never present in the dataset. A greedy policy then selects those unsupported actions and compounds the error.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'support', min: 0, max: 1 }, y: { label: 'Q error', min: 0, max: 1 } },
      series: [
        { id: 'plain', label: 'plain', points: [{ x: 0.1, y: 0.88 }, { x: 0.3, y: 0.67 }, { x: 0.6, y: 0.38 }, { x: 0.9, y: 0.24 }] },
        { id: 'cons', label: 'cons', points: [{ x: 0.1, y: 0.42 }, { x: 0.3, y: 0.32 }, { x: 0.6, y: 0.20 }, { x: 0.9, y: 0.10 }] },
      ],
      markers: [
        { id: 'danger', x: 0.18, y: 0.82, label: 'OOD' },
      ],
    }),
    highlight: { active: ['plain', 'danger'], compare: ['cons'] },
    explanation: 'The conceptual curve is the offline-RL hazard: error is largest where support is weakest. Conservative methods try to keep unsupported values pessimistic rather than letting the policy exploit hallucinated value.',
  };
}

function* conservativeUpdate() {
  yield {
    state: offlineGraph('Conservative learning penalizes unsupported optimism'),
    highlight: { active: ['support', 'q', 'pi', 'ope', 'e-support-q', 'e-q-pi', 'e-q-ope'], compare: ['sim'] },
    explanation: 'CQL-style methods learn a conservative Q-function so the policy is less tempted by unsupported high-value actions. IQL-style methods avoid explicit evaluation of out-of-dataset actions during value learning.',
  };

  yield {
    state: labelMatrix(
      'Offline RL defenses',
      [
        { id: 'bc', label: 'BC' },
        { id: 'cql', label: 'CQL' },
        { id: 'iql', label: 'IQL' },
        { id: 'ope', label: 'OPE' },
        { id: 'sim', label: 'sim' },
      ],
      [
        { id: 'move', label: 'move' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['copy', 'no improve'],
        ['pess', 'too safe'],
        ['in data', 'expectile'],
        ['weight', 'var'],
        ['stress', 'gap'],
      ],
    ),
    highlight: { active: ['bc:move', 'cql:move', 'iql:move'], compare: ['ope:risk', 'sim:risk'] },
    explanation: 'Offline RL is a family of constraints. Behavior cloning stays on support. CQL adds pessimism. IQL learns in-sample values and extracts a policy. OPE and simulation decide whether a policy deserves an online trial.',
  };

  yield {
    state: offlineGraph('Deployment needs OPE plus stress tests'),
    highlight: { active: ['pi', 'ope', 'sim', 'gate', 'e-pi-sim', 'e-ope-gate', 'e-sim-gate'], compare: ['q'] },
    explanation: 'A high offline score is not enough. The gate should combine off-policy evaluation, simulator stress, constraint checks, coverage slices, and a small guarded online rollout if the domain allows it.',
  };

  yield {
    state: labelMatrix(
      'Release ledger',
      [
        { id: 'data', label: 'data' },
        { id: 'support', label: 'support' },
        { id: 'q', label: 'Q' },
        { id: 'ope', label: 'OPE' },
        { id: 'roll', label: 'rollout' },
      ],
      [
        { id: 'must', label: 'must' },
        { id: 'blocker', label: 'block' },
      ],
      [
        ['version', 'unknown'],
        ['min', 'holes'],
        ['pess', 'spike'],
        ['CI', 'low ESS'],
        ['canary', 'unsafe'],
      ],
    ),
    highlight: { active: ['support:must', 'q:must', 'ope:must'], found: ['roll:blocker'] },
    explanation: 'The ledger makes offline RL auditable: dataset version, support threshold, conservative-value behavior, effective sample size, canary boundary, and rollback condition are all explicit.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'dataset support') yield* datasetSupport();
  else if (view === 'conservative update') yield* conservativeUpdate();
  else throw new InputError('Pick an offline RL view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'Offline reinforcement learning learns from a fixed dataset of logged transitions instead of interacting with the environment while training. That is attractive for robotics, recommender systems, healthcare, operations, and safety-critical settings where exploration is expensive or dangerous.',
        'D4RL was introduced as a benchmark suite for offline RL, explicitly focusing on dataset properties such as human demonstrations, hand-designed controllers, multitask data, and mixtures of policies: https://arxiv.org/abs/2004.07219. The benchmark exists because online-RL benchmarks do not expose the hard parts of learning from static logs.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The main data structure is a support map over state-action regions. If the dataset contains many examples of a state-action pair, the learner has evidence. If the dataset contains none, a Q-network can still hallucinate a high value, but the policy has no logged proof that the action is safe or useful. This is extrapolation error.',
        'Conservative Q-Learning addresses this by learning pessimistic Q-values that lower-bound policy value estimates and reduce unsupported optimism: https://arxiv.org/abs/2006.04779. Implicit Q-Learning takes a different route: it avoids evaluating out-of-dataset actions during value learning and extracts a policy from in-sample advantages: https://arxiv.org/abs/2110.06169.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Offline RL moves cost from simulator interaction to dataset governance and evaluation. Teams need behavior-policy metadata, action coverage, reward definitions, environment versions, off-policy evaluation, effective sample size, constraint checks, and canary rollout plans. Without those, an offline policy can look excellent because it exploits values in regions no one actually observed.',
        'The hardest production question is not whether the offline score improved. It is whether the new policy stays inside support where mistakes are bounded, and whether any improvement survives simulation, OPE, hidden slices, and guarded online trials.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Offline RL is useful when historical logs are rich and online exploration is costly: ad bidding, recommendations, robotic manipulation, autonomous driving logs, inventory control, and medical decision support. In all of these, the dataset is not just training material. It is the evidence boundary for what the learned policy is allowed to claim.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'Do not treat offline RL as supervised learning with rewards. A supervised model predicts labels for inputs drawn from a similar distribution. An offline RL policy changes the action distribution, which changes future states. That distribution shift is why support constraints and pessimism matter. Also do not treat simulator success as deployment proof; simulators have their own coverage gaps.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Sources: D4RL at https://arxiv.org/abs/2004.07219, Conservative Q-Learning at https://arxiv.org/abs/2006.04779, and Implicit Q-Learning at https://arxiv.org/abs/2110.06169. Study Value Iteration, Policy Gradients, Importance Sampling & Off-Policy Estimation, Doubly Robust Estimation, Contextual Bandit Logged Policy Evaluation, and RL Experiment Reproducibility Ledger next.',
      ],
    },
  ],
};
