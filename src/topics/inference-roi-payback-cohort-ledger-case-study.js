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
      heading: 'How to read the animation',
      paragraphs: [
        'Read the payback-ledger view as a join graph. A feature flag assigns users to a cohort, which means a stable measurement group. Runtime traces create cost rows, product events create value rows, quality checks create risk rows, and the payback node combines only rows that share the same cohort boundary.',
        'In the cohort-trace view, a request span is one observed unit of work, such as a model call or tool call. Active nodes show evidence being created or joined. Found nodes show the row set that is now decision-ready. The margin plot shows why the same feature can be profitable for paid users and negative for heavy free users.',
        {type:'callout', text:'AI payback is credible only when cost, value, quality, and risk rows share the same cohort boundary.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Inference is model execution after a user request arrives. It can spend input tokens, output tokens, GPU time, cache capacity, retrieval, tools, and human review. A product team needs to know whether that spending creates value for the users who caused it.',
        'ROI means return on investment, but here it must be measured at feature and cohort level. A cohort is a stable group, such as paid accounts exposed to a support copilot for 30 days. Payback is cumulative value minus cumulative cost over time, after quality and risk gates are counted.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is a dashboard with total AI spend, total requests, average cost per request, and engagement. It is easy to build from billing exports and trace counts. It also feels objective because every number is real.',
        'The problem is that aggregate numbers mix different businesses. A paid enterprise cohort can save expensive support labor while a free cohort burns margin on curiosity usage. The total can look healthy while one cohort is paying for another or while a risky feature is hiding behind average value.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is attribution over time. Cost arrives immediately when the model runs. Value may arrive days later as a renewal, a resolved ticket, a retained user, or a shorter workflow. Risk may arrive as a bad answer, escalation, refund, or policy incident.',
        'If cost rows are per request, value rows are per account, and risk rows are per incident with no shared join key, the ledger cannot answer the payback question. It can only tell a story after the fact. The missing data structure is the cohort ledger that keeps all evidence aligned.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Make the cohort the primary key of the decision. Every cost row, value row, quality row, and risk row must attach to the same exposure definition and time window. Route changes, pricing, expansion, and shutdown decisions should read from that shared ledger.',
        'The invariant is boundary consistency. A feature cannot be called profitable for cohort A if the cost came from cohort A, the value came from all users, and the incidents came from only escalated tickets. Same boundary first, arithmetic second.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The system starts before launch by assigning users to a feature flag or experiment cohort. Each AI request records model, route, prompt tokens, completion tokens, cache hit, tool use, latency, fallback, owner, product, and feature id. Billing exports and cloud cost allocation rows connect those traces to invoice cost.',
        'Value events are recorded separately. They may include ticket deflection, minutes saved, conversion lift, renewal lift, revenue, or task completion. Quality rows record rejects, retries, human review, incident severity, and customer harm. The ledger rolls these rows up by cohort and day, then computes payback only after data completeness gates pass.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The correctness argument is accounting discipline. If every exposure has a stable cohort id, every request trace carries that id, every cost row can be allocated to that trace or owner, and every value event uses the same cohort window, then the payback curve is a faithful summary of that cohort.',
        'The ledger must also prevent double counting. One support ticket cannot be counted as both a full labor saving and a full revenue lift unless the business rule explicitly allows both. A request that retries four times must carry all four costs, because the user-facing result consumed all four attempts.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The ledger adds instrumentation, storage, delayed decisions, and review work. It may be too heavy for a prototype that spends $50 per month. It becomes necessary when a feature spends $50,000 per month, changes gross margin, or determines GPU capacity planning.',
        'Cost behaves by cohort shape. If token price is $0.004 per 1,000 tokens and a request uses 2,000 input tokens plus 500 output tokens at the same blended rate, the model call costs about $0.010 before tools and infrastructure. At 1,000,000 monthly calls, that small unit cost becomes $10,000 before retries, review, or reserved capacity waste.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'This pattern fits support copilots, coding agents, document review, sales assistants, search summarization, data-analysis assistants, and any feature where inference cost is large enough to affect product decisions. It is strongest when the feature can define a measurable value event before launch.',
        'It also helps platform teams choose routes. A high-payback enterprise cohort may deserve a stronger model, lower latency, and reserved capacity. A free-heavy cohort may need a smaller model, cache rules, usage caps, batching, or pricing changes.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'The ledger fails when value is undefined. Engagement is not ROI unless the business has proved how engagement becomes margin, retention, or revenue. A feature can be popular and still lose money.',
        'It also fails when measurement windows are too short, quality gates are ignored, or cohort averages hide damage. A launch-week novelty spike can look profitable before usage settles. A safe-looking average can hide one customer segment with most incidents or one heavy segment with negative margin.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'A support copilot launches to 5,000 paid accounts for 30 days. The cohort makes 200,000 AI requests. The average request uses $0.012 of model cost, $0.003 of retrieval and tool cost, and $0.005 of allocated platform cost, so total cost is 200,000 * $0.020 = $4,000.',
        'The same cohort resolves 8,000 tickets with 6 minutes less agent time per ticket. At $40 per support hour, that is 800 saved hours and $32,000 of labor value. Human review adds $3,000 and quality incidents cost an estimated $2,000. Net value is $32,000 - $4,000 - $3,000 - $2,000 = $23,000, so payback is positive. If the free cohort has the same $0.020 request cost but no labor value, the route must change or usage must be capped.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: AWS Cost and Usage Reports at https://docs.aws.amazon.com/cur/latest/userguide/what-is-cur.html, AWS cost allocation tags at https://docs.aws.amazon.com/awsaccountbilling/latest/aboutv2/cost-alloc-tags.html, FOCUS specification at https://focus.finops.org/focus-specification/, and FinOps allocation guidance at https://www.finops.org/framework/capabilities/allocation/.',
        'Study LLM unit economics, distributed tracing, feature flags, A/B testing, cloud cost allocation, semantic caching, request routing, and AI capacity reservation next. The key follow-up is learning how trace ids, cohort ids, and invoice rows survive real production joins.',
      ],
    },
  ],
};