// ML system drift fallback ledger: monitor production model inputs, outputs,
// retrieval, embeddings, latency, cost, and fallback routing as one contract.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'ml-system-drift-fallback-ledger-case-study',
  title: 'ML System Drift & Fallback Ledger Case Study',
  category: 'AI & ML',
  summary: 'Track model drift and operational decay with input statistics, prediction drift, retrieval logs, embedding shift, latency, cost, fallback state, and incident response hooks.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['drift ledger', 'fallback router'], defaultValue: 'drift ledger' },
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

function driftGraph(title) {
  return graphState({
    nodes: [
      { id: 'req', label: 'request', x: 0.7, y: 3.5, note: 'live' },
      { id: 'capture', label: 'capture', x: 2.0, y: 3.5, note: 'sample' },
      { id: 'stats', label: 'stats', x: 3.4, y: 2.0, note: 'dist' },
      { id: 'retrieval', label: 'retrieval', x: 3.4, y: 5.1, note: 'RAG' },
      { id: 'ledger', label: 'ledger', x: 5.1, y: 3.5, note: 'drift' },
      { id: 'alert', label: 'alert', x: 6.8, y: 1.8, note: 'SLO' },
      { id: 'router', label: 'router', x: 6.8, y: 5.1, note: 'fallback' },
      { id: 'primary', label: 'primary', x: 8.3, y: 3.0, note: 'model' },
      { id: 'fallback', label: 'fallback', x: 8.3, y: 5.7, note: 'safe' },
      { id: 'incident', label: 'incident', x: 9.6, y: 3.5, note: 'owner' },
    ],
    edges: [
      { id: 'e-req-capture', from: 'req', to: 'capture' },
      { id: 'e-capture-stats', from: 'capture', to: 'stats' },
      { id: 'e-capture-retrieval', from: 'capture', to: 'retrieval' },
      { id: 'e-stats-ledger', from: 'stats', to: 'ledger' },
      { id: 'e-retrieval-ledger', from: 'retrieval', to: 'ledger' },
      { id: 'e-ledger-alert', from: 'ledger', to: 'alert' },
      { id: 'e-ledger-router', from: 'ledger', to: 'router' },
      { id: 'e-router-primary', from: 'router', to: 'primary' },
      { id: 'e-router-fallback', from: 'router', to: 'fallback' },
      { id: 'e-alert-incident', from: 'alert', to: 'incident' },
      { id: 'e-primary-incident', from: 'primary', to: 'incident' },
      { id: 'e-fallback-incident', from: 'fallback', to: 'incident' },
    ],
  }, { title });
}

function driftPlot() {
  return plotState({
    axes: {
      x: { label: 'days since deploy', min: 0, max: 43 },
      y: { label: 'normalized score', min: 0, max: 1 },
    },
    series: [
      { id: 'input', label: 'input drift', points: [{ x: 0, y: 0.08 }, { x: 5, y: 0.14 }, { x: 10, y: 0.26 }, { x: 20, y: 0.54 }, { x: 30, y: 0.71 }] },
      { id: 'quality', label: 'quality', points: [{ x: 0, y: 0.90 }, { x: 5, y: 0.88 }, { x: 10, y: 0.83 }, { x: 20, y: 0.72 }, { x: 30, y: 0.61 }] },
      { id: 'fallback', label: 'fallback', points: [{ x: 0, y: 0.00 }, { x: 5, y: 0.00 }, { x: 10, y: 0.05 }, { x: 20, y: 0.18 }, { x: 30, y: 0.34 }] },
    ],
    markers: [
      { id: 'review', x: 20, y: 0.54, label: 'review' },
    ],
  });
}

