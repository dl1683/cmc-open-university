// Bulkheads: a ship survives a breach because the hull is compartmentalized
// — flooding stays in one chamber. A service survives a sick dependency the
// same way: give each dependency its OWN pool, and doom stops spreading.

import { matrixState, graphState, InputError } from '../core/state.js';

export const topic = {
  id: 'bulkheads',
  title: 'Bulkheads & Resource Isolation',
  category: 'Systems',
  summary: 'One shared thread pool = shared doom. Compartmentalize per dependency and a sick service drowns alone.',
  controls: [
    { id: 'view', label: 'Seal', type: 'select', options: ['one pool, shared doom', 'compartments, sized by math'], defaultValue: 'one pool, shared doom' },
  ],
  run,
};

function* sharedDoom() {
  const nodes = [
    { id: 'pool', label: 'SERVICE B — one pool, 200 threads', x: 4.5, y: 3.5, note: 'serves ALL three dependencies' },
    { id: 'pay', label: 'payments', x: 8.7, y: 5.8, note: 'healthy, 30ms' },
    { id: 'search', label: 'search', x: 8.7, y: 3.5, note: 'healthy, 50ms' },
    { id: 'recs', label: 'recommendations', x: 8.7, y: 1.2, note: 'SICK: 30s hangs' },
  ];
  const edges = [
    { id: 'ep', from: 'pool', to: 'pay' },
    { id: 'es', from: 'pool', to: 'search' },
    { id: 'er', from: 'pool', to: 'recs' },
  ];
  const depNodes = nodes.slice(1);
  const poolSize = 200;
  const sickRate = 20;
  const hangTime = 30;
  yield {
    state: graphState({ nodes, edges }),
    highlight: { removed: [nodes[3].id, edges[2].id], active: [nodes[0].id] },
    explanation: `The shared pool is the bug. ${depNodes.map(n => n.label).join(', ')} all borrow from the same ${poolSize} threads. When ${nodes[3].label} starts hanging for ${hangTime} seconds, each recommendation call holds one of those threads. At ${sickRate} calls per second, demand for held threads quickly exceeds the whole pool. The decorative dependency can now starve the critical path because there is no wall between them.`,
    invariant: `A shared pool makes every dependency a creditor on the same account: one default bankrupts all ${depNodes.length} consumers.`,
  };

  const casualtyRows = [
    { id: 'recs', label: 'recommendations (the sick one)' },
    { id: 'pay', label: 'payments (perfectly healthy)' },
    { id: 'search', label: 'search (perfectly healthy)' },
  ];
  const casualtyCols = [{ id: 'threads', label: 'threads held' }, { id: 'status', label: 'user-visible status' }];
  const casualtyVals = [[poolSize, 1], [0, 2], [0, 2]];
  const casualtyTitle = 'Ten seconds later: who actually died?';
  yield {
    state: matrixState({
      title: casualtyTitle,
      rows: casualtyRows,
      columns: casualtyCols,
      values: casualtyVals,
      format: (v) => (v === 1 ? 'degraded — expected' : v === 2 ? 'DOWN — collateral damage âš ' : `${v}/${poolSize}`),
    }),
    highlight: { removed: [`${casualtyRows[1].id}:${casualtyCols[1].id}`, `${casualtyRows[2].id}:${casualtyCols[1].id}`], compare: [`${casualtyRows[0].id}:${casualtyCols[0].id}`] },
    explanation: `The casualty report is the point of the pattern. ${casualtyRows[0].label} is sick, but ${casualtyRows[1].id} and ${casualtyRows[2].id} are healthy. In a shared pool, healthy work still cannot get a worker because sick work is holding all ${casualtyVals[0][0]} of them. A survivable feature outage becomes a site outage. Bulkheads exist to make "what failed?" match "what users lost."`,
  };

  const drownRows = [
    { id: 's0', label: 't = 0s' },
    { id: 's2', label: 't = 2s' },
    { id: 's5', label: 't = 5s' },
    { id: 's10', label: 't = 10s' },
  ];
  const drownCols = [{ id: 'held', label: 'threads held by recs' }, { id: 'free', label: 'free for everyone else' }];
  const drownVals = [[0, poolSize], [40, 160], [100, 100], [poolSize, 0]];
  const drownTitle = `The drowning, second by second (${sickRate} sick calls/s, ${hangTime}s holds)`;
  yield {
    state: matrixState({
      title: drownTitle,
      rows: drownRows,
      columns: drownCols,
      values: drownVals,
      format: (v) => String(v),
    }),
    highlight: { removed: [`${drownRows[3].id}:${drownCols[1].id}`], compare: [`${drownRows[0].id}:${drownCols[1].id}`] },
    explanation: `The stopwatch makes the failure mechanical. If ${sickRate} calls per second enter a dependency and none return for ${hangTime} seconds, the held-thread count climbs by ${drownVals[1][0]} every second. More threads only delays the empty-pool moment; it does not change the slope. Because the threads are waiting, not computing, faster CPUs do not help. You need containment, fast failure, or both.`,
    invariant: `Held threads grow at ${drownVals[1][0]} per second until holds release or the pool empties at ${drownVals[3][0]} — whichever comes first.`,
  };
}

