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
    explanation: 'Service B owns one pool of 200 worker threads and calls three downstreams: payments (critical), search (important), recommendations (decorative). Circuit Breakers & Deadlines showed what happens next when recommendations sickens into 30-second hangs: every thread that touches it is held hostage for 30s. But look at the architecture\'s real sin — the threads are SHARED. Recommendation calls arrive at maybe 20 per second; 20/s × 30s = 600 thread-demands against a pool of 200. Arithmetic says the WHOLE pool drowns in ten seconds — and with it, payments.',
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
    explanation: 'The casualty report, and its perversity: the DECORATIVE feature took down the CRITICAL one. Recommendations holds all 200 threads; payments — whose own downstream is perfectly healthy — cannot get a single worker, so checkout dies site-wide because a "you might also like" widget got slow. This is the failure mode the Titanic\'s designers understood for water and software architects keep relearning for threads: damage that is SURVIVABLE in one compartment is FATAL when the compartments connect. (Honest footnote: the Titanic\'s bulkheads famously weren\'t sealed at the top — half-measures flood over.)',
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
    explanation: 'The drowning on a stopwatch: 20 calls per second enter the sick dependency and NONE come back for 30 seconds, so held threads climb by 20 every second — 40 by t=2, 100 by t=5, all 200 by t=10. Nothing dramatic happens at any single moment; the pool just monotonically drains, which is why shared-pool incidents feel like slow-motion suffocation on the dashboards. Note what would NOT have helped: more threads (400 drowns in 20 seconds), faster machines (the holds are waits, not work). The only cures are walls (this page) or fast failure (Circuit Breakers & Deadlines) — and the next view builds the walls.',
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
    explanation: 'The bulkhead move: split the one pool into three sealed compartments — payments 80, search 80, recommendations 40. Re-run the disaster: recommendations sickens, its 40 threads fill in two seconds… and the flooding STOPS at the compartment wall. Calls to recommendations now reject instantly (pool full = immediate failure, feeding the fallback ladder from Circuit Breakers & Deadlines), while payments and search hum along on their untouched pools. The decorative feature degrades; the critical one never notices. Total blast radius: exactly the 40 threads you pre-decided recommendations was worth.',
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
    explanation: 'How big is each compartment? Not vibes — LITTLE\'S LAW, queueing theory\'s one-liner: threads in use ≈ arrival rate × time each is held. Payments at 200 requests/second holding a thread 50ms needs ~10 threads on average; budget 80 and spikes are covered. The crucial subtlety lives in the recommendations row: size against the p99 hold time, not the mean — Tail Latency & p99 Thinking taught that the tail IS the load during trouble, and trouble is exactly when the bulkhead earns its keep. Undersized pools reject healthy traffic; oversized ones leak doom back in. The law turns the dial into arithmetic.',
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
    explanation: 'The pattern wears many uniforms: every database connection pool with a per-service cap is a bulkhead; async runtimes use semaphores (a counter of in-flight calls per dependency — cheaper than dedicated threads, same wall); Kubernetes resource limits bulkhead at the process level; and the biggest ships — AWS, Slack — bulkhead at the ARCHITECTURE level with cells: complete service stacks each serving a slice of users, so even a full-stack failure drowns one cell\'s users, not everyone (Sharding & Partitioning\'s logic, aimed at failure instead of data).',
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
    explanation: 'Bulkheads and breakers are not rivals — they are the static and dynamic halves of one defense. The bulkhead is STRUCTURAL: it needs no detection, no thresholds, no state machine; the wall simply exists, and the worst case is capped from the first millisecond. The breaker is ADAPTIVE: it notices sickness, removes load so the dependency can heal, and probes its way back. In concert (this is Hystrix\'s and resilience4j\'s default composition): the compartment floods and contains, fast failures trip the breaker, the breaker\'s silence heals the downstream, the probe reopens trade. Containment first, recovery second — the same doctrine as ships, hospitals, and firewalls: you cannot prevent every breach, so build for the breach you\'ll survive.',
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
      heading: `What it is`,
      paragraphs: [
        `A bulkhead is a wall in a ship's hull, sealing compartments so that water breaching one chamber does not flood the entire vessel. In distributed systems, the principle is identical: give each dependency its own isolated pool of resources — threads, connections, memory — so when one dependency becomes sick and consumes its pool, the sickness stays contained. The demo shows the fatal flaw of a shared pool: when recommendations slows to 30-second hangs, all 200 threads in the common pool fill with blocked requests, leaving zero for payments or search. The wall you add—a bulkhead—caps each dependency's blast radius at a fixed size, turning "everything dies" into "only that feature degrades."`,
      ],
    },
    {
      heading: `How it works`,
      paragraphs: [
        `Instead of one pool of N threads shared by all downstreams, create K separate pools with sizes L₁, L₂, …, Lₖ where L₁ + L₂ + … + Lₖ ≤ N. In the demo, the 200 threads are divided: payments gets 80, search gets 80, recommendations gets 40. When a request arrives, it claims a thread from its dependency's own compartment. If full, it fails immediately or queues locally — it cannot steal from another compartment. When recommendations fills its 40-thread pool (because calls take 30 seconds), only recommendations calls fail fast. Payments requests still find their 80 threads untouched.`,
        `Sizing each compartment requires Little's Law (L = λ·W): the average requests held equals arrival rate times hold time. If payments gets 200 rps and each holds a thread 50ms, then 200 × 0.05 = 10 threads are in use on average; budget 80 for spikes. For recommendations, size to the p99 hold time (0.4s), not the mean: 20 rps × 0.4s = 8 threads at the tail, so 40 is safe. Tail Latency & p99 Thinking teaches that the tail IS the load during trouble.`,
        `Once sized, the bulkhead needs a partner: Circuit Breakers & Deadlines. When the compartment fills and calls fail fast, the breaker notices, trips open, and stops flooding the sick dependency. The silence heals it while the bulkhead ensures the silence does not leak into healthy pools.`,
      ],
    },
    {
      heading: `Cost and complexity`,
      paragraphs: [
        `Bulkheads are nearly free. Async runtimes use one semaphore per dependency (a counter of in-flight calls). Thread-based systems create one pool-of-pools instead of one pool. Database connection pools already enforce per-service caps—you just size them with Little's Law. At architecture scale, cell-based systems (AWS, Slack from Sharding & Partitioning) bulkhead entire service stacks by user shard or region, containing full-stack outages to one cell. The lookup is O(1); memory is O(K) where K is the number of dependencies—typically 5 to 50, negligible.`,
      ],
    },
    {
      heading: `Real-world uses`,
      paragraphs: [
        `Every service runs bulkheads by default. JDBC in Java and SQLAlchemy in Python cap database connections per service, preventing one chatty app from starving others. Kubernetes resource limits bulkhead at the container level; a memory leak stays in its box. Netflix's Hystrix, ancestor of resilience4j, pairs bulkheads (bounded pools per dependency) with circuit breakers by default. Node.js and Python async use semaphores per remote service. At scale, AWS and Slack use cell architecture: each cell is a complete stack serving one user shard. When one cell's search melts, only its users see degradation. Hot Rows & Append-and-Aggregate applies the same logic to data: if one shard becomes a traffic hotspot, resource limits contain it.`,
      ],
    },
    {
      heading: `Pitfalls and misconceptions`,
      paragraphs: [
        `Do not guess sizes—always measure with Little's Law and p99 latency. Guessing too small rejects healthy traffic; too large allows one dependency to starve others. Bulkheads contain failure but do not prevent it; a compartment still fills and fails—pairing with Circuit Breakers & Deadlines is essential. Without a fallback (Circuit Breakers & Deadlines), requests hang in isolation instead of failing fast. Bulkheads apply at any resource level: connections, file handles, memory, CPU time, API quotas. Even entire data shards (Sharding & Partitioning) are bulkheads—a shard outage affects only its users. Finally, monitor: if a compartment is always full, it is sized too small; recalculate as load and latencies drift.`,
      ],
    },
    {
      heading: `Study next`,
      paragraphs: [
        `Study Semaphore Permit Counter to see the data structure behind async bulkheads and per-dependency concurrency caps. Circuit Breakers & Deadlines pair with bulkheads—structure contains, adaptation heals. Tail Latency & p99 Thinking shows why sizing to the tail matters. Sharding & Partitioning demonstrates bulkheads at the architecture level. Hot Rows & Append-and-Aggregate applies bulkheads to single hotspot rows. Message Queue explores how queues bulkhead producer from consumer. Load Balancer completes the stack: distribute traffic to healthy compartments and away from saturated ones.`,
      ],
    },
  ],
};
