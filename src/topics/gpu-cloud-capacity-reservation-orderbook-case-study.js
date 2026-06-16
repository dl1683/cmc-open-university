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
      heading: 'What it is',
      paragraphs: [
        'A GPU cloud capacity reservation orderbook treats scarce accelerator availability as a matching data structure. Instead of saying "we reserved GPUs," it stores exactly what was reserved: SKU, zone, memory size, network topology, start time, duration, tenancy, policy, owner, price basis, and release rule.',
        'This module builds on AI Capex Depreciation Utilization Ledger and LLM Unit Economics Ledger Case Study. The capex ledger explains the fixed-asset pressure. The orderbook explains how that capacity is sliced, matched, leaked, and billed.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The orderbook has bucketed keys for the attributes that make capacity usable. A request for one GPU generation in one zone cannot automatically consume another generation in a different zone. The matching layer uses priority queues for urgency, bins for SKU and placement, policy filters for tenant eligibility, and trace rows for explainability.',
        'The data structure resembles a scheduler, but the economic consequences are stronger. A missed match can delay a launch, force an expensive on-demand fallback, strand reserved capacity, or push a model to a slower topology that changes latency and cost.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Reserved capacity trades flexibility for assurance. It can protect a critical launch, disaster-recovery path, training run, or inference floor. It can also create idle leakage if demand slips, the wrong SKU was reserved, quota is misaligned, or the product cannot route enough useful work into the slot.',
        'The matching engine needs links to SLO-Aware LLM Request Router, LLM Serving Autoscaling Warm Pool, Kubernetes Scheduler PriorityQueue + Preemption, Feature Flag Control Plane, and GenAI Trace Token Cost Ledger Case Study. Capacity reservations are useful only when the runtime can consume them intentionally.',
      ],
    },
    {
      heading: 'Case studies and sources',
      paragraphs: [
        'AWS EC2 Capacity Reservations reserve compute capacity in a specific Availability Zone and distinguish immediate and future-dated reservations: https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/ec2-capacity-reservations.html. Microsoft Azure on-demand capacity reservation similarly reserves VM capacity by size, location, and quantity and distinguishes capacity guarantee from Reserved Instance discounts: https://learn.microsoft.com/en-us/azure/virtual-machines/capacity-reservation-overview.',
        'CoreWeave disclosures show the AI-cloud version of this pattern. Its S-1 describes committed contracts where customers reserve capacity over contract length on a take-or-pay basis: https://www.sec.gov/Archives/edgar/data/1769628/000119312525044231/d899798ds1.htm. Its FY25 10-K describes committed cloud capacity contracts and revenue recognition over contract periods: https://s205.q4cdn.com/133937190/files/doc_financials/2025/q4/CoreWeave-Inc-FY25-10-K-7.pdf.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'A platform team can use this orderbook to plan a model launch, reserve scarce GPUs before a traffic event, bind a customer contract to capacity, or decide whether idle slots should be released, repurposed, or filled with batch work. A finance team can use it to separate capacity assurance from discount commitments.',
        'The orderbook also helps engineering avoid false conclusions. If an incident says "capacity unavailable," the next question is unavailable where, for which SKU, under what tenant policy, and with what quota?',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'Do not treat a reservation as generic capacity. Wrong zone, wrong instance type, wrong topology, missing quota, or a tenant policy deny can make reserved capacity unusable for the workload that needs it. Do not treat a Reserved Instance discount as a capacity guarantee. The cloud docs explicitly separate discount instruments from capacity reservation instruments.',
        'Do not hide idle reserved hours. A good ledger charges them somewhere and records why they were held. Otherwise every product looks cheap while the platform absorbs the waste.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: AWS EC2 Capacity Reservations at https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/ec2-capacity-reservations.html, Azure on-demand capacity reservation at https://learn.microsoft.com/en-us/azure/virtual-machines/capacity-reservation-overview, CoreWeave S-1 at https://www.sec.gov/Archives/edgar/data/1769628/000119312525044231/d899798ds1.htm, and CoreWeave FY25 10-K at https://s205.q4cdn.com/133937190/files/doc_financials/2025/q4/CoreWeave-Inc-FY25-10-K-7.pdf. Study Queue, Binary Heap, Kubernetes Scheduler PriorityQueue + Preemption, SLO-Aware LLM Request Router, LLM Serving Autoscaling Warm Pool, AI Capex Depreciation Utilization Ledger, AI Circular Financing Demand Graph Case Study, Inference ROI Payback Cohort Ledger Case Study, and Tail Latency & p99 Thinking next.',
      ],
    },
  ],
};