function* driftLedger() {
  yield {
    state: driftGraph('Production ML fights entropy after launch'),
    highlight: { active: ['req', 'capture', 'stats', 'retrieval', 'ledger', 'e-req-capture', 'e-capture-stats', 'e-capture-retrieval', 'e-stats-ledger', 'e-retrieval-ledger'], found: ['alert'] },
    explanation: 'A production model needs an operations ledger, not just an evaluation score. The ledger tracks input distributions, prediction drift, retrieval behavior, embedding shift, latency, cost, fallback state, and ownership.',
    invariant: 'A model in production is a monitored system, not a frozen artifact.',
  };

  yield {
    state: labelMatrix(
      'Drift ledger signals',
      [
        { id: 'input', label: 'inputs' },
        { id: 'pred', label: 'preds' },
        { id: 'embed', label: 'embeds' },
        { id: 'rag', label: 'RAG' },
        { id: 'ops', label: 'ops' },
      ],
      [
        { id: 'baseline', label: 'base' },
        { id: 'current', label: 'now' },
        { id: 'action', label: 'action' },
      ],
      [
        ['train hist', 'shift .32', 'review'],
        ['class mix', 'flat tail', 'sample'],
        ['centroid', 'far', 'reindex'],
        ['hit@k', 'down', 'debug'],
        ['p99/cost', 'up', 'route'],
      ],
    ),
    highlight: { active: ['input:current', 'embed:current', 'rag:current', 'ops:action'], found: ['input:action', 'rag:action'] },
    explanation: 'The ledger stores enough signal families to separate data drift, model behavior drift, retrieval drift, embedding-index decay, and pure serving problems such as latency or cost spikes.',
  };

  yield {
    state: driftPlot(),
    highlight: { active: ['input', 'quality', 'fallback', 'review'] },
    explanation: 'Drift is rarely a single cliff. Input shift can grow for weeks, quality can degrade gradually, and fallback traffic can rise before dashboards show a clean outage.',
  };

  yield {
    state: labelMatrix(
      'Snapshot fields',
      [
        { id: 'slice', label: 'slice' },
        { id: 'model', label: 'model' },
        { id: 'schema', label: 'schema' },
        { id: 'base', label: 'baseline' },
        { id: 'owner', label: 'owner' },
      ],
      [
        { id: 'stores', label: 'stores' },
        { id: 'why', label: 'why' },
      ],
      [
        ['region/user', 'fairness'],
        ['version', 'rollback'],
        ['features', 'skew'],
        ['histograms', 'compare'],
        ['team', 'page'],
      ],
    ),
    highlight: { active: ['slice:stores', 'model:stores', 'base:stores'], found: ['owner:why'] },
    explanation: 'Every drift snapshot should be slice-aware and versioned. Without model version, feature schema, serving slice, and baseline pointer, a drift alert is hard to act on.',
  };
}

