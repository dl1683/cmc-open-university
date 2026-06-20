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
        'The "asset ledger" view traces a GPU purchase from demand forecast through order, power commitment, construction-in-progress, placed-in-service, depreciation clock, utilization measurement, unit cost, and refresh decision. Active highlights mark the current pipeline stage. The found highlight on the unit-cost node shows where all upstream commitments converge into a single dollar-per-accepted-answer number.',
        'The "utilization flywheel" view traces workload demand through token generation, scheduling, cache reuse, utilization, cost reduction, and the feedback loop into pricing and further capex. Watch how the two paths from tokens (scheduling and cache reuse) both feed utilization independently -- either lever moves cost, but they compound when combined.',
        'At each frame, ask: which clock is advancing, what failure mode does this node carry, and what happens to unit cost if this node stalls or underperforms?',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        {
          type: 'quote',
          text: 'We recognized approximately $1.4 billion of depreciation expense related to data center and other compute assets during fiscal year 2025... The estimated useful lives of our servers are four years.',
          attribution: 'CoreWeave 10-K, FY2025 (SEC filing, April 2025)',
        },
        'AI inference fleets are capital assets, not cloud rentals. A company that buys $500 million in accelerators does not pay that cost when the GPUs process tokens. It pays when it signs the purchase order, takes delivery, energizes the data center, and places the asset in service. From that moment, the depreciation clock runs whether the fleet is busy or idle.',
        'The problem is that the finance system and the serving system speak different languages. Finance tracks asset classes, depreciation schedules, and book value. The serving system tracks requests, tokens, latency, and cache hits. Nobody naturally joins those two worlds. The ledger exists to connect the fixed-cost clock (depreciation) to the useful-work clock (accepted answers) so that unit economics are grounded in reality rather than averages.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The reasonable first attempt is a spreadsheet: total GPU spend divided by useful life in months, divided by estimated utilization, divided by projected request volume. Three divisions and a unit cost falls out.',
        {
          type: 'code',
          language: 'text',
          text: [
            'Total capex:           $30,000,000',
            'Useful life:           36 months',
            'Monthly depreciation:  $833,333',
            'Assumed utilization:    70%',
            'Effective monthly:     $1,190,476',
            'Projected answers/mo:  50,000,000',
            'Unit cost (depr only): $0.024 per accepted answer',
          ].join('\n'),
        },
        'This works for a board deck. It gives a single number that leadership can compare against revenue per answer. Finance teams reach for it because it fits the standard capital budgeting model: buy asset, depreciate asset, allocate cost to revenue.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The spreadsheet breaks at the denominator. "Projected answers per month" is not one number -- it is a distribution across workload types, model tiers, SLO classes, time-of-day patterns, cache hit rates, retry rates, and policy rejection rates. A single utilization percentage hides which workloads carry the depreciation burden and which free-ride.',
        {
          type: 'table',
          headers: ['Workload', 'GPU hours', '% of fleet', 'Accepted answers', 'Depr per answer'],
          rows: [
            ['Interactive chat', '12,000', '40%', '35,000,000', '$0.0095'],
            ['RAG retrieval', '6,000', '20%', '28,000,000', '$0.0060'],
            ['Coding agents', '4,500', '15%', '2,000,000', '$0.0750'],
            ['Batch evaluation', '3,000', '10%', '40,000,000', '$0.0025'],
            ['Internal testing', '2,250', '7.5%', '0 (non-revenue)', 'infinite'],
            ['Idle / failed', '2,250', '7.5%', '0', 'infinite'],
          ],
        },
        'The fleet-wide average of $0.024 per answer is meaningless. Coding agents cost 30x more per accepted answer than batch evaluation. Internal testing and idle time produce zero accepted answers but still burn depreciation. The wall is that a single utilization number cannot allocate cost to the workloads that actually consume it -- and without that allocation, no team can make a grounded build-vs-buy, route, or pricing decision.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'A GPU fleet runs two clocks simultaneously. The finance clock starts at placed-in-service and ticks monthly regardless of load. The useful-work clock ticks only when a request arrives, gets scheduled onto hardware, completes within SLO, passes policy, and produces an accepted answer. Unit economics improve only when these clocks are joined at the workload level.',
        {
          type: 'diagram',
          label: 'The two-clock model',
          text: [
            'FINANCE CLOCK (ticks always)',
            '  order -> CIP -> placed-in-service -> depreciation -> book value -> refresh',
            '  |                                     |',
            '  |         monthly charge: $833K       |',
            '  |         (runs whether busy or not)  |',
            '  |                                     |',
            '  +------ JOIN KEY: pool_id + month ----+',
            '  |                                     |',
            '  |   accepted answers: 50M (or 5M)     |',
            '  |   (depends on demand + routing)     |',
            '  |                                     |',
            'USEFUL-WORK CLOCK (ticks on accepted answers)',
            '  request -> schedule -> prefill -> decode -> policy -> accept/reject',
          ].join('\n'),
        },
        'The join key is what makes this a ledger rather than a dashboard. Each asset row (pool, generation, zone, depreciation schedule) joins to runtime rows (request class, model, route, cache outcome, SLO result, acceptance) through a shared pool identifier and time window. The joined record answers the real question: how much fixed cost did this workload slice consume per accepted answer this period?',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The ledger has two sides. The asset side tracks each deployable pool as a row with its own attributes and failure modes.',
        {
          type: 'table',
          headers: ['Asset row', 'Tracks', 'Failure mode'],
          rows: [
            ['GPU order', 'SKU, quantity, delivery date, purchase price', 'Supply delay, different SKU delivered'],
            ['Network fabric', 'Switch topology, bandwidth, zone', 'Bottleneck at spine, incompatible with new model parallelism'],
            ['Power reservation', 'MW committed, utility contract, PUE', 'Delay in energization, rate increase, cooling shortfall'],
            ['Lease / facility', 'Term, renewal option, location', 'Locked into site after workload migrates'],
            ['Construction-in-progress', 'Build timeline, capital spend to date', 'Delay pushes capex into wrong fiscal period'],
            ['Placed-in-service', 'Date, depreciation method, useful life', 'Late start compresses remaining useful life for ROI'],
            ['Depreciation', 'Monthly charge, accumulated, book value', 'Idle fleet still depreciates at full rate'],
            ['Refresh assumption', 'Expected swap date, successor SKU', 'New SKU unavailable, migration cost underestimated'],
          ],
        },
        'The runtime side records each request as a trace row: request class, model served, route taken, batch size, cache hit or miss, prefill and decode time, retry count, policy outcome, and whether the response was accepted by the caller. The critical field is the binary accepted-answer flag. Retries, timeouts, policy rejections, and abandoned requests consume GPU time but do not increment the useful-work clock.',
        {
          type: 'code',
          language: 'javascript',
          text: [
            '// Simplified ledger join: asset charge per accepted answer',
            'function unitCost(assetRows, traceRows, periodKey) {',
            '  const results = [];',
            '  for (const pool of assetRows) {',
            '    const monthlyDepr = pool.purchasePrice / pool.usefulLifeMonths;',
            '    const traces = traceRows.filter(',
            '      t => t.poolId === pool.id && t.period === periodKey',
            '    );',
            '    const gpuHours = traces.reduce((s, t) => s + t.gpuSeconds / 3600, 0);',
            '    const accepted = traces.filter(t => t.accepted).length;',
            '    const poolShare = gpuHours / pool.totalGpuHoursAvailable;',
            '    const deprCharge = monthlyDepr * poolShare;',
            '    results.push({',
            '      pool: pool.id,',
            '      period: periodKey,',
            '      gpuHours,',
            '      accepted,',
            '      deprPerAnswer: accepted > 0 ? deprCharge / accepted : Infinity,',
            '    });',
            '  }',
            '  return results;',
            '}',
          ].join('\n'),
        },
        'The join allocates each pool\'s monthly depreciation charge proportionally to the GPU hours each workload slice consumed, then divides by accepted answers in that slice. A workload that uses 15% of a pool\'s GPU hours and produces 2 million accepted answers gets a different unit cost than one that uses 40% and produces 35 million. This is the number that makes routing, caching, and capacity decisions concrete.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The ledger works because it keeps the denominator honest. A request that retries three times, misses cache, times out, or fails policy is not equivalent to an accepted answer. Counting only accepted answers in the denominator means the unit cost rises automatically when quality, reliability, or policy compliance degrades -- surfacing the real cost of those failures in dollar terms.',
        'It also works because it separates decisions that organizations habitually blur together. Buying capacity, constructing the facility, placing it in service, depreciating it, routing traffic to it, and refreshing it are different decisions made by different teams on different timelines. Keeping them as separate ledger rows lets each team see the consequence of its choices without waiting for an end-of-quarter post-mortem.',
        {
          type: 'note',
          text: 'The ledger does not require perfect attribution. Even approximate GPU-hour allocation per workload class -- say, from scheduler logs bucketed by model and request type -- is far more useful than a fleet-wide average. The goal is to separate "which workloads carry the depreciation" from "how much total depreciation exists." The first question drives operational decisions; the second is just accounting.',
        },
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'A company places a $30 million inference pool (2,048 GPUs) into service on January 1 and depreciates straight-line over 36 months. Monthly depreciation: $833,333. The pool provides roughly 1,474,560 GPU-hours per month (2,048 GPUs x 24 hours x 30 days). Add $250,000/month for power, cooling, and network, bringing total monthly fixed cost to $1,083,333.',
        {
          type: 'table',
          headers: ['Scenario', 'Utilization', 'Accepted answers', 'Fixed cost/answer', 'Lever'],
          rows: [
            ['Launch month', '25%', '8,000,000', '$0.1354', 'Demand ramp is slow'],
            ['Steady state', '72%', '52,000,000', '$0.0208', 'Scheduling + cache hitting'],
            ['Peak holiday', '91%', '78,000,000', '$0.0139', 'Batch backfill fills gaps'],
            ['Cache improvement', '72%', '64,000,000', '$0.0169', 'Same GPU hours, more accepted answers from prefix reuse'],
            ['Quality regression', '72%', '31,000,000', '$0.0349', 'Same GPU hours, retries and rejections spike'],
          ],
        },
        'The cache improvement row is the most instructive. GPU utilization stays at 72%, but accepted answers rise from 52 million to 64 million because prefix cache hits reduce redundant prefill, letting the same hardware serve more distinct requests. The cost drops 19% without buying a single GPU. This is why the denominator -- accepted answers, not raw GPU hours -- is the critical metric.',
        'The quality regression row shows the opposite. Utilization is identical, but a model update causes more retries and policy rejections. Accepted answers fall 40%, and unit cost nearly doubles. The fleet looks busy, but useful work has collapsed.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The ledger itself is not computationally expensive. The join between asset rows and trace rows is a standard GROUP BY on pool ID, period, and workload class. The hard cost is organizational: it requires stable pool identifiers that both finance and platform teams agree on, trace instrumentation that tags every request with its pool, route, and acceptance outcome, and a reconciliation process that maps GPU-hour consumption back to asset depreciation schedules.',
        {
          type: 'table',
          headers: ['Component', 'Effort', 'Failure if missing'],
          rows: [
            ['Pool ID registry', 'Low -- naming convention for deployable GPU groups', 'Cannot join finance rows to runtime rows'],
            ['Trace tagging', 'Medium -- instrument request path with pool, model, route, outcome', 'Denominator is a guess'],
            ['Depreciation feed', 'Low -- export from finance system monthly', 'Numerator is a guess'],
            ['Scheduler logs', 'Medium -- emit GPU-seconds per request', 'Cannot allocate cost to workloads'],
            ['Accepted-answer flag', 'Medium -- define what counts as accepted vs. failed/rejected', 'Denominator inflated by junk work'],
            ['Reconciliation', 'High -- align finance periods, pool boundaries, workload taxonomy', 'Numbers do not agree across teams'],
          ],
        },
        'Most organizations that attempt this discover that the reconciliation step is harder than the computation. Finance may depreciate "data center equipment" as a single line item while platform teams think in terms of individual GPU pools with different generations and memory sizes. The ledger forces those taxonomies to agree, which is uncomfortable but necessary.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'The ledger pattern fits any organization where AI inference capex is large enough that workload-level cost attribution changes decisions. Concrete triggers:',
        {
          type: 'bullets',
          items: [
            'Shared inference fleets serving multiple products -- the ledger shows which product line is subsidizing which.',
            'Reserved GPU cloud capacity (e.g., long-term commitments with cloud providers) -- reserved hours that go unused still carry depreciation, and the ledger quantifies the idle tax per workload.',
            'Mixed interactive and batch workloads -- batch backfill improves fleet utilization but should not mask the per-answer cost of the interactive tier that drives revenue.',
            'Refresh planning -- comparing remaining book value, migration cost, and projected unit cost on old vs. new hardware requires the joined view that the ledger provides.',
            'Pricing decisions -- setting per-token or per-answer prices requires knowing the actual fixed-cost floor per workload class, not the fleet average.',
          ],
        },
        'The pattern also applies outside AI. Any capital-intensive serving infrastructure -- CDN edge nodes, 5G base stations, HPC clusters -- has the same two-clock problem: fixed assets depreciate on a schedule, useful work happens on demand, and unit economics depend on the join.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'The ledger fails when the join keys are weak. If "pool ID" is a hand-maintained spreadsheet column rather than an infrastructure-level tag, the numbers drift. If the accepted-answer definition is ambiguous (does a streamed response that the user abandons at token 50 count?), the denominator is unreliable. False precision is worse than an honest average because it creates confidence in wrong numbers.',
        'It also fails when the organization wants a single tidy number for political reasons. The ledger will show that some workloads are expensive and some are cheap. Teams running expensive workloads will dispute the allocation methodology. This is not a technical failure -- it is the ledger working as designed -- but it can kill adoption.',
        {
          type: 'note',
          text: 'A common failure mode: the ledger shows that internal evaluation and safety testing consume 8% of GPU hours and produce zero revenue. Someone proposes cutting internal testing to "improve unit economics." The correct response is to keep the ledger honest (those costs are real) while making the policy decision separately (safety testing is not optional). The ledger informs decisions; it does not make them.',
        },
        'Refresh timing is the hardest decision the ledger surfaces. A newer accelerator may offer 2x throughput per watt, but migration is wrong if the old pool has 18 months of remaining book value, the new pool cannot run the required model yet, the network fabric is incompatible, or the workload mix cannot fill both pools. The ledger can lay out these factors; it cannot resolve the judgment call.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        {
          type: 'bullets',
          items: [
            'CoreWeave 10-K, FY2025 (SEC filing). Shows how a GPU cloud provider reports depreciation, useful life assumptions, construction-in-progress, and the relationship between capital expenditure and revenue.',
            'NVIDIA Fiscal 2026 Q4 earnings and 10-K (SEC filing). Shows accelerator demand, data center revenue, and how the supply side of AI capex appears in public reporting.',
            'FOCUS FinOps specification (focus.finops.org). The open standard for cloud cost and usage data, including constructs for amortized cost, commitment charges, and resource-level attribution that map to the ledger pattern.',
            'ASC 360 (FASB) / IAS 16 (IFRS). The accounting standards governing property, plant, and equipment -- useful life, depreciation methods, impairment testing, and asset retirement obligations that determine the finance clock.',
          ],
        },
        'Study LLM Inference Cost Stack Case Study for the per-request variable cost layer that sits on top of the fixed depreciation layer. Study GenAI Trace Token Cost Ledger Case Study for the distributed tracing instrumentation that generates the runtime rows. Study GPU Cloud Capacity Reservation Orderbook Case Study for the supply-side commitment model. Study SLO-Aware LLM Request Router for the routing decisions that determine which pool serves which workload and therefore which pool absorbs which depreciation charge.',
        'For the financial modeling side, study Inference ROI Payback Cohort Ledger Case Study to see how the payback period changes with utilization, and AI Circular Financing Demand Graph Case Study for the feedback loop between capex, demand, and revenue that determines whether the flywheel accelerates or stalls.',
      ],
    },
  ],
};
