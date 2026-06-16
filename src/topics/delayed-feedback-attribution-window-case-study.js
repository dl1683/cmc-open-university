// Delayed feedback attribution windows: join impressions and delayed clicks
// without training on premature negatives or future labels.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'delayed-feedback-attribution-window-case-study',
  title: 'Delayed Feedback Attribution Window Case Study',
  category: 'Systems',
  summary: 'A streaming label-join data structure for ads and recommenders: pending impression maps, attribution windows, watermarks, grace periods, and correction events.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['label join', 'late feedback'], defaultValue: 'label join' },
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

function joinGraph(title) {
  return graphState({
    nodes: [
      { id: 'imp', label: 'impr', x: 0.7, y: 3.5, note: 'view' },
      { id: 'pend', label: 'pending', x: 2.3, y: 3.5, note: 'map' },
      { id: 'click', label: 'click', x: 2.3, y: 1.5, note: 'delay' },
      { id: 'timer', label: 'timer', x: 2.3, y: 5.5, note: 'expire' },
      { id: 'join', label: 'join', x: 4.3, y: 3.5, note: 'id+time' },
      { id: 'label', label: 'label', x: 6.2, y: 3.5, note: '0/1' },
      { id: 'learn', label: 'learn', x: 8.4, y: 3.5, note: 'update' },
    ],
    edges: [
      { id: 'e-imp-pend', from: 'imp', to: 'pend' },
      { id: 'e-click-join', from: 'click', to: 'join' },
      { id: 'e-pend-join', from: 'pend', to: 'join' },
      { id: 'e-timer-join', from: 'timer', to: 'join' },
      { id: 'e-join-label', from: 'join', to: 'label' },
      { id: 'e-label-learn', from: 'label', to: 'learn' },
    ],
  }, { title });
}

function watermarkGraph(title) {
  return graphState({
    nodes: [
      { id: 'events', label: 'events', x: 0.7, y: 3.5, note: 'event time' },
      { id: 'wm', label: 'wm', x: 2.4, y: 3.5, note: 'progress' },
      { id: 'window', label: 'window', x: 4.2, y: 2.0, note: 'attr' },
      { id: 'grace', label: 'grace', x: 4.2, y: 5.0, note: 'late wait' },
      { id: 'close', label: 'close', x: 6.2, y: 3.5, note: 'final?' },
      { id: 'late', label: 'late', x: 8.2, y: 2.0, note: 'side out' },
      { id: 'corr', label: 'correct', x: 8.2, y: 5.0, note: 'delta' },
    ],
    edges: [
      { id: 'e-events-wm', from: 'events', to: 'wm' },
      { id: 'e-wm-window', from: 'wm', to: 'window' },
      { id: 'e-wm-grace', from: 'wm', to: 'grace' },
      { id: 'e-window-close', from: 'window', to: 'close' },
      { id: 'e-grace-close', from: 'grace', to: 'close' },
      { id: 'e-close-late', from: 'close', to: 'late' },
      { id: 'e-late-corr', from: 'late', to: 'corr' },
    ],
  }, { title });
}

