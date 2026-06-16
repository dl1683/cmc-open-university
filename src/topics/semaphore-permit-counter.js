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
    explanation: 'Workers A and B each decrement the counter and enter the bounded region. With two permits consumed, the third acquire cannot simply decrement to negative one.',
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
      heading: 'What it is',
      paragraphs: [
        'A semaphore is a permit counter with a waiting rule. Acquiring a permit decrements the counter when it is positive. Releasing a permit increments it or wakes a waiter. The counter is never allowed to become negative.',
        'Semaphores are useful because many resources are not exclusive. A lock says one thread may enter. A semaphore says up to N operations may enter: database connections, open files, in-flight API calls, download slots, GPU jobs, or worker tasks.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The fast path checks the count. If count is positive, acquire decrements and proceeds. If count is zero, the caller joins a wait queue, optionally with timeout or cancellation. Release wakes one waiter or restores a visible permit.',
        'Implementations differ on fairness. A strict FIFO semaphore reduces starvation but can waste capacity when the front waiter needs a large weighted permit. A looser semaphore may improve throughput but can surprise callers who expect arrival order.',
      ],
    },
    {
      heading: 'Case study: dependency bulkhead',
      paragraphs: [
        'An API service calling payments, search, and recommendations should not use one shared in-flight counter. Give each dependency its own semaphore. When recommendations slows, its semaphore fills and rejects or queues locally; payments and search still have their own permits.',
        'Sizing follows Little Law: in-flight work is arrival rate times hold time. The incident case is governed by tail latency, not the average. A downstream that holds calls for 2 seconds can require an order of magnitude more permits than it did when healthy.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Acquire and release are O(1) in the uncontended case. Contention adds a wait-queue operation, a wakeup, and sometimes a kernel transition. The hard parts are fairness, cancellation cleanup, timeout races, weighted acquisition, and avoiding unbounded queues behind the semaphore.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'A semaphore is not automatically a mutex, and a binary semaphore is still not the same abstraction as ownership-tracking mutual exclusion. A semaphore also does not decide the right overload policy. If exhausted callers wait forever, the semaphore has merely moved the outage into a queue.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: POSIX semaphore overview at https://man7.org/linux/man-pages/man7/sem_overview.7.html, sem_wait at https://man7.org/linux/man-pages/man3/sem_wait.3.html, and sem_post at https://man7.org/linux/man-pages/man3/sem_post.3.html. Study Futex Wait Queue, Bulkheads & Resource Isolation, Backpressure & Flow Control, Token Bucket Rate Limiter, and Message Queue next.',
      ],
    },
  ],
};
