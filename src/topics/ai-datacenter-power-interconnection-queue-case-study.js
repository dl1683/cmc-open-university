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
      heading: 'What it is',
      paragraphs: [
        'An AI datacenter power interconnection queue is the missing physical layer under GPU capacity planning. It stores site candidates, utility applications, grid-study status, substation work, feeder capacity, rack power envelopes, load-test results, and the release decision that says which capacity is actually usable.',
        'The local AI infrastructure corpus repeatedly points to this bottleneck: massive GPU commitments require substations, cooling, interconnects, and front-loaded construction before revenue arrives. The data-structure lesson is to model that chain explicitly instead of treating a GPU purchase order as online capacity.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The queue starts with demand forecasts and contract terms, but it only releases capacity when the physical proof objects are present. A row can hold site id, utility territory, requested MW, approved MW, study phase, substation milestone, switchgear ETA, cooling design, rack density, load-bank test, and scheduler quota.',
        'The release algorithm is conservative: usable capacity is the minimum of contracted power, energized power, thermal capacity, network-ready rack groups, operational staffing, and policy caps. That minimum then feeds the GPU Cloud Capacity Reservation Orderbook and SLO-Aware LLM Request Router.',
      ],
    },
    {
      heading: 'Why it matters',
      paragraphs: [
        'AI infrastructure can be financially committed before it is physically energized. That creates a dangerous gap between booked capacity, construction-in-progress, and billable load. The gap matters for depreciation, debt service, customer reservations, and public claims about how much capacity exists.',
        'The Uptime Institute 2025 survey describes power availability as a major capacity constraint for datacenter operators, especially as AI workloads drive higher rack densities: https://uptimeinstitute.com/resources/research-and-reports/uptime-institute-global-data-center-survey-results-2025. The US Department of Energy also tracks clean-energy and grid-readiness work for rising datacenter electricity demand: https://www.energy.gov/policy/articles/clean-energy-resources-meet-data-center-electricity-demand.',
      ],
    },
    {
      heading: 'Implementation shape',
      paragraphs: [
        'Use an append-only ledger for external proof objects and a derived capacity index for scheduling. The ledger keeps signed interconnection studies, energization dates, load tests, power meter snapshots, thermal certification, and incident notes. The derived index exposes only capacity that is safe to allocate.',
        'A practical schema separates planned MW, approved MW, energized MW, IT load, facility overhead, rack density, cooling mode, redundancy class, and serving quota. That prevents the common error where a market-facing commitment, a construction milestone, and a running rack are collapsed into one number.',
      ],
    },
    {
      heading: 'Pitfalls',
      paragraphs: [
        'Do not use nameplate facility power as scheduler capacity. Do not ignore the timing gap between equipment arrival and utility energization. Do not allocate committed reservations to racks that have not passed sustained load tests. Do not hide derating events; they are the exact evidence the capacity model needs.',
        'Also avoid treating power as separate from cooling. Higher-density AI racks change airflow, liquid loop, water, CDU, maintenance, and emergency shutdown assumptions. The power queue should link directly to the Liquid Cooling Rack Thermal Loop case study.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: US Department of Energy datacenter electricity demand resources at https://www.energy.gov/policy/articles/clean-energy-resources-meet-data-center-electricity-demand, Uptime Institute Global Data Center Survey Results 2025 at https://uptimeinstitute.com/resources/research-and-reports/uptime-institute-global-data-center-survey-results-2025, and NVIDIA DGX GB200 hardware guidance at https://docs.nvidia.com/dgx/dgxgb200-user-guide/hardware.html. Study AI Capex Depreciation Utilization Ledger, GPU Cloud Capacity Reservation Orderbook, AC Power Flow Newton-Raphson Jacobian, Power Grid Bus Admittance Sparse Matrix, and Liquid Cooling Rack Thermal Loop next.',
      ],
    },
  ],
};
