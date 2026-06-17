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
  yield {
    state: permitGraph('A counting semaphore starts with N permits', { permits: '2 free', queue: 'empty', c: 'not here', post: 'idle' }),
    highlight: { active: ['counter', 'resource'], found: ['a', 'b'] },
    explanation: 'A semaphore is a nonnegative integer plus a waiting discipline. The integer represents how many units of some resource may be claimed concurrently.',
    invariant: 'The visible counter never goes below zero.',
  };

  yield {
    state: permitGraph('Acquire consumes permits while the count is positive', { permits: '0 free', queue: 'empty', c: 'arrives', post: 'idle' }),
    highlight: { active: ['a', 'b', 'counter', 'e-counter-a', 'e-counter-b'], compare: ['c'] },
    explanation: 'Workers A and B each decrement the counter and enter the bounded region. With two permits consumed, the third acquire cannot decrement into negative capacity.',
  };

  yield {
    state: permitGraph('At zero, acquire joins a wait queue', { permits: '0 free', queue: 'C asleep', c: 'blocked', post: 'idle' }),
    highlight: { active: ['c', 'queue', 'e-counter-c', 'e-c-queue'], compare: ['resource'] },
    explanation: 'When permits are exhausted, the semaphore records the waiter and parks it. In a futex-backed implementation, this is the point where the fast path becomes a kernel wait.',
  };

  yield {
    state: permitGraph('Release either restores a permit or wakes one waiter', { permits: '0 after handoff', queue: 'C woken', c: 'ready', post: 'A posts' }),
    highlight: { active: ['post', 'queue', 'c', 'e-post-queue', 'e-c-resource'], found: ['resource'] },
    explanation: 'A post operation increments capacity. If waiters exist, implementations often hand the permit directly to one waiter rather than letting the public count become positive and trigger a race.',
    invariant: 'permits in use + visible permits + reserved permits equals capacity.',
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
    explanation: 'The same permit-counter structure appears in operating systems, async runtimes, database pools, API clients, and bulkheads. The queue policy and cancellation rules matter as much as the integer.',
  };
}

