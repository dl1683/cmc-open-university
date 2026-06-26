// GPU cloud capacity reservation orderbook: model scarce accelerator supply as
// a typed matching book across SKU, zone, time, tenancy, and commitment.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'gpu-cloud-capacity-reservation-orderbook-case-study',
  title: 'GPU Cloud Capacity Reservation Orderbook',
  category: 'Systems',
  summary: 'A capacity-market case study: reservations, take-or-pay commitments, GPU SKUs, zones, quotas, matching, utilization leakage, and release policy.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['reservation book', 'matching engine'], defaultValue: 'reservation book' },
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

function bookGraph(title) {
  return graphState({
    nodes: [
      { id: 'demand', label: 'ask', x: 0.6, y: 3.5, note: 'need' },
      { id: 'key', label: 'key', x: 2.0, y: 3.5, note: 'sku/zone' },
      { id: 'quota', label: 'quota', x: 3.4, y: 1.7, note: 'limit' },
      { id: 'book', label: 'book', x: 3.4, y: 3.5, note: 'slots' },
      { id: 'price', label: 'price', x: 3.4, y: 5.3, note: 'rate' },
      { id: 'match', label: 'match', x: 5.1, y: 3.5, note: 'alloc' },
      { id: 'run', label: 'run', x: 6.8, y: 2.0, note: 'VM/pod' },
      { id: 'idle', label: 'idle', x: 6.8, y: 5.0, note: 'leak' },
      { id: 'meter', label: 'meter', x: 8.4, y: 3.5, note: 'bill' },
      { id: 'release', label: 'rel', x: 9.6, y: 3.5, note: 'free' },
    ],
    edges: [
      { id: 'e-demand-key', from: 'demand', to: 'key' },
      { id: 'e-key-quota', from: 'key', to: 'quota' },
      { id: 'e-key-book', from: 'key', to: 'book' },
      { id: 'e-key-price', from: 'key', to: 'price' },
      { id: 'e-quota-match', from: 'quota', to: 'match' },
      { id: 'e-book-match', from: 'book', to: 'match' },
      { id: 'e-price-match', from: 'price', to: 'match' },
      { id: 'e-match-run', from: 'match', to: 'run' },
      { id: 'e-match-idle', from: 'match', to: 'idle' },
      { id: 'e-run-meter', from: 'run', to: 'meter' },
      { id: 'e-idle-meter', from: 'idle', to: 'meter' },
      { id: 'e-meter-release', from: 'meter', to: 'release' },
    ],
  }, { title });
}

function matchGraph(title) {
  return graphState({
    nodes: [
      { id: 'req', label: 'req', x: 0.7, y: 3.4, note: 'job' },
      { id: 'attrs', label: 'attrs', x: 2.0, y: 3.4, note: 'typed' },
      { id: 'heap', label: 'heap', x: 3.5, y: 1.7, note: 'priority' },
      { id: 'bins', label: 'bins', x: 3.5, y: 5.1, note: 'by zone' },
      { id: 'fit', label: 'fit', x: 5.2, y: 3.4, note: 'score' },
      { id: 'hold', label: 'hold', x: 6.7, y: 1.7, note: 'reserve' },
      { id: 'spill', label: 'spill', x: 6.7, y: 5.1, note: 'fallback' },
      { id: 'trace', label: 'trace', x: 8.2, y: 3.4, note: 'why' },
      { id: 'audit', label: 'audit', x: 9.5, y: 3.4, note: 'row' },
    ],
    edges: [
      { id: 'e-req-attrs', from: 'req', to: 'attrs' },
      { id: 'e-attrs-heap', from: 'attrs', to: 'heap' },
      { id: 'e-attrs-bins', from: 'attrs', to: 'bins' },
      { id: 'e-heap-fit', from: 'heap', to: 'fit' },
      { id: 'e-bins-fit', from: 'bins', to: 'fit' },
      { id: 'e-fit-hold', from: 'fit', to: 'hold' },
      { id: 'e-fit-spill', from: 'fit', to: 'spill' },
      { id: 'e-hold-trace', from: 'hold', to: 'trace' },
      { id: 'e-spill-trace', from: 'spill', to: 'trace' },
      { id: 'e-trace-audit', from: 'trace', to: 'audit' },
    ],
  }, { title });
}

