// AI datacenter power interconnection queue: connect GPU orders to the
// slower physical gates that decide when capacity can actually serve traffic.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'ai-datacenter-power-interconnection-queue-case-study',
  title: 'AI Datacenter Power Interconnection Queue',
  category: 'Systems',
  summary: 'A physical-infrastructure case study: model AI capacity as a queue of utility interconnects, substations, MW reservations, rack power envelopes, and energization gates.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['capacity queue', 'energization ledger'], defaultValue: 'capacity queue' },
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

function queueGraph(title) {
  return graphState({
    nodes: [
      { id: 'forecast', label: 'demand', x: 0.6, y: 3.5, note: 'GPU' },
      { id: 'site', label: 'site', x: 1.9, y: 3.5, note: 'land' },
      { id: 'utility', label: 'utility', x: 3.2, y: 2.0, note: 'queue' },
      { id: 'study', label: 'study', x: 4.6, y: 2.0, note: 'grid' },
      { id: 'sub', label: 'sub', x: 5.9, y: 2.0, note: 'MW' },
      { id: 'plant', label: 'plant', x: 3.2, y: 5.0, note: 'shell' },
      { id: 'rack', label: 'rack', x: 5.9, y: 5.0, note: 'kW' },
      { id: 'online', label: 'online', x: 7.5, y: 3.5, note: 'serve' },
      { id: 'ledger', label: 'ledger', x: 9.0, y: 3.5, note: 'truth' },
    ],
    edges: [
      { id: 'e-forecast-site', from: 'forecast', to: 'site' },
      { id: 'e-site-utility', from: 'site', to: 'utility' },
      { id: 'e-utility-study', from: 'utility', to: 'study' },
      { id: 'e-study-sub', from: 'study', to: 'sub' },
      { id: 'e-site-plant', from: 'site', to: 'plant' },
      { id: 'e-plant-rack', from: 'plant', to: 'rack' },
      { id: 'e-sub-online', from: 'sub', to: 'online' },
      { id: 'e-rack-online', from: 'rack', to: 'online' },
      { id: 'e-online-ledger', from: 'online', to: 'ledger' },
      { id: 'e-sub-ledger', from: 'sub', to: 'ledger' },
      { id: 'e-rack-ledger', from: 'rack', to: 'ledger' },
    ],
  }, { title });
}

function ledgerGraph(title) {
  return graphState({
    nodes: [
      { id: 'contract', label: 'contract', x: 0.7, y: 3.5, note: 'term' },
      { id: 'chips', label: 'chips', x: 2.0, y: 1.8, note: 'ETA' },
      { id: 'power', label: 'power', x: 2.0, y: 5.2, note: 'MW' },
      { id: 'civil', label: 'civil', x: 3.6, y: 3.5, note: 'build' },
      { id: 'cool', label: 'cool', x: 5.1, y: 1.8, note: 'heat' },
      { id: 'net', label: 'net', x: 5.1, y: 5.2, note: 'fabric' },
      { id: 'burn', label: 'burn', x: 6.7, y: 3.5, note: 'load' },
      { id: 'release', label: 'release', x: 8.2, y: 3.5, note: 'quota' },
      { id: 'audit', label: 'audit', x: 9.5, y: 3.5, note: 'row' },
    ],
    edges: [
      { id: 'e-contract-chips', from: 'contract', to: 'chips' },
      { id: 'e-contract-power', from: 'contract', to: 'power' },
      { id: 'e-chips-civil', from: 'chips', to: 'civil' },
      { id: 'e-power-civil', from: 'power', to: 'civil' },
      { id: 'e-civil-cool', from: 'civil', to: 'cool' },
      { id: 'e-civil-net', from: 'civil', to: 'net' },
      { id: 'e-cool-burn', from: 'cool', to: 'burn' },
      { id: 'e-net-burn', from: 'net', to: 'burn' },
      { id: 'e-burn-release', from: 'burn', to: 'release' },
      { id: 'e-release-audit', from: 'release', to: 'audit' },
    ],
  }, { title });
}

function rampPlot() {
  return plotState({
    axes: {
      x: { label: 'quarter', min: 0, max: 8 },
      y: { label: 'usable capacity', min: 0, max: 120 },
    },
    series: [
      { id: 'commit', label: 'cmt', points: [
        { x: 0, y: 30 }, { x: 1, y: 55 }, { x: 2, y: 80 }, { x: 4, y: 105 }, { x: 8, y: 115 },
      ] },
      { id: 'energized', label: 'live', points: [
        { x: 0, y: 12 }, { x: 1, y: 18 }, { x: 2, y: 28 }, { x: 4, y: 58 }, { x: 8, y: 96 },
      ] },
      { id: 'served', label: 'load', points: [
        { x: 0, y: 8 }, { x: 1, y: 14 }, { x: 2, y: 22 }, { x: 4, y: 48 }, { x: 8, y: 86 },
      ] },
    ],
    markers: [
      { id: 'gap', x: 2, y: 80, label: 'paper MW' },
      { id: 'live', x: 4, y: 48, label: 'live' },
    ],
  });
}

