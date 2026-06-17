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
  yield {
    state: graphState({
      nodes: [
        { id: 'pool', label: 'SERVICE B — one pool, 200 threads', x: 4.5, y: 3.5, note: 'serves ALL three dependencies' },
        { id: 'pay', label: 'payments', x: 8.7, y: 5.8, note: 'healthy, 30ms' },
        { id: 'search', label: 'search', x: 8.7, y: 3.5, note: 'healthy, 50ms' },
        { id: 'recs', label: 'recommendations', x: 8.7, y: 1.2, note: 'SICK: 30s hangs' },
      ],
      edges: [
        { id: 'ep', from: 'pool', to: 'pay' },
        { id: 'es', from: 'pool', to: 'search' },
        { id: 'er', from: 'pool', to: 'recs' },
      ],
    }),
    highlight: { removed: ['recs', 'er'], active: ['pool'] },
    explanation: 'The shared pool is the bug. Payments, search, and recommendations all borrow from the same 200 threads. When recommendations starts hanging for 30 seconds, each recommendation call holds one of those threads. At 20 calls per second, demand for held threads quickly exceeds the whole pool. The decorative dependency can now starve the critical path because there is no wall between them.',
    invariant: 'A shared pool makes every dependency a creditor on the same account: one default bankrupts all.',
  };

  yield {
    state: matrixState({
      title: 'Ten seconds later: who actually died?',
      rows: [
        { id: 'recs', label: 'recommendations (the sick one)' },
        { id: 'pay', label: 'payments (perfectly healthy)' },
        { id: 'search', label: 'search (perfectly healthy)' },
      ],
      columns: [{ id: 'threads', label: 'threads held' }, { id: 'status', label: 'user-visible status' }],
      values: [[200, 1], [0, 2], [0, 2]],
      format: (v) => (v === 1 ? 'degraded — expected' : v === 2 ? 'DOWN — collateral damage ⚠' : `${v}/200`),
    }),
    highlight: { removed: ['pay:status', 'search:status'], compare: ['recs:threads'] },
    explanation: 'The casualty report is the point of the pattern. Recommendations is sick, but payments and search are healthy. In a shared pool, healthy work still cannot get a worker because sick work is holding all of them. A survivable feature outage becomes a site outage. Bulkheads exist to make "what failed?" match "what users lost."',
  };

  yield {
    state: matrixState({
      title: 'The drowning, second by second (20 sick calls/s, 30s holds)',
      rows: [
        { id: 's0', label: 't = 0s' },
        { id: 's2', label: 't = 2s' },
        { id: 's5', label: 't = 5s' },
        { id: 's10', label: 't = 10s' },
      ],
      columns: [{ id: 'held', label: 'threads held by recs' }, { id: 'free', label: 'free for everyone else' }],
      values: [[0, 200], [40, 160], [100, 100], [200, 0]],
      format: (v) => String(v),
    }),
    highlight: { removed: ['s10:free'], compare: ['s0:free'] },
    explanation: 'The stopwatch makes the failure mechanical. If 20 calls per second enter a dependency and none return for 30 seconds, the held-thread count climbs by 20 every second. More threads only delays the empty-pool moment; it does not change the slope. Because the threads are waiting, not computing, faster CPUs do not help. You need containment, fast failure, or both.',
    invariant: 'Held threads grow at (arrival rate) per second until holds release or the pool empties — whichever comes first.',
  };
}

