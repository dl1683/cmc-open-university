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
      heading: 'Why this exists',
      paragraphs: [
        'Reinforcement learning usually assumes the learner can try actions, observe rewards, and improve through interaction. That is a bad fit for many real systems. A robot can break hardware while exploring. A recommender can damage user trust. A medical policy cannot try unsafe treatments just to learn their value. Offline reinforcement learning exists for settings where historical logs are available but live exploration is expensive, unethical, slow, or dangerous.',
        'The input is a fixed dataset of transitions: state, action, reward, next state, and sometimes the probability that the old behavior policy took the action. The goal is to learn a better policy without collecting new training data during learning. That sounds close to supervised learning, but it is not. A policy changes which actions are taken, and those actions change future states. That feedback loop is what makes offline RL hard.',
        {type:'callout', text:'Offline RL is a support-boundary problem: policy improvement is credible only where logged behavior supplies evidence.'},
      ],
    },
    {
      heading: 'The naive approach',
      paragraphs: [
        'A reasonable first attempt is to take an online RL algorithm, replace live experience with logged experience, and train a value function from the static dataset. If the Q-network predicts that action A has higher return than action B, choose action A. This is the same greedy improvement step that works in many online settings.',
        'Another tempting baseline is behavior cloning. Train a supervised model to imitate the logged policy, then deploy the clone. That can be safe when the behavior policy was good, but it does not solve the improvement problem. A perfect clone repeats the old policy, including its blind spots.',
        'The wall appears when the learned policy chooses actions that the dataset barely covers or never covers. A function approximator can still assign those actions high Q-values. The dataset has no counterexample because the behavior policy did not try them. The greedy policy then exploits the model error. In offline RL, missing evidence is not neutral. It is a source of overconfidence.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'The core insight is support. A state-action pair is in support when the dataset contains enough similar examples to make a value estimate credible. Well-covered actions can be learned from. Rare actions need caution. Out-of-distribution actions are not proven safe just because the value network gives them a high number.',
        'Offline RL methods differ in how they respect this boundary. Behavior cloning stays close to the logger. Conservative Q-Learning pushes down Q-values for actions that are not well supported. Implicit Q-Learning avoids explicit maximization over out-of-dataset actions during value learning and extracts a policy from in-sample advantages. Off-policy evaluation and simulators add separate evidence before deployment.',
      ],
    },
    {
      heading: 'How the mechanism works',
      paragraphs: [
        'The pipeline starts with logs and a behavior policy. The behavior policy may be explicit, as in a logged recommender that recorded action probabilities, or implicit, as in a robot dataset collected by a controller and human operators. The first job is to describe coverage: which states appear, which actions were tried there, how often they were tried, and which regions are thin.',
        'A support map can be exact for small discrete problems, but most real problems need approximations. Teams estimate density, nearest-neighbor coverage, action frequency by slice, behavior-policy likelihood, uncertainty, or ensemble disagreement. The goal is not a perfect map. The goal is to stop the learned policy from treating unsupported regions as if they had the same evidence as common logged behavior.',
        'Value learning then adds a constraint. Conservative methods penalize unsupported optimism. In CQL, the objective discourages high Q-values for actions outside the data distribution. In IQL, the value function is learned from in-dataset actions, and the policy is extracted by advantage-weighted behavior cloning. Both methods are trying to avoid the same failure: maximizing over actions whose values were mostly invented.',
        'A release ledger closes the loop. It records dataset version, reward definition, environment version, support thresholds, value-model behavior, off-policy evaluation estimates, effective sample size, simulator stress results, canary limits, and rollback rules. A policy should not ship because one offline score went up.',
      ],
    },
    {
      heading: 'What the visual is proving',
      paragraphs: [
        'The dataset-support view proves that the dataset is not just a bag of examples. It is the evidence boundary for the learned policy. The graph starts with static logs, derives behavior-policy support, learns Q-values, proposes a new policy, and then routes that policy through evaluation gates. The support node is the center because every later claim depends on coverage.',
        'The error plot proves the main hazard. As support falls, value error rises. A plain value learner can make unsupported actions look attractive because nothing in the data pushes those predictions back down. The conservative curve is lower because pessimism turns missing evidence into a penalty. The conservative-update view then shows the deployment lesson: OPE, simulator stress, slices, and canaries are independent checks, not optional decorations.',
      ],
    },
    {
      heading: 'Why the method works',
      paragraphs: [
        'Support constraints work because they limit distribution shift. If the new policy stays near actions the behavior policy actually tried, the logged data contains some evidence about likely outcomes. The estimate can still be biased or noisy, but it is anchored. If the new policy moves far outside support, the estimate is mostly extrapolation.',
        'Pessimism works because the dangerous error is asymmetric. Underestimating an unsupported action may lose a possible improvement. Overestimating an unsupported action can make the policy choose it repeatedly and drive the system into states the dataset never covered. Conservative methods deliberately prefer the first error over the second.',
        'Off-policy evaluation adds another guard, but it has its own limits. Importance sampling can become high variance when the new policy differs from the behavior policy. Doubly robust estimators combine models with importance weights, but they still depend on coverage and model quality. A simulator can reveal obvious failures, yet it may not match the real environment. This is why production gates combine evidence instead of trusting one number.',
      ],
    },
    {
      heading: 'Costs and tradeoffs',
      paragraphs: [
        'Offline RL saves interaction cost, but it increases data and evaluation cost. The team needs logs with stable schemas, rewards that still mean what they meant when collected, action probabilities when possible, environment-version metadata, support diagnostics, hidden validation slices, and a release process. A pile of transitions is not enough.',
        'The main algorithmic tradeoff is improvement versus safety. Behavior cloning is simple and stable, but it may not improve. Conservative methods can improve while limiting unsupported actions, but they may become too pessimistic. Aggressive value maximization can find large apparent gains, but those gains may be artifacts of extrapolation error. The right amount of conservatism depends on the domain cost of a bad action.',
      ],
    },
    {
      heading: 'Real use cases',
      paragraphs: [
        'Offline RL is useful when logged decision data is rich and random exploration is unacceptable. Recommenders can learn from historical ranking logs. Ad systems can learn bidding policies from past auctions. Robotics teams can train from demonstrations and controller data. Autonomous-driving teams can learn from recorded scenarios. Operations teams can tune inventory, pricing, or resource allocation from historical decisions.',
        'The fit is strongest when actions and rewards are recorded carefully, the behavior policy is not too narrow, and deployment can start with guarded online trials. It is weakest when the logs hide the action probabilities, rewards are delayed or confounded, the environment has changed, or rare catastrophic failures are not represented in the data.',
      ],
    },
    {
      heading: 'Failure modes',
      paragraphs: [
        'The first mistake is treating offline RL as supervised learning with rewards. Supervised learning predicts labels under a mostly fixed input distribution. A deployed policy changes the action distribution and therefore the future state distribution. That is a different problem.',
        'The second mistake is trusting an offline benchmark score without asking which dataset slices support the improved actions. A policy can improve on common states while creating risk in rare states. The third mistake is trusting a simulator as proof. Simulators are useful stress tools, but they have their own missing cases and modeling errors.',
        'The fourth mistake is changing rewards after the fact. If the reward definition is edited until the learned policy looks good, the evaluation no longer measures the original goal. Reward design, dataset versioning, and release gates need the same audit discipline as model code.',
      ],
    },
    {
      heading: 'What to study next',
      paragraphs: [
        'Study value iteration to understand Bellman backups, Q-learning to see why maximization over actions matters, policy gradients for the contrast with direct policy optimization, and contextual bandits for the simpler one-step logged-policy case. Then study importance sampling, weighted importance sampling, and doubly robust estimation for off-policy evaluation.',
        'For offline RL itself, read the D4RL benchmark paper for dataset-centered evaluation, Conservative Q-Learning for pessimistic value learning, and Implicit Q-Learning for in-sample value learning. After that, connect this topic to uncertainty estimation, safe exploration, model-based RL, and experiment ledgers for reproducible policy deployment.',
      ],
    },
  ],
};