function headroomPlot() {
  return plotState({
    axes: {
      x: { label: 'rack density kW', min: 0, max: 180 },
      y: { label: 'site headroom', min: 0, max: 10 },
    },
    series: [
      { id: 'air', label: 'air', points: [
        { x: 20, y: 8.5 }, { x: 45, y: 5.8 }, { x: 70, y: 3.0 }, { x: 95, y: 1.2 },
      ] },
      { id: 'liquid', label: 'liq', points: [
        { x: 20, y: 8.8 }, { x: 60, y: 7.5 }, { x: 100, y: 5.8 }, { x: 140, y: 3.8 }, { x: 180, y: 2.1 },
      ] },
    ],
    markers: [
      { id: 'upgrade', x: 100, y: 5.8, label: 'CDU' },
      { id: 'derate', x: 90, y: 1.6, label: 'derate' },
    ],
  });
}

function* capacityQueue() {
  yield {
    state: queueGraph('AI capacity is a power interconnection queue'),
    highlight: { active: ['forecast', 'site', 'utility', 'study', 'sub', 'e-forecast-site', 'e-site-utility', 'e-utility-study', 'e-study-sub'], found: ['online'] },
    explanation: 'A GPU order does not become serving capacity until the site has usable power. The physical queue includes land, utility applications, grid studies, substation work, feeder capacity, and acceptance tests.',
    invariant: 'Track promised capacity separately from energized capacity and billable load.',
  };

  yield {
    state: labelMatrix(
      'Queue gates',
      [
        { id: 'land', label: 'land' },
        { id: 'grid', label: 'grid' },
        { id: 'sub', label: 'sub' },
        { id: 'feed', label: 'feed' },
        { id: 'rack', label: 'rack' },
        { id: 'ops', label: 'ops' },
      ],
      [
        { id: 'proof', label: 'proof' },
        { id: 'block', label: 'block' },
      ],
      [
        ['site ctrl', 'permit'],
        ['study', 'queue'],
        ['gear ETA', 'build'],
        ['MW alloc', 'line'],
        ['kW env', 'heat'],
        ['load test', 'derate'],
      ],
    ),
    highlight: { active: ['grid:proof', 'sub:proof', 'feed:proof', 'ops:proof'], compare: ['rack:block', 'grid:block'] },
    explanation: 'Every gate needs a proof object. A signed contract, a utility study, switchgear delivery, substation acceptance, rack thermal certification, and load-bank test are different rows with different clocks.',
  };

  yield {
    state: rampPlot(),
    highlight: { active: ['commit', 'energized', 'gap'], compare: ['served'] },
    explanation: 'Committed MW often rises before energized MW. This gap matters because depreciation, debt service, and customer expectations can start before the building can safely run the intended load.',
  };

  yield {
    state: queueGraph('The ledger reconciles market claims with physics'),
    highlight: { active: ['online', 'ledger', 'e-online-ledger', 'e-sub-ledger', 'e-rack-ledger'], compare: ['forecast', 'utility'], found: ['rack'] },
    explanation: 'The ledger should reconcile market claims with physical readiness: how much power is contracted, how much is energized, how much the cooling plant can reject, and how much capacity the scheduler is allowed to release.',
  };
}

