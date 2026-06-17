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
      heading: 'Problem',
      paragraphs: [
        'Many prediction systems act before the label exists. An ad server shows an impression now, a recommender ranks a feed now, a notification system sends a message now, and the user response may arrive seconds, minutes, hours, or days later. If the learner treats every missing response as a negative label immediately, it trains on false negatives.',
        'Delayed feedback is therefore not just an analytics inconvenience. It is a data-structure and streaming-systems problem. The system must remember predictions, match later feedback to the right prediction, decide when enough time has passed, emit labels in a reproducible order, and handle late corrections without corrupting training data or offline evaluation.',
      ],
    },
    {
      heading: 'Naive approach',
      paragraphs: [
        'The easiest approach is immediate labeling: if a click or conversion has not arrived by the time the training job reads the impression, emit label 0. This gives fresh training data and a simple pipeline. It also quietly says that "not yet observed" means "will never happen", which is usually false.',
        'The opposite easy approach is to wait until all possible outcomes have arrived. That gives cleaner labels for long-horizon events such as purchases, cancellations, chargebacks, fraud reviews, or subscription renewals. But it makes the model stale, grows unbounded pending state, and may delay learning until the product has already changed.',
        'A third naive approach is to join by processing time. If the click arrives within thirty minutes of the impression record being processed, count it. That fails when records are delayed, replayed, backfilled, or processed in a different region. The same historical data can produce different labels depending on pipeline timing.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is that freshness, correctness, and bounded memory pull in different directions. Short windows keep the model current but create false negatives for slow responders. Long windows reduce false negatives but delay learning and keep more impressions in memory. Infinite windows are impossible for an online system.',
        'There is also leakage. Offline evaluation can accidentally use labels that would not have been known at prediction time. Online learning can train on a negative just before the positive arrives. Backfills can mutate old labels without recording what changed. If event time, processing time, and model update time are mixed casually, the training set becomes unreplayable.',
        'Late feedback adds a policy choice. A click that arrives after the nominal window can be ignored, side-output, used to correct a previous negative, or reserved for a slower model. All of those choices can be valid. The failure is making no choice and letting late events disappear silently.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Keep each prediction in pending state until the attribution policy can make a defensible decision. A pending map finds the impression or decision that a later feedback event refers to. An expiry heap, time wheel, or ordered state store finds pending items whose window has closed. A dedupe set prevents repeated feedback events from producing repeated positives. An append-only output log makes every emitted label replayable.',
        'The key contract is simple: do not train a negative until the positive event had a fair chance to arrive according to event time, watermark progress, attribution window, and grace period. A missing label is not a negative label until the windowing policy finalizes it.',
        'The contract also separates provisional truth from final truth. A fast online learner may consume provisional labels, but the system should know which labels can still be corrected. A slower evaluation or batch-training path may wait for a longer window and treat the result as final.',
      ],
    },
    {
      heading: 'Mechanics',
      paragraphs: [
        'When an impression or decision event arrives, the join operator stores a record keyed by a stable identifier such as impression_id, request_id, user_id plus candidate_id, or experiment exposure id. The record includes event time, model version, feature snapshot pointer, predicted score, treatment, and an expiry timestamp equal to event time plus the attribution window.',
        'When feedback arrives, the operator looks up the pending record. If the feedback event time is inside the attribution window and the event has not already been counted, it emits a positive label and removes or marks the pending item. If multiple feedback events can happen, the policy may keep the record open for additional outcomes or aggregate them into a value.',
        'When the watermark passes the expiry timestamp plus grace, the operator finalizes unmatched pending records as negatives. The watermark is a promise about event-time progress, not merely wall-clock time. It says the stream has advanced far enough that earlier events are unlikely or no longer accepted on the main path.',
        'Late feedback goes to a declared path. Some systems write correction events that reverse a previous negative and add a positive. Some systems send the late record to a side output for monitoring. Some systems backfill offline training data while keeping online learning fixed. The right choice depends on product semantics and model tolerance for label revisions.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A practical pipeline has four state structures. The pending map answers "is there an open prediction for this feedback?" The expiry index answers "which predictions are old enough to close?" The dedupe store answers "has this feedback already been applied?" The output log answers "what label did the system emit, and why?"',
        'Event time controls label eligibility. Processing time controls resource cleanup and operational alerts. Model update time controls what the learner has already consumed. Keeping those clocks separate is what makes the pipeline auditable. A replay over the same event-time stream and policy should produce the same labels, even if the replay runs faster or slower than production.',
        'The join can run in a streaming engine, a database-backed worker, or a feature-store pipeline. The same logic applies: insert pending prediction, match feedback, finalize expired pending records, and write immutable label decisions. Exactly-once systems make this easier, but idempotent keys and append-only correction records are still needed because retries and duplicates happen.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The method works because it turns uncertainty into explicit state. Before the window closes, the system does not know whether missing feedback means no response or delayed response. After the event-time window and grace policy close, the system has a bounded rule for converting missing feedback into a negative.',
        'It also makes online and offline data comparable. The label is not "whatever was in the database when the query ran." The label is the result of a policy with a window, a watermark rule, a dedupe rule, and a late-event rule. That policy can be versioned, replayed, audited, and used to explain why a specific impression became positive, negative, provisional, or corrected.',
        'The output log is part of correctness. If a late conversion changes the truth, the system should not overwrite the past without evidence. A correction event preserves both decisions: the original negative was reasonable under the short window, and the later positive became known later. Downstream learners can decide which stream they are allowed to consume.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Consider an ad click model with a thirty-minute attribution window and five-minute grace. At 10:00:00, the system serves impression 17 and stores it in pending state with expiry 10:30:00. The record includes model version m42 and the feature hash used for the prediction. At 10:08:12, a click event with impression_id 17 arrives. The join finds the pending record, verifies the click time is inside the window, emits label 1, and records the matched click id in the dedupe set.',
        'Now consider impression 18 at 10:01:00. No click arrives. When the event-time watermark passes 10:36:00, the expiry index says impression 18 can be closed. The system emits label 0, removes the pending record, and logs the reason: window expired after watermark plus grace. If a click for impression 18 arrives at 10:40:00 event time, it is late relative to the policy. It can become a correction, a side-output metric, or an offline-only backfill, but it should not be silently folded into the original stream without a policy version change.',
        'For purchase conversion, the same shape uses a longer window. A click at 10:08 may lead to a purchase two days later. A short-window CTR learner can update quickly from clicks. A conversion-value model may wait longer, use survival-style delayed-feedback modeling, or train from corrected labels after enough time has passed.',
      ],
    },
    {
      heading: 'What the animation teaches',
      paragraphs: [
        'The "label join" view shows the main path: impression, pending map, feedback join, label emission, and learner update. The pending map is not optional bookkeeping. It is the place where the system remembers that a decision has not yet become training data.',
        'The "late feedback" view shows why a single fixed join is not enough. Watermark progress closes windows, grace absorbs bounded disorder, and late records follow a separate correction or backfill path. The freshness curve and truth curve show the central tradeoff: fresher labels arrive sooner, but complete labels require waiting.',
        'The highlighted table rows represent policy decisions, not mere pipeline stages. When a record moves from waiting to positive, negative, late, or duplicate, the system is making a claim that downstream training and evaluation will inherit.',
      ],
    },
    {
      heading: 'Costs and tradeoffs',
      paragraphs: [
        'The main cost is state. Pending records must remain available until the attribution policy closes them, so memory or state-store size scales with event rate times window length. Longer windows also increase recovery time, checkpoint size, and the amount of state that can be affected by a replay or bug fix.',
        'The second cost is latency. A model trained only on final labels learns more slowly. A model trained on provisional labels learns quickly but may learn biased negatives. Some teams solve this with two streams: fast provisional learning for responsiveness and slower final learning for evaluation, calibration, and periodic retraining.',
        'The third cost is complexity. Corrections require idempotent label identifiers, versioned policies, downstream consumers that can subtract or supersede old labels, and metrics that show how often labels change after first emission. Without that machinery, correction support can create more confusion than benefit.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'This pattern wins in ads, recommendations, notifications, search ranking, contextual bandits, fraud review, lead scoring, subscription churn, and any decision system where the action is immediate but the outcome is delayed. It is especially important when the learner updates online, because the order of prediction, label arrival, and model update changes future predictions.',
        'It also wins when offline evaluation must mirror online reality. Point-in-time feature joins prevent feature leakage; delayed-feedback windows prevent label leakage. Together they let a team answer a precise question: what would this model have known at the time it made the prediction?',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'The design fails when identifiers are unstable or ambiguous. If a feedback event cannot be linked to exactly one eligible prediction, the system may double count, miss positives, or assign credit to the wrong model version. Attribution rules for multi-touch journeys, cross-device users, and repeated exposures need explicit product semantics.',
        'It fails when the window is chosen by convenience rather than delay distribution. A five-minute window may be fine for clicks and terrible for purchases. A thirty-day window may be fine for batch conversion modeling and useless for an online ranker that must adapt today.',
        'It also fails when teams compare datasets built with different policies. A model trained under a one-hour window and a model trained under a seven-day window are not learning from the same label definition. Report the policy version with every metric.',
      ],
    },
    {
      heading: 'Failure modes',
      paragraphs: [
        'Common bugs include using processing time instead of event time, finalizing negatives before the watermark proves the window is closed, forgetting dedupe, letting retries emit duplicate labels, deleting pending state before checkpointing the output, and joining feedback to the latest model version rather than the model version that made the prediction.',
        'Operational failures include state-store growth after a downstream outage, a watermark stuck behind one slow partition, sudden late-event spikes after mobile clients reconnect, clock skew in event producers, schema changes that drop the attribution key, and replay jobs that accidentally use a newer policy. Good dashboards show pending count by age, window-close rate, late-feedback rate, correction rate, duplicate rate, and label drift by policy version.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Primary references include Apache Flink event time and watermarks, Kafka Streams window and grace-period semantics, papers on delayed feedback in ad prediction, and point-in-time feature-join documentation from feature-store systems. Read them with the same question in mind: what information was legally knowable when the model acted?',
        'Inside this curriculum, study FTRL-Proximal Online CTR Case Study for online learning, Contextual Bandit Logged Policy Evaluation for counterfactual logging, Streaming Watermarks for event-time progress, Point-in-Time Feature Join Index for feature leakage prevention, Feature Store for training-serving consistency, Hash Table for pending maps, Binary Heap or Hierarchical Timing Wheel for expirations, and Message Queues for replayable event delivery.',
      ],
    },
  ],
};
