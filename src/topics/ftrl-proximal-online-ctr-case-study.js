// FTRL-Proximal online CTR case study: sparse logistic regression over hashed
// features, with per-coordinate learning rates and lazy L1 shrinkage.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'ftrl-proximal-online-ctr-case-study',
  title: 'FTRL-Proximal Online CTR Case Study',
  category: 'Papers',
  summary: 'A production ad-click learner: hash sparse features, predict before update, accumulate per-coordinate gradient state, and let L1 keep the model sparse.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['online update', 'sparsity system'], defaultValue: 'online update' },
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

function onlineGraph(title) {
  return graphState({
    nodes: [
      { id: 'event', label: 'event', x: 0.7, y: 3.5, note: 'ad view' },
      { id: 'hash', label: 'hash', x: 2.2, y: 3.5, note: 'sparse x' },
      { id: 'weight', label: 'weight', x: 3.9, y: 2.0, note: 'lazy w' },
      { id: 'pred', label: 'predict', x: 5.6, y: 3.5, note: 'pCTR' },
      { id: 'label', label: 'label', x: 7.1, y: 2.0, note: 'click?' },
      { id: 'grad', label: 'grad', x: 7.1, y: 5.0, note: 'p-y' },
      { id: 'state', label: 'z/n', x: 8.8, y: 3.5, note: 'update' },
    ],
    edges: [
      { id: 'e-event-hash', from: 'event', to: 'hash' },
      { id: 'e-hash-weight', from: 'hash', to: 'weight' },
      { id: 'e-weight-pred', from: 'weight', to: 'pred' },
      { id: 'e-pred-label', from: 'pred', to: 'label' },
      { id: 'e-pred-grad', from: 'pred', to: 'grad' },
      { id: 'e-label-grad', from: 'label', to: 'grad' },
      { id: 'e-grad-state', from: 'grad', to: 'state' },
      { id: 'e-state-weight', from: 'state', to: 'weight' },
    ],
  }, { title });
}

function systemGraph(title) {
  return graphState({
    nodes: [
      { id: 'stream', label: 'stream', x: 0.7, y: 3.5, note: 'views' },
      { id: 'hash', label: 'hasher', x: 2.2, y: 2.0, note: 'bits' },
      { id: 'join', label: 'join y', x: 2.2, y: 5.0, note: 'delay' },
      { id: 'ftrl', label: 'FTRL', x: 4.4, y: 3.5, note: 'online' },
      { id: 'calib', label: 'calib', x: 6.3, y: 2.0, note: 'prob' },
      { id: 'guard', label: 'guard', x: 6.3, y: 5.0, note: 'holdout' },
      { id: 'serve', label: 'serve', x: 8.5, y: 3.5, note: 'rank' },
    ],
    edges: [
      { id: 'e-stream-hash', from: 'stream', to: 'hash' },
      { id: 'e-stream-join', from: 'stream', to: 'join' },
      { id: 'e-hash-ftrl', from: 'hash', to: 'ftrl' },
      { id: 'e-join-ftrl', from: 'join', to: 'ftrl' },
      { id: 'e-ftrl-calib', from: 'ftrl', to: 'calib' },
      { id: 'e-ftrl-guard', from: 'ftrl', to: 'guard' },
      { id: 'e-calib-serve', from: 'calib', to: 'serve' },
      { id: 'e-guard-serve', from: 'guard', to: 'serve' },
    ],
  }, { title });
}