function* energizationLedger() {
  yield {
    state: ledgerGraph('Energization is a release gate'),
    highlight: { active: ['contract', 'chips', 'power', 'civil', 'cool', 'net', 'e-contract-chips', 'e-contract-power', 'e-power-civil'], found: ['release'] },
    explanation: 'A production release for AI infrastructure needs more than GPUs on the floor. Chips, power, civil work, cooling, network fabric, and load testing must all line up before quota is exposed.',
  };

  yield {
    state: labelMatrix(
      'Release rows',
      [
        { id: 'mw', label: 'MW' },
        { id: 'it', label: 'IT load' },
        { id: 'pue', label: 'PUE' },
        { id: 'water', label: 'water' },
        { id: 'carbon', label: 'carbon' },
        { id: 'slo', label: 'SLO' },
      ],
      [
        { id: 'measure', label: 'measure' },
        { id: 'policy', label: 'policy' },
      ],
      [
        ['meter', 'cap'],
        ['rack draw', 'quota'],
        ['facility', 'target'],
        ['flow', 'site'],
        ['source', 'report'],
        ['p99', 'route'],
      ],
    ),
    highlight: { active: ['mw:measure', 'it:measure', 'pue:measure', 'slo:policy'], compare: ['water:policy', 'carbon:policy'] },
    explanation: 'The release row should include electrical meters, IT load, facility overhead, water and carbon constraints, and the serving SLO that the rack must meet under load.',
  };

  yield {
    state: headroomPlot(),
    highlight: { active: ['air', 'derate'], compare: ['liquid', 'upgrade'] },
    explanation: 'Rack density changes the power problem. A site that is electrically ready may still be thermally blocked. Liquid cooling extends the density envelope, but it introduces a separate readiness ledger.',
  };

  yield {
    state: ledgerGraph('Quota follows the slowest physical gate'),
    highlight: { active: ['cool', 'net', 'burn', 'release', 'audit', 'e-cool-burn', 'e-net-burn', 'e-burn-release', 'e-release-audit'], compare: ['chips', 'power'] },
    explanation: 'The scheduler should receive released capacity only after the physical gates pass. Otherwise a capacity orderbook can allocate demand to racks that are powered on paper but not safe to run at sustained AI load.',
    invariant: 'Capacity is online when the slowest power, cooling, network, and operations gate clears.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'capacity queue') yield* capacityQueue();
  else if (view === 'energization ledger') yield* energizationLedger();
  else throw new InputError('Pick an AI datacenter power view.');
}

export const article = {
  sections: [
    {
      heading: "Why this exists",
      paragraphs: [
        {type:'image', src:'https://upload.wikimedia.org/wikipedia/commons/e/e5/Electrical_substation.jpg', alt:'Electrical substation with transformers and high-voltage switching gear', caption:'An electrical substation — the physical gate between the utility grid and a datacenter. GPU orders are fast; interconnection studies, substation upgrades, switchgear delivery, and energization tests operate on slower clocks measured in quarters, not weeks. Source: Wikimedia Commons, Z22, CC BY-SA 3.0'},
        {type:'callout', text:'Contracted megawatts and energized megawatts are different numbers. The gap between them is where capacity claims become misleading — a signed power contract, a completed grid study, an installed substation, and a rack safely serving AI traffic are four separate states with four separate proof objects and four separate clocks.'},
        "AI datacenter capacity is not real when GPUs are ordered. It becomes real when a site has usable power, tested cooling, network-ready racks, and an operations policy that allows sustained load. The gap between those two states is where many capacity claims become misleading.",
        "The power interconnection queue exists because physical infrastructure moves on slower clocks than chip procurement or cloud sales. A site may need utility applications, grid studies, substation work, switchgear, feeder upgrades, environmental permits, cooling changes, load-bank tests, and acceptance procedures. Each gate has a different owner and a different proof object.",
      ],
    },
    {
      heading: "The naive approach",
      paragraphs: [
        "The naive capacity model counts contracted megawatts or purchased accelerators. It looks reasonable in a finance model because every row has a number and a date. If the company bought the GPUs and signed for the power, the spreadsheet can mark the capacity as coming online in a quarter.",
        "Operations breaks that shortcut. Planned MW, approved MW, energized MW, usable IT load, rack-ready power, thermal headroom, network-ready groups, and scheduler quota are different states. A market-facing commitment, a construction milestone, and a rack safely serving AI traffic cannot be collapsed into one capacity number.",
      ],
    },
    {
      heading: "The core insight",
      paragraphs: [
        "The core insight is to model capacity as a queue of proof gates, not a single inventory count. The durable object is an append-only ledger of evidence: site control, utility application, grid-study phase, interconnection agreement, substation milestone, switchgear delivery, meter state, load-bank result, cooling certification, network acceptance, derate, and incident note.",
        "The system then derives a release index from that ledger. Schedulable capacity is no larger than the minimum of contracted power, approved power, energized power, thermal capacity, network-ready rack groups, staffing, policy caps, and current derates. The scheduler should see the conservative release index, not the optimistic construction plan.",
      ],
    },
    {
      heading: "How the mechanism works",
      paragraphs: [
        "A practical row starts with demand and site information, but it does not become serving capacity until evidence accumulates. Land control is not a grid study. A grid study is not an energized feeder. An energized feeder is not proof that high-density racks can reject heat under sustained AI load.",
        "The release algorithm is intentionally conservative. It reconciles electrical meters, IT load, facility overhead, PUE assumptions, cooling mode, rack density, water or carbon constraints, network fabric, SLO tests, and staffing. Any one of those can lower the capacity that is safe to expose to a GPU scheduler or customer reservation system.",
        "The ledger should be append-only because old promises matter. If a site was derated, if switchgear slipped, or if a load test failed, the historical record explains why capacity moved backward. A mutable status cell cannot support finance, operations, customer commitments, and post-incident review at the same time.",
        "The units should stay explicit. Megawatts at the utility boundary, IT load at the rack, facility overhead, rack density in kW, cooling-loop limits, and released scheduler quota are related but not interchangeable. Keeping them separate prevents accidental conversion from paper capacity to usable service.",
      ],
    },
    {
      heading: "What the visual is proving",
      paragraphs: [
        "The capacity-queue view proves that GPU demand becomes usable service only after several physical gates clear. The queue nodes are not paperwork decoration. They are dependencies that decide whether a rack can draw power safely. The gap between committed MW and energized MW is the risk the model is making visible.",
        "The energization-ledger view proves that release is a reconciliation, not a label. The chip delivery, power state, civil work, cooling, network, burn-in, and audit rows all narrow the final quota. The scheduler should follow the slowest real gate, because the fastest procurement row cannot make an unready site serve traffic.",
      ],
    },
    {
      heading: "Why it works",
      paragraphs: [
        "The method works because it refuses to average incompatible states. Finance can still track contracted capacity. Construction can still track milestones. Operations can still track energized and tested load. The release index simply prevents those states from being mistaken for one another.",
        "It also works because it gives every downstream system a defensible input. A reservation orderbook can sell only released quota. A rack-placement service can place hardware only where power and cooling exist. An SLO-aware router can send inference traffic only to capacity that has passed burn-in. A finance team can see the difference between committed capex and billable load.",
        "Forecasting still has a place. The queue can show expected dates and confidence ranges. The rule is that forecasts stay forecasts until a gate has proof. That separation lets leaders plan without letting optimistic dates leak into scheduler capacity.",
      ],
    },
    {
      heading: "Costs and tradeoffs",
      paragraphs: [
        "The cost is operational discipline. Every gate needs an owner, a timestamp, a source document, and a policy for what counts as passing. That is heavier than a simple capacity spreadsheet. It is also the price of avoiding double-counted capacity and public claims that outrun physics.",
        "The ledger can create organizational friction because it exposes uncomfortable gaps. Sales may want to reserve future capacity. Finance may want a simple ramp. Infrastructure may know that power, cooling, network, and burn-in will not arrive together. A useful release model makes those conflicts visible instead of smoothing them into one optimistic date.",
      ],
    },
    {
      heading: "Real uses",
      paragraphs: [
        "Cloud providers and AI labs need this model when they decide how much training or inference capacity can be promised to internal teams or external customers. A capacity reservation system should not allocate a customer to racks that are powered only on paper. A model-training plan should not assume a cluster exists because the accelerators have shipped.",
        "The same ledger helps with site comparison. One site may have faster chip delivery but slower utility work. Another may have strong power but weak thermal headroom for dense racks. A third may be network-ready but constrained by water, carbon, or local operating policy. The queue makes those differences explicit.",
        "It also helps incident response. If a site loses headroom during a heat event, a transformer problem, or a cooling-loop fault, the ledger can derate released capacity and leave a reason. The scheduler then routes around the constraint instead of discovering the physical problem as rising latency or failed jobs.",
      ],
    },
    {
      heading: "Failure modes and limits",
      paragraphs: [
        "The model fails when nameplate facility power is treated as scheduler capacity. It also fails when manual spreadsheets get stale, derates are hidden, load tests are skipped, or a team records a gate as done without attaching evidence. In those cases the release index becomes theater.",
        "Power cannot be isolated from cooling. A site can be electrically ready and still thermally blocked. High-density AI racks change airflow, liquid loops, CDU capacity, maintenance procedures, emergency shutdown policy, and staffing. The interconnection queue should link directly to a thermal readiness ledger, not pretend that power alone is the bottleneck.",
        "It is also possible to be too conservative. If the release model lags real readiness, expensive GPUs sit idle and customers wait. The goal is not pessimism. The goal is evidence-based release, with fast updates when proof arrives and fast derates when conditions change.",
      ],
    },
    {
      heading: "Study next",
      paragraphs: [
        "Primary sources: US Department of Energy datacenter electricity demand resources at https://www.energy.gov/policy/articles/clean-energy-resources-meet-data-center-electricity-demand, Uptime Institute Global Data Center Survey Results 2025 at https://uptimeinstitute.com/resources/research-and-reports/uptime-institute-global-data-center-survey-results-2025, and NVIDIA DGX GB200 hardware guidance at https://docs.nvidia.com/dgx/dgxgb200-user-guide/hardware.html.",
        "Study AI Capex Depreciation Utilization Ledger for the finance view, GPU Cloud Capacity Reservation Orderbook for customer allocation, AC Power Flow Newton-Raphson Jacobian and Power Grid Bus Admittance Sparse Matrix for grid modeling, Liquid Cooling Rack Thermal Loop for thermal limits, and SLO-Aware LLM Request Router for how released capacity becomes serving traffic.",
      ],
    },
  ],
};
