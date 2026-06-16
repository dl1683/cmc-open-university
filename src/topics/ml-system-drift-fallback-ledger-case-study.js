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
      heading: 'What it is',
      paragraphs: [
        'An ML system drift and fallback ledger is the production record for model health. It tracks live input distributions, prediction changes, retrieval logs, embedding shifts, latency, cost per query, quality feedback, fallback routing, and incident response actions.',
        'This module is grounded in the repo-local AIOps thesis: production AI systems are never done after the model ships. The boring systems work is the product surface: monitoring, versioning, fallbacks, drift response, and on-call protocols.',
      ],
    },
    {
      heading: 'Data structures',
      paragraphs: [
        'The ledger stores versioned snapshots. Each snapshot includes model version, feature schema, baseline pointer, serving slice, histograms, top categorical values, embedding centroid or index stats, retrieval hit metrics, prediction distribution, latency, cost, fallback rate, alert state, owner, and incident link.',
        'TensorFlow Data Validation supports computing statistics and checking skew or drift across data spans: https://www.tensorflow.org/tfx/data_validation/get_started. Cloud model-monitoring systems make the same contract operational by comparing production inputs against training or previous serving windows.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The serving path samples requests and responses, joins them with trace ids and model metadata, updates online summaries, compares current windows against baselines, and emits drift events when thresholds breach. The fallback router then decides whether to keep primary traffic, route a slice to a previous model, switch retrieval indexes, cap expensive paths, or degrade safely.',
        'Amazon SageMaker Model Monitor documents the production pattern directly: monitor deployed models, detect drift or quality issues, and alert when rules trigger: https://docs.aws.amazon.com/sagemaker/latest/dg/model-monitor.html. Google model monitoring similarly tracks feature skew and drift in production inputs: https://docs.cloud.google.com/gemini-enterprise-agent-platform/machine-learning/model-monitoring/overview.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'A support agent is trained before a new product launch. After launch, user questions shift, retrieval hit rate drops, embedding centroids move, token usage rises, and answer feedback declines. Offline evals from release day still look fine because they do not contain the new questions. The live ledger catches the shift.',
        'The fallback router moves high-risk support categories to a previous rules-backed answer flow, caps expensive long-context calls, opens an incident for the agent owner, and triggers a reindex job. The post-incident ledger records which slices drifted, which fallback routes were used, what users saw, and when quality recovered.',
      ],
    },
    {
      heading: 'Tradeoffs',
      paragraphs: [
        'Drift thresholds are not universal. Highly seasonal products need different baselines than stable internal tools. Slice-level drift catches minority failures but increases alert volume. Aggressive fallback protects users but can hide model degradation if teams do not review the ledger.',
        'For LLM and RAG systems, quality signals are often delayed or partial. Retrieval hit rate, citation coverage, guardrail blocks, response length, tool error rate, token cost, and fallback rate can be early operational proxies before human labels arrive.',
      ],
    },
    {
      heading: 'Pitfalls',
      paragraphs: [
        'Do not rely only on offline benchmark scores. Production distribution, retrieval corpus, prompt templates, latency budgets, price, and user behavior all move after launch. The system needs live monitoring tied to exact model and data versions.',
        'Do not route fallbacks silently. Users, support teams, and post-incident reviewers need to know whether the primary model, previous model, smaller model, rules fallback, or safe error path handled a request.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Study AIOps Incident Response, Training-Serving Skew Replay Diff, Feature Freshness SLO Monitor, GenAI Trace Token Cost Ledger, LLM Response Cache Safety Ledger, LLM Guardrail Policy Engine, SLO Error Budget Burn Rate Alert, and Runbook Automation Approval Ledger next.',
      ],
    },
  ],
};