function* onlineUpdate() {
  yield {
    state: onlineGraph('Predict first, then learn from the click'),
    highlight: { active: ['event', 'hash', 'weight', 'pred', 'e-event-hash', 'e-hash-weight', 'e-weight-pred'], compare: ['label'], found: ['state'] },
    explanation: 'Online CTR learning starts with an impression. The system hashes the sparse feature names, reads only those coordinates, computes a probability, then waits for the click label. The prediction must happen before the update; otherwise the learner grades itself on a label it already consumed.',
    invariant: 'In progressive validation, each example is predicted before it trains the model.',
  };

  yield {
    state: labelMatrix(
      'One impression as sparse coordinates',
      [
        { id: 'camp', label: 'campaign' },
        { id: 'pub', label: 'publisher' },
        { id: 'dev', label: 'device' },
        { id: 'cross', label: 'camp x dev' },
      ],
      [
        { id: 'idx', label: 'idx' },
        { id: 'x', label: 'x' },
        { id: 'w', label: 'w' },
        { id: 'g', label: 'grad' },
      ],
      [
        ['91', '1', '+0.42', '-0.18'],
        ['18', '1', '-0.10', '-0.18'],
        ['44', '1', '+0.05', '-0.18'],
        ['207', '1', '0', '-0.18'],
      ],
    ),
    highlight: { active: ['camp:w', 'pub:w', 'dev:w', 'cross:w'], found: ['cross:g'] },
    explanation: 'The feature vector is sparse. A billion possible coordinates may exist, but one ad impression touches only a handful. The logistic gradient for an active coordinate is roughly (prediction - label) * x_i, so only active feature states are updated.',
  };

  yield {
    state: labelMatrix(
      'FTRL coordinate state',
      [
        { id: 'camp', label: 'campaign' },
        { id: 'pub', label: 'publisher' },
        { id: 'dev', label: 'device' },
        { id: 'cross', label: 'camp x dev' },
      ],
      [
        { id: 'z', label: 'z' },
        { id: 'n', label: 'n' },
        { id: 'lr', label: 'step' },
        { id: 'w', label: 'new w' },
      ],
      [
        ['-3.4', '81', 'small', '+0.30'],
        ['+0.9', '4', 'large', '0'],
        ['-0.2', '1', 'large', '0'],
        ['-0.4', '0.03', 'large', '0'],
      ],
    ),
    highlight: { active: ['camp:z', 'camp:n', 'camp:lr', 'camp:w'], compare: ['cross:lr'], removed: ['pub:w', 'dev:w', 'cross:w'] },
    explanation: 'FTRL-Proximal stores compact per-coordinate state, often called z and n. n accumulates squared gradients, so frequent features get smaller steps. z stores the cumulative adjusted gradient. The actual weight can be computed lazily from z and n only when the coordinate is touched.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'feature impressions', min: 1, max: 10000 }, y: { label: 'relative step', min: 0, max: 1 } },
      series: [
        { id: 'rare', label: 'rare feat', points: [{ x: 1, y: 1.0 }, { x: 10, y: 0.72 }, { x: 100, y: 0.45 }, { x: 1000, y: 0.22 }, { x: 10000, y: 0.09 }] },
        { id: 'global', label: 'global lr', points: [{ x: 1, y: 1.0 }, { x: 10, y: 0.32 }, { x: 100, y: 0.10 }, { x: 1000, y: 0.03 }, { x: 10000, y: 0.01 }] },
      ],
      markers: [
        { id: 'react', x: 100, y: 0.45, label: 'reacts' },
      ],
    }),
    highlight: { active: ['rare', 'react'], compare: ['global'] },
    explanation: 'The Google ad-click paper stresses per-coordinate learning rates. A global schedule decays even for features that have barely appeared. Per-coordinate state lets common features settle down while rare-but-new features can still move when evidence arrives.',
  };

  yield {
    state: labelMatrix(
      'Online learner comparison',
      [
        { id: 'ogd', label: 'OGD' },
        { id: 'adagrad', label: 'AdaGrad' },
        { id: 'ftrl', label: 'FTRL' },
        { id: 'batch', label: 'batch LR' },
      ],
      [
        { id: 'state', label: 'state' },
        { id: 'sparse', label: 'sparse?' },
        { id: 'fit', label: 'fit' },
      ],
      [
        ['w only', 'weak', 'simple'],
        ['w+n', 'weak', 'adaptive'],
        ['z+n', 'strong', 'ads'],
        ['all data', 'depends', 'offline'],
      ],
    ),
    highlight: { active: ['ftrl:state', 'ftrl:sparse', 'ftrl:fit'], compare: ['adagrad:state'], removed: ['ogd:sparse'] },
    explanation: 'FTRL is not just "SGD with a different name." Its proximal form handles cumulative L1 pressure in a way that can produce much sparser models at similar accuracy, which matters when the feature space is enormous and serving latency depends on the number of nonzero weights.',
  };
}

