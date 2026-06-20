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
  references: [
    { title: 'TensorFlow Data Validation', url: 'https://www.tensorflow.org/tfx/data_validation/get_started' },
    { title: 'Amazon SageMaker Model Monitor', url: 'https://docs.aws.amazon.com/sagemaker/latest/dg/model-monitor.html' },
    { title: 'Google Cloud Model Monitoring', url: 'https://docs.cloud.google.com/gemini-enterprise-agent-platform/machine-learning/model-monitoring/overview' },
    { title: 'Evidently Data Drift', url: 'https://docs.evidentlyai.com/metrics/preset_data_drift' },
  ],
  sections: [
    {
      heading: 'Why this exists',
      paragraphs: [
        `An offline model score is a snapshot. Production is a stream. User behavior changes, products launch, policies change, prompts move, retrieval indexes age, embeddings get rebuilt, vendors update models, latency shifts, prices move, and the system keeps answering users while all of that happens.`,
        `A drift and fallback ledger exists because a shipped ML product is not only a model. It is a monitored service with inputs, outputs, retrieval, routing, cost, quality feedback, fallbacks, owners, and recovery actions. The ledger makes those moving parts visible in one operational record so decay is detected, routed, and explained instead of discovered through customer pain.`,
        {type:'callout', text:`A drift ledger turns production decay into traceable state by joining model behavior, retrieval health, cost, latency, fallback route, and owner.`},
      ],
    },
    {
      heading: 'The baseline and the wall',
      paragraphs: [
        `The baseline approach is to deploy the model, monitor uptime and error rate, and rerun an offline evaluation set before major releases. That catches crashes, broken deployments, and some obvious regressions. It is necessary, but it is not enough for a live ML system.`,
        `The wall is silent quality decay. A support agent can keep returning HTTP 200 while its answers get worse because users are asking about a new product. A RAG system can keep producing fluent responses while retrieval hit rate falls. A classifier can keep meeting average accuracy while one region, language, plan tier, or product slice fails. The service looks alive, but the product promise is eroding.`,
      ],
    },
    {
      heading: 'Delayed truth and attribution',
      paragraphs: [
        `The first hard problem is delayed truth. Ground-truth labels, thumbs-down feedback, refunds, escalations, support reviews, and human audits often arrive late or sparsely. By the time the quality metric is undeniable, the system may have served weak answers for days or weeks.`,
        `The second hard problem is attribution. A quality drop can come from input drift, training-serving skew, prompt changes, model version changes, retrieval index decay, embedding shift, feature freshness problems, latency timeouts, guardrail blocks, or budget routing to smaller models. One aggregate dashboard cannot explain which part of the system changed. The ledger exists to keep enough context to separate these causes.`,
      ],
    },
    {
      heading: 'Core ledger invariant',
      paragraphs: [
        `The invariant is traceable degradation. Every drift event and fallback decision must be tied to a serving slice, model version, prompt version, feature schema, retrieval index, baseline, current window, metric, threshold, route, owner, and recovery condition. If a team cannot answer "what changed, compared with what, for which users, and what route did we serve instead," the ledger is incomplete.`,
        `This invariant is stronger than ordinary monitoring. Monitoring may show that p99 latency rose or answer feedback fell. The ledger connects that signal to a versioned production context and an operational response. It records not just that the system degraded, but which policy decided to degrade gracefully and who owns returning to the primary path.`,
      ],
    },
    {
      heading: 'State model',
      paragraphs: [
        `A useful snapshot stores model version, prompt version, feature schema version, retrieval index version, embedding model version, guardrail policy version, serving slice, trace ids, request features, prediction distribution, top categorical values, numeric histograms, embedding centroid or distance statistics, retrieval hit metrics, latency, cost, feedback, fallback rate, alert state, owner, and incident link.`,
        `The baseline pointer is essential because drift is always a comparison. The current window may be compared with training data, a previous serving window, a release candidate, a gold slice, a seasonally matched period, or a human-approved production interval. A drift score without a baseline is hard to interpret and easy to overreact to.`,
      ],
    },
    {
      heading: 'Mechanism',
      paragraphs: [
        `The serving path samples requests and responses, joins them with trace ids and version metadata, updates rolling summaries, and compares the current window with the chosen baseline. It records both data signals and system signals because either can break the user experience. Input drift, prediction drift, retrieval drift, embedding drift, latency, cost, and guardrail behavior all belong in the same operational view.`,
        `When a threshold or policy condition breaches, the ledger emits an event with slice, metric, baseline, current value, severity, owner, and suggested action. The fallback router then applies an explicit route: keep primary traffic, send a slice to a previous model, switch retrieval indexes, reduce context length, cap expensive calls, use a rules fallback, require human review, or return an honest unavailable response.`,
        `The route itself is recorded. That matters because a fallback can be the correct customer-protection action and still become a product problem if it remains in place. The ledger should show when degraded behavior started, how much traffic it touched, why it was chosen, and what condition will end it.`,
      ],
    },
    {
      heading: 'Correctness and reliability',
      paragraphs: [
        `The ledger does not prove that every answer is correct. It proves a narrower but important property: monitoring, fallback, and incident decisions are connected to specific evidence and versions. In production ML, that traceability is part of reliability because teams need to know what users received during uncertainty.`,
        `Correctness of the operational loop means that the trigger, route, user-visible behavior, owner, and recovery rule match the policy. Silent fallback is dangerous because it can protect uptime dashboards while hiding product decay. A good ledger makes degraded service visible, bounded, and reviewable.`,
      ],
    },
    {
      heading: 'Costs and tradeoffs',
      paragraphs: [
        `Monitoring costs compute, storage, labels, and attention. Fine-grained slices catch minority failures but increase metric volume and alert noise. Wide sampling reduces cost but can miss rare high-impact drift. Retaining prompts, traces, and responses may create privacy and compliance duties, so sampling and redaction rules must be designed with the product's risk model.`,
        `Thresholds are product decisions. A seasonal ecommerce recommender needs different baselines than a stable internal classifier. A medical triage assistant should fallback earlier than a movie recommender because the cost of a false negative is higher. A customer-support bot may route uncertain answers to human review, while a low-risk suggestion model may tolerate more drift before intervention.`,
      ],
    },
    {
      heading: 'Concrete case study',
      paragraphs: [
        `A support agent is evaluated before a new product launch. The offline set covers existing products well, and the release looks safe. After launch, users start asking about the new product. The input distribution shifts toward new terms, retrieval hit@5 falls because the documentation index is stale, embedding distances move away from the old centroid, long-context calls increase, token cost rises, answer feedback drops, and fallback traffic climbs.`,
        `The offline release score still looks fine because the old test set lacks the new questions. The live ledger catches the slice shift, opens an incident for the agent owner, routes high-risk new-product questions to a rules-backed support flow, starts a reindex job, caps expensive retrieval paths, and records when hit rate and answer feedback recover. The important point is not one metric. It is the connected story across input, retrieval, cost, quality, route, and recovery.`,
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        `A drift and fallback ledger wins in systems where labels are late, user behavior moves, or the ML path has several failure sources. Support agents, search systems, recommenders, fraud models, risk scorers, ranking systems, document extraction pipelines, and RAG products all benefit from joining data drift with operational routing.`,
        `It is especially valuable for AI products that can fail softly. A generated answer can be fluent and wrong. A retrieval system can cite weak documents. A guardrail can block too much traffic. A budget router can silently lower answer quality. The ledger gives teams a way to see these soft failures before they become invisible normal behavior.`,
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        `The ledger can fail by creating false confidence. Drift signals are proxies. A distribution shift does not automatically mean quality is bad, and stable inputs do not guarantee quality is good. The ledger must be connected to human review, labels, business outcomes, or carefully chosen proxy metrics.`,
        `It can also fail through bad baselines. If the baseline already contains a degraded week, the system learns decay as normal. If the baseline ignores seasonality, ordinary traffic can look like an incident. If slice definitions are too broad, minority failures disappear into averages. If slice definitions are too narrow, alert volume can overwhelm responders.`,
      ],
    },
    {
      heading: 'Failure modes',
      paragraphs: [
        `Averages hide slice failures. Overall quality can stay flat while one region, language, product line, plan tier, or user segment breaks. Cost averages can also hide a small slice that burns budget through long contexts or repeated retries.`,
        `Fallbacks can become permanent. If the degraded route is not visible, teams may stop noticing that users are getting a smaller model, stale rules, human handoff, or safe errors instead of the intended product. Another failure mode is alert-only monitoring: the system pages someone but has no approved route to protect users while the owner investigates.`,
      ],
    },
    {
      heading: 'Operational guidance',
      paragraphs: [
        `Start with a small set of high-signal slices and routes. Define the baseline for each metric before defining thresholds. Attach every alert to an owner and a recovery condition. Record the model, prompt, feature, retrieval, and guardrail versions in the same trace so incidents do not turn into archaeology.`,
        `Treat fallback as product behavior, not just infrastructure. Users should receive the safest honest behavior the product can provide: previous model, reduced feature set, rules-backed answer, human review, or clear unavailability. Measure fallback rate as a first-class metric because it tells you how much of the product is operating outside the intended path.`,
      ],
    },
    {
      heading: 'How the visual model teaches it',
      paragraphs: [
        `The drift ledger view shows why monitoring has to collect several families of signals before deciding what to do. Inputs, retrieval, embeddings, latency, cost, quality, and fallback rate are not separate stories. They are different lenses on the same production system.`,
        `The fallback router view shows that detection is only half of the design. A drift event must connect to a route, and the route must connect to an incident owner. The visual model is useful because it keeps the model from looking like the whole system. The model is one node inside a larger operational contract.`,
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        `TensorFlow Data Validation supports schema-based statistics plus skew and drift checks across spans: https://www.tensorflow.org/tfx/data_validation/get_started. Amazon SageMaker Model Monitor covers data quality, model quality, bias drift, and feature-attribution drift: https://docs.aws.amazon.com/sagemaker/latest/dg/model-monitor.html.`,
        `Google Model Monitoring describes threshold-based alerts, model-version monitoring, input-feature drift, output-inference drift, and training-serving skew: https://docs.cloud.google.com/gemini-enterprise-agent-platform/machine-learning/model-monitoring/overview. Evidently describes comparing current data to reference data, column drift, prediction drift, and drift as a proxy when ground truth is missing: https://docs.evidentlyai.com/metrics/preset_data_drift.`,
        `Study AIOps Incident Response for ownership, Training-Serving Skew Replay Diff for baseline comparisons, Feature Freshness SLO Monitor for upstream data decay, GenAI Trace Token Cost Ledger for spend drift, LLM Response Cache Safety Ledger for stale outputs, LLM Guardrail Policy Engine for routed failures, SLO Error Budget Burn Rate Alert for alert policy, and Runbook Automation Approval Ledger for controlled recovery.`,
      ],
    },
  ],
};
