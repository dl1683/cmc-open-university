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
      heading: 'What it is',
      paragraphs: [
        'FTRL-Proximal is an online optimization algorithm used for huge sparse prediction problems, especially click-through-rate prediction. Each example arrives as a sparse feature vector, the model predicts, the label arrives, and only the active coordinates update. The case-study shape is logistic regression over feature-hashed categorical and text features.',
        'The central data structures are simple but powerful: a sparse hashed feature vector, a weight vector, and two per-coordinate state arrays often called z and n. n accumulates squared gradients for adaptive per-coordinate learning rates. z accumulates adjusted gradients. The actual weight can be computed lazily from z, n, L1, and L2, which lets the system keep many coordinates at exact zero.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'On each impression, hash active feature names into indices. Read the current lazy weights for those indices and compute p = sigmoid(w dot x). When the click label y arrives, compute the logistic gradient. For each active coordinate, update n_i with g_i squared and update z_i with the adjusted gradient term. The proximal formula applies L1 as a threshold: if |z_i| is below lambda1, w_i is zero; otherwise w_i is a shrunk value scaled by accumulated curvature.',
        'This differs from ordinary online gradient descent in two practical ways. First, learning rates are per coordinate, so a feature that has appeared millions of times takes smaller steps than a fresh rare feature. Second, L1 sparsity is handled through the cumulative proximal state, which can produce a much smaller serving model without simply ignoring low-count features by hand.',
      ],
    },
    {
      heading: 'Complete case study: search ads',
      paragraphs: [
        'A search ads system predicts whether an impression will be clicked. Features include query tokens, ad id, advertiser id, device, geography, hour, publisher, and crosses such as advertiser x device. Feature Hashing Signed Projection Primer explains why these features fit a fixed-width vector without a giant vocabulary service. FTRL explains how the model can learn online from an endless stream of impressions and delayed clicks.',
        'The serving loop predicts before update. The logging loop later joins click labels, applies an attribution window, and feeds updates to the learner. Delayed Feedback Attribution Window Case Study expands that label-join path because premature negatives can poison an online model even when the optimizer is correct. Contextual Bandit Logged Policy Evaluation Case Study adds the counterfactual layer: if the serving policy samples ads or stories, the log must also preserve action probabilities so future policies can be replayed and gated before launch. The model registry records hash bits, namespace grammar, optimizer parameters, calibration layer, holdout policy, and logging policy version. A sparse model is valuable operationally: fewer nonzero weights reduce memory, cache pressure, and ranking latency.',
      ],
    },
    {
      heading: 'Systems lessons',
      paragraphs: [
        'The 2013 Google paper is important because it treats CTR prediction as a deployed system. It discusses FTRL-Proximal, per-coordinate learning rates, memory savings, performance visualization, confidence estimates, calibration, and automated feature management. That is the right framing: the optimizer is only one part of a feedback loop that includes data freshness, delayed labels, feature churn, monitoring, and rollback.',
        'Progressive validation matters. For an online learner, an honest metric predicts on an example before training on it. If the system updates first and scores second, it is grading itself after seeing the answer. Holdout slices, calibration curves, delayed-label audits, and online/offline replay checks keep the learner from adapting to instrumentation bugs or short-term traffic artifacts.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'Do not use FTRL as a magic replacement for feature quality. Bad namespaces, leaky labels, broken attribution windows, and hash collisions still break the model. Do not compare only AUC or log loss without model size and serving cost. Do not change hash width or namespace grammar without retraining. And do not assume online adaptation is always good: fast learners can also adapt quickly to spam, logging outages, or delayed-label artifacts.',
        'Another trap is confusing sparsity with fairness or safety. L1 removes weak coordinates; it does not know whether a strong coordinate is a proxy, a privacy leak, or a brittle shortcut. Pair sparse online learning with Data Leakage & Contamination audits, Feature Store lineage, calibration, and slice metrics.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Google Research Ad Click Prediction: a View from the Trenches at https://research.google/pubs/ad-click-prediction-a-view-from-the-trenches/ and PDF at https://research.google.com/pubs/archive/41159.pdf, McMahan Follow-the-Regularized-Leader and Mirror Descent at https://proceedings.mlr.press/v15/mcmahan11b/mcmahan11b.pdf, Adaptive Online Learning survey at https://arxiv.org/abs/1403.3465, and Vowpal Wabbit feature and hashing docs at https://vowpalwabbit.org/features.html and https://vowpalwabbit.org/docs/vowpal_wabbit/python/9.6.0/tutorials/cmd_linear_regression.html. Study Feature Hashing Signed Projection Primer, Delayed Feedback Attribution Window Case Study, Contextual Bandit Logged Policy Evaluation Case Study, Logistic Regression, Gradient Descent, Regularization, Calibration Curves, ROC Curves & AUC, Feature Store, and Training-Serving Skew Replay Diff next.',
      ],
    },
  ],
};
