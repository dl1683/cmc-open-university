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
      heading: 'Why This Exists',
      paragraphs: [
        'GPU reservations exist because accelerator supply is scarce, expensive, and not fully fungible. A company can have a large contract and still fail a launch if the reserved capacity is in the wrong zone, on the wrong GPU generation, behind the wrong network topology, bound to a different tenant, outside the launch window, or blocked by quota.',
        'The orderbook makes those facts explicit. It treats reserved capacity as typed state that must be matched, held, metered, used, and released. This is not only a finance topic. It connects procurement, platform scheduling, customer commitments, inference routing, training windows, and idle-capacity leakage into one operational control problem.',
        {type:'callout', text:'A GPU reservation is useful only when its typed attributes match the workload, time window, topology, quota, and owner.'},
        {type:'image', src:'https://upload.wikimedia.org/wikipedia/commons/9/9a/NetApp_ONTAP_AI.jpg', alt:'Rack display containing 100Gb network switches, NetApp storage, and NVIDIA DGX systems.', caption:'NetApp All-Flash FAS system with NVIDIA DGX, photo by Qdrddr, Wikimedia Commons, CC BY-SA 4.0/GFDL.'},
      ],
    },
    {
      heading: 'Baseline Wall',
      paragraphs: [
        'The naive baseline is a spreadsheet that says one team owns 200 H100s, another owns 100 A100s, and finance tracks the contract dates. That breaks down as soon as a workload needs 64 GPUs in one availability zone with a specific interconnect and placement policy. The spreadsheet can say capacity exists while the scheduler has no legal slot to place the job.',
        'A single utilization percentage is also misleading. Ninety percent utilization can coexist with a failed launch if the remaining ten percent is in the wrong place. Ten percent utilization can be rational if the pool is a disaster-recovery floor or a customer guarantee. The wall is fungibility: capacity becomes useful only when its attributes match the workload.',
      ],
    },
    {
      heading: 'Core Insight',
      paragraphs: [
        'Model scarce GPU capacity as a typed orderbook. The key is not just GPU. It is SKU, accelerator generation, memory size, zone, region, network topology, placement group, tenancy, start time, duration, owner, quota scope, priority, and release policy. Matching then becomes scheduling with money attached.',
        'The invariant is simple: a reserved slot can be consumed only by a request whose attributes satisfy the reservation key, and every held slot must have a meter, owner, and release decision. If a slot is idle, that is still a billable state. It should be visible, charged, and explained.',
      ],
    },
    {
      heading: 'How the Visual Model Teaches It',
      paragraphs: [
        'The reservation-book view teaches that an ask is not matched against a single pool called GPUs. The request is keyed by type, checked against quota, compared with booked slots, priced, matched, then moved into run or idle state. The capacity plot separates reserved supply from actually used supply so the leakage becomes visible.',
        'The matching-engine view teaches that capacity placement is typed scheduling. The heap carries urgency. The bins carry SKU, zone, and topology availability. The fit node scores usable matches. The trace and audit nodes record why the system held a slot, spilled to fallback capacity, waited, or rejected the request.',
      ],
    },
    {
      heading: 'Mechanics',
      paragraphs: [
        'A reservation row stores the capacity attributes, quantity, time interval, contract basis, owner, allowed consumers, and release rule. The book indexes rows by attributes that determine usability. A launch request is normalized into the same key space, then filtered by quota, policy, time, topology, tenant eligibility, and placement constraints.',
        'The matching layer usually combines two structures. A priority queue orders urgent launches, renewals, incidents, customer guarantees, and batch work. Bucketed books hold capacity by SKU, zone, and topology so the system can find candidates without scanning every contract. The output is a hold, fallback, wait, or reject decision plus an audit row.',
      ],
    },
    {
      heading: 'Correctness',
      paragraphs: [
        'Correctness means the orderbook never spends the same capacity twice, never assigns a slot outside its time window, never violates tenant or quota policy, and never hides why a request missed. Quantity accounting must be interval-aware because a reservation for Monday morning does not help a Tuesday launch.',
        'The audit row should include requested attributes, matched attributes, policy filters, quota result, priority score, fallback path, idle leakage, and cost owner. That evidence lets finance, platform, and product teams distinguish a real supply shortage from a routing error, quota mistake, topology mismatch, or planning failure.',
      ],
    },
    {
      heading: 'Cost and Tradeoffs',
      paragraphs: [
        'Reservations trade flexibility for assurance. They are valuable for launch floors, customer commitments, regulated workloads, disaster recovery, long training jobs, and inference fleets that cannot tolerate interruption. The cost is idle leakage, planning overhead, and the risk of buying the wrong shape of capacity.',
        'The tradeoff improves when runtime systems can steer work. SLO-Aware LLM Request Router, LLM Serving Autoscaling Warm Pool, Kubernetes Scheduler PriorityQueue + Preemption, Feature Flag Control Plane, and GenAI Trace Token Cost Ledger Case Study are operational partners of the orderbook. Without routing and measurement, a reservation is an expensive guess.',
      ],
    },
    {
      heading: 'Reservation Instruments',
      paragraphs: [
        'Capacity reservations, reserved instances, committed-use discounts, take-or-pay contracts, and spot capacity are different instruments. A discount does not always guarantee capacity. A capacity hold does not always lower price. A take-or-pay commitment can bill even when the slot is idle. A spot pool can be cheap but interruptible.',
        'The orderbook should preserve those distinctions. Mixing every instrument into one reserved column hides the operational question: can this workload use this slot at this time under this policy? It also hides the economic question: who pays if the slot sits idle or spills to on-demand supply?',
      ],
    },
    {
      heading: 'Worked Example',
      paragraphs: [
        'Suppose a model launch needs 64 H100 GPUs with high-bandwidth interconnect in zone A for a four-hour launch window. The book has 80 H100s reserved, but 32 are in zone B, 16 are bound to another tenant, and 8 are outside the launch window. The matching engine can honestly report that only 24 slots fit, even though the spreadsheet says 80 are reserved.',
        'The system can then choose among concrete options: move launch traffic to zone B, reduce the launch batch size, spill part of the workload to on-demand capacity, delay batch jobs, or renegotiate a future reservation. The orderbook turns the vague claim that capacity exists into a small set of safe, auditable decisions.',
      ],
    },
    {
      heading: 'Where It Wins',
      paragraphs: [
        'This pattern wins when GPU scarcity is real, workloads are expensive to delay, and the organization needs to separate capacity assurance from discount accounting. It is especially useful for AI clouds, internal platform teams, customer-dedicated capacity, launch planning, disaster-recovery floors, and high-priority inference fleets.',
        'It also wins when several teams compete for the same scarce pool. The orderbook gives platform teams a shared language for customer commitments, quota exceptions, incident priority, idle leakage, and future procurement. It turns capacity fights into traceable matching decisions instead of calendar arguments.',
      ],
    },
    {
      heading: 'Where It Fails',
      paragraphs: [
        'It fails when the workload is truly fungible, the organization will not maintain accurate attributes, or the scheduler cannot consume the book. A perfect reservation ledger does not help if launch tooling ignores it and humans still place work by chat message.',
        'It can also become overfit bureaucracy for small teams. If capacity is abundant, workloads are flexible, and on-demand spend is acceptable, a simple quota plus budget alert may be enough. The orderbook earns its complexity only when wrong matches are expensive.',
      ],
    },
    {
      heading: 'Pitfalls',
      paragraphs: [
        'Do not treat a reservation as generic capacity. Wrong zone, wrong instance type, wrong topology, missing quota, or a tenant policy deny can make reserved capacity unusable for the workload that needs it. Do not treat a Reserved Instance discount as a capacity guarantee. Cloud documentation separates discount instruments from capacity reservation instruments for a reason.',
        'Do not hide idle reserved hours. A good ledger charges them somewhere and records why they were held. Otherwise every product looks cheap while the platform absorbs the waste. Also avoid silent spillover: if a reserved job falls back to on-demand supply, that event should be visible to both runtime owners and finance.',
      ],
    },
    {
      heading: 'Operational Guidance',
      paragraphs: [
        'Keep the key space boring and explicit. Normalize SKU names, zones, topology labels, tenant policy, time windows, and quota scopes before matching. Store both requested and matched attributes. Record when a slot is held for assurance rather than immediate use, because that distinction explains idle cost.',
        'Measure reservation fit rate, spill rate, idle reserved hours, failed launches with reserved supply present, cost per used reserved hour, cost per idle reserved hour, and time-to-match for critical jobs. Those metrics tell whether the organization has a true supply problem, a bad forecasting problem, or a scheduler that cannot consume what finance bought.',
      ],
    },
    {
      heading: 'Study Next',
      paragraphs: [
        'Primary sources: AWS EC2 Capacity Reservations at https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/ec2-capacity-reservations.html, Azure on-demand capacity reservation at https://learn.microsoft.com/en-us/azure/virtual-machines/capacity-reservation-overview, CoreWeave S-1 at https://www.sec.gov/Archives/edgar/data/1769628/000119312525044231/d899798ds1.htm, and CoreWeave FY25 10-K at https://s205.q4cdn.com/133937190/files/doc_financials/2025/q4/CoreWeave-Inc-FY25-10-K-7.pdf.',
        'Study Queue, Binary Heap, Interval Scheduling, Kubernetes Scheduler PriorityQueue + Preemption, SLO-Aware LLM Request Router, LLM Serving Autoscaling Warm Pool, AI Capex Depreciation Utilization Ledger, AI Circular Financing Demand Graph Case Study, Inference ROI Payback Cohort Ledger Case Study, and Tail Latency & p99 Thinking next.',
      ],
    },
  ],
};
