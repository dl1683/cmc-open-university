// Modern cache eviction: SIEVE and S3-FIFO show how simple queue-based
// policies can compete with complex recency/frequency schemes.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'modern-cache-eviction-sieve-s3fifo',
  title: 'Modern Cache Eviction: SIEVE & S3-FIFO',
  category: 'Systems',
  summary: 'A modern cache-policy primer: SIEVE uses one queue plus a hand bit, while S3-FIFO uses three FIFO queues for quick demotion and scalability.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['SIEVE hand', 'S3-FIFO queues'], defaultValue: 'SIEVE hand' },
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
  return matrixState({ title, rows, columns, values: labelsByRow.map((row) => row.map(code)), format: (value) => labels[value] });
}

function* sieveHand() {
  yield {
    state: graphState({
      nodes: [
        { id: 'hit', label: 'hit', x: 0.9, y: 2.8, note: 'set bit' },
        { id: 'queue', label: 'queue', x: 2.6, y: 2.8, note: 'insert order' },
        { id: 'hand', label: 'hand', x: 4.2, y: 2.8, note: 'candidate' },
        { id: 'bit', label: 'visited?', x: 5.9, y: 2.8, note: 'one bit' },
        { id: 'skip', label: 'skip', x: 7.4, y: 2.8, note: 'clear bit' },
        { id: 'evict', label: 'evict', x: 9.0, y: 2.8, note: 'bit=0' },
      ],
      edges: [
        { id: 'e-hit-queue', from: 'hit', to: 'queue', weight: '' },
        { id: 'e-queue-hand', from: 'queue', to: 'hand', weight: '' },
        { id: 'e-hand-bit', from: 'hand', to: 'bit', weight: '' },
        { id: 'e-bit-skip', from: 'bit', to: 'skip', weight: '' },
        { id: 'e-skip-evict', from: 'skip', to: 'evict', weight: '' },
      ],
    }, { title: 'SIEVE keeps insertion order and one visited bit' }),
    highlight: { active: ['queue', 'hand', 'bit'], found: ['evict'] },
    explanation: 'SIEVE keeps one queue, one hand pointer, and one visited bit per item. Hits set the bit. Eviction walks candidates from old to new, clears visited items once, and evicts the first unvisited candidate.',
  };

  yield {
    state: labelMatrix(
      'SIEVE candidate scan',
      [
        { id: 'A', label: 'A old' },
        { id: 'B', label: 'B' },
        { id: 'C', label: 'C' },
        { id: 'D', label: 'D new' },
      ],
      [
        { id: 'visited', label: 'bit' },
        { id: 'action', label: 'action' },
      ],
      [
        ['1', 'clear+skip'],
        ['0', 'evict'],
        ['1', 'later'],
        ['0', 'later'],
      ],
    ),
    highlight: { active: ['A:visited'], found: ['B:action'] },
    explanation: 'A recently hit object gets one second chance. It is not moved to the head on every hit, which avoids the write amplification and synchronization pressure of strict LRU promotion.',
    invariant: 'No per-hit list promotion is the scalability lesson.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'threads', min: 1, max: 32 }, y: { label: 'relative throughput', min: 0, max: 8 } },
      series: [
        { id: 'lru', label: 'promotion-heavy LRU', points: [{ x: 1, y: 1.0 }, { x: 8, y: 1.8 }, { x: 16, y: 2.2 }, { x: 32, y: 2.4 }] },
        { id: 'sieve', label: 'SIEVE-style', points: [{ x: 1, y: 1.1 }, { x: 8, y: 3.1 }, { x: 16, y: 4.5 }, { x: 32, y: 6.2 }] },
      ],
    }),
    highlight: { active: ['sieve'], compare: ['lru'] },
    explanation: 'The shape illustrates the paper claim: avoiding promotion on every hit can make a cache policy easier to scale under contention. The exact throughput depends on the implementation and workload.',
  };

  yield {
    state: labelMatrix(
      'SIEVE tradeoffs',
      [
        { id: 'state', label: 'state' },
        { id: 'hit', label: 'hit path' },
        { id: 'evict', label: 'evict path' },
        { id: 'fit', label: 'fit' },
      ],
      [
        { id: 'choice', label: 'choice' },
        { id: 'lesson', label: 'lesson' },
      ],
      [
        ['queue+bit', 'small'],
        ['set bit', 'cheap'],
        ['hand scan', 'lazy work'],
        ['web cache', 'trace test'],
      ],
    ),
    highlight: { found: ['state:choice', 'hit:choice', 'evict:choice'] },
    explanation: 'SIEVE is attractive because the implementation surface is tiny. The serious evaluation still comes from trace replay and byte-aware workload testing, not from simplicity alone.',
  };
}

