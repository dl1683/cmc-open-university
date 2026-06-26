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
      heading: 'How to read the animation',
      paragraphs: [
        'The animation shows a label join. A label join is the streaming step that connects a prediction event, such as an ad impression, to a later outcome event, such as a click. Active nodes are records still being processed; found nodes are finalized labels; removed nodes are records that can no longer stay on the main path.',
        'The safe inference rule is this: a missing click is not a negative label until the attribution window and watermark policy have closed. A watermark is an event-time progress marker, meaning the stream believes no earlier events will arrive on the main path. The table rows show the policy result: wait, emit positive, emit negative, or route late feedback to correction.',
        {type:'callout', text:'A delayed-feedback join is a label policy encoded as state: predictions remain pending until event-time windows make positives, negatives, and corrections reproducible.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Online prediction systems often act before their labels exist. An ad is shown at 10:00, but the click may arrive at 10:08 and the purchase may arrive tomorrow. If training treats every missing outcome as label 0 immediately, it teaches the model that slow positives are negatives.',
        'The system needs a reproducible rule for when a prediction becomes training data. Reproducible means the same historical logs and the same policy produce the same labels on replay. That matters for online learning, offline evaluation, model debugging, and audits of why one impression became positive while another became negative.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is immediate labeling. When the training job reads an impression, it joins any click already present and otherwise emits label 0. This is fresh, cheap, and easy to explain.',
        'A second obvious approach is to wait a very long time so almost all feedback has arrived. That improves label truth but makes the learner stale. A model that waits seven days to learn every click may miss a campaign, product change, or fraud wave that happened today.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is that freshness, memory, and correctness pull in different directions. A short window gives quick labels but more false negatives. A long window gives cleaner labels but stores more pending predictions and delays learning.',
        'There is also a clock problem. Event time is when the user action happened; processing time is when the pipeline saw it; model update time is when the learner consumed the label. If those clocks are mixed, a backfill can create labels that would not have been knowable when the prediction was made.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Store every unresolved prediction as pending state until the policy can decide. The pending map finds the original prediction by impression id, request id, or exposure key. An expiry index finds records whose window has closed, and a dedupe set prevents repeated feedback from creating repeated positives.',
        'This makes the attribution window a data-structure contract. Before expiry, missing feedback means unknown. After expiry plus allowed lateness, missing feedback becomes a negative on the main training stream, while late positives follow an explicit correction, side-output, or backfill path.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'When a prediction event arrives, the operator stores its key, event time, model version, feature snapshot pointer, and expiry time. Expiry time is event time plus the attribution window, such as 30 minutes for clicks or 7 days for purchases. The expiry index is usually a min-heap, timer wheel, or ordered state store.',
        'When feedback arrives, the operator looks up the pending record. If the event time is inside the window and the feedback id has not been counted, it emits label 1 and records the match. When the watermark passes expiry plus grace, unmatched records emit label 0 and leave the pending map.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The correctness argument is an invariant: no negative label is emitted while an allowed positive can still arrive on the main path. Matching feedback turns one pending record into one positive because the key and dedupe guard identify the exact prediction and outcome. Expiry turns an unresolved record into one negative only after event-time progress says the window is closed.',
        'Corrections preserve history instead of mutating it silently. If a late conversion arrives after a negative was emitted, the system records a new decision under the late-event policy. Downstream learners can then choose the fast stream, the corrected stream, or a batch-rebuilt stream without pretending they are the same label definition.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'State size behaves like event rate times window length. At 20,000 impressions per second and a 30-minute click window, the pending store holds about 36 million records before dedupe and metadata. If each record costs 160 bytes, that is about 5.8 GB of state, plus indexes, checkpoints, and replication.',
        'The dominant operation is not the hash lookup; it is keeping timed state recoverable and bounded. Longer windows increase checkpoint size, replay time, storage cost, and the blast radius of a policy bug. Shorter windows lower cost but create more false negatives, so the cost is paid as model bias instead of RAM.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'The pattern is used in ads, recommendations, notifications, fraud review, lead scoring, and subscription churn. These systems make a decision now and observe an outcome later. The join determines what the learner is allowed to know at each point in time.',
        'It is also central to honest offline evaluation. A point-in-time feature join prevents future features from leaking into training. A delayed-feedback window prevents future labels from leaking into evaluation. Together they answer the operational question: what was knowable when the model acted?',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'The design fails when keys are ambiguous. If a click can match several impressions, the system needs a product rule such as last touch, first touch, or fractional credit. Without that rule, the data structure can be internally consistent while assigning credit to the wrong prediction.',
        'It also fails when the window is chosen for convenience instead of the delay distribution. Five minutes may be enough for ad clicks and terrible for purchases. A model trained under a 30-minute label definition should not be compared directly with one trained under a 7-day definition.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Suppose an ad model uses a 30-minute click window and 5-minute grace. Impression 17 arrives at 10:00:00, so the pending map stores expiry 10:30:00. A click with the same impression id arrives with event time 10:08:12, so the join emits label 1, removes the pending row, and records the click id in dedupe state.',
        'Impression 18 arrives at 10:01:00 and receives no click. When the watermark passes 10:36:00, the expiry index can close it and emit label 0. If a click for impression 18 arrives at 10:40:00, it is late under this policy; it may create a correction event, but it must not silently rewrite the earlier training stream.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Study Apache Flink event time and watermarks, Kafka Streams window grace periods, delayed-feedback modeling papers for ad conversion prediction, and point-in-time feature-store joins. Read each source through one question: what information was allowed to exist when the model made its decision?',
        'Inside this curriculum, study Streaming Watermarks, Hash Table, Binary Heap, Hierarchical Timing Wheel, Message Queues, Point-in-Time Feature Join Index, FTRL-Proximal Online CTR Case Study, and Contextual Bandit Logged Policy Evaluation. These are the pieces that make pending state, expiry, replay, and leakage control concrete.',
      ],
    },
  ],
};
