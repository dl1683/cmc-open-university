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
        'Read the asset-ledger view as two clocks joined by a ledger. The finance clock starts when the asset is placed in service, while the useful-work clock moves only when the fleet produces accepted answers.',
        'Active nodes show the current commitment or operating row, found nodes show the unit-cost result, and compare nodes show refresh or utilization pressure. The safe inference is that a GPU pool is economically healthy only when depreciation, operating cost, and accepted output are joined at the workload level.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        {type:'callout', text:'The depreciation clock starts when the asset enters service, not when it processes its first token. A GPU fleet that sits idle depreciates at the same rate as one running at full utilization â€” but the idle fleet spreads that fixed cost across zero useful work. This is why utilization is not just a performance metric; it is a finance metric that determines whether unit economics are viable or underwater.'},
        'AI infrastructure is often bought as capital equipment. The company pays for accelerators, power commitments, network fabric, facility buildout, and leases before users generate enough work to fill the fleet.',
        'The ledger exists because finance systems track asset cost while serving systems track requests, tokens, cache hits, latency, and policy outcomes. Without a join between those systems, teams argue from averages that hide idle capacity and expensive workload classes.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach divides total capex by useful life, utilization, and projected answer volume. A 30 million dollar pool depreciated over 36 months gives 833,333 dollars per month before power and operations.',
        'If the model assumes 70 percent utilization and 50 million accepted answers per month, depreciation alone looks like about 2.4 cents per answer. That number is useful for a first board model, but it is too smooth for operating decisions.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is the denominator. Accepted answers are not the same as raw requests, token attempts, GPU seconds, or busy hardware, because retries, timeouts, policy rejections, and abandoned streams consume capacity without producing useful work.',
        'A coding-agent workload can consume 15 percent of GPU hours and produce 2 million accepted answers, while batch evaluation consumes 10 percent and produces 40 million accepted answers. One fleet average hides a large difference in cost behavior.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Join asset rows to runtime trace rows. An asset row names the pool, generation, service date, purchase price, useful life, power contract, and refresh assumption; a trace row names the request class, route, pool, GPU seconds, cache result, policy result, and accepted-answer flag.',
        'The invariant is workload-level allocation. Every unit-cost claim must say which fixed charge was allocated, which GPU hours consumed it, and how many accepted answers absorbed it.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'For each month, compute the fixed charge for a pool: depreciation plus power, cooling, network, and facility overhead. Then allocate that charge across workload slices using GPU seconds or another scheduler-measured consumption unit.',
        'Divide the allocated charge by accepted answers in each slice. A slice with zero accepted answers gets infinite fixed cost per accepted answer, which is exactly the signal needed for idle, failed, or internal-only usage.',
        'The flywheel view adds behavior. More demand, better batching, prefix cache reuse, and slack-filling batch jobs can lower unit cost, while quality regressions and policy failures raise unit cost even when utilization looks high.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The correctness argument is conservation of cost. The monthly pool charge is distributed across measured consumption, so the allocated charges add back to the finance total instead of creating or losing cost.',
        'The accepted-answer denominator then makes reliability visible. If the same GPU hours produce fewer accepted answers because retries rise, the unit cost increases without anyone manually reclassifying the incident.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Computational cost is a group-by over pool, period, workload, and outcome. The harder cost is instrumentation: every request must carry pool identity, workload class, GPU seconds, cache outcome, and accepted-answer state.',
        'Cost behaves like a coordination tax. If finance calls a site one asset and platform divides it into six pools, reconciliation becomes manual; if both systems share stable pool IDs, monthly calculation is routine.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'The ledger fits AI clouds, enterprises with reserved GPU capacity, shared inference platforms, and teams deciding whether to buy, rent, route, cache, or refresh. It is strongest when workloads differ sharply in latency, token length, acceptance rate, and revenue.',
        'It also helps product pricing. A team should know whether a premium agent feature costs 0.8 cents, 8 cents, or 80 cents per accepted answer before it promises a margin target.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'It fails when pool identity is weak. If trace rows cannot prove which hardware served a request, the allocation becomes a story with numbers attached.',
        'It also fails when accepted output is defined politically. Counting retries, blocked responses, or abandoned streams as accepted answers makes the denominator look healthy while users get less value.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'A pool costs 30 million dollars, depreciates over 36 months, and adds 250,000 dollars per month in power and facility overhead. The monthly fixed charge is 1,083,333 dollars, and the pool offers about 1,474,560 GPU hours in a 30-day month.',
        'At 72 percent utilization and 52 million accepted answers, fixed cost is about 2.1 cents per answer. If cache reuse raises accepted answers to 64 million on the same GPU hours, cost falls to about 1.7 cents; if a quality regression lowers accepted answers to 31 million, cost rises to about 3.5 cents.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Study public cloud and GPU-cloud filings for depreciation language, the FOCUS FinOps specification for cost attribution, and accounting guidance for property, plant, equipment, and useful life. Treat those as finance-clock sources.',
        'Next study LLM inference cost stacks, trace token cost ledgers, capacity reservation orderbooks, prefix caching, continuous batching, and SLO-aware request routing. Those topics explain how runtime behavior changes the ledger denominator.',
      ],
    },
  ],
};
