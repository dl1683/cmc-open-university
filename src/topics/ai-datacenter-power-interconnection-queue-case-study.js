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
      heading: 'How to read the animation',
      paragraphs: [
        'Read the animation as a queue of physical proof gates. Active nodes are gates currently being checked, found nodes are gates with evidence, and compare nodes show the difference between contracted capacity and released serving capacity.',
        'The safe inference rule is minimum readiness. Schedulable capacity cannot exceed the smallest proven limit among contracted power, approved interconnection, energized load, cooling, network, burn-in, staffing, and current derates.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        {type:'image', src:'https://upload.wikimedia.org/wikipedia/commons/e/e5/Electrical_substation.jpg', alt:'Electrical substation with transformers and high-voltage switching gear', caption:'An electrical substation — the physical gate between the utility grid and a datacenter. GPU orders are fast; interconnection studies, substation upgrades, switchgear delivery, and energization tests operate on slower clocks measured in quarters, not weeks. Source: Wikimedia Commons, Z22, CC BY-SA 3.0'},
        {type:'callout', text:'Contracted megawatts and energized megawatts are different numbers. The gap between them is where capacity claims become misleading — a signed power contract, a completed grid study, an installed substation, and a rack safely serving AI traffic are four separate states with four separate proof objects and four separate clocks.'},
        'AI datacenter capacity is not real when accelerators are ordered. It becomes real when power is contracted, studied, upgraded, energized, cooled, tested, connected, and released to the scheduler.',
        'An interconnection queue is the ordered set of utility and facility gates that must clear before a site can safely draw load. For AI sites, those gates matter because GPU procurement can move faster than substations, switchgear, transformers, cooling loops, and energization tests.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is to count purchased GPUs or contracted megawatts. A capacity spreadsheet can then assign an expected online quarter to each site.',
        'That works for rough planning. It fails as an operating number because contracted power, approved power, energized power, usable IT load, rack-ready power, and scheduler quota are different states.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is physical readiness. A site can have a signed power agreement but no completed grid study, installed transformer, commissioned switchgear, passing load-bank test, or thermal headroom for dense racks.',
        'The wall is also unit confusion. Megawatts at the utility boundary are not the same as IT load at the rack because facility overhead, power usage effectiveness, derates, and cooling constraints consume part of the capacity.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'The core insight is to treat capacity as an evidence ledger, not as inventory. Every state transition needs a proof object: application, study result, interconnection agreement, delivery receipt, meter state, burn-in record, cooling certificate, network acceptance, or derate note.',
        'The invariant is conservative release. Scheduler capacity must be derived from proven gates, while forecasts stay labeled as forecasts until their evidence arrives.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The ledger records site, utility application, study phase, interconnection agreement, substation milestone, switchgear delivery, feeder state, meter state, cooling readiness, network readiness, burn-in result, staffing state, and derates. Each row has an owner, timestamp, source document, and status.',
        'A release function then computes usable quota as the minimum of all active constraints. If contracted power is 100 MW, approved interconnection is 80 MW, energized power is 60 MW, cooling supports 52 MW, and network-ready rack groups support 45 MW, the scheduler should see 45 MW before policy caps.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The method works because it refuses to average incompatible states. Finance can track future contracted capacity, construction can track milestones, and operations can expose only proven serving capacity.',
        'The correctness argument is monotonic with derates. A site becomes more releasable only when evidence clears a gate, and it can move backward when evidence records a failure, heat event, transformer issue, or maintenance constraint.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The cost is operational discipline across utility, facilities, network, platform, and finance teams. Every gate needs a definition of done, and every derate needs a reason that downstream systems can consume.',
        'Cost behaves like delay risk. If a $400,000,000 GPU order waits two extra quarters for energization, depreciation, financing cost, customer commitments, and opportunity cost accumulate before revenue-bearing work begins.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Cloud providers and AI labs use this model to decide which customer reservations can be promised and which training plans are physically possible. A site with hardware but no tested load should not receive production quota.',
        'The same ledger helps incident response. A heat event, transformer issue, or cooling-loop fault can derate released capacity with an explicit reason, so routers and schedulers react before users see failed jobs.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'The ledger fails when nameplate facility power is treated as scheduler capacity. It also fails when manual updates lag reality, derates are hidden, or passing evidence is recorded without a source.',
        'It can also be too conservative. If updates lag completed work, expensive GPUs sit idle, so the same evidence system must support fast release when proof arrives and fast derate when proof changes.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'A campus announces 100 MW of contracted power for a 20,000-GPU build. The interconnection study approves 80 MW in phase one, the substation is energized for 60 MW, cooling certification supports 54 MW, and rack burn-in passes for 48 MW of IT load.',
        'With power usage effectiveness of 1.20, 60 MW at the utility boundary supports about 50 MW of IT load before other derates. Since burn-in proves 48 MW, the release index is 48 MW; if a heat event derates cooling by 10 MW, released quota falls to 38 MW even though the original contract still says 100 MW.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Study utility interconnection procedures, datacenter power usage effectiveness, load-bank testing, Uptime Institute datacenter surveys, and hardware guidance for high-density AI racks. These sources explain why electrical capacity, thermal capacity, and IT load are separate numbers.',
        'Next, study capex depreciation utilization ledgers, GPU capacity reservation orderbooks, AC power-flow models, liquid cooling rack thermal loops, and SLO-aware request routers.',
      ],
    },
  ],
};
