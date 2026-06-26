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
    explanation: 'The graph starts with logged behavior, not a live simulator. Offline RL wants a better policy, but every claim must come from transitions already in the dataset because unsafe new actions cannot be tried during training.',
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
    explanation: 'Read the support map as an evidence boundary. Seen actions can be learned, rare actions need caution, and OOD actions have no logged proof. A high Q-value outside support is a hypothesis, not evidence.',
    invariant: 'A Q-value for an unsupported action is a story, not evidence.',
  };

  yield {
    state: offlineGraph('OOD actions create extrapolation error', { risky: true }),
    highlight: { active: ['support', 'q', 'pi', 'gate', 'e-support-q', 'e-q-pi'], compare: ['data'] },
    explanation: 'The risky path shows extrapolation error. A function approximator can invent a high value for an unsupported action, and a greedy policy will select it because the table has no counterexample.',
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
    explanation: 'The curve states the offline-RL hazard: as support falls, value error rises. The conservative curve stays lower because pessimism prevents unsupported actions from looking better than actions the data actually covers.',
  };
}

function* conservativeUpdate() {
  yield {
    state: offlineGraph('Conservative learning penalizes unsupported optimism'),
    highlight: { active: ['support', 'q', 'pi', 'ope', 'e-support-q', 'e-q-pi', 'e-q-ope'], compare: ['sim'] },
    explanation: 'The conservative update changes what the policy is allowed to trust. CQL pushes unsupported Q-values down; IQL learns values from in-dataset actions and extracts a policy from in-sample advantages.',
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
    explanation: 'Each row is a defense against leaving support. Behavior cloning copies the logger, CQL adds pessimism, IQL stays in data during value learning, and OPE plus simulation decide whether improvement is credible enough to test.',
  };

  yield {
    state: offlineGraph('Deployment needs OPE plus stress tests'),
    highlight: { active: ['pi', 'ope', 'sim', 'gate', 'e-pi-sim', 'e-ope-gate', 'e-sim-gate'], compare: ['q'] },
    explanation: 'The gate combines independent evidence because offline score can be inflated by unsupported values. OPE checks logged evidence, simulator stress checks dynamics, slices check coverage, and a canary rollout bounds live risk.',
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
    explanation: 'The ledger is the release contract. It records dataset version, minimum support, conservative-value behavior, OPE confidence, effective sample size, canary boundary, and rollback condition so a policy is not promoted on a single score.',
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
      heading: 'How to read the animation',
      paragraphs: [
        'Read the dataset-support view as a map of where the logged data gives evidence. A state is the situation, an action is the choice, and a policy is the rule that picks actions. Active marks the candidate action currently being evaluated. Visited marks logged actions already used to define the support boundary.',
        {type:'callout', text:'Offline RL is a support-boundary problem: policy improvement is credible only where logged behavior supplies evidence.'},
        'Support means the set of state-action pairs that appear often enough in the dataset to estimate value. A safe inference rule is this: a learned policy should not trust a high value for an action that the dataset never showed in similar states.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Reinforcement learning learns from rewards after actions. Online reinforcement learning can try actions in the environment and learn from the outcome. Offline reinforcement learning must learn from a fixed log, such as robot demonstrations, medical treatment histories, or customer-interaction data.',
        'Offline learning exists because exploration can be expensive, dangerous, or impossible. A robot arm can damage hardware, a medical policy can harm patients, and a production recommender can lose users. The fixed dataset is safer, but it only contains evidence for actions that were actually tried.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is to reuse off-policy Q-learning on the logged dataset. A Q-value estimates the future reward of taking an action in a state. If the model predicts a high Q-value for an action, the policy chooses that action.',
        'That approach is reasonable because off-policy methods are meant to learn about one policy from data generated by another. It works when the dataset covers the actions the new policy wants to take. The problem is that function approximators can assign confident values outside the data.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is extrapolation error. A neural network may predict that an unseen action has high value because it generalizes from nearby data. The Bellman update then uses that optimistic prediction as a target, causing the policy to choose even more out-of-support actions.',
        'This creates a feedback loop without environment correction. Online learning would try the action and discover the mistake. Offline learning cannot. The dataset is both the evidence and the boundary of safe estimation.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'The core insight is to constrain improvement to the support of the data or to penalize values outside it. A support constraint says the learned policy should choose actions similar to logged actions in similar states. A conservative value method says unseen actions should not receive optimistic estimates.',
        'This does not mean copying the behavior policy forever. It means policy improvement must pay for uncertainty. The learner can improve where the dataset has enough coverage and should become cautious where the log is thin.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'One family of methods learns a behavior model, which estimates which actions the logger would take in each state. During policy improvement, actions far from that behavior distribution are rejected or down-weighted. The learned policy is allowed to choose better actions inside the region the data supports.',
        'Another family modifies the Q objective. Conservative Q-learning, for example, lowers values for actions not well supported by the data while still fitting observed transitions. The penalty prevents the policy from winning the optimization by exploiting value guesses in empty regions.',
        'The animation shows this as a boundary around logged actions. Candidate actions inside the boundary can be evaluated from evidence. Candidate actions outside the boundary may still be possible in the real world, but the offline learner does not have enough data to trust them.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The correctness argument is a pessimism invariant. When uncertainty is high because support is low, the value estimate should not be allowed to become the optimistic target that drives policy improvement. This keeps Bellman backups from amplifying guesses into policy choices.',
        'The guarantee is not that the learned policy is globally optimal. The guarantee is narrower: improvement is tied to regions where logged evidence can evaluate actions, or else it is penalized for leaving those regions. That is the right contract for learning without new interaction.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Training cost is usually higher than ordinary supervised learning because each update estimates values, targets, and often support or conservatism penalties. If a batch has 256 transitions and the method samples 10 candidate actions per state to penalize unsupported values, one update evaluates about 2,560 candidate actions in addition to observed actions.',
        'The behavior cost is conservatism. Strong constraints reduce dangerous extrapolation but can block real improvement. Weak constraints improve more aggressively but may exploit unsupported value errors. The main tuning problem is deciding how much pessimism the dataset quality deserves.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Offline RL fits robotics, recommender systems, bidding systems, operations control, and healthcare decision support when historical logs exist and live exploration is risky. It is useful when actions have delayed effects and simple supervised imitation would miss long-term reward.',
        'The support idea also helps evaluate whether a proposed policy is credible. If a policy repeatedly chooses actions outside logged support, its estimated return should be treated as a model artifact. Support diagnostics are therefore part of the safety case, not just the training algorithm.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Offline RL fails when the dataset is too narrow for the desired policy. If a robot log never includes reaching behind an object, no support constraint can prove that action safe. The best answer may be more data, a simulator, or a limited online fine-tuning phase.',
        'It also fails when the logged data has hidden confounding, missing rewards, nonstationary behavior, or state variables that do not capture why the behavior policy acted. A support boundary in the observed feature space can look safe while hiding real differences that matter for outcomes.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Suppose a logged driving dataset has 10,000 lane-change decisions near a merge. In states with speed 55 mph and gap 35 m, 8,000 examples keep lane, 1,900 merge gently, and 100 brake hard. The dataset has support for keep-lane and gentle merge, but weak support for hard braking.',
        'A naive Q model predicts values 8.0 for keep lane, 8.5 for gentle merge, and 12.0 for hard braking because the network extrapolated from rare cases. A support-constrained policy rejects hard braking unless enough similar examples exist, so it chooses gentle merge. A conservative method may reduce the unsupported action value from 12.0 to 6.0 before policy improvement.',
        'If new data later adds 2,000 safe hard-braking examples in the same state region, the boundary changes. The policy can then consider that action with evidence. The algorithm did not declare the action impossible; it refused to trust it without data.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Start with Conservative Q-Learning at https://arxiv.org/abs/2006.04779, Batch-Constrained deep Q-learning at https://arxiv.org/abs/1812.02900, and the D4RL benchmark paper at https://arxiv.org/abs/2004.07219. Use these to separate support constraints, pessimistic value learning, and benchmark limitations.',
        'Next, study Bellman backups, off-policy evaluation, behavior cloning, distribution shift, fitted Q iteration, importance sampling, doubly robust estimators, and online fine-tuning. The reusable lesson is that a model trained on logs should know where the logs stop speaking.',
      ],
    },
  ],
};
