// Semaphore permit counters: a bounded integer plus a wait queue, used for
// concurrency limits, producer/consumer gates, and resource bulkheads.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'semaphore-permit-counter',
  title: 'Semaphore Permit Counter',
  category: 'Data Structures',
  summary: 'A semaphore is a nonnegative permit counter: acquire decrements when possible, waiters park at zero, and release wakes or restores capacity.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['permits and waiters', 'bulkhead limit case study'], defaultValue: 'permits and waiters' },
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

function permitGraph(title, { permits = '2', queue = 'empty', c = 'arrives', post = 'idle' } = {}) {
  return graphState({
    nodes: [
      { id: 'counter', label: 'permits', x: 5.0, y: 1.1, note: permits },
      { id: 'a', label: 'A', x: 1.0, y: 3.2, note: 'holding' },
      { id: 'b', label: 'B', x: 3.0, y: 3.2, note: 'holding' },
      { id: 'c', label: 'C', x: 5.9, y: 6.1, note: c },
      { id: 'queue', label: 'queue', x: 8.5, y: 6.1, note: queue },
      { id: 'post', label: 'post', x: 9.0, y: 3.2, note: post },
      { id: 'resource', label: 'res', x: 5.5, y: 3.2, note: 'cap 2' },
    ],
    edges: [
      { id: 'e-counter-a', from: 'counter', to: 'a', weight: 'take' },
      { id: 'e-counter-b', from: 'counter', to: 'b', weight: 'take' },
      { id: 'e-counter-c', from: 'counter', to: 'c', weight: 'try' },
      { id: 'e-c-queue', from: 'c', to: 'queue', weight: 'park' },
      { id: 'e-a-resource', from: 'a', to: 'resource', weight: '' },
      { id: 'e-b-resource', from: 'b', to: 'resource', weight: '' },
      { id: 'e-post-counter', from: 'post', to: 'counter', weight: '+1' },
      { id: 'e-post-queue', from: 'post', to: 'queue', weight: 'wake' },
      { id: 'e-c-resource', from: 'c', to: 'resource', weight: 'enter' },
    ],
  }, { title });
}

function* permitsAndWaiters() {
  const capacity = 2;
  const workers = ['A', 'B', 'C'];

  yield {
    state: permitGraph('A counting semaphore starts with N permits', { permits: '2 free', queue: 'empty', c: 'not here', post: 'idle' }),
    highlight: { active: ['counter', 'resource'], found: ['a', 'b'] },
    explanation: `A semaphore is a nonnegative integer plus a waiting discipline. The integer represents how many units of some resource may be claimed concurrently — here, ${capacity} at a time.`,
    invariant: `The visible counter never goes below zero; it starts at ${capacity} and can only reach 0.`,
  };

  yield {
    state: permitGraph('Acquire consumes permits while the count is positive', { permits: '0 free', queue: 'empty', c: 'arrives', post: 'idle' }),
    highlight: { active: ['a', 'b', 'counter', 'e-counter-a', 'e-counter-b'], compare: ['c'] },
    explanation: `Workers ${workers[0]} and ${workers[1]} each decrement the counter and enter the bounded region. With ${capacity} permits consumed, the third acquire by ${workers[2]} cannot decrement into negative capacity.`,
  };

  yield {
    state: permitGraph('At zero, acquire joins a wait queue', { permits: '0 free', queue: 'C asleep', c: 'blocked', post: 'idle' }),
    highlight: { active: ['c', 'queue', 'e-counter-c', 'e-c-queue'], compare: ['resource'] },
    explanation: `When all ${capacity} permits are exhausted, the semaphore records ${workers[2]} as a waiter and parks it. In a futex-backed implementation, this is the point where the fast path becomes a kernel wait.`,
  };

  yield {
    state: permitGraph('Release either restores a permit or wakes one waiter', { permits: '0 after handoff', queue: 'C woken', c: 'ready', post: 'A posts' }),
    highlight: { active: ['post', 'queue', 'c', 'e-post-queue', 'e-c-resource'], found: ['resource'] },
    explanation: `A post operation increments capacity. If waiters exist, implementations often hand the permit directly to one waiter rather than letting the public count become positive and trigger a race among all ${workers.length} workers.`,
    invariant: `permits in use + visible permits + reserved permits equals ${capacity}.`,
  };

  yield {
    state: labelMatrix(
      'Semaphore flavors',
      [
        { id: 'binary', label: 'binary semaphore' },
        { id: 'counting', label: 'counting semaphore' },
        { id: 'async', label: 'async semaphore' },
        { id: 'weighted', label: 'weighted semaphore' },
      ],
      [
        { id: 'permits', label: 'permits' },
        { id: 'queue', label: 'wait queue' },
        { id: 'use', label: 'common use' },
      ],
      [
        ['0 or 1', 'maybe FIFO', 'simple gate'],
        ['0..N', 'sleepers at zero', 'resource pool'],
        ['0..N', 'promises/tasks', 'API concurrency cap'],
        ['variable cost', 'fit by weight', 'memory or tokens'],
      ],
    ),
    highlight: { active: ['counting:permits', 'async:use'], found: ['weighted:permits'] },
    explanation: `The same permit-counter structure appears in operating systems, async runtimes, database pools, API clients, and bulkheads. All ${capacity + 2} flavors shown share one invariant: a nonnegative counter plus a wait queue.`,
  };
}