function* sparsitySystem() {
  yield {
    state: labelMatrix(
      'Lazy L1 thresholding',
      [
        { id: 'cold', label: 'cold id' },
        { id: 'city', label: 'city' },
        { id: 'query', label: 'query tok' },
        { id: 'cross', label: 'cross' },
      ],
      [
        { id: 'absz', label: '|z|' },
        { id: 'l1', label: 'L1' },
        { id: 'w', label: 'weight' },
      ],
      [
        ['0.4', '1.0', '0'],
        ['1.3', '1.0', 'small'],
        ['4.8', '1.0', 'large'],
        ['0.9', '1.0', '0'],
      ],
    ),
    highlight: { removed: ['cold:w', 'cross:w'], active: ['query:w'], compare: ['city:w'] },
    explanation: 'The L1 threshold is the sparsity gate. If the cumulative signal |z_i| is not strong enough to beat lambda1, the coordinate weight is exactly zero. A rare crossed feature can exist in the hash space without paying serving cost until evidence justifies it.',
    invariant: 'Inactive coordinates can remain implicit zeros even when the hash space is huge.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'nonzero weights', min: 0, max: 100 }, y: { label: 'relative loss', min: 0.2, max: 1.0 } },
      series: [
        { id: 'ogd', label: 'OGD', points: [{ x: 15, y: 0.72 }, { x: 35, y: 0.52 }, { x: 70, y: 0.40 }, { x: 100, y: 0.34 }] },
        { id: 'ftrl', label: 'FTRL', points: [{ x: 10, y: 0.58 }, { x: 22, y: 0.42 }, { x: 38, y: 0.34 }, { x: 55, y: 0.31 }] },
        { id: 'count', label: 'count gate', points: [{ x: 8, y: 0.85 }, { x: 22, y: 0.55 }, { x: 50, y: 0.42 }, { x: 90, y: 0.35 }] },
      ],
      markers: [
        { id: 'frontier', x: 38, y: 0.34, label: 'frontier' },
      ],
    }),
    highlight: { active: ['ftrl', 'frontier'], compare: ['ogd', 'count'] },
    explanation: 'This conceptual Pareto plot mirrors the paper lesson: the useful frontier is not only loss, but loss at a given model size. FTRL-Proximal was valuable because it improved the size-versus-accuracy tradeoff, not because it made one offline metric look nicer in isolation.',
  };

  yield {
    state: systemGraph('CTR learning is a system, not only an optimizer'),
    highlight: { active: ['stream', 'hash', 'join', 'ftrl', 'calib', 'guard', 'serve'], found: ['e-calib-serve', 'e-guard-serve'] },
    explanation: 'A deployed CTR learner needs more than z and n arrays. It needs feature hashing, delayed label joins, progressive validation or holdout guards, calibration, confidence estimates, automated feature management, and rollback. The Google paper is useful precisely because it treats these as production ML problems, not footnotes.',
  };

  yield {
    state: labelMatrix(
      'Production controls',
      [
        { id: 'hash', label: 'hash bits' },
        { id: 'ns', label: 'namespace' },
        { id: 'delay', label: 'label delay' },
        { id: 'calib', label: 'calib' },
        { id: 'holdout', label: 'holdout' },
        { id: 'prune', label: 'prune' },
      ],
      [
        { id: 'risk', label: 'risk' },
        { id: 'guard', label: 'guard' },
      ],
      [
        ['collide', 'audit loss'],
        ['bad crosses', 'grammar'],
        ['late click', 'window'],
        ['wrong prob', 'reliab'],
        ['self grade', 'pre update'],
        ['too dense', 'L1+TTL'],
      ],
    ),
    highlight: { active: ['holdout:guard', 'calib:guard', 'prune:guard'], compare: ['hash:risk', 'delay:risk'] },
    explanation: 'Each control protects a different failure mode. Hash bits protect collisions. Namespace grammar protects feature crosses. Delayed-label windows protect training truth. Calibration protects probability semantics. Progressive validation protects evaluation. L1 and TTL-style cleanup protect serving size.',
  };

  yield {
    state: systemGraph('Complete case: query ad click model'),
    highlight: { active: ['stream', 'hash', 'ftrl', 'calib', 'serve'], compare: ['join', 'guard'] },
    explanation: 'A search ad system logs an impression with query, ad, device, publisher, and crossed features. The learner predicts pCTR, later joins the click label, updates only active hashed coordinates, and periodically ships a calibrated sparse model to ranking. When traffic shifts, online updates adapt faster than a nightly batch retrain, while holdouts prevent the system from blindly promoting regressions.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'online update') yield* onlineUpdate();
  else if (view === 'sparsity system') yield* sparsitySystem();
  else throw new InputError('Pick an FTRL case-study view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'Read the animation as an online learning loop. Click-through rate means the probability that an ad impression receives a click, and online learning means the model updates as labeled events arrive instead of waiting for a full retraining job. Active coordinates are features touched by the current impression, visited coordinates already have stored history, and found weights are nonzero weights that passed the sparsity gate.',
        'The safe inference rule is prediction before learning. The model must score the impression with the current weights, then update only after the label arrives, or the evaluation leaks the answer into the prediction.',
        {type:'callout', text:'FTRL-Proximal succeeds because each sparse coordinate carries its own evidence, step size, and L1 gate instead of forcing the whole feature space through one dense update rule.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'FTRL-Proximal exists for sparse prediction problems with fast feedback and huge feature spaces. In ad ranking, one impression may include query terms, device type, campaign id, publisher id, time bucket, and crossed features formed from pairs of fields.',
        'Most possible features are absent on any one event. The learner needs to touch only the active coordinates, adapt to fresh evidence, and keep the served model small enough for low-latency ranking.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is nightly batch training. Collect yesterday impressions and clicks, fit a logistic regression model, and ship the model the next morning.',
        'That approach is reasonable when the world changes slowly. It struggles when campaigns launch during the day, traffic shifts by hour, fraud patterns move, or a new query trend appears before the next batch window.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is uneven evidence. A campaign feature seen ten million times should move cautiously, while a new crossed feature seen five times may still need a meaningful update if the clicks are strong.',
        'A single global learning rate cannot serve both coordinates well. Count thresholding also fails because rarity is not the same as uselessness; the system needs a way to let evidence overcome a memory and overfitting tax.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'FTRL-Proximal gives each coordinate its own state. The n value stores accumulated squared gradient, which acts like local curvature, and the z value stores adjusted cumulative evidence after accounting for changing step sizes.',
        'The proximal part creates exact sparsity. If the absolute z value for a coordinate is below the L1 threshold, the served weight is exactly zero. The feature can exist in the hash space without paying serving cost until evidence is strong enough.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Feature hashing maps each active feature name to an integer coordinate. The model reads the active coordinates, computes the dot product with their lazy weights, and applies the sigmoid function to produce a probability between 0 and 1.',
        'When the click label arrives, the logistic gradient for each active coordinate is approximately prediction minus label, multiplied by the feature value. Only those active coordinates update z and n; every absent coordinate is untouched.',
        'The lazy weight formula applies the L1 gate and an L2 penalty when the coordinate is read. This keeps the served vector sparse even though the possible feature space may contain billions of names.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Correctness for the online loop comes from progressive validation. Each example is predicted using state that existed before its label, so the loss estimate measures the model the serving path actually used.',
        'The optimizer works for sparse data because each update is local and because coordinate-specific history controls step size. Frequent coordinates accumulate large n and take smaller future steps, while rare coordinates are not frozen by a global schedule.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Per event, the cost is proportional to the number of active features, not the size of the feature universe. If an impression activates 40 features, prediction and update touch about 40 coordinates even if the hash space has 2 to the 30 possible slots.',
        'Memory is proportional to the number of coordinates whose state is stored. Sparsity reduces served weight size, but the learner still needs z and n for touched coordinates. Doubling active features per impression roughly doubles compute, feature gathering, and update traffic.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'The classic use is click-through-rate prediction for search and display ads. The same pattern fits recommendation ranking, feed ranking, notification prediction, spam scoring, fraud scoring, and any stream where sparse categorical evidence arrives continuously.',
        'The system boundary matters as much as the formula. Delayed labels, calibration, holdout traffic, feature-version logging, and rollback controls are part of a correct production learner because the optimizer lives inside a feedback loop.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'FTRL-Proximal fails when data contracts are broken. Training before prediction, treating delayed positives as immediate negatives, logging features unavailable at serving time, or changing hash namespaces silently can make the model look better offline and worse in production.',
        'It also fails when feature generation is uncontrolled. Exploding crosses, unstable ids, hash collisions, and spam bursts can fill the state store with noise. L1 regularization helps, but it cannot repair a feature pipeline that creates misleading evidence.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Suppose an ad impression activates 30 features and the current dot product is -2.20. The sigmoid probability is about 0.10, so the model predicts a 10 percent click probability. If the user clicks, the label is 1 and each active binary feature receives gradient about -0.90.',
        'Now compare two coordinates. A frequent campaign feature has n = 10,000, so the new gradient barely changes its effective step. A rare query-cross feature has n = 4 and z just below an L1 threshold of 1.0; after the -0.90 gradient, its absolute z may cross the gate and create a nonzero weight for future impressions.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Read McMahan and colleagues on Ad Click Prediction: a View from the Trenches, the Follow-the-Regularized-Leader literature, and Vowpal Wabbit documentation for feature hashing and online learning practice. Study logistic regression, gradient descent, regularization, calibration, and feature hashing next.',
        'Then study delayed-feedback attribution and logged-policy evaluation. FTRL solves the sparse online update, but ranking systems also need correct labels, unbiased evaluation, and safety controls around fast adaptation.',
      ],
    },
  ],
};
