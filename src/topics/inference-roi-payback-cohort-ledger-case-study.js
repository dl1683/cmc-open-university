// Inference ROI payback cohort ledger: join token cost, feature cohorts,
// cost allocation, value events, and rollback decisions.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'inference-roi-payback-cohort-ledger-case-study',
  title: 'Inference ROI Payback Cohort Ledger',
  category: 'Systems',
  summary: 'A product-finance case study for AI features: cohort assignment, token-cost spans, cost allocation, value events, payback curves, and route changes.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['payback ledger', 'cohort trace'], defaultValue: 'payback ledger' },
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

function roiGraph(title) {
  return graphState({
    nodes: [
      { id: 'flag', label: 'flag', x: 0.7, y: 3.5, note: 'variant' },
      { id: 'cohort', label: 'cohort', x: 2.1, y: 3.5, note: 'users' },
      { id: 'trace', label: 'trace', x: 3.6, y: 2.0, note: 'tokens' },
      { id: 'alloc', label: 'alloc', x: 3.6, y: 5.0, note: 'cost' },
      { id: 'value', label: 'value', x: 5.3, y: 2.0, note: 'event' },
      { id: 'risk', label: 'risk', x: 5.3, y: 5.0, note: 'quality' },
      { id: 'payback', label: 'pay', x: 7.0, y: 3.5, note: 'curve' },
      { id: 'route', label: 'route', x: 8.6, y: 2.0, note: 'change' },
      { id: 'stop', label: 'stop', x: 8.6, y: 5.0, note: 'kill' },
      { id: 'ledger', label: 'ledger', x: 9.8, y: 3.5, note: 'row' },
    ],
    edges: [
      { id: 'e-flag-cohort', from: 'flag', to: 'cohort' },
      { id: 'e-cohort-trace', from: 'cohort', to: 'trace' },
      { id: 'e-cohort-alloc', from: 'cohort', to: 'alloc' },
      { id: 'e-trace-value', from: 'trace', to: 'value' },
      { id: 'e-alloc-risk', from: 'alloc', to: 'risk' },
      { id: 'e-value-payback', from: 'value', to: 'payback' },
      { id: 'e-risk-payback', from: 'risk', to: 'payback' },
      { id: 'e-payback-route', from: 'payback', to: 'route' },
      { id: 'e-payback-stop', from: 'payback', to: 'stop' },
      { id: 'e-route-ledger', from: 'route', to: 'ledger' },
      { id: 'e-stop-ledger', from: 'stop', to: 'ledger' },
    ],
  }, { title });
}

function traceGraph(title) {
  return graphState({
    nodes: [
      { id: 'req', label: 'req', x: 0.7, y: 3.4, note: 'span' },
      { id: 'model', label: 'model', x: 2.1, y: 1.6, note: 'route' },
      { id: 'tool', label: 'tool', x: 2.1, y: 5.2, note: 'work' },
      { id: 'cost', label: 'cost', x: 3.7, y: 3.4, note: '$' },
      { id: 'tag', label: 'tag', x: 5.2, y: 1.6, note: 'owner' },
      { id: 'event', label: 'event', x: 5.2, y: 5.2, note: 'value' },
      { id: 'focus', label: 'FOCUS', x: 6.9, y: 3.4, note: 'schema' },
      { id: 'cohort', label: 'cohort', x: 8.3, y: 3.4, note: 'slice' },
      { id: 'decide', label: 'decide', x: 9.6, y: 3.4, note: 'ship' },
    ],
    edges: [
      { id: 'e-req-model', from: 'req', to: 'model' },
      { id: 'e-req-tool', from: 'req', to: 'tool' },
      { id: 'e-model-cost', from: 'model', to: 'cost' },
      { id: 'e-tool-cost', from: 'tool', to: 'cost' },
      { id: 'e-cost-tag', from: 'cost', to: 'tag' },
      { id: 'e-cost-event', from: 'cost', to: 'event' },
      { id: 'e-tag-focus', from: 'tag', to: 'focus' },
      { id: 'e-event-focus', from: 'event', to: 'focus' },
      { id: 'e-focus-cohort', from: 'focus', to: 'cohort' },
      { id: 'e-cohort-decide', from: 'cohort', to: 'decide' },
    ],
  }, { title });
}

function paybackPlot() {
  return plotState({
    axes: {
      x: { label: 'days after launch', min: 0, max: 90 },
      y: { label: 'net value per cohort', min: -8, max: 18 },
    },
    series: [
      { id: 'assist', label: 'assist', points: [
        { x: 0, y: -2 }, { x: 7, y: -1 }, { x: 14, y: 2 }, { x: 30, y: 7 }, { x: 60, y: 13 }, { x: 90, y: 16 },
      ] },
      { id: 'agent', label: 'agent', points: [
        { x: 0, y: -4 }, { x: 7, y: -6 }, { x: 14, y: -5 }, { x: 30, y: -1 }, { x: 60, y: 5 }, { x: 90, y: 10 },
      ] },
      { id: 'novelty', label: 'novelty', points: [
        { x: 0, y: -2 }, { x: 7, y: 1 }, { x: 14, y: 0 }, { x: 30, y: -2 }, { x: 60, y: -4 }, { x: 90, y: -5 },
      ] },
    ],
    markers: [
      { id: 'cross', x: 14, y: 2, label: 'cross' },
      { id: 'kill', x: 45, y: -3, label: 'kill' },
    ],
  });
}