function* compartments() {
  const compRows = [
    { id: 'pay', label: 'payments pool' },
    { id: 'search', label: 'search pool' },
    { id: 'recs', label: 'recommendations pool' },
  ];
  const compCols = [{ id: 'size', label: 'pool size' }, { id: 'sick', label: 'when recs sickens…' }];
  const compVals = [[80, 1], [80, 1], [40, 2]];
  const totalThreads = compVals.reduce((sum, row) => sum + row[0], 0);
  const compTitle = `The same ${totalThreads} threads, bulkheaded per dependency`;
  yield {
    state: matrixState({
      title: compTitle,
      rows: compRows,
      columns: compCols,
      values: compVals,
      format: (v) => (v === 1 ? 'untouched — full speed' : v === 2 ? `saturates at ${compVals[2][0]}, fails fast` : `${v} threads`),
    }),
    highlight: { found: [`${compRows[0].id}:${compCols[1].id}`, `${compRows[1].id}:${compCols[1].id}`], removed: [`${compRows[2].id}:${compCols[1].id}`] },
    explanation: `Now the same ${totalThreads} threads are divided by dependency. ${compRows[2].label} can fill its ${compVals[2][0]}-thread compartment, but it cannot borrow the ${compVals[0][0]} reserved for ${compRows[0].id} or the ${compVals[1][0]} reserved for ${compRows[1].id}. The blast radius is no longer discovered during the outage; it is configured ahead of time. A full compartment should fail fast or trigger a breaker, not spill into neighbors.`,
    invariant: `A bulkhead converts "how bad can it get?" from a discovery into a configuration: blast radius = ${compCols[0].label}.`,
  };

  const lawRows = [
    { id: 'law', label: 'the law' },
    { id: 'pay', label: 'payments: 200 rps × 0.05s' },
    { id: 'search', label: 'search: 300 rps × 0.08s' },
    { id: 'recs', label: 'recs: 20 rps × 0.4s (p99!)' },
  ];
  const lawCols = [{ id: 'calc', label: '' }];
  const lawVals = [[1], [2], [3], [4]];
  const lawFormatEntries = ['', 'threads needed ≈ arrival rate × time held (L = λ·W)', '= 10 busy threads → pool of 80 covers spikes', '= 24 busy → 80 gives 3× headroom', '= 8 busy at p99 → 40 caps the worst case'];
  yield {
    state: matrixState({
      title: 'Sizing the compartments: Little\'s Law does the math',
      rows: lawRows,
      columns: lawCols,
      values: lawVals,
      format: (v) => lawFormatEntries[v],
    }),
    highlight: { active: [`${lawRows[0].id}:${lawCols[0].id}`] },
    explanation: `Sizing is not guesswork. Little's Law says concurrency demand is roughly arrival rate times time held. ${lawRows[1].label} needs about 10 busy threads on average, then you add headroom. Use tail latency for the hold time, not only the mean, because the compartment matters most during bad days. Too small rejects normal traffic; too large lets one dependency consume the shared budget again.`,
    invariant: `L = λ·W: pool demand equals arrival rate times hold time — size compartments against the p99 W, as shown for ${lawRows.length - 1} dependencies.`,
  };

  const realRows = [
    { id: 'conn', label: 'database connection pools' },
    { id: 'sema', label: 'semaphores / async limits' },
    { id: 'cgroup', label: 'containers & cgroups' },
    { id: 'cluster', label: 'cell-based architecture' },
  ];
  const realCols = [{ id: 'how', label: 'the compartment' }];
  const realVals = [[1], [2], [3], [4]];
  const realFormatEntries = ['', 'per-service connection caps — one chatty app can\'t starve the DB', 'max concurrent calls per dependency, no threads needed', 'CPU/memory limits per container — a leak stays in its box', 'whole user-shards isolated: an outage hits one cell, not all'];
  yield {
    state: matrixState({
      title: 'Bulkheads you already run (maybe without the name)',
      rows: realRows,
      columns: realCols,
      values: realVals,
      format: (v) => realFormatEntries[v],
    }),
    highlight: { compare: [`${realRows[0].id}:${realCols[0].id}`, `${realRows[2].id}:${realCols[0].id}`] },
    explanation: `Bulkheads are not only thread pools. ${realRows.map(r => r.label).join(', ')} all do the same job: reserve a bounded resource for one class of work so another class cannot consume it all. At architecture scale, a ${realRows[3].label} is a bulkhead for users rather than threads.`,
  };

  const pairRows = [
    { id: 'bulk', label: 'bulkhead' },
    { id: 'breaker', label: 'circuit breaker' },
    { id: 'together', label: 'in concert' },
  ];
  const pairCols = [{ id: 'role', label: 'role' }];
  const pairVals = [[1], [2], [3]];
  const pairFormatEntries = ['', 'CONTAINS instantly: caps the blast radius before anything reacts', 'RECOVERS adaptively: sheds load from the sick, probes it back to health', 'compartment floods → calls fail fast → breaker trips → silence heals → probe → reopen'];
  yield {
    state: matrixState({
      title: 'The pair that works the incident together',
      rows: pairRows,
      columns: pairCols,
      values: pairVals,
      format: (v) => pairFormatEntries[v],
    }),
    highlight: { compare: [`${pairRows[0].id}:${pairCols[0].id}`, `${pairRows[1].id}:${pairCols[0].id}`], found: [`${pairRows[2].id}:${pairCols[0].id}`] },
    explanation: `${pairRows[0].label} and ${pairRows[1].label} solve different phases. The ${pairRows[0].label} is structural containment: it caps the worst case before any detector reacts. The ${pairRows[1].label} is adaptive recovery: it notices failures, removes load, and probes for health. ${pairRows[2].label}, a compartment fills, calls fail fast, the breaker opens, the dependency gets quiet, and a probe reintroduces traffic carefully.`,
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'one pool, shared doom') yield* sharedDoom();
  else if (view === 'compartments, sized by math') yield* compartments();
  else throw new InputError('Pick a view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'The animation has two views. "One pool, shared doom" shows a service with a single thread pool serving three dependencies. When the recommendations dependency starts hanging, watch the held-thread count climb until payments and search -- both healthy -- starve. Active highlights mark the resource under pressure. Removed highlights mark the collateral damage.',
        {
          type: 'callout',
          text: 'A bulkhead turns failure scope from an outage surprise into a resource boundary chosen before the incident.',
        },
        '"Compartments, sized by math" shows the same 200 threads divided into per-dependency pools. When recommendations sickens, its compartment fills and fails fast. Found highlights on the payments and search rows prove they keep full capacity. The matrix view traces the numbers second by second so you can verify the math yourself.',
        'At each frame, check three things: which compartment is saturating, whether the boundary held, and what the user-visible effect would be. If the boundary held, the outage shape matches the dependency shape. If it did not, the pool design is the bug.',
      
        {type: 'image', src: './assets/gifs/bulkheads.gif', alt: 'Animated walkthrough of the bulkheads visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        {
          type: 'quote',
          text: 'The Bulkhead pattern partitions a system so that a failure in one partition does not cascade into the others. The goal is damage containment. Without bulkheads, a shared resource pool lets one slow dependency drown every consumer of the pool.',
          attribution: 'Michael T. Nygard, Release It! (2007, 2nd ed. 2018)',
        },
        'The name comes from shipbuilding. A hull is divided into watertight compartments so one breach floods one chamber, not the whole vessel. In software, the compartments are thread pools, semaphores, connection pools, memory limits, or tenant cells. The invariant is the same: one failure consumes only the resources assigned to it.',
        {
          type: 'image',
          src: 'https://mermaid.ink/svg/pako:dcxBCsIwEEDRfU4xF0iP4MKKK8HauAtZTNMpDUxnJImW3l6wG0Hcfh5_Yl3jjLnCpTdHfxWCwrrCSA-SkSRuAaw9QOt7irosJCPWpFLgocowPZmDaT_k5M-YGDLFAhOWGkznO9wWkrrr_XTzriZmwBcmxoEpGOcdYY7zl7r_qhZsAxFFtMKgOesKjYXuT3dv',
          alt: 'A saturated recommendations pool cannot borrow from payments or search pools.',
          caption: 'Per-dependency pools make saturation local: the sick compartment fills, while neighboring pools remain usable. Source: https://mermaid.ink/svg/pako:dcxBCsIwEEDRfU4xF0iP4MKKK8HauAtZTNMpDUxnJImW3l6wG0Hcfh5_Yl3jjLnCpTdHfxWCwrrCSA-SkSRuAaw9QOt7irosJCPWpFLgocowPZmDaT_k5M-YGDLFAhOWGkznO9wWkrrr_XTzriZmwBcmxoEpGOcdYY7zl7r_qhZsAxFFtMKgOesKjYXuT3dv',
        },
        'Healthy work dies when it shares a resource pool with sick work. A recommendations service hanging for 30 seconds holds threads that payments needs. Payments is fast, its dependency is healthy, but it cannot get a worker because recommendations is holding all of them. A survivable feature outage becomes a total site outage. Bulkheads exist to make "what failed" match "what users lost."',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious design is one large shared pool. All outbound calls draw from the same workers because that maximizes average utilization. If payments is quiet, search gets more threads. If search is quiet, recommendations gets more. Dashboards show one healthy pool with spare capacity, and the design looks efficient.',
        'The problem is that average utilization is the wrong metric during a failure. A dependency does not need high CPU to drain a shared pool. It only needs to hold resources while calls wait. Twenty calls per second into a 30-second hang means 20 more threads held every second. At t=10s, the 200-thread pool is empty. More threads only delays the moment; it does not create a boundary between critical and optional work.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is that shared capacity creates shared fate. If two classes of work can spend the same scarce resource, the failure domain of each includes the other. No amount of monitoring, alerting, or fast CPUs changes the math: held threads grow at the arrival rate per second until holds release or the pool empties.',
        'The failure is mechanical, not probabilistic. At 20 rps into a 30s hang, 200 threads last exactly 10 seconds. Faster hardware does not help because the threads are waiting, not computing. More threads only buys time. The only fix is a boundary that prevents one class of work from reaching into another class\'s allocation.',
        'This is why the pattern is structural, not reactive. A circuit breaker notices failures after they happen. A bulkhead prevents the blast radius from growing before any detector fires. You need both, but without the bulkhead, the breaker is racing a flood.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Pick the resource that can be exhausted -- threads, connections, memory, queue slots -- and split it by dependency, tenant, priority, or workload class. Each partition gets a bounded allocation and a policy for what happens when the bound is reached: fail fast, return a fallback, shed low-priority work, or trip a circuit breaker.',
        {
          type: 'diagram',
          text: [
            '                    +--- [ payments pool: 80 threads ] ---> payments API',
            '                    |',
            'Service B ----+--- [ search pool: 80 threads ] ------> search API',
            '                    |',
            '                    +--- [ recs pool: 40 threads ] --------> recommendations API',
            '                                                              (SICK: 30s hangs)',
            '',
            'When recs saturates its 40-thread compartment, it CANNOT borrow',
            'from the 80 reserved for payments or the 80 reserved for search.',
            'Blast radius = compartment size, configured before the incident.',
          ].join('\n'),
          label: 'Thread pool isolation per downstream dependency',
        },
        'In synchronous systems, the compartment is typically a dedicated thread pool per downstream. In async systems, a semaphore limiting concurrent in-flight calls achieves the same isolation without dedicating OS threads. For databases, per-service connection pools prevent one chatty application from starving others.',
        {
          type: 'code',
          language: 'javascript',
          text: [
            '// Semaphore-based bulkhead: no thread pool needed, works with async I/O',
            'class Bulkhead {',
            '  constructor(name, maxConcurrent) {',
            '    this.name = name;',
            '    this.max = maxConcurrent;',
            '    this.active = 0;',
            '  }',
            '',
            '  async run(fn) {',
            '    if (this.active >= this.max) {',
            '      throw new Error(`Bulkhead "${this.name}" full: ${this.active}/${this.max}`);',
            '    }',
            '    this.active++;',
            '    try {',
            '      return await fn();',
            '    } finally {',
            '      this.active--;',
            '    }',
            '  }',
            '}',
            '',
            '// One bulkhead per dependency -- they cannot borrow from each other',
            'const paymentsBulkhead = new Bulkhead("payments", 80);',
            'const searchBulkhead   = new Bulkhead("search", 80);',
            'const recsBulkhead     = new Bulkhead("recs", 40);',
            '',
            '// Usage: recs filling its 40 permits does not affect payments',
            'const result = await paymentsBulkhead.run(() => fetch(paymentUrl));',
          ].join('\n'),
        },
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The invariant is simple: each compartment\'s in-flight count is bounded by its configured maximum. Because compartments do not share permits, one dependency at maximum cannot reduce another dependency\'s available permits. The blast radius of any single failure is at most the compartment size, which is a configuration parameter rather than a runtime discovery.',
        'Sizing uses Little\'s Law: average concurrency L equals arrival rate lambda times average hold time W. Payments at 200 rps with 50ms calls needs about 10 busy threads on average. A pool of 80 gives 8x headroom for bursts and tail latency. Use p99 hold time, not the mean, because the compartment matters most during bad minutes. Too small rejects healthy traffic; too large reintroduces shared fate by letting one dependency consume the global budget.',
        'The correctness argument is a conservation property. The total thread budget is fixed at 200. Partitioning redistributes those 200 threads into non-overlapping subsets. No operation can increase the total, and no dependency can access a subset not assigned to it. The wall between compartments is enforced by the semaphore or pool implementation, not by good behavior from the downstream.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The runtime cost of a bulkhead check is O(1): increment a counter, compare to a limit, decrement on completion. The real cost is allocation fragmentation. Idle capacity in one compartment cannot be used by another. If every feature has a tiny private pool, the system wastes resources and rejects traffic that a shared pool could have served. If every compartment is too large, isolation becomes cosmetic.',
        {
          type: 'table',
          headers: ['Pattern', 'What it does', 'When it acts', 'Failure mode if missing'],
          rows: [
            ['Bulkhead', 'Caps resource consumption per dependency', 'Immediately -- structural', 'Shared pool drained by one sick dependency'],
            ['Circuit breaker', 'Stops calling a dependency after repeated failures', 'After failure threshold -- adaptive', 'Retries hammer a sick dependency indefinitely'],
            ['Retry with backoff', 'Re-attempts a failed call with increasing delay', 'After individual failure -- per-call', 'Amplifies load during outages without a cap'],
          ],
        },
        'Bulkheads add configuration and observability burden. You need per-compartment metrics: in-flight count, max permits, rejection rate, timeout rate, and downstream latency. A single service-level saturation metric hides the point. The whole value is that different compartments can be healthy, full, or failing at the same time.',
        {
          type: 'note',
          text: 'Netflix Hystrix (now in maintenance) popularized thread-pool-based bulkheads in Java. Resilience4j replaced it with semaphore-based bulkheads by default, avoiding the overhead of dedicated thread pools while preserving the isolation invariant. Both enforce the same contract: a bounded permit count per dependency with fail-fast rejection when full.',
        },
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'Bulkheads win whenever one class of work is less important, less reliable, or more bursty than the work beside it. Recommendations beside checkout, analytics beside login, batch jobs beside interactive queries, tenant workloads sharing a database, plugins inside a host service, and external API calls beside core product logic are all natural fits.',
        'The idea scales upward through every layer of the stack. Database connection pools isolate per-service clients. Kubernetes memory and CPU limits isolate containers. Rate limits isolate tenants. Cell-based architecture isolates entire user populations so one cell can degrade without taking the whole product down. The resource unit changes from thread to connection to container to region, but the invariant stays the same: a bounded compartment with a configured blast radius.',
        'Bulkheads pair naturally with circuit breakers. The bulkhead is structural containment: it caps damage before any detector fires. The breaker is adaptive recovery: it notices failures, opens the circuit, and probes for health. Together, a compartment fills, calls fail fast, the breaker opens, the dependency gets quiet, and a probe carefully reintroduces traffic.',
        {
          type: 'image',
          src: 'https://mermaid.ink/svg/pako:HckxDsMgDADAnVf4A_lCpQbSqUPVFTG4yBQkB1LsCOX3lVjvErcRM3aF59vcvW37gV13qgqpMEuAZbnB6i0yCyQsDAlFg1lnWG9Lj2dRaAdVCcZOdt61UUU74Q5fUoHfWUiDcbM3_-rtQ6AdUyoxmG3yw1tuQjAyVciErPkKfw',
          alt: 'Sequence from filled compartment to fail-fast calls, open circuit, quiet downstream, probe traffic, and recovery.',
          caption: 'Bulkheads cap the damage first; breakers then reduce load and probe the dependency back into service. Source: https://mermaid.ink/svg/pako:HckxDsMgDADAnVf4A_lCpQbSqUPVFTG4yBQkB1LsCOX3lVjvErcRM3aF59vcvW37gV13qgqpMEuAZbnB6i0yCyQsDAlFg1lnWG9Lj2dRaAdVCcZOdt61UUU74Q5fUoHfWUiDcbM3_-rtQ6AdUyoxmG3yw1tuQjAyVciErPkKfw',
        },
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'The most common mistake is hiding an unbounded queue behind the bulkhead. The semaphore rejects new work, but a queue in front of it accepts requests and holds them. That preserves admission for a while but creates doomed work, long waits, and memory pressure. A bulkhead with an infinite queue is not a bulkhead; it has moved the outage into tail latency.',
        'Retrying aggressively into a full compartment is equally dangerous. Each retry consumes a permit slot the moment one opens, so the compartment stays full even after the downstream recovers. Retries multiply load exactly when the dependency is weakest.',
        'Static limits drift. Traffic mix changes, latency distributions shift, and feature priorities evolve. A compartment sized from last quarter\'s p99 may reject normal traffic today. Bulkheads need periodic review against live data: in-flight counts, queue depth, rejection rate, and downstream latency histograms. Adaptive bulkheads (like Netflix\'s concurrency-limit library) adjust permits dynamically based on measured latency, but they trade deterministic blast radius for throughput efficiency.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        {
          type: 'bullets',
          items: [
            'Michael T. Nygard, Release It! Design and Deploy Production-Ready Software (2007, 2nd ed. 2018) -- the canonical source for bulkheads, circuit breakers, and stability patterns in production systems.',
            'Netflix Hystrix wiki, "How It Works" (github.com/Netflix/Hystrix) -- thread-pool and semaphore isolation in practice, with detailed rationale for per-dependency pools.',
            'Resilience4j documentation, "Bulkhead" module (resilience4j.readme.io) -- the modern Java replacement for Hystrix, semaphore-based by default.',
            'Netflix concurrency-limits library (github.com/Netflix/concurrency-limits) -- adaptive bulkheads that adjust permits based on measured latency using TCP congestion control algorithms (Vegas, Gradient).',
          ],
        },
        {
          type: 'bullets',
          items: [
            'Prerequisite: Semaphore Permit Counter -- the primitive that enforces the concurrency bound.',
            'Extension: Circuit Breakers and Deadlines -- adaptive recovery after containment.',
            'Deeper: Tail Latency and p99 Thinking -- why sizing against the mean is insufficient.',
            'Broader: Cell-Based Architecture -- bulkheads at user-population scale.',
            'Complementary: Backpressure and Flow Control -- how pressure propagates when compartments fill.',
          ],
        },
      ],
    },
  ],
};
