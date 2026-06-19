// AI capex depreciation utilization ledger: connect accelerator purchases,
// placed-in-service clocks, utilization, and per-answer economics.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'ai-capex-depreciation-utilization-ledger-case-study',
  title: 'AI Capex Depreciation Utilization Ledger',
  category: 'Systems',
  summary: 'A finance-control case study for AI infrastructure: GPU capex, construction-in-progress, depreciation clocks, utilization, refresh risk, and cost per accepted answer.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['asset ledger', 'utilization flywheel'], defaultValue: 'asset ledger' },
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

function assetGraph(title) {
  return graphState({
    nodes: [
      { id: 'forecast', label: 'fcst', x: 0.7, y: 3.5, note: 'demand' },
      { id: 'order', label: 'order', x: 2.0, y: 2.0, note: 'GPU' },
      { id: 'power', label: 'power', x: 2.0, y: 5.0, note: 'MW' },
      { id: 'cip', label: 'CIP', x: 3.6, y: 3.5, note: 'build' },
      { id: 'service', label: 'svc', x: 5.1, y: 3.5, note: 'live' },
      { id: 'depr', label: 'depr', x: 6.5, y: 2.0, note: 'clock' },
      { id: 'util', label: 'use', x: 6.5, y: 5.0, note: 'hours' },
      { id: 'unit', label: 'unit', x: 8.1, y: 3.5, note: '$/ans' },
      { id: 'refresh', label: 'refresh', x: 9.4, y: 3.5, note: 'next' },
    ],
    edges: [
      { id: 'e-forecast-order', from: 'forecast', to: 'order' },
      { id: 'e-forecast-power', from: 'forecast', to: 'power' },
      { id: 'e-order-cip', from: 'order', to: 'cip' },
      { id: 'e-power-cip', from: 'power', to: 'cip' },
      { id: 'e-cip-service', from: 'cip', to: 'service' },
      { id: 'e-service-depr', from: 'service', to: 'depr' },
      { id: 'e-service-util', from: 'service', to: 'util' },
      { id: 'e-depr-unit', from: 'depr', to: 'unit' },
      { id: 'e-util-unit', from: 'util', to: 'unit' },
      { id: 'e-unit-refresh', from: 'unit', to: 'refresh' },
    ],
  }, { title });
}

function flywheelGraph(title) {
  return graphState({
    nodes: [
      { id: 'apps', label: 'apps', x: 0.7, y: 3.4, note: 'usage' },
      { id: 'tokens', label: 'tokens', x: 2.1, y: 3.4, note: 'work' },
      { id: 'sched', label: 'sched', x: 3.5, y: 2.0, note: 'pack' },
      { id: 'reuse', label: 'reuse', x: 3.5, y: 5.0, note: 'cache' },
      { id: 'util', label: 'use', x: 5.0, y: 3.4, note: 'busy' },
      { id: 'cost', label: 'cost', x: 6.5, y: 3.4, note: 'lower' },
      { id: 'price', label: 'price', x: 8.0, y: 2.0, note: 'adopt' },
      { id: 'risk', label: 'risk', x: 8.0, y: 5.0, note: 'stress' },
      { id: 'capex', label: 'capex', x: 9.4, y: 3.4, note: 'more' },
    ],
    edges: [
      { id: 'e-apps-tokens', from: 'apps', to: 'tokens' },
      { id: 'e-tokens-sched', from: 'tokens', to: 'sched' },
      { id: 'e-tokens-reuse', from: 'tokens', to: 'reuse' },
      { id: 'e-sched-util', from: 'sched', to: 'util' },
      { id: 'e-reuse-util', from: 'reuse', to: 'util' },
      { id: 'e-util-cost', from: 'util', to: 'cost' },
      { id: 'e-cost-price', from: 'cost', to: 'price' },
      { id: 'e-cost-risk', from: 'cost', to: 'risk' },
      { id: 'e-price-capex', from: 'price', to: 'capex' },
      { id: 'e-risk-capex', from: 'risk', to: 'capex' },
    ],
  }, { title });
}