function marginPlot() {
  return plotState({
    axes: {
      x: { label: 'cohort usage percentile', min: 0, max: 100 },
      y: { label: 'gross margin after AI', min: -20, max: 60 },
    },
    series: [
      { id: 'free', label: 'free tier', points: [
        { x: 10, y: 20 }, { x: 30, y: 12 }, { x: 60, y: -2 }, { x: 90, y: -15 },
      ] },
      { id: 'paid', label: 'paid', points: [
        { x: 10, y: 46 }, { x: 30, y: 42 }, { x: 60, y: 34 }, { x: 90, y: 20 },
      ] },
    ],
    markers: [
      { id: 'heavy', x: 90, y: -15, label: 'heavy' },
      { id: 'ok', x: 60, y: 34, label: 'ok' },
    ],
  });
}

function* paybackLedger() {
  yield {
    state: roiGraph('AI ROI needs a cohort ledger'),
    highlight: { active: ['flag', 'cohort', 'trace', 'alloc', 'value', 'risk', 'e-flag-cohort', 'e-cohort-trace', 'e-cohort-alloc'], found: ['payback'] },
    explanation: 'A feature-level AI cost ledger starts with a controlled cohort. Token traces and allocated infrastructure costs must join to value events, quality risk, and payback curves before the feature is scaled.',
    invariant: 'Payback is measured on cohorts, not anecdotes.',
  };

  yield {
    state: labelMatrix(
      'ROI',
      [
        { id: 'cost', label: 'cost' },
        { id: 'time', label: 'time' },
        { id: 'rev', label: 'rev' },
        { id: 'save', label: 'save' },
        { id: 'qual', label: 'qual' },
        { id: 'risk', label: 'risk' },
      ],
      [
        { id: 'row', label: 'row' },
        { id: 'use', label: 'use' },
      ],
      [
        ['tokens', 'unit'],
        ['minutes', 'labor'],
        ['upsell', 'LTV'],
        ['deflect', 'support'],
        ['score', 'gate'],
        ['incident', 'stop'],
      ],
    ),
    highlight: { active: ['cost:row', 'rev:row', 'save:row', 'qual:row'], compare: ['risk:use'] },
    explanation: 'The ledger should store cost, time saved, revenue lift, support deflection, quality score, and incident risk separately. Combining them too early hides whether an AI feature is valuable, merely popular, or operationally dangerous.',
  };

  yield {
    state: paybackPlot(),
    highlight: { active: ['assist', 'cross'], compare: ['agent'], found: ['novelty', 'kill'] },
    explanation: 'Different AI features pay back on different clocks. Assistance can cross quickly, agentic automation may need a longer setup period, and novelty features can spike early before becoming negative after heavy use.',
  };

  yield {
    state: roiGraph('The action is route, price, or stop'),
    highlight: { active: ['payback', 'route', 'stop', 'ledger', 'e-payback-route', 'e-payback-stop', 'e-route-ledger', 'e-stop-ledger'], compare: ['risk'] },
    explanation: 'The ledger is not a dashboard trophy. It should trigger route changes, model downgrades, cache rules, pricing changes, cohort expansion, or a hard stop.',
  };
}