function* fallbackRouter() {
  yield {
    state: driftGraph('Fallback routing is part of model monitoring'),
    highlight: { active: ['ledger', 'router', 'primary', 'fallback', 'incident', 'e-ledger-router', 'e-router-primary', 'e-router-fallback', 'e-fallback-incident'], found: ['alert'] },
    explanation: 'The fallback router decides when to keep the primary model, send traffic to a previous model, switch retrieval indexes, use a rules fallback, degrade features, or return an honest unavailable response.',
  };

  yield {
    state: labelMatrix(
      'Fallback policy table',
      [
        { id: 'soft', label: 'soft drift' },
        { id: 'hard', label: 'hard drift' },
        { id: 'lat', label: 'p99' },
        { id: 'cost', label: 'cost' },
        { id: 'guard', label: 'guardrail' },
      ],
      [
        { id: 'trigger', label: 'trigger' },
        { id: 'route', label: 'route' },
        { id: 'record', label: 'record' },
      ],
      [
        ['watch', 'sample more', 'note'],
        ['threshold', 'prev model', 'incident'],
        ['SLO burn', 'fast path', 'page'],
        ['budget', 'small model', 'ledger'],
        ['blocked', 'safe error', 'audit'],
      ],
    ),
    highlight: { active: ['hard:route', 'lat:route', 'guard:route'], found: ['cost:record'] },
    explanation: 'Fallbacks should be explicit policies. Each trigger maps to a route, an owner, and a ledger record so teams know when degraded behavior was served and why.',
  };

  yield {
    state: labelMatrix(
      'Complete case: support agent',
      [
        { id: 'input', label: 'input' },
        { id: 'retr', label: 'retrieval' },
        { id: 'cost', label: 'cost' },
        { id: 'qual', label: 'quality' },
        { id: 'route', label: 'route' },
      ],
      [
        { id: 'signal', label: 'signal' },
        { id: 'effect', label: 'effect' },
        { id: 'action', label: 'action' },
      ],
      [
        ['new product', 'shift', 'flag'],
        ['hit@5 down', 'weak docs', 'reindex'],
        ['tokens up', 'budget burn', 'cap'],
        ['thumbs down', 'bad answers', 'review'],
        ['fallback 18%', 'degraded', 'incident'],
      ],
    ),
    highlight: { active: ['retr:action', 'cost:action', 'route:signal'], found: ['qual:action'] },
    explanation: 'A support agent starts seeing new-product questions. Retrieval hit rate falls, answer quality drops, token cost rises, and fallback rate climbs. The ledger links the drift alert to reindexing, routing, and incident response.',
  };

  yield {
    state: labelMatrix(
      'Anti-patterns',
      [
        { id: 'eval', label: 'offline only' },
        { id: 'avg', label: 'averages' },
        { id: 'silent', label: 'silent fb' },
        { id: 'none', label: 'no owner' },
      ],
      [
        { id: 'bad', label: 'bad' },
        { id: 'fix', label: 'fix' },
      ],
      [
        ['launch score', 'live slices'],
        ['hide tails', 'p95/p99'],
        ['unknown UX', 'log route'],
        ['no response', 'page map'],
      ],
    ),
    highlight: { active: ['eval:bad', 'silent:bad', 'none:bad'], found: ['avg:fix', 'silent:fix'] },
    explanation: 'The local AIOps thesis is exactly right here: the model is not the system. Monitoring, fallbacks, versioning, cost controls, and incident protocols are the parts that keep shipped AI reliable.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'drift ledger') yield* driftLedger();
  else if (view === 'fallback router') yield* fallbackRouter();
  else throw new InputError('Pick an ML drift ledger view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'The animation treats a production ML system as a service with state, not as a frozen model file. Active nodes show live signals being collected, found nodes show alerts or routes that have enough evidence to act, and compare marks the baseline used to decide whether behavior changed.',
        'The safe inference rule is this: a drift signal is only actionable when it is tied to a slice, version, baseline, owner, and route. A rising score without that context is noise that can cause either panic or neglect.',
        {type:'callout', text:`A drift ledger turns production decay into traceable state by joining model behavior, retrieval health, cost, latency, fallback route, and owner.`},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'A model can pass offline evaluation and still decay in production. User behavior changes, product catalogs move, prompts are edited, feature pipelines drift, retrieval indexes age, and vendor models change behind stable APIs.',
        'A drift and fallback ledger exists to record those moving parts together. It makes degraded behavior visible while the system is still serving users, then links each degradation to a fallback route and recovery owner.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is to monitor uptime, error rate, and an offline test set. That is useful because crashes, broken deployments, and large regressions do show up in those signals.',
        'For ML products, those signals are too thin. A support agent can return HTTP 200 with fluent wrong answers, and a recommender can keep average accuracy stable while one important slice gets worse.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is delayed and ambiguous truth. Labels, refunds, human reviews, escalations, and thumbs-down feedback often arrive after the bad experience has already reached users.',
        'Attribution is the second wall. A quality drop can come from input shift, retrieval decay, embedding drift, prompt edits, model version changes, latency timeouts, guardrail blocks, or budget routing, and one aggregate chart cannot separate them.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'The core insight is to make degradation traceable state. Every alert and fallback decision should name the serving slice, model version, prompt version, feature schema, retrieval index, baseline, current window, metric, threshold, route, owner, and recovery condition.',
        'That turns monitoring into an operational contract. The ledger does not merely say "quality fell"; it says which users were affected, compared with what baseline, what degraded route they received, and who must restore the intended path.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The serving path samples requests, responses, traces, costs, latencies, retrieval results, model outputs, and feedback. Rolling summaries compare the current window with a chosen baseline such as training data, last stable week, a release candidate, or a seasonally matched window.',
        'When a policy breaches, the router applies an approved action: keep primary traffic, send a slice to the previous model, switch retrieval indexes, cap context length, use a rules fallback, require human review, or return an honest unavailable response. The route itself is logged so degraded service cannot become invisible normal behavior.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Correctness here means policy correctness, not proof that every answer is true. If the trigger, slice, route, owner, and recovery rule are recorded from the same versioned trace, responders can reconstruct what happened and verify whether the system followed its declared fallback policy.',
        'The invariant is traceability under uncertainty. Even when ground truth arrives late, the ledger preserves enough evidence to distinguish data drift from retrieval failure, serving failure, guardrail behavior, or cost-driven route changes.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The cost grows with traffic, slices, retained fields, and label joins. Sampling 1 percent of 10 million daily requests stores 100,000 traces per day; raising sampling to 10 percent stores 1 million traces and usually multiplies privacy review, storage, and dashboard load.',
        'Fine slices catch minority failures but create alert volume. Broad slices reduce noise but hide failures, so the behavioral cost is attention: responders must trust that every alert has a route and that every route has an owner.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'This pattern fits support agents, RAG systems, recommenders, fraud models, ranking systems, risk scoring, search, document extraction, and any ML service where labels are late. The access pattern is continuous service with partial evidence.',
        'It is especially useful when failure can look polite. A generative answer can be fluent and wrong, a retrieval result can cite stale documents, and a budget router can silently lower answer quality to protect spend.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'A ledger fails when its baselines are bad. If last week was already degraded, comparing against it teaches the system that decay is normal; if seasonality is ignored, ordinary traffic can look like an incident.',
        'It also fails when fallbacks are treated as infrastructure details. A safe error, smaller model, stale rules flow, or human handoff is product behavior, so it must be measured, reviewed, and retired when recovery conditions are met.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'A support agent normally handles 100,000 requests per day with 92 percent answer acceptance, 78 percent retrieval hit@5, 900 ms p95 latency, and 2 percent fallback traffic. After a new product launch, new-product questions grow to 18,000 requests per day, hit@5 falls to 41 percent, p95 latency rises to 1600 ms, acceptance drops to 66 percent, and fallback reaches 23 percent.',
        'The ledger links those numbers to the product slice, prompt version, retrieval index version, and route. It sends high-risk questions to a rules-backed flow, starts reindexing, caps expensive context expansion, and closes the incident only after hit@5 returns above 70 percent and fallback falls below 5 percent for two full windows.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Study TensorFlow Data Validation for schema and drift checks, Amazon SageMaker Model Monitor for production model quality monitoring, Google Cloud Model Monitoring for feature and prediction drift, and Evidently for reference-window drift reports.',
        'Study next: training-serving skew replay, feature freshness SLOs, RAG citation evaluation, token cost ledgers, guardrail policy engines, incident response runbooks, and error-budget burn alerts.',
      ],
    },
  ],
};