function capacityPlot() {
  return plotState({
    axes: {
      x: { label: 'month', min: 0, max: 12 },
      y: { label: 'GPU slots', min: 0, max: 120 },
    },
    series: [
      { id: 'reserved', label: 'reserved', points: [
        { x: 0, y: 40 }, { x: 3, y: 65 }, { x: 6, y: 90 }, { x: 9, y: 100 }, { x: 12, y: 105 },
      ] },
      { id: 'used', label: 'used', points: [
        { x: 0, y: 30 }, { x: 3, y: 48 }, { x: 6, y: 82 }, { x: 9, y: 72 }, { x: 12, y: 96 },
      ] },
      { id: 'spot', label: 'on demand', points: [
        { x: 0, y: 10 }, { x: 3, y: 15 }, { x: 6, y: 18 }, { x: 9, y: 32 }, { x: 12, y: 18 },
      ] },
    ],
    markers: [
      { id: 'gap', x: 9, y: 100, label: 'leak' },
      { id: 'burst', x: 9, y: 32, label: 'burst' },
    ],
  });
}

function queuePlot() {
  return plotState({
    axes: {
      x: { label: 'hours before deadline', min: 0, max: 72 },
      y: { label: 'match priority', min: 0, max: 10 },
    },
    series: [
      { id: 'critical', label: 'critical', points: [
        { x: 0, y: 9.8 }, { x: 12, y: 9.4 }, { x: 24, y: 8.7 }, { x: 48, y: 7.0 }, { x: 72, y: 5.8 },
      ] },
      { id: 'batch', label: 'batch', points: [
        { x: 0, y: 6.0 }, { x: 12, y: 5.8 }, { x: 24, y: 5.1 }, { x: 48, y: 4.1 }, { x: 72, y: 3.5 },
      ] },
    ],
    markers: [
      { id: 'now', x: 4, y: 9.6, label: 'launch' },
      { id: 'wait', x: 48, y: 4.1, label: 'wait' },
    ],
  });
}