function* labelJoin() {
  yield {
    state: joinGraph('Impressions wait for delayed clicks'),
    highlight: { active: ['imp', 'pend', 'click', 'join', 'e-imp-pend', 'e-click-join', 'e-pend-join'], found: ['label'] },
    explanation: 'An ad impression is not immediately negative. The user may click seconds or minutes later, or a conversion may arrive days later. The label join keeps a pending map keyed by impression id or click id, waits through an attribution window, and emits a positive label if a matching feedback event arrives in time.',
    invariant: 'Do not train a negative label until the feedback window says the positive event had a fair chance to arrive.',
  };

  yield {
    state: labelMatrix(
      'Pending impression state',
      [
        { id: 'i17', label: 'imp 17' },
        { id: 'i18', label: 'imp 18' },
        { id: 'i19', label: 'imp 19' },
        { id: 'i20', label: 'imp 20' },
      ],
      [
        { id: 'age', label: 'age' },
        { id: 'expires', label: 'expires' },
        { id: 'state', label: 'state' },
      ],
      [
        ['2m', '28m', 'wait'],
        ['8m', '22m', 'clicked'],
        ['31m', '0m', 'emit 0'],
        ['35m', 'late', 'side out'],
      ],
    ),
    highlight: { active: ['i18:state'], found: ['i19:state'], removed: ['i20:state'] },
    explanation: 'The pending map is paired with an expiry index, often a min-heap or time wheel. A click for imp 18 turns the row positive and removes it. Imp 19 reaches the attribution deadline and emits a negative. Imp 20 is already closed, so a late click needs a correction path or a side output.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'minutes after impression', min: 0, max: 45 }, y: { label: 'label state', min: 0, max: 1.2 } },
      series: [
        { id: 'wait', label: 'waiting', points: [{ x: 0, y: 0.2 }, { x: 10, y: 0.2 }, { x: 20, y: 0.2 }, { x: 30, y: 0.2 }] },
        { id: 'pos', label: 'click', points: [{ x: 0, y: 0.2 }, { x: 8, y: 1.0 }, { x: 30, y: 1.0 }] },
        { id: 'neg', label: 'no click', points: [{ x: 0, y: 0.2 }, { x: 30, y: 0.0 }, { x: 45, y: 0.0 }] },
      ],
      markers: [
        { id: 'window', x: 30, y: 0.2, label: 'window' },
        { id: 'late', x: 35, y: 1.0, label: 'late' },
      ],
    }),
    highlight: { active: ['window', 'pos', 'neg'], compare: ['late'] },
    explanation: 'The window is the contract. A click at minute 8 is positive. No click by minute 30 becomes negative. A click at minute 35 is not silently ignored without policy; it is a late event that should be counted, corrected, or deliberately excluded according to the training contract.',
  };

  yield {
    state: labelMatrix(
      'Label decisions',
      [
        { id: 'inside', label: 'inside win' },
        { id: 'none', label: 'no event' },
        { id: 'late', label: 'late event' },
        { id: 'dupe', label: 'duplicate' },
      ],
      [
        { id: 'emit', label: 'emit' },
        { id: 'guard', label: 'guard' },
      ],
      [
        ['label 1', 'id match'],
        ['label 0', 'watermark'],
        ['delta/side', 'grace'],
        ['ignore', 'dedupe'],
      ],
    ),
    highlight: { active: ['inside:emit', 'none:emit'], compare: ['late:guard'], removed: ['dupe:emit'] },
    explanation: 'The join has to be idempotent. Duplicate clicks should not produce duplicate positives. Missing clicks should not become negative until watermark and window policy allow it. Late clicks should follow a declared correction path instead of mutating history invisibly.',
  };

  yield {
    state: joinGraph('The learner consumes finalized labels'),
    highlight: { active: ['label', 'learn', 'e-label-learn'], compare: ['timer', 'click'], found: ['pend'] },
    explanation: 'The output is a training stream for FTRL-Proximal Online CTR Case Study or another online learner. Bad label joins create false negatives, future positives, and training-serving skew. The label pipeline is therefore part of the model, not just logging plumbing.',
  };
}

