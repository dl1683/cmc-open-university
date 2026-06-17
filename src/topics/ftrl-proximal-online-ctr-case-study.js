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
      heading: 'Why this exists',
      paragraphs: [
        'FTRL-Proximal exists for prediction problems that are huge, sparse, and always changing. Click-through-rate prediction is the classic example. An ad impression arrives with query terms, ad id, advertiser id, device, location, hour, publisher, user context, and crossed features. The model must produce a probability now. The click label may arrive later. Then the system has to learn without retraining from scratch.',
        'The feature space is enormous because categorical ids and feature crosses explode. A billion possible coordinates may exist, but one impression touches only a small set. The learner needs to update only those active coordinates, keep memory under control, adapt quickly to fresh evidence, and serve a sparse model fast enough for ranking. Ordinary dense training is the wrong shape.',
        'FTRL-Proximal, short for Follow-The-Regularized-Leader with a proximal update, gives a practical answer. It combines online logistic regression, per-coordinate adaptive learning rates, and L1-driven sparsity. The important data structures are a hashed sparse feature vector and two per-coordinate state arrays often called z and n. The actual weight can be computed lazily from that state only when a coordinate is touched.',
      ],
    },
    {
      heading: 'The naive approach',
      paragraphs: [
        'The naive approach is a nightly batch model. Collect yesterday impressions and clicks, build a training table, fit logistic regression or a tree model offline, and ship the new model in the morning. This can work for stable domains, but ad traffic is not stable. New campaigns launch, budgets move, spam changes, devices shift, publishers change layout, and query demand reacts to the news.',
        'Another naive approach is ordinary online gradient descent with one global learning rate. Predict, observe the label, take a step on active weights, and repeat. This is simple, but the global rate is wrong for sparse high-cardinality features. A feature seen ten million times should not move like a feature seen twice. A global decay schedule can freeze rare features before they have enough evidence.',
        'A third shortcut is manual count thresholding. Ignore rare features until they appear often enough, prune low-count crosses, and hope the remaining model is small. That saves memory, but it throws away rare signals that may be valuable. The right question is not whether a feature is rare. The question is whether cumulative evidence is strong enough to pay the serving and overfitting cost of a nonzero weight.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'The core insight is to let every coordinate carry its own learning history and its own sparsity decision. FTRL-Proximal does not treat all features as equally mature. It tracks how much gradient evidence a coordinate has accumulated and how much squared-gradient history it has seen. Frequent features settle down. Rare features can still move when strong evidence finally arrives.',
        'The proximal part is the sparsity mechanism. L1 regularization is not handled as an afterthought. It is built into the coordinate state so a weight can remain exactly zero until the cumulative signal beats the L1 threshold. That is critical in a hashed feature space where most possible coordinates should not cost memory or latency at serving time.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'On each impression, the feature builder emits names such as campaign=91, device=mobile, query_token=shoes, or campaign=91 x device=mobile. Feature hashing maps those names into fixed integer coordinates. The vector is sparse: most coordinates are absent, and active coordinates usually have value 1 or a small numeric value.',
        'The model predicts first. It reads or lazily computes weights for the active coordinates, forms w dot x, and returns p = sigmoid(w dot x). Later, when the click label y is joined, the logistic gradient for an active coordinate is approximately (p - y) * x_i. Only active coordinates update. This progressive-validation order matters: prediction must happen before the label trains the model, or the learner grades itself after seeing the answer.',
        'FTRL stores two main pieces of state per coordinate. n_i accumulates squared gradients. This creates an adaptive learning rate because coordinates with larger n_i take smaller future steps. z_i stores an adjusted cumulative gradient that includes the correction needed for changing per-coordinate rates. The lazy weight formula applies L1 and L2 regularization from z_i and n_i. If abs(z_i) is at or below lambda1, the weight is exactly zero. Otherwise it becomes a shrunk nonzero value scaled by accumulated curvature.',
      ],
    },
    {
      heading: 'What the visual is proving',
      paragraphs: [
        'The online-update graph proves the time order. An impression becomes hashed sparse features, the model reads current weights, and a pCTR is served before the click label is known. Only after the label is joined does the learner compute the gradient and update z and n. This prevents accidental self-grading.',
        'The sparse-coordinate table proves that a huge model can still perform a tiny update. The impression touches campaign, publisher, device, and one crossed feature. No other coordinates need to move. The FTRL state table proves the adaptive part: a frequent campaign coordinate has a small step, while a rare crossed feature may still be able to react. The zero weights prove the L1 gate.',
        'The sparsity-system view proves that FTRL is not just an optimizer formula. The learner sits inside a system with hashing, delayed-label joins, calibration, holdout guards, and serving. The Pareto plot proves the production objective: lower loss is not enough. The useful frontier is lower loss at a given model size and latency.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'FTRL works in this setting because it matches the sparsity pattern of the data. A single event touches a small number of coordinates, so the learner performs a small update. The rest of the model remains unchanged and often remains implicit. That keeps online learning feasible even when the hash space is very large.',
        'It also works because per-coordinate adaptation handles uneven feature frequency. A global schedule cannot know that one feature is mature and another is new. n_i gives each coordinate its own history. A feature with many large gradients gets smaller steps. A fresh feature can still move enough to matter when it finally appears.',
      ],
    },
    {
      heading: 'Cost and tradeoffs',
      paragraphs: [
        'FTRL saves serving cost through sparsity, but it is not free. The system still needs state for z and n across a large hash space, or a sparse map of touched coordinates. It needs feature hashing, namespace governance, delayed label joins, model snapshots, calibration, holdouts, and rollback. A production CTR learner is a data system as much as an optimizer.',
        'The regularization parameters also trade accuracy against size. A high L1 threshold creates a small model but can remove useful rare features. A low threshold preserves more signal but can densify the model. The learning-rate parameters affect adaptation speed. Fast adaptation helps with fresh campaigns and distribution shifts, but it can also chase spam, instrumentation bugs, or temporary traffic artifacts.',
      ],
    },
    {
      heading: 'Complete case study: search ads',
      paragraphs: [
        'A search ads system receives an impression request and must rank candidate ads. For each candidate, it builds features from the query, ad, advertiser, campaign, device, geography, time, publisher, and historical interactions. Crossed features capture interactions such as advertiser x query token or campaign x device. Feature hashing maps all of this into a fixed coordinate space without maintaining a giant online vocabulary service.',
        'The serving path computes pCTR from the current sparse model. The logging path records the impression, the model version, feature namespace version, hash configuration, displayed position, and later click or no-click label. The label join applies an attribution window because clicks are delayed. Treating a delayed click as an immediate negative can poison the learner even if FTRL itself is implemented correctly.',
      ],
    },
    {
      heading: 'Real uses',
      paragraphs: [
        'FTRL-Proximal fits any online sparse prediction problem where fresh categorical evidence matters. Ads are the famous use case, but the same shape appears in recommendation ranking, feed ranking, email response prediction, spam detection, fraud risk, notification click prediction, marketplace matching, and search ranking features.',
      ],
    },
    {
      heading: 'Failure modes',
      paragraphs: [
        'The first failure mode is broken time order. If the learner updates before predicting, metrics become inflated. If delayed clicks are treated as negatives too early, the model learns false feedback. If training data includes features unavailable at serving time, the model learns leakage. These are data-contract failures, not optimizer failures.',
        'The second failure mode is uncontrolled feature generation. Bad namespaces, exploding crosses, hash collisions, and unstable ids can make the model large and noisy. L1 helps, but it cannot fix a feature pipeline that creates garbage. The third failure mode is miscalibration. A ranking system may care about order, but bidding, pacing, and allocation often need probabilities that mean what they say.',
        'The fourth failure mode is unsafe adaptation. An online learner can react quickly to real shifts, but it can also react quickly to fraud, outages, bot traffic, logging bugs, or one-off events. Holdouts, slice metrics, delayed-label audits, traffic guards, and rollback are part of the algorithm in practice because they protect the feedback loop around the optimizer.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Study Logistic Regression, Gradient Descent, Regularization, Feature Hashing Signed Projection Primer, Calibration Curves, ROC Curves and AUC, and Feature Store before treating FTRL as a production system. Then read Delayed Feedback Attribution Window Case Study and Contextual Bandit Logged Policy Evaluation Case Study to understand the logging and counterfactual pieces around online learning.',
        'For primary sources, read Google Research Ad Click Prediction: a View from the Trenches, McMahan Follow-the-Regularized-Leader and Mirror Descent, and Vowpal Wabbit feature hashing documentation. The practical lesson across all of them is the same: the optimizer matters, but the prediction-before-update contract, feature grammar, label timing, calibration, and serving budget matter just as much.',
      ],
    },
  ],
};