function* s3fifoQueues() {
  yield {
    state: graphState({
      nodes: [
        { id: 'new', label: 'new', x: 0.9, y: 2.8, note: 'miss' },
        { id: 'small', label: 'small Q', x: 2.7, y: 2.8, note: 'filter' },
        { id: 'main', label: 'main Q', x: 4.7, y: 2.8, note: 'resident' },
        { id: 'ghost', label: 'ghost Q', x: 6.7, y: 2.8, note: 'history' },
        { id: 'drop', label: 'drop', x: 8.6, y: 2.8, note: 'one-hit' },
      ],
      edges: [
        { id: 'e-new-small', from: 'new', to: 'small', weight: '' },
        { id: 'e-small-main', from: 'small', to: 'main', weight: '' },
        { id: 'e-main-ghost', from: 'main', to: 'ghost', weight: '' },
        { id: 'e-ghost-drop', from: 'ghost', to: 'drop', weight: '' },
      ],
    }, { title: 'S3-FIFO uses static FIFO queues for quick demotion' }),
    highlight: { active: ['small', 'main', 'ghost'], found: ['drop'] },
    explanation: 'S3-FIFO uses FIFO queues instead of recency-list promotion. A small queue filters one-hit objects quickly, while the main and ghost queues preserve enough history to protect reusable objects.',
  };

  yield {
    state: labelMatrix(
      'Three queues',
      [
        { id: 'S', label: 'small' },
        { id: 'M', label: 'main' },
        { id: 'G', label: 'ghost' },
      ],
      [
        { id: 'role', label: 'role' },
        { id: 'why', label: 'why' },
      ],
      [
        ['filter', 'quick demote'],
        ['retain', 'hot items'],
        ['history', 'avoid churn'],
      ],
    ),
    highlight: { found: ['S:why', 'M:role', 'G:role'] },
    explanation: 'The key S3-FIFO insight is quick demotion: most objects in skewed workloads are touched once, so the cache should remove many of them before they pollute the main resident set.',
    invariant: 'FIFO can be effective when the queues are arranged to filter noise early.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'cache size as % of objects', min: 0, max: 20 }, y: { label: 'miss ratio', min: 0, max: 1.0 } },
      series: [
        { id: 'lru', label: 'LRU-like', points: [{ x: 1, y: 0.78 }, { x: 3, y: 0.62 }, { x: 5, y: 0.50 }, { x: 10, y: 0.35 }, { x: 20, y: 0.22 }] },
        { id: 's3', label: 'S3-FIFO shape', points: [{ x: 1, y: 0.62 }, { x: 3, y: 0.45 }, { x: 5, y: 0.36 }, { x: 10, y: 0.24 }, { x: 20, y: 0.16 }] },
      ],
    }),
    highlight: { active: ['s3'], compare: ['lru'] },
    explanation: 'The paper reports broad trace results; this toy curve encodes the claimed direction. S3-FIFO aims for lower miss ratio while keeping the concurrency advantages of FIFO queues.',
  };

  yield {
    state: labelMatrix(
      'Policy comparison',
      [
        { id: 'LRU', label: 'LRU' },
        { id: 'WT', label: 'W-TinyLFU' },
        { id: 'SIEVE', label: 'SIEVE' },
        { id: 'S3', label: 'S3-FIFO' },
      ],
      [
        { id: 'hit', label: 'hit work' },
        { id: 'memory', label: 'memory' },
        { id: 'lesson', label: 'lesson' },
      ],
      [
        ['move node', 'list+map', 'recency'],
        ['sketch', 'counters', 'admission'],
        ['set bit', 'queue+bit', 'lazy'],
        ['append', '3 queues', 'demote'],
      ],
    ),
    highlight: { active: ['SIEVE:lesson', 'S3:lesson'], compare: ['LRU:hit', 'WT:hit'] },
    explanation: 'Modern cache papers are not only chasing lower miss ratios. They are also asking which policy has simple enough state transitions to scale in production.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'SIEVE hand') yield* sieveHand();
  else if (view === 'S3-FIFO queues') yield* s3fifoQueues();
  else throw new InputError('Pick a modern cache eviction view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'SIEVE and S3-FIFO are modern cache-eviction designs that push back against the assumption that better caches must maintain more elaborate recency structures. They are useful companions to LRU Cache and W-TinyLFU because they teach the production cost of touching shared metadata on every hit.',
        'SIEVE uses one insertion-order queue, one moving hand, and one visited bit per item. S3-FIFO uses three static FIFO queues to quickly demote one-hit objects and preserve a useful resident set. Both designs are deliberately simple because simplicity improves adoption, concurrency, and implementation auditability.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'In SIEVE, a cache hit sets the item visited bit but does not promote the item in a list. When eviction is needed, the hand scans old candidates. If a candidate was visited, the bit is cleared and the hand moves on; if not, the candidate is evicted. This gives reused objects a second chance while keeping hit handling cheap.',
        'S3-FIFO divides cache state into small, main, and ghost FIFO queues. The small queue filters new objects so one-hit noise is demoted quickly. The main queue keeps stronger residents, and the ghost queue preserves enough history to reduce churn. The algorithm turns FIFO from a naive policy into a structured filter.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The central cost lesson is metadata mutation. Strict LRU has to promote an item on every hit, which can become expensive under contention. SIEVE and S3-FIFO shift work toward append, bit setting, and eviction-time decisions. That can improve throughput and reduce lock pressure, but it must be tested against real traces and byte sizes. The deployment question is whether lower coordination cost offsets any workload-specific miss-ratio tradeoff.',
      ],
    },
    {
      heading: 'Real-world case study',
      paragraphs: [
        'The SIEVE NSDI 2024 work reports implementation in five production cache libraries with small code changes and evaluates 1559 traces from 7 sources. The S3-FIFO SOSP 2023 work reports 6594 traces from 14 datasets and emphasizes both miss-ratio robustness and higher throughput than optimized LRU in CacheLib at 16 threads.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'Do not read these papers as "LRU is dead." LRU is still simple, explainable, and often good enough. The better conclusion is that cache policy has two axes: efficiency and implementability. A policy with a slightly better hit curve may lose in production if it requires complex per-hit mutations, large ghost state, or workload-specific tuning.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: SIEVE is Simpler than LRU at https://www.usenix.org/conference/nsdi24/presentation/zhang-yazhuo and FIFO Queues Are All You Need for Cache Eviction at https://www.pdl.cmu.edu/ftp/Storage/FIFOqueues-SOSP23_abs.shtml. Study LRU Cache, W-TinyLFU Cache Admission, Count-Min Sketch, Cache Invalidation & Versioning, Tail Latency, and Load Balancer next.',
      ],
    },
  ],
};