function* bulkheadLimitCaseStudy() {
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
    explanation: 'Bulkheads become executable when each dependency has a separate semaphore. A slow recommendations service can fill its 20 permits, but it cannot consume the 80 payment permits.',
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
    explanation: 'The permit count is not arbitrary. If the downstream slows from 120 ms to 2 seconds, its demand jumps from 6 in-flight calls to 100. The semaphore caps that surge at 20 and fails the rest quickly.',
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
    explanation: 'The semaphore gives a cap, not the whole policy. Production systems choose whether exhausted permits should wait, time out, reject, or use a fallback based on the caller budget.',
  };

  yield {
    state: permitGraph('A semaphore links back to the futex slow path', { permits: '0 free', queue: 'many waiters', c: 'timed wait', post: 'wake 1' }),
    highlight: { active: ['counter', 'queue', 'post', 'e-post-queue'], found: ['c'] },
    explanation: 'In a thread-based runtime, the exhausted semaphore usually parks waiters through a futex or equivalent kernel primitive. In an async runtime, the wait queue holds tasks instead of OS threads.',
    invariant: 'Do not let an unbounded semaphore queue become a hidden outage queue.',
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
      heading: 'Why this exists',
      paragraphs: [
        'Many shared resources are limited without being exclusive. A database pool might allow 40 checked-out connections. A downloader might allow 6 active transfers. A service might allow 20 concurrent calls to a fragile dependency. A mutex is too strict because it admits only one holder, while an unbounded queue admits overload and hides the damage.',
        'A semaphore exists to represent bounded capacity directly. It answers one question at the edge of a critical region: is there a permit available now, or must this caller wait, time out, reject, cancel, or fall back?',
        'The important idea is that capacity is data. If the limit lives only in comments, dashboards, or downstream timeouts, callers will discover overload after they have already consumed threads, memory, sockets, and user patience. A semaphore moves the limit to the admission point.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The first reasonable approach is a mutex. Wrap the resource in a lock so only one caller can enter at a time. That is correct for exclusive state such as a single in-memory map or a file region that cannot be updated concurrently.',
        'The wall is underuse. Many resources are not exclusive. A connection pool, worker pool, GPU queue, rate-limited API, or download manager may support several concurrent users safely. A mutex protects the resource by throwing away parallelism.',
        'The next reasonable approach is to let every caller start and rely on the downstream system to push back. That maximizes short-term throughput in happy paths, but it fails during slowdowns. When service time rises, in-flight work rises too. Without an admission counter, overload turns into hidden queues, timeouts, memory growth, and cascading failure.',
      ],
    },
    {
      heading: 'The core model',
      paragraphs: [
        'A semaphore is a nonnegative integer plus a waiting discipline. POSIX describes a semaphore value as an integer that is never allowed to fall below zero; wait decrements when possible, and post increments and may wake a blocked waiter. Higher-level runtimes keep the same shape even when the waiters are promises, tasks, fibers, or coroutines instead of OS threads.',
        'The central invariant is conservation: permits in use + visible permits + permits reserved for woken waiters = capacity. If that equation is broken, the system either over-admits work or loses capacity forever.',
        'The queue policy is part of the data structure. A FIFO semaphore, priority semaphore, unfair semaphore, async semaphore, and weighted semaphore can all share the same permit counter while making different promises about who gets the next permit. The integer alone does not define fairness, cancellation, ownership, or overload behavior.',
      ],
    },
    {
      heading: 'Acquire and release',
      paragraphs: [
        'Acquire has a fast path and a slow path. On the fast path, an atomic update observes a positive count and decrements it. The caller enters immediately. On the slow path, the count is zero or too small, so the caller joins a wait queue, waits with a timeout, returns a would-block error, or follows an overload policy.',
        'Release is the mirror operation. If no waiter can use the returned permit, the visible count increases. If a waiter exists, many implementations perform a direct handoff: the releasing thread wakes one waiter and reserves the permit for it, so a racing newcomer cannot steal capacity between the wakeup and the resumed acquire.',
        'Weighted semaphores add one more check. A caller may ask for 5 permits instead of 1 because a job uses more memory, tokens, bandwidth, or downstream slots. Weighted acquisition is useful, but it creates fairness problems. A large request at the head of a FIFO queue can block smaller requests behind it even when enough partial capacity is available for them.',
        'Async semaphores replace sleeping threads with suspended tasks. That saves OS threads, but it does not remove the need for cleanup. A canceled task must leave the wait queue and must not keep a reserved permit. A timed-out acquire must have a clear result: either it obtained a permit and owns release responsibility, or it did not.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The capacity bound holds because every entrant must pass through acquire before entering the protected region. The wait queue records demand without turning the counter negative. Release returns exactly the capacity that a completed holder used.',
        'The linearization points are the atomic decrement, the enqueue-or-fail decision at zero, and the release handoff or increment. Correct implementations make those transitions indivisible enough that no permit can be counted twice and no waiter can sleep through the wakeup intended for it.',
        'The conservation invariant also explains permit leaks. If a path acquires a permit and exits without release, the capacity equation still balances locally, but one permit is stuck in the in-use term forever. Over time the visible capacity shrinks until the system looks overloaded even when no real work is happening.',
      ],
    },
    {
      heading: 'What the visual proves',
      paragraphs: [
        'The permits-and-waiters view shows the counter as the admission gate. A and B take the two permits and enter the resource. C arrives when the counter is zero, so C cannot make the counter negative. The only safe choices are wait, timeout, reject, cancel, or use a fallback.',
        'The release frame is the key state transition. A posts a permit, but the public count can remain zero because the permit is immediately reserved for C. That direct handoff prevents a newcomer from racing ahead of an already queued waiter.',
        'The bulkhead view shows why one semaphore per dependency is different from one global limit. A slow recommendations service can exhaust its 20 permits and reject locally while payments and search keep their independent pools. The data structure becomes a failure boundary.',
      ],
    },
    {
      heading: 'Cost and behavior',
      paragraphs: [
        'The uncontended path is O(1): an atomic read-modify-write and a branch. The contended path adds queue manipulation, scheduling, and sometimes a kernel transition through a futex or equivalent parking primitive. Async semaphores queue tasks or promises instead of OS threads, but the same logical states remain.',
        'The hidden cost is contention. A single hot semaphore can become a cache-line fight among cores. Waking too many waiters creates thundering herd behavior. Waking too few can underuse capacity. Good implementations choose wakeup discipline carefully and keep the fast path small.',
        'Fairness is not guaranteed by the integer. FIFO queues reduce starvation but can create head-of-line blocking, especially for weighted permits. Looser queues can improve throughput but may surprise callers that expect arrival order. Priority queues can protect urgent work but can starve low-priority callers if aging or quotas are missing.',
      ],
    },
    {
      heading: 'Sizing and bulkheads',
      paragraphs: [
        'Sizing starts from the resource, not from the caller count. For a database pool, the limit may come from server connection capacity. For an API dependency, it may come from latency budgets and downstream quotas. For a CPU-heavy worker pool, it may come from cores and memory. For a GPU or LLM gateway, it may come from tokens, memory, or batch slots.',
        'Little Law gives a useful first estimate: expected in-flight work equals arrival rate times hold time. If a dependency receives 50 requests per second and each request holds a permit for 120 milliseconds, the steady-state demand is about 6 permits. If an incident raises hold time to 2 seconds, the same arrival rate demands about 100 in-flight calls. A 20-permit semaphore caps the damage before it consumes the rest of the service.',
        'Bulkheads use separate semaphores for separate failure domains. Payments, search, recommendations, image generation, and audit logging should not all draw from one undifferentiated pool if one dependency can become slow. A per-dependency semaphore lets one subsystem fail fast while the rest of the process continues to serve useful work.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'Semaphores are strongest at resource pools, producer-consumer gates, and bulkheads. They make capacity visible in code instead of burying it in a queue length, thread count, or downstream timeout.',
        'They also fit client-side concurrency caps. A web crawler can limit active requests per host. A downloader can limit active file transfers. A test runner can limit expensive integration tests. An async service can bound concurrent calls to a model endpoint without blocking OS threads.',
        'Weighted semaphores fit resources where every job has a different cost. A small image resize may consume one unit while a large transcode consumes eight. A language-model gateway may count approximate tokens or memory pressure instead of request count. The same counter idea works as long as the weight predicts the scarce resource well enough.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'A semaphore is not a full mutex. A binary semaphore can act like a gate, but it usually does not enforce ownership, recursion rules, priority inheritance, or unlock-by-owner checks. Use a mutex when those properties are part of correctness.',
        'A semaphore also does not choose the overload policy for you. Waiting forever creates a hidden outage queue. Failing fast can protect latency but drop useful work. Timeouts and cancellation require cleanup so a canceled waiter does not keep a permit reserved or remain in the queue.',
        'Permit leaks are the common operational failure. Any path that acquires and then returns early, throws, panics, or is canceled must still release. In structured languages that usually means defer, finally, RAII, or a scoped permit object.',
        'A semaphore can also hide priority inversion. Low-priority work may hold permits while high-priority work waits. If the protected resource is latency-critical, the design may need priority queues, separate pools, request classes, or admission control at a higher layer.',
      ],
    },
    {
      heading: 'Implementation guidance',
      paragraphs: [
        'Expose scoped acquisition when the language supports it. A scoped permit object can release automatically when it leaves scope. In JavaScript and other async systems, use try/finally around every awaited region that owns a permit. The dangerous path is acquire, then await several operations, then throw before release.',
        'Make overload behavior explicit. Decide whether acquire waits forever, waits with a timeout, returns immediately when full, or calls a fallback. Do not let an unbounded semaphore wait queue become the real outage queue. Queue length, wait time, timeout count, rejection count, and permit hold time should be observable.',
        'Do not use the current semaphore value as a precise planning signal unless the API promises it. Some systems report zero when waiters exist; others may expose approximate or race-prone values. The reliable control path is acquire and release, not polling a value and acting later.',
        'Keep the protected region small. A permit should be held only while the scarce resource is actually in use. Holding a permit across unrelated CPU work, logging, retries, sleeps, or user callbacks reduces effective capacity and makes incidents harder to reason about.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'An API service calls payments, search, and recommendations. Payments normally receives 400 requests per second with 50 millisecond hold time, so about 20 in-flight calls are expected. Search receives 250 requests per second with 80 millisecond hold time, also about 20. Recommendations receives 50 requests per second with 120 millisecond hold time, about 6.',
        'The service sets separate limits: 80 for payments, 60 for search, and 20 for recommendations. During an incident, recommendations slows to 2 seconds. Demand jumps to about 100 in-flight calls, but the semaphore admits only 20. The rest time out quickly or use a fallback. Payments and search do not lose their capacity because they do not share the recommendations permit pool.',
        'The semaphore did not fix recommendations. It prevented one slow dependency from becoming the whole outage. That is the operational point of a bulkhead: contain failure at the admission boundary.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: POSIX semaphore overview at https://man7.org/linux/man-pages/man7/sem_overview.7.html, sem_wait at https://man7.org/linux/man-pages/man3/sem_wait.3.html, sem_post at https://man7.org/linux/man-pages/man3/sem_post.3.html, sem_init at https://man7.org/linux/man-pages/man3/sem_init.3.html, and sem_getvalue at https://man7.org/linux/man-pages/man3/sem_getvalue.3.html.',
        'Study Futex Wait Queue for the sleep and wake slow path, Mutex for ownership and exclusion, Condition Variable for waiting on predicates, Bulkheads & Resource Isolation for failure containment, Backpressure & Flow Control for producer control, Token Bucket Rate Limiter for time-based admission, Message Queue for buffered handoff, and Circuit Breaker for dependency-failure policy.',
      ],
    },
  ],
};
