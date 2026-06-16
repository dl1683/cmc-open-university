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
      heading: 'What it is',
      paragraphs: [
        'An AI capex depreciation utilization ledger is a data structure for turning accelerator purchases into per-answer economics. LLM Unit Economics Ledger Case Study starts at the serving layer: tokens, utilization, retries, and accepted answers. This case study moves one layer down to the asset layer: chip orders, power, leases, construction-in-progress, placed-in-service dates, depreciation, utilization, and refresh decisions.',
        'The core idea is simple: a GPU fleet has at least two clocks. The finance clock starts when assets enter service and depreciate. The product clock starts when workloads produce useful answers. Unit cost only improves when those clocks are synchronized by demand, scheduling, reuse, and route policy.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The ledger stores an asset row for each deployable pool: accelerator generation, memory size, network fabric, zone, power envelope, service start, expected useful life, lease or purchase terms, and allocation owner. It then joins runtime rows from Distributed Tracing, GenAI Trace Token Cost Ledger Case Study, SLO-Aware LLM Request Router, KV Cache Concurrency Capacity Model, and LLM Serving Admission-Control Goodput Gate.',
        'The useful calculation is not only dollars per GPU hour. The ledger rolls asset cost into dollars per accepted answer by workload slice. Interactive chat, batch summarization, coding agents, RAG, and training/fine-tuning all consume the same fleet differently. The ledger has to preserve those slices instead of hiding them behind one utilization average.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Low utilization loads fixed asset cost onto fewer answers. High utilization can also be bad if it creates queueing, p99 latency, failed requests, or quality regressions. That is why this module links to Tail Latency & p99 Thinking, LLM Continuous Batching, Length-Aware Batching for LLM Serving, Prefix Caching & RadixAttention, and LLM Inference Cost Stack Case Study.',
        'Refresh timing is a second-order problem. If a newer accelerator reduces cost per token but the old fleet still has remaining book value, migration is not automatically wise. A credible decision compares remaining depreciation, power efficiency, networking compatibility, model support, route changes, and how much demand can actually fill the newer pool.',
      ],
    },
    {
      heading: 'Case studies and sources',
      paragraphs: [
        'NVIDIA fiscal 2026 reporting shows how dominant data-center demand has become in the AI hardware cycle: https://nvidianews.nvidia.com/news/nvidia-announces-financial-results-for-fourth-quarter-and-fiscal-2026. NVIDIA 10-K accounting language describes property and equipment depreciation and segment depreciation disclosure: https://www.sec.gov/Archives/edgar/data/1045810/000104581026000021/nvda-20260125.htm.',
        'CoreWeave disclosures are a useful AI-cloud case study because they discuss capital expenditures, systems moving from construction-in-progress to equipment, and the economics of committed cloud capacity: https://www.sec.gov/Archives/edgar/data/1769628/000119312525044231/d899798ds1.htm and https://s205.q4cdn.com/133937190/files/doc_financials/2025/q4/CoreWeave-Inc-FY25-10-K-7.pdf.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'A platform team can use this ledger to decide when to admit, shed, route, batch, cache, move to a different accelerator tier, or buy more capacity. A finance team can use it to allocate depreciation and committed capacity to products. A product team can use it to see when an AI feature is growing real demand versus consuming cheap pilot credits.',
        'The same pattern applies beyond GPUs. TPU pods, inference appliances, private clusters, and on-device model rollout all need a clock for fixed investment and a clock for useful work. On-Device LLM Inference Cost Crossover is the edge version of the same idea.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'Do not treat utilization as the only truth. A fleet can be busy with low-value retries, low-quality generations, or workloads that break latency promises. Do not treat depreciation as only an accounting artifact. It is a real pressure on product routing when a large fixed asset pool must earn back its place in the architecture.',
        'Do not compare old and new hardware with raw FLOPs alone. The economic comparison has to include memory capacity, interconnect, software support, kernel maturity, power, scheduler fit, model compatibility, and actual workload mix.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: NVIDIA FY2026 results at https://nvidianews.nvidia.com/news/nvidia-announces-financial-results-for-fourth-quarter-and-fiscal-2026, NVIDIA FY2026 10-K at https://www.sec.gov/Archives/edgar/data/1045810/000104581026000021/nvda-20260125.htm, CoreWeave S-1 at https://www.sec.gov/Archives/edgar/data/1769628/000119312525044231/d899798ds1.htm, CoreWeave FY25 10-K at https://s205.q4cdn.com/133937190/files/doc_financials/2025/q4/CoreWeave-Inc-FY25-10-K-7.pdf, and FOCUS at https://focus.finops.org/focus-specification/. Study LLM Unit Economics Ledger Case Study, LLM Inference Cost Stack Case Study, GPU Cloud Capacity Reservation Orderbook Case Study, AI Circular Financing Demand Graph Case Study, Inference ROI Payback Cohort Ledger Case Study, SLO-Aware LLM Request Router, GenAI Trace Token Cost Ledger Case Study, KV Cache Concurrency Capacity Model, LLM Serving Autoscaling Warm Pool, and Tail Latency & p99 Thinking next.',
      ],
    },
  ],
};
