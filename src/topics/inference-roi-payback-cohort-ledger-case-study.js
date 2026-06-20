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
      heading: 'Why it exists',
      paragraphs: [
        'AI features make product cost visible at request time. A search summary, coding agent, support copilot, or autonomous workflow can spend tokens, tool calls, retrieval, GPU time, and human review on every use. The team needs to know whether that spend creates enough value for the cohort that caused it.',
        'An inference ROI payback cohort ledger joins feature flags, stable cohorts, runtime traces, token-cost spans, cloud cost allocation, value events, quality scores, and incident risk. LLM Unit Economics Ledger Case Study tells you what one accepted answer costs. This ledger asks whether the feature paid back for a specific user group over a specific time horizon.',
        {type:'callout', text:'AI payback is credible only when cost, value, quality, and risk rows share the same cohort boundary.'},
      ],
    },
    {
      heading: 'Naive baseline and wall',
      paragraphs: [
        'The naive baseline is a dashboard with total AI spend, total requests, and an engagement chart. That is not enough. A free-heavy cohort can burn margin while a paid cohort produces strong retention. A novelty feature can spike usage before value decays. A support bot can look cheap until retries, escalations, bad answers, and human review are counted.',
        'The wall is attribution. Cost arrives immediately, value arrives later, and quality risk can erase apparent savings. If the system cannot join runtime traces to owners, cohorts, invoice rows, and product outcomes, it cannot tell the difference between a profitable AI feature and an expensive animation of product activity.',
      ],
    },
    {
      heading: 'Core insight',
      paragraphs: [
        'Measure payback on cohorts, not anecdotes. A cohort is the unit that lets product, platform, and finance ask a fair question: for users exposed to this route or feature, what cost accumulated, what value matured, and what quality risk appeared?',
        'The invariant is that every payback decision must reference the same cohort definition across cost, value, and risk. If the cost row is per request, the value row is per account, and the quality row is per incident with no join key, the conclusion is a story, not a ledger.',
      ],
    },
    {
      heading: 'How the visual model teaches it',
      paragraphs: [
        'In the payback-ledger view, follow the feature flag into a cohort, then split into runtime cost and value evidence. The payback node is not just a number. It combines token cost, allocated infrastructure, revenue lift, time saved, support deflection, quality score, and incident risk before choosing route, price, expansion, or stop.',
        'In the cohort-trace view, read each request span as raw evidence waiting to become a finance row. Model choice, tool work, cache hit, latency, owner tags, cloud cost exports, FOCUS schema rows, and product events must land on the same cohort before the decision node can be trusted.',
      ],
    },
    {
      heading: 'Mechanism',
      paragraphs: [
        'The ledger starts with Feature Flag Control Plane and AB Testing so exposure is stable. GenAI Trace Token Cost Ledger Case Study records prompt tokens, output tokens, model route, cache hit, latency, tools, fallback, and errors. Cost allocation rows attach owner, product, environment, feature, commitment, and invoice period.',
        'Value rows are separate from cost rows. They may record revenue lift, conversion, retention, support deflection, task completion, labor minutes saved, or cycle-time reduction. Quality rows record rejects, retries, human review, hallucination incidents, policy violations, and customer harm. The payback curve is cumulative value minus cumulative cost after quality gates.',
      ],
    },
    {
      heading: 'Correctness',
      paragraphs: [
        'Correctness starts with cohort immutability. If users move between variants during the measurement window, the ledger must record exposure changes rather than quietly blending them. Cost windows must align with billing completeness, and value windows must wait long enough for delayed outcomes to mature.',
        'The ledger should also prevent double counting. A support deflection should not be counted once as labor savings and again as revenue unless the business model supports both. A request that retries three times should carry all three costs. A feature that increases usage but lowers gross margin should be visible as a margin problem, not celebrated as engagement.',
      ],
    },
    {
      heading: 'Cost and tradeoffs',
      paragraphs: [
        'The ledger adds instrumentation, joins, and waiting time. That overhead is justified when AI spend is material or when route decisions affect customer experience. It may be too heavy for a small prototype, but it becomes necessary once model choice, caching, pricing, and reserved capacity depend on measured value.',
        'The main tradeoff is speed versus confidence. Early dashboards help spot runaway spend, but route, pricing, and shutdown decisions need completeness gates. Expensive cohorts can be handled through SLO-Aware LLM Request Router, On-Device LLM Inference Cost Crossover, Semantic Cache for LLMs, Prompt Cache-Key Canonicalization Ledger, and LLM Response Cache Safety Ledger.',
      ],
    },
    {
      heading: 'Operational checklist',
      paragraphs: [
        'Define value events before launch. If a feature claims to save support time, the ledger must know which ticket fields prove that saving. If it claims revenue lift, the attribution window and margin treatment must be explicit. Otherwise the ledger becomes a post-hoc story generator.',
        'Keep cost and quality gates separate. A cohort can be profitable and still unsafe, or safe and still uneconomic. The ledger should expose token spend, fallback cost, human review, incident rate, customer harm, and value events as separate rows before combining them into a route decision.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Suppose a support copilot is enabled for ten percent of paid accounts. Week one shows higher usage and higher token spend. The ledger waits for cost completeness, then joins traces to resolved tickets, escalation rate, customer satisfaction, and agent handling time. If the cohort spends $4,000 and saves $11,000 of support time with no quality regression, expansion is defensible.',
        'Now suppose the free tier uses the same feature heavily. The margin plot can show that high-percentile free users cross below zero gross margin. The action is not necessarily to kill the feature. The system might route them to a smaller model, use retrieval summaries, add cache rules, cap usage, or move the feature behind pricing.',
      ],
    },
    {
      heading: 'Limits and failure modes',
      paragraphs: [
        'This pattern wins for AI-assisted drafting, support deflection, search summarization, coding agents, document review, data analysis copilots, and any feature where inference cost is large enough to shape product strategy. It also helps justify GPU reservations when high-payback cohorts can consume the reserved pool.',
        'It fails when the organization has no value event, no stable exposure, or no owner tags. It can also mislead when the value window is too short, the metric rewards engagement instead of outcomes, or the team ignores quality and incident risk.',
        'It also fails when teams use averages to hide cohort damage. A profitable enterprise segment can subsidize a free-tier loss, or a small high-risk group can carry most incidents. The ledger should support cohort slices before making a global decision.',
        'The same warning applies to time. A feature can look profitable during launch week and fail after novelty decays, or look expensive before delayed retention and renewal value mature.',
      ],
    },
    {
      heading: 'Pitfalls',
      paragraphs: [
        'Do not count engagement as ROI unless the product has a value model. Do not ignore quality rejects, retries, human review, or incidents. Do not declare payback before billing data is complete or before delayed value events mature.',
        'Do not allocate all shared AI infrastructure evenly by headcount or revenue. AI workloads are skewed: one feature, customer, or agent loop can consume a disproportionate amount of tokens and reserved capacity.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: AWS CUR at https://docs.aws.amazon.com/cur/latest/userguide/what-is-cur.html, AWS cost allocation tags at https://docs.aws.amazon.com/awsaccountbilling/latest/aboutv2/cost-alloc-tags.html, FOCUS at https://focus.finops.org/focus-specification/, FOCUS 1.3 release notes at https://www.finops.org/insights/introducing-focus-1-3/, and FinOps Allocation at https://www.finops.org/framework/capabilities/allocation/.',
        'Study LLM Unit Economics Ledger Case Study, GenAI Trace Token Cost Ledger Case Study, Feature Flag Control Plane, AB Testing, AI Capex Depreciation Utilization Ledger, GPU Cloud Capacity Reservation Orderbook Case Study, AI Circular Financing Demand Graph Case Study, Semantic Cache for LLMs, and SLO-Aware LLM Request Router next.',
      ],
    },
  ],
};