function utilPlot() {
  return plotState({
    axes: {
      x: { label: 'reserved GPU hours used', min: 0, max: 100 },
      y: { label: 'relative cost per answer', min: 0, max: 12 },
    },
    series: [
      { id: 'depr', label: 'depr load', points: [
        { x: 10, y: 10.8 }, { x: 20, y: 6.0 }, { x: 40, y: 3.6 }, { x: 70, y: 2.6 }, { x: 95, y: 2.3 },
      ] },
      { id: 'ops', label: 'ops load', points: [
        { x: 10, y: 8.0 }, { x: 20, y: 4.8 }, { x: 40, y: 3.0 }, { x: 70, y: 2.2 }, { x: 95, y: 2.0 },
      ] },
    ],
    markers: [
      { id: 'idle', x: 15, y: 8.5, label: 'idle tax' },
      { id: 'steady', x: 70, y: 2.6, label: 'steady' },
    ],
  });
}

function refreshPlot() {
  return plotState({
    axes: {
      x: { label: 'quarters after service start', min: 0, max: 12 },
      y: { label: 'economic pressure', min: 0, max: 10 },
    },
    series: [
      { id: 'book', label: 'book load', points: [
        { x: 0, y: 9.0 }, { x: 2, y: 7.6 }, { x: 4, y: 6.2 }, { x: 8, y: 3.5 }, { x: 12, y: 1.8 },
      ] },
      { id: 'perf', label: 'perf gap', points: [
        { x: 0, y: 1.0 }, { x: 2, y: 1.8 }, { x: 4, y: 3.2 }, { x: 8, y: 6.6 }, { x: 12, y: 8.8 },
      ] },
    ],
    markers: [
      { id: 'swap', x: 7, y: 5.6, label: 'swap?' },
    ],
  });
}