function* bulkheadLimitCaseStudy() {
  const paymentPermits = 80;
  const searchPermits = 60;
  const recsPermits = 20;
  const totalPermits = paymentPermits + searchPermits + recsPermits;

  yield {
    state: graphState({
      nodes: [
        { id: 'api', label: 'API service', x: 0.8, y: 4.0, note: 'incoming' },
        { id: 'payments', label: 'payments sem', x: 3.0, y: 2.0, note: '80 permits' },
        { id: 'search', label: 'search sem', x: 3.0, y: 4.0, note: '60 permits' },
        { id: 'recs', label: 'recs sem', x: 3.0, y: 6.0, note: '20 permits' },
        { id: 'paydb', label: 'payments DB', x: 6.1, y: 2.0, note: 'healthy' },
        { id: 'searchdb', label: 'search cluster', x: 6.1, y: 4.0, note: 'healthy' },
        { id: 'recsvc', label: 'recs service', x: 6.1, y: 6.0, note: 'slow' },
        { id: 'fallback', label: 'fallback', x: 8.5, y: 6.0, note: 'fast fail' },
      ],
      edges: [
        { id: 'e-api-pay', from: 'api', to: 'payments', weight: 'acquire' },
        { id: 'e-api-search', from: 'api', to: 'search', weight: 'acquire' },
        { id: 'e-api-recs', from: 'api', to: 'recs', weight: 'acquire' },
        { id: 'e-pay-db', from: 'payments', to: 'paydb', weight: 'call' },
        { id: 'e-search-db', from: 'search', to: 'searchdb', weight: 'call' },
        { id: 'e-recs-svc', from: 'recs', to: 'recsvc', weight: 'call' },
        { id: 'e-recs-fallback', from: 'recs', to: 'fallback', weight: 'reject' },
      ],
    }, { title: 'One semaphore per dependency makes a bulkhead concrete' }),
    highlight: { active: ['payments', 'search', 'recs'], found: ['paydb', 'searchdb'], compare: ['recsvc'] },
    explanation: `Bulkheads become executable when each dependency has a separate semaphore. A slow recommendations service can fill its ${recsPermits} permits, but it cannot consume the ${paymentPermits} payment permits — ${totalPermits} permits total, split across 3 independent pools.`,
  };

  yield {
    state: labelMatrix(
      'Sizing with Little Law',
      [
        { id: 'payments', label: 'payments' },
        { id: 'search', label: 'search' },
        { id: 'recs-normal', label: 'recs normal' },
        { id: 'recs-bad', label: 'recs incident' },
      ],
      [
        { id: 'rate', label: 'arrival rate' },
        { id: 'hold', label: 'hold time' },
        { id: 'inflight', label: 'expected in-flight' },
        { id: 'limit', label: 'permit limit' },
      ],
      [
        ['400 rps', '50 ms', '20', '80'],
        ['250 rps', '80 ms', '20', '60'],
        ['50 rps', '120 ms', '6', '20'],
        ['50 rps', '2 s', '100', '20 rejects'],
      ],
    ),
    highlight: { active: ['recs-bad:inflight', 'recs-bad:limit'], found: ['payments:limit', 'search:limit'] },
    explanation: `The permit count is not arbitrary. If the downstream slows from 120 ms to 2 seconds, its demand jumps from 6 in-flight calls to 100. The semaphore caps that surge at ${recsPermits} and fails the rest quickly, while payments keeps its ${paymentPermits} permits untouched.`,
  };

  yield {
    state: labelMatrix(
      'Queue or fail fast?',
      [
        { id: 'thread', label: 'thread pool' },
        { id: 'async', label: 'async API' },
        { id: 'latency', label: 'latency SLO' },
        { id: 'batch', label: 'batch worker' },
      ],
      [
        { id: 'policy', label: 'policy' },
        { id: 'reason', label: 'reason' },
      ],
      [
        ['short queue', 'avoid thread exhaustion'],
        ['promise wait or timeout', 'caller can await cheaply'],
        ['fail fast', 'protect tail latency'],
        ['bounded queue', 'throughput over immediacy'],
      ],
    ),
    highlight: { active: ['latency:policy', 'thread:reason'], compare: ['batch:policy'] },
    explanation: `The semaphore gives a cap, not the whole policy. With ${totalPermits} permits spread across 3 pools, production systems choose whether exhausted permits should wait, time out, reject, or use a fallback based on the caller budget.`,
  };

  yield {
    state: permitGraph('A semaphore links back to the futex slow path', { permits: '0 free', queue: 'many waiters', c: 'timed wait', post: 'wake 1' }),
    highlight: { active: ['counter', 'queue', 'post', 'e-post-queue'], found: ['c'] },
    explanation: `In a thread-based runtime, the exhausted semaphore usually parks waiters through a futex or equivalent kernel primitive. In an async runtime, the wait queue holds tasks instead of OS threads — either way, the ${recsPermits}-permit cap holds.`,
    invariant: `Do not let an unbounded semaphore queue become a hidden outage queue — all ${totalPermits} permits across the system have explicit bounds.`,
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'permits and waiters') yield* permitsAndWaiters();
  else if (view === 'bulkhead limit case study') yield* bulkheadLimitCaseStudy();
  else throw new InputError('Pick a semaphore view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'The animation shows a semaphore with a fixed number of permits. A permit is permission to enter a protected region or use a bounded resource.',
        {type: 'callout', text: 'A semaphore turns capacity into an atomic admission rule: enter while a permit exists, otherwise join the wait queue.'},
        'Active state marks the current acquire or release operation, found state marks holders inside the protected region, and compare state marks waiters. The safe inference is: if the counter is zero, a new caller cannot enter until a release transfers or returns a permit.',
      
        {type: 'image', src: './assets/gifs/semaphore-permit-counter.gif', alt: 'Animated walkthrough of the semaphore permit counter visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Concurrent programs need to share resources without letting too many callers enter at once. A database pool might allow 40 connections, a crawler might allow 6 requests per host, and a service might allow 20 calls to a fragile dependency.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d9/Edsger_Wybe_Dijkstra.jpg/250px-Edsger_Wybe_Dijkstra.jpg', alt: 'Edsger Dijkstra, who introduced semaphores as a synchronization primitive', caption: 'Dijkstra introduced semaphores while designing early multiprogramming systems. Source: Wikipedia image page https://en.wikipedia.org/wiki/Edsger_W._Dijkstra.'},
        'A mutex admits one holder, which is too strict for bounded pools. An unbounded queue hides overload. A semaphore makes capacity explicit through a counter and a wait queue.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is a shared counter guarded by busy-waiting. Each thread repeatedly reads the counter, checks whether it is positive, and tries to decrement it.',
        'This can work for toy examples or very short critical sections. It is simple because the state is just a number in memory.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'Busy-waiting wastes CPU while the caller does no useful work. Under contention, spinning threads can steal cycles from the holder that needs to run and release the resource.',
        'The counter update is also a race unless the check and decrement are atomic. Two threads can both see one available permit and both enter, breaking the capacity bound.',
        'There is no ordering policy. A thread can spin indefinitely while newer arrivals repeatedly win the timing race.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'A semaphore packages three things together: a nonnegative counter, an atomic acquire-release protocol, and a queue for callers that arrive when the counter is zero.',
        'The counter represents visible available permits. The queue represents demand that cannot enter yet. Atomicity prevents two callers from taking the same permit.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Acquire, historically called P, checks the counter atomically. If the counter is positive, it decrements the counter and the caller enters; if the counter is zero, the caller is placed on the wait queue and blocks or suspends.',
        'Release, historically called V, either wakes one waiter or increments the visible counter. If a waiter exists, the released permit transfers directly to that waiter, so the counter can remain zero.',
        'A binary semaphore starts at 1 and behaves like a one-permit gate. A counting semaphore starts at N and admits up to N concurrent holders.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The conservation invariant is: held permits plus visible counter plus permits reserved for woken waiters equals the initial capacity N. Acquire moves one permit from visible to held, and release moves one permit from held to either a waiter or the visible counter.',
        'Atomic acquire prevents two callers from consuming the same visible permit. Blocking prevents waiters from burning CPU while no permit is available.',
        'The queue makes admission order explicit. FIFO queues give first-come-first-served behavior, while priority queues encode a different scheduling policy.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Each acquire and release is O(1). The uncontended path is usually an atomic operation and a branch; the contended path adds queue work and a scheduler wake or sleep.',
        'The hidden cost is contention on one shared counter. Many cores updating the same cache line can spend more time invalidating each other\'s cached copies than doing useful work.',
        'Memory cost is the counter plus one queue node per blocked waiter. In async runtimes, those queue nodes are suspended tasks or promises rather than operating-system threads.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Connection pools use semaphores to keep open database connections below a hard limit. The 41st caller in a 40-connection pool waits or fails fast instead of overloading the database.',
        'Bulkheads use one semaphore per downstream dependency. If recommendations exhausts its 20 permits, payments and search can still keep their separate capacity.',
        'Producer-consumer queues use two semaphores: one for empty slots and one for full slots. This prevents buffer overflow and underflow with the same permit-counting mechanism.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'A semaphore has no ownership. Any thread can release, so double-release or release-by-wrong-thread bugs can inflate capacity unless the surrounding code prevents them.',
        'Multiple semaphores can deadlock. If one thread holds A and waits for B while another holds B and waits for A, both wait forever.',
        'Semaphores are poor for complex predicates. If the wake condition depends on several variables, a condition variable with an explicit predicate is usually clearer.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Start with capacity 3 and threads T1 through T5. T1, T2, and T3 acquire in order, so the counter moves 3 -> 2 -> 1 -> 0 and all three enter.',
        'T4 then tries to acquire when the counter is 0, so it blocks in the queue. T5 does the same, producing queue [T4, T5].',
        'When T1 releases, the permit transfers directly to T4 and the counter stays 0. When T2 releases, the permit transfers to T5. Only after T3, T4, and T5 eventually release with no waiters does the counter climb back to 3.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Dijkstra introduced semaphores in Cooperating Sequential Processes, circulated in 1965 and later published. Allen Downey\'s The Little Book of Semaphores is a practical modern tutorial.',
        'Study mutexes, condition variables, futex wait queues, producer-consumer buffers, readers-writer locks, structured concurrency, cancellation safety, and bulkhead resource isolation.',
      ],
    },
  ],
};
