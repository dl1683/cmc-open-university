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
        'The permits-and-waiters view shows a semaphore with capacity 2. Active highlights mark the current decision point: which thread is trying to acquire and what the counter reads. Found highlights mark threads that hold permits and are inside the protected region. Compare highlights mark threads that have arrived but cannot yet enter.',
        {
          type: 'callout',
          text: 'A semaphore turns capacity into an atomic admission rule: enter while a permit exists, otherwise join the wait queue.',
        },
        'Watch the counter. It starts at 2, drops to 0 as A and B acquire, stays at 0 while C blocks, and stays at 0 after A releases because the freed permit passes directly to C. The counter never goes negative. That is the semaphore invariant.',
        'The bulkhead view shows three independent semaphores guarding three dependencies. Each semaphore has its own counter and queue. A slowdown in one dependency exhausts only its own permits, not the others. Watch the permit counts and arrival rates to see why isolation matters.',
      
        {type: 'image', src: './assets/gifs/semaphore-permit-counter.gif', alt: 'Animated walkthrough of the semaphore permit counter visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'In 1965, Edsger Dijkstra needed a synchronization primitive for the THE multiprogramming system at Eindhoven. Interrupts and busy-wait loops were the only tools available, and they were error-prone: race conditions were invisible, correctness arguments were ad hoc, and adding a new concurrent process meant re-auditing every shared variable.',
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d9/Edsger_Wybe_Dijkstra.jpg/250px-Edsger_Wybe_Dijkstra.jpg',
          alt: 'Edsger Dijkstra, who introduced semaphores as a synchronization primitive',
          caption: 'Dijkstra introduced semaphores while designing early multiprogramming systems. Source: Wikipedia image page https://en.wikipedia.org/wiki/Edsger_W._Dijkstra.',
        },
        'Dijkstra invented the semaphore as the first general-purpose synchronization primitive. He defined two atomic operations and gave them Dutch names: P (from proberen, to try) decrements the counter if positive, otherwise blocks the caller; V (from verhogen, to increment) increments the counter and wakes a blocked caller if one exists. The names survive in POSIX as sem_wait and sem_post.',
        'The semaphore solved two problems at once. A binary semaphore (counter 0 or 1) provides mutual exclusion. A counting semaphore (counter 0 to N) provides bounded concurrency. Both reduce to the same mechanism: a nonnegative integer that callers cannot drive below zero, plus a queue for callers that arrive when the integer is zero.',
        'The idea endures because bounded capacity is everywhere. A database pool allows 40 connections. A crawler allows 6 requests per host. A microservice allows 20 concurrent calls to a fragile dependency. A mutex is too strict because it admits only one holder. An unbounded queue admits overload and hides the damage. A semaphore sits at the admission point and makes capacity visible in code.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is busy-wait. A shared counter lives in memory. Each thread spins in a tight loop: read the counter, check if it is positive, decrement it, and retry if someone else changed it first.',
        'Busy-wait works on toy examples. On a single-core machine with cooperative scheduling, the spinning thread yields eventually and the holder finishes. On modern hardware with few threads and short critical sections, a spin-lock can even outperform a blocking lock because it avoids the cost of a context switch.',
        'The logic is transparent: the counter, the check, and the decrement are all visible in a few lines of code. No kernel calls, no queues, no opaque runtime machinery.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'Busy-wait breaks in three ways. First, it wastes CPU. A spinning thread burns cycles doing no useful work. If 10 threads spin on a 4-core machine, the cores running spinners cannot run the holder that would release the resource. Under contention, busy-wait makes the problem worse by stealing cycles from the thread that could fix it.',
        'Second, the flag itself is a race condition. Reading the counter, checking it, and decrementing it are three separate operations. Between the check and the decrement, another thread can see the same positive value and also decrement. Two threads both believe they acquired the permit. The capacity bound is broken.',
        'Third, there is no ordering guarantee. Busy-wait has no queue. Whichever thread happens to read the counter at the right moment wins. A thread can spin indefinitely while luckier threads repeatedly grab the resource. Starvation is possible, and there is no way to reason about fairness.',
        'These three failures are why Dijkstra needed a primitive with atomicity (P and V cannot be interrupted), blocking (waiters sleep instead of spinning), and a queue (waiters are tracked and woken in some order).',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A semaphore is an integer counter initialized to N (the number of permits) plus a wait queue that holds blocked callers.',
        'P(s) -- acquire: if s > 0, atomically decrement s and proceed. The caller now holds one permit and may enter the protected region. If s = 0, add the caller to the wait queue and block. The caller sleeps until a V operation wakes it.',
        'V(s) -- release: if the wait queue is non-empty, remove one waiter and wake it. The permit transfers directly to the woken waiter without ever making the public counter positive. If the wait queue is empty, atomically increment s. The permit returns to the visible pool.',
        'A binary semaphore has N = 1. It acts as a mutex: one holder at a time, every other caller blocks. A counting semaphore has N > 1. It admits up to N concurrent holders. The mechanism is identical; only the initial count differs.',
        'In thread-based runtimes, the wait queue holds OS threads and blocking means a kernel sleep (often via futex on Linux, kevent on macOS, or WaitForSingleObject on Windows). In async runtimes, the queue holds promises, tasks, or coroutines, and blocking means suspending the task without consuming an OS thread.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'P and V are atomic operations. The test-and-decrement in P cannot be interrupted between the check and the update, so two threads cannot both see s = 1 and both decrement. This eliminates the race condition that breaks busy-wait.',
        'The counter tracks available permits exactly. The conservation invariant is: permits held + visible counter + permits reserved for woken waiters = N. If a thread acquires, the held count rises and the visible count falls. If a thread releases, the reverse happens. No permit is created or destroyed.',
        'Blocked threads do not consume CPU. They are parked by the scheduler and only wake when V explicitly transfers a permit. This solves the busy-wait problem of spinning threads stealing cycles from the holder.',
        'The wait queue provides ordering. FIFO queues give first-come-first-served fairness. Priority queues give urgency-based ordering. Either way, the queue makes fairness a design choice instead of an accident of timing.',
      ],
    },
    {
      heading: 'Cost and behavior',
      paragraphs: [
        'Each P and V operation is O(1). The uncontended fast path is an atomic read-modify-write and a branch. The contended slow path adds queue insertion or removal and a context switch. On Linux, the futex fast path stays in userspace; only contended operations enter the kernel.',
        'The hidden cost is contention. A single hot semaphore forces atomic operations on the same cache line across cores. Each core that tries P or V invalidates every other core\'s cached copy. Under high contention, this cache-line bouncing dominates the cost.',
        'Memory cost is the counter (one integer) plus one queue node per blocked waiter. In async runtimes, each queue node is a suspended task or promise. The queue is bounded by the number of callers, not by N.',
        'Wakeup policy matters. Waking all waiters when one permit is released causes a thundering herd: all wake, one succeeds, the rest re-block. Waking exactly one waiter avoids the herd but requires careful handoff to prevent a racing newcomer from stealing the permit between the wake signal and the waiter\'s resume.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'Connection pools: a database server supports at most 40 connections. A semaphore with N = 40 at the pool boundary ensures the 41st caller blocks or fails fast instead of opening a connection that the server will reject.',
        'Rate limiting: a crawler limits itself to 6 concurrent requests per host. A per-host semaphore enforces the limit without a separate rate-limiting layer.',
        'Producer-consumer: a bounded buffer uses two semaphores. One counts empty slots (producers P it, consumers V it). The other counts full slots (consumers P it, producers V it). The buffer never overflows or underflows.',
        'Reader-writer locks: a semaphore initialized to N allows up to N concurrent readers. A writer acquires all N permits, excluding every reader. This is a counting-semaphore implementation of shared/exclusive access.',
        'Bulkheads: one semaphore per downstream dependency isolates failure. A slow recommendations service fills its 20 permits and rejects locally while payments and search keep their independent pools. The semaphore becomes a failure boundary.',
        'OS resource management: POSIX named semaphores coordinate processes (not just threads) across address spaces. System V semaphore sets allow atomic operations on multiple semaphores for complex resource protocols.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'No ownership. Any thread can call V, not just the thread that called P. A semaphore cannot detect or prevent an accidental double-release or a release by the wrong thread. A mutex enforces unlock-by-owner; a semaphore does not.',
        'Deadlock with multiple semaphores. If thread 1 holds semaphore A and waits for semaphore B while thread 2 holds B and waits for A, both block forever. Semaphores provide no built-in deadlock detection or avoidance. The programmer must impose a consistent acquisition order.',
        'No priority inversion handling. If a low-priority thread holds a permit and a high-priority thread waits, the low-priority thread may be preempted by medium-priority threads indefinitely. A mutex with priority inheritance can boost the holder; a semaphore cannot, because it has no owner to boost.',
        'Condition variables are more flexible for complex predicates. A semaphore tests one condition: is the counter positive? If the wakeup condition involves multiple variables, a predicate on shared state, or a logical combination of events, condition variables with explicit predicates are clearer and less error-prone.',
        'Permit leaks. Any code path that calls P and then exits early -- via exception, early return, panic, or cancellation -- without calling V permanently reduces capacity. In structured languages, this requires defer, finally, RAII, or a scoped permit guard. In async code, a canceled task must leave the wait queue and must not keep a reserved permit.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'A semaphore is initialized with 3 permits. Five threads (T1 through T5) request access in order.',
        'T1 calls P: counter is 3, so decrement to 2. T1 enters. T2 calls P: counter is 2, decrement to 1. T2 enters. T3 calls P: counter is 1, decrement to 0. T3 enters. Three threads are inside; the counter reads 0.',
        'T4 calls P: counter is 0, so T4 blocks and joins the wait queue. Queue: [T4]. T5 calls P: counter is 0, so T5 blocks. Queue: [T4, T5].',
        'T1 finishes and calls V. The queue is non-empty, so the permit transfers directly to T4. T4 wakes and enters. Counter stays at 0 because the permit went to T4, not back to the public pool. Queue: [T5].',
        'T2 finishes and calls V. The permit transfers to T5. T5 wakes and enters. Queue: empty. Counter stays at 0. Three threads are inside again (T3, T4, T5).',
        'T3 finishes and calls V. Queue is empty, so counter increments to 1. T4 finishes, V increments to 2. T5 finishes, V increments to 3. The semaphore is back to its initial state.',
        'At no point did the counter go negative. At no point were more than 3 threads inside. The queue ensured T4 and T5 entered in arrival order. That is the semaphore contract: bounded concurrency with ordered waiting.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Dijkstra introduced semaphores in "Cooperating Sequential Processes" (1965, circulated as EWD-123, later published in Programming Languages, Academic Press, 1968). EWD-310 "Hierarchical Ordering of Sequential Processes" (1971) developed the theory further. Allen Downey\'s "The Little Book of Semaphores" (2016, free online) is the best modern tutorial, covering classical problems (dining philosophers, readers-writers, producer-consumer) with semaphore-only solutions.',
        'For the POSIX API: sem_overview(7), sem_wait(3), sem_post(3), sem_init(3), and sem_getvalue(3) at man7.org document the standard interface.',
        'Study next: Mutex for ownership and exclusion (prerequisite: understand why a binary semaphore is not quite a mutex). Condition Variable for predicate-based waiting (extension: when the wakeup condition is more complex than "counter > 0"). Futex Wait Queue for the kernel sleep-and-wake mechanism underneath (implementation depth). Bulkheads & Resource Isolation for the failure-containment pattern that counting semaphores enable (production application).',
      ],
    },
  ],
};