function* assetLedger() {
  yield {
    state: assetGraph('Capex becomes a per-answer ledger'),
    highlight: { active: ['forecast', 'order', 'power', 'cip', 'service', 'e-forecast-order', 'e-forecast-power', 'e-order-cip', 'e-power-cip'], found: ['unit'] },
    explanation: 'AI infrastructure economics begin before the first token. Demand forecasts become accelerator orders, power commitments, data-center build work, and construction-in-progress before the asset enters service.',
    invariant: 'A GPU is cheap only after the service clock and the utilization clock agree.',
  };

  yield {
    state: labelMatrix(
      'Capex',
      [
        { id: 'gpu', label: 'GPU' },
        { id: 'net', label: 'net' },
        { id: 'power', label: 'MW' },
        { id: 'lease', label: 'lease' },
        { id: 'svc', label: 'svc' },
        { id: 'depr', label: 'depr' },
      ],
      [
        { id: 'book', label: 'book' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['cost', 'obsolete'],
        ['switch', 'bneck'],
        ['reserve', 'delay'],
        ['term', 'lock'],
        ['start', 'late'],
        ['clock', 'idle'],
      ],
    ),
    highlight: { active: ['gpu:book', 'power:book', 'svc:book', 'depr:book'], compare: ['gpu:risk', 'power:risk'] },
    explanation: 'The asset ledger separates the book event from the operating event. A chip order, a power reservation, a lease term, a service start, and a depreciation clock are different rows with different failure modes.',
  };

  yield {
    state: utilPlot(),
    highlight: { active: ['depr', 'idle'], compare: ['ops'], found: ['steady'] },
    explanation: 'Depreciation makes idle capacity expensive. The same fleet can look profitable or underwater depending on how many reserved GPU hours become accepted, billable, policy-compliant answers.',
  };

  yield {
    state: assetGraph('Useful life competes with product life'),
    highlight: { active: ['service', 'depr', 'util', 'unit', 'refresh', 'e-service-depr', 'e-service-util', 'e-depr-unit', 'e-util-unit', 'e-unit-refresh'], compare: ['cip'] },
    explanation: 'The hard part is not only buying capacity. It is keeping a fast-moving model stack, serving scheduler, memory fabric, and route policy aligned while the asset is depreciating.',
  };
}

function* utilizationFlywheel() {
  yield {
    state: flywheelGraph('Utilization is a product flywheel'),
    highlight: { active: ['apps', 'tokens', 'sched', 'reuse', 'util', 'cost', 'e-apps-tokens', 'e-tokens-sched', 'e-tokens-reuse', 'e-sched-util', 'e-reuse-util'], found: ['capex'] },
    explanation: 'High utilization is not a finance spreadsheet trick. It comes from product demand, token routing, batching, prefix reuse, queue control, and enough useful workloads to keep the fleet busy.',
  };

  yield {
    state: labelMatrix(
      'Use',
      [
        { id: 'chat', label: 'chat' },
        { id: 'rag', label: 'RAG' },
        { id: 'agent', label: 'agent' },
        { id: 'train', label: 'train' },
        { id: 'batch', label: 'batch' },
      ],
      [
        { id: 'load', label: 'load' },
        { id: 'knob', label: 'knob' },
      ],
      [
        ['spiky', 'SLO'],
        ['bursty', 'cache'],
        ['long', 'state'],
        ['blocks', 'quota'],
        ['smooth', 'fill'],
      ],
    ),
    highlight: { active: ['chat:knob', 'rag:knob', 'agent:knob', 'batch:knob'], compare: ['train:load'] },
    explanation: 'Different workloads fill capacity differently. Interactive chat needs p99 guardrails, RAG needs cache and prefill control, agents need state budgets, training needs quota windows, and batch jobs can absorb slack.',
  };

  yield {
    state: refreshPlot(),
    highlight: { active: ['book', 'perf', 'swap'] },
    explanation: 'Book value falls while the performance gap to newer hardware can rise. A refresh decision should compare remaining depreciation, migration cost, power efficiency, network compatibility, and workload demand.',
  };

  yield {
    state: labelMatrix(
      'Controls',
      [
        { id: 'admit', label: 'admit' },
        { id: 'route', label: 'route' },
        { id: 'cache', label: 'cache' },
        { id: 'trace', label: 'trace' },
        { id: 'fin', label: 'fin' },
      ],
      [
        { id: 'metric', label: 'metric' },
        { id: 'action', label: 'action' },
      ],
      [
        ['deadline', 'shed'],
        ['$/SLO', 'move'],
        ['hit', 'reuse'],
        ['cost span', 'join'],
        ['asset row', 'price'],
      ],
    ),
    highlight: { active: ['admit:action', 'route:action', 'cache:action', 'trace:metric', 'fin:metric'], found: ['fin:action'] },
    explanation: 'The ledger is useful only when it can change behavior. Admission control, SLO-aware routing, cache policy, trace cost rows, and finance allocation must join into one operational view.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'asset ledger') yield* assetLedger();
  else if (view === 'utilization flywheel') yield* utilizationFlywheel();
  else throw new InputError('Pick an AI capex ledger view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        "Read the animation as the execution trace for AI Capex Depreciation Utilization Ledger. A finance-control case study for AI infrastructure: GPU capex, construction-in-progress, depreciation clocks, utilization, refresh risk, and cost per accepted answer..",
        "Active items are the current decision point. Visited markers are state that is already ruled out by proof, not by taste.",
        "Found markers are outcomes now guaranteed true. If this is not visible, the animation can mislead.",
        "At each frame, ask what changed, why that move is legal, and where the idea is strong or fragile.",
      ],
    },
    {
      heading: 'Why this ledger exists',
      paragraphs: [
        'AI infrastructure spending is not just a purchase order for GPUs. It is a chain of commitments: accelerator supply, network fabric, power, leases, construction-in-progress, placed-in-service dates, depreciation schedules, workload routing, and eventual refresh. A ledger exists because those commitments land in different systems and on different clocks.',
        'The question the ledger answers is blunt: how much fixed investment is attached to each accepted answer? Token cost alone does not answer it. A model can be efficient per token while the fleet is still economically heavy because too many reserved GPU hours sit idle, arrive late, or serve low-value work.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The obvious approach is to keep a finance spreadsheet with total GPU spend, divide by months of useful life, and then divide again by a rough utilization percentage. That is good enough for a board slide. It is not good enough to operate an AI platform.',
        'The wall appears when averages hide the real denominator. Interactive chat, RAG, coding agents, batch jobs, fine-tuning, and internal evaluation traffic use the same fleet in very different ways. Some work produces accepted answers. Some work retries, times out, violates policy, or occupies capacity without revenue. A single utilization number cannot say which product, route, or workload is carrying the depreciation burden.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'A GPU fleet has a finance clock and a useful-work clock. The finance clock starts when the asset is placed in service and depreciation begins. The useful-work clock advances only when workloads turn reserved capacity into accepted, billable, policy-compliant answers.',
        'The core insight is that unit economics improve only when those clocks are joined. Buying more capacity does not lower cost by itself. Cost falls when product demand, admission control, batching, prefix reuse, cache policy, and routing keep the depreciating assets doing valuable work.',
      ],
    },
    {
      heading: 'Reading the two views',
      paragraphs: [
        'In the asset ledger view, follow the path from forecast to order, power, construction-in-progress, service start, depreciation, utilization, unit cost, and refresh. The point is not that every company uses these exact row names. The point is that each row has its own failure mode: late power, stranded network capacity, idle depreciation, incompatible hardware, or a refresh that arrives before the old pool has earned its keep.',
        'In the utilization flywheel view, follow work rather than assets. Product usage creates tokens. Schedulers and cache reuse turn those tokens into high GPU occupancy. Higher useful occupancy lowers per-answer cost, which can support pricing, adoption, or more capex. The flywheel only works if the work is valuable and the SLOs still hold.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Start with an asset row for each deployable pool: accelerator generation, memory size, network fabric, zone, power envelope, lease or purchase terms, construction status, service start, expected useful life, depreciation method, allocation owner, and refresh assumptions. Do not collapse all GPUs into one bucket if they have different memory, power, networking, or model support.',
        'Then join runtime rows to those asset rows. The runtime side records request class, model, route, batch, cache hit, prefill and decode time, retries, policy outcome, accepted answer count, and SLO result. The useful metric is not dollars per GPU hour in isolation. It is fixed asset charge plus operating cost per accepted answer, preserved by workload slice.',
        'This is why the ledger connects naturally to distributed tracing, token cost ledgers, SLO-aware routers, cache capacity models, and admission-control gates. The finance row says what the fleet costs. The trace row says what the fleet did. The join says whether that work justified the asset.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The ledger works because it keeps the denominator honest. A request that retries three times, misses cache, times out, or fails policy is not equivalent to an accepted answer. A fleet that is 90 percent busy with low-priority batch fill is not equivalent to a fleet that meets interactive p99 and product demand.',
        'It also works because it separates decisions that are often blurred together. Buying capacity, placing it in service, depreciating it, routing traffic to it, and refreshing it are different decisions. Keeping them as separate rows lets a team ask a better question: which control should change before we buy again?',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Suppose a company places a $30 million inference pool into service and depreciates it straight-line over 36 months. The monthly asset charge is about $833,000 before power, staffing, networking, and software overhead. If the pool produces 20 million accepted answers in a month, depreciation alone is about 4.2 cents per accepted answer. At 80 million accepted answers, it is about 1.0 cent.',
        'That simple example shows why utilization cannot be decorative. A routing improvement that raises accepted answers without breaking latency can matter more than a small kernel optimization. A cache policy that reduces duplicate prefill can change the denominator. A product launch that fills idle off-peak capacity can turn stranded capex into useful capacity.',
        'The example also shows the refresh problem. If a newer accelerator cuts energy and token time in half, migration may still be wrong if the old pool has large remaining book value, the new pool cannot run the required model yet, or the workload mix cannot fill both pools.',
      ],
    },
    {
      heading: 'Cost and behavior',
      paragraphs: [
        'The ledger adds bookkeeping pressure. It needs stable asset identifiers, trace joins, allocation rules, cache and route metadata, and agreement between finance and platform teams. If the join keys are weak, the output becomes a false precision machine.',
        'High utilization is not automatically good. Pushing the fleet too hard can create queueing, p99 spikes, failed requests, poor answer quality, and burned-out batch backlogs. Low utilization is not automatically bad either if it buys launch readiness, resilience, or regulatory isolation. The ledger should make that tradeoff visible instead of pretending one metric decides everything.',
        'Refresh timing is the hardest tradeoff. A credible comparison includes remaining depreciation, power efficiency, network compatibility, model support, scheduler fit, kernel maturity, migration cost, and actual demand. Raw FLOPs are only one row.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'It wins when a company has enough AI traffic that small routing and utilization changes move real money: shared inference fleets, reserved GPU clouds, private clusters, batch plus interactive mixes, and products with multiple model tiers. It helps platform teams decide when to admit, shed, route, batch, cache, move work, or buy more capacity.',
        'It fails when the organization wants one tidy number for political reasons. It also fails when request traces do not carry product, model, route, cache, and outcome metadata, or when finance data is too coarse to map assets to deployable pools. In those cases the ledger can still teach the shape of the problem, but it should not be used as a pricing oracle.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Public filings and cloud-provider disclosures are useful primary material for this topic because they show how capital expenditures, construction-in-progress, depreciation, leases, committed capacity, and data-center demand appear in real reporting. Useful starting points include NVIDIA results and 10-K disclosures, CoreWeave S-1 and annual disclosures, and the FOCUS FinOps specification: https://nvidianews.nvidia.com/news/nvidia-announces-financial-results-for-fourth-quarter-and-fiscal-2026, https://www.sec.gov/Archives/edgar/data/1045810/000104581026000021/nvda-20260125.htm, https://www.sec.gov/Archives/edgar/data/1769628/000119312525044231/d899798ds1.htm, https://s205.q4cdn.com/133937190/files/doc_financials/2025/q4/CoreWeave-Inc-FY25-10-K-7.pdf, and https://focus.finops.org/focus-specification/.',
        'Study LLM Unit Economics Ledger Case Study, LLM Inference Cost Stack Case Study, GPU Cloud Capacity Reservation Orderbook Case Study, AI Circular Financing Demand Graph Case Study, Inference ROI Payback Cohort Ledger Case Study, SLO-Aware LLM Request Router, GenAI Trace Token Cost Ledger Case Study, KV Cache Concurrency Capacity Model, LLM Serving Autoscaling Warm Pool, and Tail Latency & p99 Thinking next.',
      ],
    },
      {
      heading: 'Why this exists',
      paragraphs: [
        "State the real constraint this topic fixes before introducing the mechanism.",
        "A good opening says what gets too slow, too fragile, or too hard to reason about under baseline behavior.",
        "Without that, every optimization appears decorative.",
      ],
    },

    {
      heading: 'The obvious approach',
      paragraphs: [
        "Name the reasonable first attempt and why teams reach for it.",
        "Then show the exact place that approach stops scaling or starts breaking.",
        "Treat this section as contrast, not a rejection.",
      ],
    },

    {
      heading: 'Where it fails',
      paragraphs: [
        "List the failure modes and the conditions that trigger them.",
        "Most methods have at least one silent failure mode; expose the silent ones.",
        "A method without explicit failure conditions is an invitation for misuse.",
      ],
    },


      {
        heading: 'Sources and study next',
        paragraphs: [
          'Read one primary source, one implementation source, and one production case where this idea appears.',
          'If they disagree on a detail, prefer the source with the clearest constraint and define the simplification for this animation.',
          'Then choose three study topics: one prerequisite, one extension, and one case study for your next session.',
        ],
      },

      {
        heading: 'Learning map',
        paragraphs: [
          'Before this topic, unlock all prerequisites and define the required preconditions.',
          'After this topic, trace where this idea appears in one larger path on this site.',
          'Use unlock relationships to keep one path and one checkpoint per review cycle.',
        ],
      },

      {
        heading: 'Micro checks',
        paragraphs: [
          {
            type: 'bullets',
            items: [
              'Can you state one invariant in one sentence?',
              'Can you prove one transition with pre and post state?',
              'Can you name one hidden edge case in one line?',
              'Can you transfer this mechanism to a neighboring domain?',
            ],
          },
        ],
      },

      {
        heading: 'Try this now',
        paragraphs: [
          'Build one input manually and predict every step before running the animation.',
          'If your predicted final state matches the animation for ai-capex-depreciation-utilization-ledger-case-study, continue to the next topic in the same track.'
  ],
      },
],
};