function* lateFeedback() {
  yield {
    state: watermarkGraph('Watermarks decide when event time is safe enough'),
    highlight: { active: ['events', 'wm', 'window', 'grace', 'close', 'e-events-wm', 'e-wm-window', 'e-wm-grace'], compare: ['late'] },
    explanation: 'Flink defines watermarks as event-time progress markers: a watermark at t says the system believes events at or before t should have arrived. Kafka Streams windows use grace periods to decide how long to wait for out-of-order records before results are final. Label joins use the same idea: wait enough to be honest, not so long that learning goes stale.',
    invariant: 'Final means watermark plus attribution policy, not wall-clock impatience.',
  };

  yield {
    state: labelMatrix(
      'Stateful join structures',
      [
        { id: 'map', label: 'pending map' },
        { id: 'heap', label: 'expiry heap' },
        { id: 'dedupe', label: 'dedupe set' },
        { id: 'wal', label: 'output log' },
      ],
      [
        { id: 'key', label: 'key' },
        { id: 'job', label: 'job' },
      ],
      [
        ['imp id', 'find match'],
        ['expire ts', 'emit 0'],
        ['event id', 'once only'],
        ['label id', 'replay'],
      ],
    ),
    highlight: { active: ['map:job', 'heap:job'], compare: ['dedupe:job'], found: ['wal:job'] },
    explanation: 'The data structures are familiar: a hash map for pending impressions, a heap or time wheel for expiry order, a dedupe set for repeated events, and an append-only output log for replay. The complexity is the timing contract, not exotic storage.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'label wait time', min: 0, max: 30 }, y: { label: 'quality', min: 0, max: 1 } },
      series: [
        { id: 'fresh', label: 'freshness', points: [{ x: 0, y: 1.0 }, { x: 5, y: 0.82 }, { x: 10, y: 0.68 }, { x: 20, y: 0.45 }, { x: 30, y: 0.30 }] },
        { id: 'truth', label: 'label truth', points: [{ x: 0, y: 0.35 }, { x: 5, y: 0.58 }, { x: 10, y: 0.74 }, { x: 20, y: 0.90 }, { x: 30, y: 0.96 }] },
      ],
      markers: [
        { id: 'trade', x: 10, y: 0.74, label: 'tradeoff' },
      ],
    }),
    highlight: { active: ['fresh', 'truth', 'trade'] },
    explanation: 'A shorter window gives fresher training data but more false negatives. A longer window gives cleaner labels but stale updates. The optimal point depends on product latency, click-delay distribution, conversion-delay distribution, and how quickly the environment shifts.',
  };

  yield {
    state: labelMatrix(
      'Production policy knobs',
      [
        { id: 'win', label: 'window' },
        { id: 'grace', label: 'grace' },
        { id: 'late', label: 'late path' },
        { id: 'backfill', label: 'backfill' },
        { id: 'holdout', label: 'holdout' },
      ],
      [
        { id: 'chooses', label: 'chooses' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['max delay', 'false 0s'],
        ['OOO wait', 'latency'],
        ['delta vs drop', 'bias'],
        ['repair hist', 'drift'],
        ['honest eval', 'peek'],
      ],
    ),
    highlight: { active: ['win:chooses', 'grace:chooses', 'late:chooses'], compare: ['holdout:risk'] },
    explanation: 'The knobs must be written down. A team should know whether a late click emits a correction, is routed to a backfill job, or is excluded. Otherwise two training jobs can produce different labels from the same logs and both look plausible.',
  };

  yield {
    state: watermarkGraph('Complete case: conversion attribution'),
    highlight: { active: ['window', 'grace', 'close', 'late', 'corr'], compare: ['wm'] },
    explanation: 'For conversion prediction, a click can lead to a purchase hours or days later. The delayed-feedback paper describes post-click attribution and conversion windows. The systems translation is the same as ad clicks but with a longer pending store, stronger correction needs, and more pressure to separate fresh-but-incomplete labels from complete-but-late labels.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'label join') yield* labelJoin();
  else if (view === 'late feedback') yield* lateFeedback();
  else throw new InputError('Pick a delayed-feedback view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'Delayed feedback is the problem where the label arrives after the prediction. Ads, recommendations, fraud, notifications, and conversion optimization all have this shape. An impression happens now; a click may arrive later; a purchase may arrive much later. Treating every unclicked impression as immediately negative trains false negatives into the model.',
        'The core data structure is a stateful streaming join. Store pending predictions in a map keyed by impression id, click id, user id plus timestamp, or another attribution key. Keep an expiry index ordered by attribution deadline. When feedback arrives inside the window, emit a positive. When the window closes with no feedback, emit a negative. Late events go to a declared correction path.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The join uses event time, not just processing time. Watermarks tell the operator how far event time has advanced. Grace periods tell it how long to tolerate out-of-order records. The pending map answers "does this click match an open impression?" The expiry heap answers "which impressions are old enough to finalize as negatives?" The output log makes labels replayable.',
        'This is adjacent to point-in-time feature joins. A feature join asks which feature values existed at prediction time. A delayed-label join asks when the outcome became knowable. Both are leakage problems in time: using future information inflates offline metrics, while closing the window too early creates biased labels.',
      ],
    },
    {
      heading: 'Complete case study: click labels for FTRL',
      paragraphs: [
        'An online CTR learner predicts p(click) for each impression and logs impression_id, ad_id, user segment, feature vector hash, prediction time, and model version. The click stream arrives later with impression_id and click time. A stateful join emits positive labels for matching clicks inside a 30-minute attribution window and emits negatives after the watermark passes the window plus grace period.',
        'The resulting label stream trains FTRL-Proximal Online CTR Case Study. Progressive validation predicts before update, and the label join must preserve that order. If the serving system is a contextual bandit, Contextual Bandit Logged Policy Evaluation Case Study adds one more invariant: reward joins must preserve the same event ids and policy versions used by the propensity log, or off-policy evaluation will weight the wrong labels.',
      ],
    },
    {
      heading: 'Complete case study: conversion windows',
      paragraphs: [
        'Conversion modeling stretches the same design. A user clicks an ad, then may buy within hours or days. Advertising attribution papers describe post-click attribution and conversion windows: a conversion is credited only if it occurs within the configured window. That creates a freshness-truth tradeoff. Waiting thirty days gives more complete labels but makes online learning stale; training earlier requires correction or delayed-feedback modeling.',
        'A mature pipeline separates provisional labels from final labels. It can train a fast model on short-window labels, backfill a slower model on complete labels, or emit correction events that subtract prior negatives and add positives. The correct choice depends on product latency, event delay distribution, and whether the model can safely handle label revisions.',
      ],
    },
    {
      heading: 'Pitfalls and study next',
      paragraphs: [
        'Do not equate missing feedback with negative feedback until the attribution policy says so. Do not mix event time and processing time without recording which one controls the window. Do not silently drop late positives if they are common. Do not mutate old labels without a replayable correction log. And do not compare models trained under different attribution windows as if the labels were the same dataset.',
        'Primary sources: Apache Flink timely stream processing and watermarks at https://nightlies.apache.org/flink/flink-docs-stable/docs/concepts/time/, Confluent Kafka Streams window grace-period docs at https://docs.confluent.io/platform/current/streams/concepts.html, Apache Kafka Streams join semantics at https://kafka.apache.org/41/streams/developer-guide/dsl-api/, Google Ad Click Prediction at https://research.google.com/pubs/archive/41159.pdf, delayed feedback attribution paper at https://wnzhang.net/share/rtb-papers/delayed-feedback.pdf, and Databricks point-in-time feature joins at https://docs.databricks.com/aws/en/machine-learning/feature-store/time-series. Study FTRL-Proximal Online CTR Case Study, Contextual Bandit Logged Policy Evaluation Case Study, Streaming Watermarks, Point-in-Time Feature Join Index, Feature Store, Message Queues, Hash Table, and Binary Heap next.',
      ],
    },
  ],
};