function* reservationBook() {
  yield {
    state: bookGraph('Reservations are an orderbook'),
    highlight: { active: ['demand', 'key', 'quota', 'book', 'price', 'match', 'e-demand-key', 'e-key-quota', 'e-key-book', 'e-key-price'], found: ['meter'] },
    explanation: 'A capacity reservation is not the same thing as a discount. It is an orderbook row keyed by instance type, accelerator generation, zone, platform, tenancy, start time, duration, and who is allowed to consume it.',
    invariant: 'Reserved capacity must be matched, used, metered, and released explicitly.',
  };

  yield {
    state: labelMatrix(
      'Book',
      [
        { id: 'aws', label: 'AWS' },
        { id: 'azure', label: 'Azure' },
        { id: 'ai', label: 'AI cloud' },
        { id: 'ri', label: 'RI' },
        { id: 'spot', label: 'spot' },
      ],
      [
        { id: 'locks', label: 'locks' },
        { id: 'meter', label: 'meter' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['AZ+type', 'pay-go', 'idle'],
        ['region+size', 'pay-go', 'quota'],
        ['GPU+term', 'take/pay', 'lock'],
        ['discount', 'term', 'no cap'],
        ['none', 'cheap', 'preempt'],
      ],
    ),
    highlight: { active: ['aws:locks', 'azure:locks', 'ai:meter'], compare: ['ri:risk'], found: ['spot:risk'] },
    explanation: 'Capacity reservations, reserved instances, take-or-pay contracts, and spot capacity are different instruments. Mixing them in one column hides whether you bought availability, a discount, a long-term commitment, or an interruptible option.',
  };

  yield {
    state: capacityPlot(),
    highlight: { active: ['reserved', 'used', 'gap'], compare: ['spot', 'burst'] },
    explanation: 'Reserved supply creates assurance, but unused reserved hours become leakage. A burst can still need on-demand capacity if the reservation is in the wrong zone, size, tenancy, or time window.',
  };

  yield {
    state: bookGraph('The bill includes idle reservations'),
    highlight: { active: ['match', 'run', 'idle', 'meter', 'release', 'e-match-run', 'e-match-idle', 'e-run-meter', 'e-idle-meter', 'e-meter-release'], compare: ['quota'] },
    explanation: 'The reservation book has to meter both running work and held idle slots. That makes it a control structure, not just procurement paperwork.',
  };
}

function* matchingEngine() {
  yield {
    state: matchGraph('Capacity matching is typed scheduling'),
    highlight: { active: ['req', 'attrs', 'heap', 'bins', 'fit', 'e-req-attrs', 'e-attrs-heap', 'e-attrs-bins', 'e-heap-fit', 'e-bins-fit'], found: ['audit'] },
    explanation: 'The matching engine combines a priority queue for urgency with bucketed books for SKU, zone, topology, tenancy, and policy. A job cannot use a slot unless the attributes match.',
  };

  yield {
    state: labelMatrix(
      'Attrs',
      [
        { id: 'sku', label: 'SKU' },
        { id: 'zone', label: 'zone' },
        { id: 'topo', label: 'topo' },
        { id: 'term', label: 'term' },
        { id: 'policy', label: 'policy' },
      ],
      [
        { id: 'match', label: 'match' },
        { id: 'miss', label: 'miss' },
      ],
      [
        ['H100/B200', 'wrong gen'],
        ['AZ/region', 'far'],
        ['NVLink', 'slow net'],
        ['start/end', 'gap'],
        ['tenant', 'deny'],
      ],
    ),
    highlight: { active: ['sku:match', 'zone:match', 'topo:match', 'term:match', 'policy:match'], compare: ['topo:miss'] },
    explanation: 'GPU capacity is multi-dimensional. Accelerator generation, memory size, network topology, placement group, zone, contract term, and tenant policy all change whether a reservation is actually usable.',
  };

  yield {
    state: queuePlot(),
    highlight: { active: ['critical', 'now'], compare: ['batch', 'wait'] },
    explanation: 'Critical launches need earlier matching and stronger guarantees. Batch jobs can wait for cheaper or less contended windows. A priority queue lets the system make that trade explicitly.',
  };

  yield {
    state: matchGraph('Every match needs an audit row'),
    highlight: { active: ['fit', 'hold', 'spill', 'trace', 'audit', 'e-fit-hold', 'e-fit-spill', 'e-hold-trace', 'e-spill-trace', 'e-trace-audit'], compare: ['heap'] },
    explanation: 'An audit row records requested attributes, matched slot, fallback path, idle leakage, and who owns the cost. Without it, capacity problems become blame-shifting across finance, platform, and product teams.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'reservation book') yield* reservationBook();
  else if (view === 'matching engine') yield* matchingEngine();
  else throw new InputError('Pick a GPU capacity reservation view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'Read the reservation book as a typed market for capacity, not as a single bucket named GPUs. A request must match SKU, zone, time window, topology, quota, tenant, and owner before it can consume a reserved slot.',
        'The safe inference is that unused reserved capacity can still be unavailable to a workload. A slot in the wrong zone or behind the wrong network is economically reserved but operationally useless for that request.',
        {type:'callout', text:'A GPU reservation is useful only when its typed attributes match the workload, time window, topology, quota, and owner.'},
        {type:'image', src:'https://upload.wikimedia.org/wikipedia/commons/9/9a/NetApp_ONTAP_AI.jpg', alt:'Rack display containing 100Gb network switches, NetApp storage, and NVIDIA DGX systems.', caption:'NetApp All-Flash FAS system with NVIDIA DGX, photo by Qdrddr, Wikimedia Commons, CC BY-SA 4.0/GFDL.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'AI teams reserve GPU capacity because accelerators are scarce, expensive, and hard to acquire at the exact moment a launch or training run needs them. Capacity assurance is different from a discount, because the workload needs usable hardware at a specific time and place.',
        'The orderbook exists to make that usability explicit. It records which capacity exists, who can use it, when it is held, why it is idle, and which request failed even though a high-level spreadsheet said capacity was available.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is a spreadsheet with columns for team, GPU type, count, start date, end date, and contract. Finance can reconcile the bill, and platform teams can see rough ownership.',
        'That works while capacity is abundant and jobs are flexible. It fails when a request needs a precise shape, such as 64 H100 GPUs in one zone with a high-bandwidth fabric and tenant eligibility for a customer launch.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is fungibility. Eighty reserved GPUs are not the same as eighty usable GPUs if thirty-two are in another zone, sixteen are reserved for another tenant, and eight are outside the launch window.',
        'A utilization percentage can also mislead. Ten percent idle reserved capacity may be waste, or it may be a deliberate disaster-recovery floor; the ledger has to record the behavior behind the number.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Model GPU reservations as an orderbook keyed by attributes that decide usability. The reservation key includes SKU, memory size, zone, topology, time interval, tenancy, quota scope, priority, owner, and release rule.',
        'The invariant is that a slot can be assigned only once for an overlapping interval and only to a request that satisfies its key. Every held slot needs a cost owner because idle reserved time still consumes money or opportunity.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A reservation row stores quantity, interval, capacity attributes, contract basis, allowed consumers, and release policy. The book indexes rows by the attributes that most often filter requests, such as SKU, zone, topology, and time.',
        'A launch request is normalized into the same key space. The matcher filters by quota, policy, tenant, interval overlap, topology, and priority, then returns hold, run, fallback, wait, or reject with an audit record.',
        'The audit record is part of the data structure. It stores requested attributes, matched attributes, rejected candidates, quota checks, fallback path, idle leakage, and cost owner so later reviews can distinguish shortage from bad matching.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Correctness is interval accounting plus attribute matching. If two requests overlap in time, the same slot cannot satisfy both; if a request needs zone A, a zone B slot is not a valid match even when the GPU model is identical.',
        'The audit trail makes the decision reproducible. Given the same book state, request, and policy, a reviewer can see why the system held, spilled, waited, or rejected instead of relying on informal capacity claims.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Reservations trade flexibility for assurance. A one-month hold for 128 H100s can protect a launch, but every unused GPU-hour becomes visible idle leakage that must be charged or justified.',
        'When the number of attributes doubles, naive scanning gets worse because more combinations must be tested. Practical books use indexes and buckets so matching usually touches candidate rows for the requested SKU, zone, topology, and interval instead of every contract row.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'This pattern fits AI clouds, internal accelerator platforms, customer-dedicated capacity, high-priority inference fleets, disaster-recovery floors, and long training runs. It is useful wherever a missed slot causes a launch failure or an expensive delay.',
        'It also connects platform and finance. The same ledger can explain spill to on-demand capacity, idle reserved hours, quota exceptions, failed launches with capacity present, and procurement gaps for future quarters.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'The orderbook fails when inventory attributes are stale or the scheduler ignores the book. A precise ledger does not help if humans still place jobs by chat message and runtime tooling does not enforce holds.',
        'It can be too heavy for small teams with abundant capacity and flexible workloads. If on-demand supply is cheap enough and delays are acceptable, a quota system plus budget alerts may be the better tool.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Suppose a launch needs 64 H100 GPUs in zone A from 13:00 to 17:00 with one high-bandwidth placement group. The book shows 80 reserved H100s, but 32 are in zone B, 16 are tenant-locked, and 8 start at 18:00.',
        'The usable count is 24, not 80. The matcher can hold 24, reject the remaining 40 as unmatched, and present concrete options: move traffic to zone B, delay the launch, spill to on-demand capacity, or reduce batch size.',
        'If the held 24 GPUs cost 4 dollars per GPU-hour and sit idle for the first two hours as launch insurance, the idle assurance cost is 24 x 2 x 4 = 192 dollars. The ledger shows whether that cost bought a real guarantee or hid a planning error.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary references are AWS EC2 Capacity Reservations at https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/ec2-capacity-reservations.html, Azure capacity reservation documentation at https://learn.microsoft.com/en-us/azure/virtual-machines/capacity-reservation-overview, and public AI infrastructure filings such as CoreWeave SEC reports. The stable concept is typed capacity, not any one cloud product name.',
        'Study interval scheduling, priority queues, bin packing, Kubernetes scheduler preemption, quota systems, SLO-aware request routing, and GPU topology placement next. Those topics explain how reserved capacity becomes actual runtime placement.',
      ],
    },
  ],
};