function* cohortTrace() {
  yield {
    state: traceGraph('Trace rows become finance rows'),
    highlight: { active: ['req', 'model', 'tool', 'cost', 'tag', 'event', 'e-req-model', 'e-req-tool', 'e-model-cost', 'e-tool-cost'], found: ['focus'] },
    explanation: 'A production system needs a join between runtime traces and billing rows. The trace knows model, tokens, tools, latency, cache hit, and route. Finance needs owner, product, cohort, and invoice alignment.',
  };

  yield {
    state: labelMatrix(
      'Join',
      [
        { id: 'span', label: 'span' },
        { id: 'tag', label: 'tag' },
        { id: 'cur', label: 'CUR' },
        { id: 'focus', label: 'FOCUS' },
        { id: 'cohort', label: 'cohort' },
      ],
      [
        { id: 'has', label: 'has' },
        { id: 'miss', label: 'miss' },
      ],
      [
        ['tokens', 'owner'],
        ['owner', 'late'],
        ['line item', 'product'],
        ['schema', 'event'],
        ['variant', 'invoice'],
      ],
    ),
    highlight: { active: ['span:has', 'tag:has', 'cur:has', 'focus:has', 'cohort:has'], compare: ['span:miss', 'cur:miss'] },
    explanation: 'Tracing, tags, cloud cost exports, FOCUS rows, and experiment cohorts each have part of the truth. The data structure is the join key design that keeps them aligned.',
  };

  yield {
    state: marginPlot(),
    highlight: { active: ['free', 'heavy'], compare: ['paid', 'ok'] },
    explanation: 'Usage-heavy free cohorts can invert margins even when engagement rises. Paid cohorts can absorb more inference if conversion, retention, or workflow value rises with usage.',
  };

  yield {
    state: traceGraph('Completeness gates prevent false ROI'),
    highlight: { active: ['focus', 'cohort', 'decide', 'e-focus-cohort', 'e-cohort-decide'], compare: ['tag', 'event'], found: ['cost'] },
    explanation: 'A payback report should wait for enough cost completeness, value-event maturity, cohort stability, and quality review. Fresh but incomplete billing data can make a feature look better or worse than it is.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'payback ledger') yield* paybackLedger();
  else if (view === 'cohort trace') yield* cohortTrace();
  else throw new InputError('Pick an inference ROI payback view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'An inference ROI payback cohort ledger is a product-finance data structure for AI features. It joins feature flags, cohorts, model routes, token-cost spans, cloud cost allocation, value events, quality scores, and incident risk. The output is not a blended average. It is a payback curve by cohort and workload.',
        'This module sits above LLM Unit Economics Ledger Case Study. Unit economics tells you what an accepted answer costs. The payback ledger asks whether the product outcome justified that cost for a specific cohort.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The ledger begins with Feature Flag Control Plane and AB Testing so cohorts are stable. GenAI Trace Token Cost Ledger Case Study records model, prompt, output tokens, cache hits, route choice, latency, tool calls, and fallback. Cost allocation rows then attach owner, product, environment, feature, and invoice period. Value rows record revenue lift, support deflection, time saved, retention, or task completion.',
        'The cohort ledger calculates cumulative cost and cumulative value over time. It also stores quality and safety gates, because an AI feature that saves money by generating bad answers is not profitable in a serious system.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'ROI attribution is hard because the cost appears immediately while value often appears later. A coding assistant might save time within minutes. A customer-support bot might need weeks of escalation and satisfaction data. An agentic workflow might require setup before it becomes efficient. The ledger should therefore preserve payback windows rather than forcing one number.',
        'Heavy users can invert margins if pricing and routing are not aligned. The ledger needs links to SLO-Aware LLM Request Router, On-Device LLM Inference Cost Crossover, Semantic Cache for LLMs, Prompt Cache-Key Canonicalization Ledger, and LLM Response Cache Safety Ledger so expensive cohorts can be routed or cached intentionally.',
      ],
    },
    {
      heading: 'Case studies and sources',
      paragraphs: [
        'AWS Cost and Usage Reports expose cost and usage line items by product, usage type, operation, and tag-defined dimensions: https://docs.aws.amazon.com/cur/latest/userguide/what-is-cur.html. AWS cost allocation tags show how activated tags organize resource costs for reporting: https://docs.aws.amazon.com/awsaccountbilling/latest/aboutv2/cost-alloc-tags.html.',
        'FOCUS defines a normalized cloud and technology billing schema, with recent versions adding commitment, invoice, recency, and completeness structure: https://focus.finops.org/focus-specification/. FinOps allocation guidance explains why tags, labels, account structures, derived metadata, and shared-cost methods matter for accountability: https://www.finops.org/framework/capabilities/allocation/.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'A product manager can compare whether AI-assisted drafting, support deflection, search summarization, or coding-agent execution is paying back by cohort. A platform team can identify the route, model, cache, or device/offload policy that preserves value while reducing cost. Finance can connect a cloud bill to products rather than treating AI spend as a shared mystery bucket.',
        'The ledger is also useful for contract decisions. If a reserved GPU pool is supported by a few high-payback cohorts, the capacity reservation has evidence. If usage is high but value is low, the product may need pricing, routing, prompt compression, or shutdown.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'Do not count engagement as ROI unless the product has a value model. Do not ignore quality rejects, retries, human review, or incidents. Do not declare payback before billing data is complete or before delayed value events mature.',
        'Do not allocate all shared AI infrastructure evenly by headcount or revenue. AI workloads are skewed: one feature, customer, or agent loop can consume a disproportionate amount of tokens and reserved capacity.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: AWS CUR at https://docs.aws.amazon.com/cur/latest/userguide/what-is-cur.html, AWS cost allocation tags at https://docs.aws.amazon.com/awsaccountbilling/latest/aboutv2/cost-alloc-tags.html, FOCUS at https://focus.finops.org/focus-specification/, FOCUS 1.3 release notes at https://www.finops.org/insights/introducing-focus-1-3/, and FinOps Allocation at https://www.finops.org/framework/capabilities/allocation/. Study LLM Unit Economics Ledger Case Study, GenAI Trace Token Cost Ledger Case Study, Feature Flag Control Plane, AB Testing, AI Capex Depreciation Utilization Ledger, GPU Cloud Capacity Reservation Orderbook Case Study, AI Circular Financing Demand Graph Case Study, Semantic Cache for LLMs, and SLO-Aware LLM Request Router next.',
      ],
    },
  ],
};