function* compartments() {
  yield {
    state: matrixState({
      title: 'The same 200 threads, bulkheaded per dependency',
      rows: [
        { id: 'pay', label: 'payments pool' },
        { id: 'search', label: 'search pool' },
        { id: 'recs', label: 'recommendations pool' },
      ],
      columns: [{ id: 'size', label: 'pool size' }, { id: 'sick', label: 'when recs sickens…' }],
      values: [[80, 1], [80, 1], [40, 2]],
      format: (v) => (v === 1 ? 'untouched — full speed' : v === 2 ? 'saturates at 40, fails fast' : `${v} threads`),
    }),
    highlight: { found: ['pay:sick', 'search:sick'], removed: ['recs:sick'] },
    explanation: 'Now the same 200 threads are divided by dependency. Recommendations can fill its 40-thread compartment, but it cannot borrow the 80 reserved for payments or the 80 reserved for search. The blast radius is no longer discovered during the outage; it is configured ahead of time. A full compartment should fail fast or trigger a breaker, not spill into neighbors.',
    invariant: 'A bulkhead converts "how bad can it get?" from a discovery into a configuration: blast radius = pool size.',
  };

  yield {
    state: matrixState({
      title: 'Sizing the compartments: Little\'s Law does the math',
      rows: [
        { id: 'law', label: 'the law' },
        { id: 'pay', label: 'payments: 200 rps × 0.05s' },
        { id: 'search', label: 'search: 300 rps × 0.08s' },
        { id: 'recs', label: 'recs: 20 rps × 0.4s (p99!)' },
      ],
      columns: [{ id: 'calc', label: '' }],
      values: [[1], [2], [3], [4]],
      format: (v) => ['', 'threads needed ≈ arrival rate × time held (L = λ·W)', '= 10 busy threads → pool of 80 covers spikes', '= 24 busy → 80 gives 3× headroom', '= 8 busy at p99 → 40 caps the worst case'][v],
    }),
    highlight: { active: ['law:calc'] },
    explanation: 'Sizing is not guesswork. Little\'s Law says concurrency demand is roughly arrival rate times time held. Payments at 200 rps and 50ms needs about 10 busy threads on average, then you add headroom. Use tail latency for the hold time, not only the mean, because the compartment matters most during bad days. Too small rejects normal traffic; too large lets one dependency consume the shared budget again.',
    invariant: 'L = λ·W: pool demand equals arrival rate times hold time — size compartments against the p99 W.',
  };

  yield {
    state: matrixState({
      title: 'Bulkheads you already run (maybe without the name)',
      rows: [
        { id: 'conn', label: 'database connection pools' },
        { id: 'sema', label: 'semaphores / async limits' },
        { id: 'cgroup', label: 'containers & cgroups' },
        { id: 'cluster', label: 'cell-based architecture' },
      ],
      columns: [{ id: 'how', label: 'the compartment' }],
      values: [[1], [2], [3], [4]],
      format: (v) => ['', 'per-service connection caps — one chatty app can\'t starve the DB', 'max concurrent calls per dependency, no threads needed', 'CPU/memory limits per container — a leak stays in its box', 'whole user-shards isolated: an outage hits one cell, not all'][v],
    }),
    highlight: { compare: ['conn:how', 'cgroup:how'] },
    explanation: 'Bulkheads are not only thread pools. A database connection cap, semaphore, queue limit, Kubernetes memory limit, API quota, and cell-based architecture all do the same job: reserve a bounded resource for one class of work so another class cannot consume it all. At architecture scale, a cell is a bulkhead for users rather than threads.',
  };

  yield {
    state: matrixState({
      title: 'The pair that works the incident together',
      rows: [
        { id: 'bulk', label: 'bulkhead' },
        { id: 'breaker', label: 'circuit breaker' },
        { id: 'together', label: 'in concert' },
      ],
      columns: [{ id: 'role', label: 'role' }],
      values: [[1], [2], [3]],
      format: (v) => ['', 'CONTAINS instantly: caps the blast radius before anything reacts', 'RECOVERS adaptively: sheds load from the sick, probes it back to health', 'compartment floods → calls fail fast → breaker trips → silence heals → probe → reopen'][v],
    }),
    highlight: { compare: ['bulk:role', 'breaker:role'], found: ['together:role'] },
    explanation: 'Bulkheads and breakers solve different phases. The bulkhead is structural containment: it caps the worst case before any detector reacts. The breaker is adaptive recovery: it notices failures, removes load, and probes for health. Together, a compartment fills, calls fail fast, the breaker opens, the dependency gets quiet, and a probe reintroduces traffic carefully.',
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
      heading: `Why this exists`,
      paragraphs: [
        `A bulkhead is resource isolation. The name comes from ships: watertight compartments keep one breach from flooding the whole hull. In software, the compartments are thread pools, async semaphores, database connection pools, queues, CPU and memory limits, tenant cells, or API quotas. The purpose is the same: one failure should consume only the resources assigned to it.`,
        `This exists because healthy work can die while waiting behind unhealthy work. A recommendation service can hang for thirty seconds, hold every shared worker, and make payments fail even though payments is fast and its dependency is healthy. Bulkheads make the outage shape match the dependency shape. If recommendations is broken, recommendations should degrade; checkout should not lose its reserved capacity just because both features used the same pool.`,
      ],
    },
    {
      heading: `The obvious solution`,
      paragraphs: [
        `The obvious design is one large shared pool. All outbound calls use the same workers because that maximizes average utilization. If payments is quiet, search can use more threads. If search is quiet, recommendations can use more. During normal traffic this looks efficient, and simple dashboards may show one healthy pool with spare capacity.`,
        `The design fails during slow failures. A dependency does not need high CPU to take down the pool. It only needs to hold resources while calls wait. If recommendations receives twenty calls per second and each hangs for thirty seconds, the number of held workers rises by twenty every second until the shared pool is empty. More threads only delays the moment. It does not create a boundary between critical and optional work.`,
      ],
    },
    {
      heading: `Core insight`,
      paragraphs: [
        `The core insight is that capacity is a fault boundary, not only a performance budget. If two classes of work can spend the same scarce resource, they share fate. If each class has a separate bound, the maximum damage is configured before the incident starts.`,
        `A bulkhead is therefore a promise about blast radius. Recommendations may fill its forty-worker compartment, but it cannot borrow the eighty workers reserved for payments. A batch tenant may consume its own queue, but it cannot take every database connection from interactive traffic. A leaking container may hit its memory limit, but it should not evict the whole host. The boundary changes the failure from unbounded spread to known degradation.`,
      ],
    },
    {
      heading: `How it works`,
      paragraphs: [
        `Pick the resource that can be exhausted, then split it by dependency, tenant, priority, or workload class. In synchronous systems that may be a thread pool per downstream. In async systems it may be a semaphore that allows only N in-flight calls to one dependency. For databases it may be a per-service connection pool. For platforms it may be a cell or shard that isolates a user population.`,
        `The boundary must have a behavior when full. Usually that behavior is fail fast, return a fallback, shed low-priority work, or trip a circuit breaker. A bulkhead with an infinite queue is not a bulkhead; it has only moved the outage into tail latency and memory. The point is to stop work from crossing the boundary when the compartment is saturated.`,
      ],
    },
    {
      heading: `Sizing by math`,
      paragraphs: [
        `Sizing is not pure guesswork. Little's Law says average concurrency is arrival rate times time held. If payments receives 200 requests per second and each downstream call holds a worker for 50 milliseconds, the average busy count is about 10. You then add headroom for bursts, tail latency, retries, and safety margin.`,
        `Use tail hold time for failure-sensitive sizing. Mean latency describes a normal minute, but p95 or p99 latency fills compartments during bad minutes. A recommendations call that normally takes 100 milliseconds but sometimes hangs for 30 seconds needs a small, explicit cap. Too small rejects healthy work. Too large quietly reintroduces shared fate by letting a weak dependency consume the global budget.`,
      ],
    },
    {
      heading: `What the visual proves`,
      paragraphs: [
        `The shared-pool view proves that the sick dependency is not the whole bug. The common pool is the bug. Recommendations hangs, but payments and search fail because all three features draw from the same workers. The stopwatch makes the failure mechanical: held workers rise with arrival rate until no worker remains for anyone else.`,
        `The compartment view proves that the same total capacity can produce a different outage shape. Payments, search, and recommendations still use 200 workers in total, but each has a limit. When recommendations fills its smaller compartment, payments and search keep their reserved workers. The visual is proving containment, not recovery. Recovery needs timeouts, fallbacks, retries, and breakers around the contained failure.`,
      ],
    },
    {
      heading: `Pairing with breakers`,
      paragraphs: [
        `Bulkheads and circuit breakers solve different phases of the incident. The bulkhead is structural. It caps damage before any detector notices. The breaker is adaptive. It observes failure, opens the circuit, stops sending normal traffic, and later probes for recovery.`,
        `They work best together. A dependency gets slow, its compartment fills, calls fail fast instead of waiting forever, and the breaker opens after enough failures or timeouts. The open breaker keeps new calls from filling the compartment again. After a quiet period, a small probe tests whether the dependency can handle traffic. The bulkhead limits the blast; the breaker reduces repeated pressure.`,
      ],
    },
    {
      heading: `Costs and tradeoffs`,
      paragraphs: [
        `The implementation cost can be small, but allocation is hard. Idle capacity in one compartment may not be usable by another. If every feature has a tiny private pool, the system wastes resources and rejects traffic that a shared pool could have served. If every compartment is too large, isolation becomes cosmetic.`,
        `Bulkheads also add configuration and observability burden. You need to know which limit rejected a request, whether the rejection protected critical work, and whether a compartment is too small for normal traffic. A service-level saturation metric is not enough. The whole point is that different compartments can be healthy, full, or failing at the same time.`,
      ],
    },
    {
      heading: `Where it wins`,
      paragraphs: [
        `Bulkheads win when one class of work is less important, less reliable, or more bursty than the work beside it. Recommendations beside checkout, analytics beside login, batch jobs beside interactive queries, tenant workloads sharing a database, plugins inside a host service, and external API calls beside core product paths are all natural fits.`,
        `The idea also scales upward. Kubernetes resource limits isolate processes. Per-service database pools isolate clients. Rate limits isolate tenants. Cell-based architecture isolates user populations so one cell can degrade without taking the entire product down. The unit changes from thread to connection to container to region, but the invariant remains a bounded compartment with a known blast radius.`,
      ],
    },
    {
      heading: `Failure modes`,
      paragraphs: [
        `The common mistake is hiding an unbounded queue behind the bulkhead. That preserves admission for a while but creates doomed work, long waits, and memory pressure. Another mistake is retrying aggressively into a full compartment. Retries can multiply load exactly when the downstream is weakest.`,
        `Static limits can also drift. Traffic mix changes, latency changes, and feature priority changes. A limit sized from last quarter's p99 may be wrong today. Bulkheads should be reviewed with live data: in-flight counts, wait time, queue depth, rejection counts, timeout rate, fallback rate, downstream latency, and breaker state.`,
      ],
    },
    {
      heading: `Operating signals`,
      paragraphs: [
        `A useful dashboard separates compartments instead of averaging them together. Show current in-flight work, max permits, queue depth, queue wait, rejection rate, timeout rate, fallback rate, and downstream latency for each dependency or workload class. A full recommendations compartment and an empty payments compartment is a successful containment event, not a global outage.`,
        `Alerts should distinguish saturation from spread. Saturation says one compartment is full and users of that feature are seeing fallbacks or fast failures. Spread says another compartment is losing capacity because the boundary is missing, too large, or bypassed by retries. Bulkheads are easiest to trust when the metrics prove which side of the wall is wet.`,
      ],
    },
    {
      heading: `Study next`,
      paragraphs: [
        `Study next: Semaphore Permit Counter for async concurrency limits, Circuit Breakers and Deadlines for adaptive recovery, Tail Latency and p99 Thinking for sizing against bad days, Backpressure and Flow Control for pressure propagation, Message Queues for bounded buffers, Sharding and Partitioning for data-level isolation, and Cell-Based Architecture for blast-radius control at user-population scale.`,
      ],
    },
  ],
};
