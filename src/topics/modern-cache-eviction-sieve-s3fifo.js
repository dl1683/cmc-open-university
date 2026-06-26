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
  const cacheItems = 4; // A, B, C, D
  const maxThreads = 32;
  const sieveSteps = 6; // hit, queue, hand, bit, skip, evict

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
    explanation: `SIEVE keeps one queue, one hand pointer, and one visited bit per item across ${cacheItems} cached entries. Hits set the bit. Eviction walks ${sieveSteps} stages from old to new, clears visited items once, and evicts the first unvisited candidate.`,
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
    explanation: `A recently hit object gets one second chance across ${cacheItems} candidates. It is not moved to the head on every hit, which avoids the write amplification and synchronization pressure of strict LRU promotion.`,
    invariant: `No per-hit list promotion across ${cacheItems} entries is the scalability lesson.`,
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
    explanation: `The shape illustrates the paper claim: avoiding promotion on every hit can make a cache policy easier to scale under contention up to ${maxThreads} threads. The exact throughput depends on the implementation and workload.`,
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
    explanation: `SIEVE is attractive because the implementation surface spans just ${sieveSteps} conceptual steps. The serious evaluation still comes from trace replay and byte-aware workload testing, not from simplicity alone.`,
  };
}

function* s3fifoQueues() {
  const queueCount = 3; // small, main, ghost
  const policiesCompared = 4; // LRU, W-TinyLFU, SIEVE, S3-FIFO

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
    explanation: `S3-FIFO uses ${queueCount} FIFO queues instead of recency-list promotion. A small queue filters one-hit objects quickly, while the main and ghost queues preserve enough history to protect reusable objects.`,
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
    explanation: `The key S3-FIFO insight is quick demotion: most objects in skewed workloads are touched once, so the cache should remove many of them across ${queueCount} queues before they pollute the main resident set.`,
    invariant: `FIFO can be effective when ${queueCount} queues are arranged to filter noise early.`,
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
    explanation: `The paper reports broad trace results; this toy curve encodes the claimed direction. S3-FIFO aims for lower miss ratio while keeping the concurrency advantages of ${queueCount} FIFO queues.`,
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
    explanation: `Modern cache papers compare ${policiesCompared} policies not only for miss ratios but also for which policy has simple enough state transitions to scale in production.`,
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
      heading: 'How to read the animation',
      paragraphs: [
        {type: 'callout', text: 'SIEVE and S3-FIFO move intelligence off the cache-hit path and spend it lazily when eviction pressure appears.'},
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/52/Data_Queue.svg/250px-Data_Queue.svg.png', alt: 'FIFO queue diagram with input on one side and output on the other', caption: 'SIEVE and S3-FIFO deliberately return to queue-shaped state because FIFO movement is cheap to maintain under load. Source: Wikimedia Commons, Everaldo Coelho and YellowIcon, LGPL.'},
        'Read the SIEVE view as a cache under eviction pressure. Each item is a cached object, the visited bit means the object was hit since the hand last considered it, active marks the candidate under inspection, and found marks the victim whose bit is zero.',
        'Read the S3-FIFO view as three queues with different jobs. Small is the probation area for new objects, main is the resident area for proven objects, and ghost remembers recently evicted keys without storing values.',
        {type: 'image', src: './assets/gifs/modern-cache-eviction-sieve-s3fifo.gif', alt: 'Animated walkthrough of the modern cache eviction sieve s3fifo visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'A cache stores a small working set so repeated requests avoid slower storage or recomputation. The eviction policy decides which object leaves when the cache is full.',
        'Classic least-recently-used eviction, called LRU, moves an object to the front of a list on every hit. That is accurate recency tracking, but it mutates shared metadata on the hottest path in the system.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is strict LRU with a hash table and a doubly linked list. A hit finds the node in the hash table, splices it to the front, and evicts from the tail when space is needed.',
        'That design is correct for the rule it implements. If the workload mostly repeats recently used objects and contention is low, the list order is a useful prediction of future hits.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is that LRU pays on every hit and still handles scans badly. A one-time scan of cold objects can push genuinely hot objects toward eviction because every scanned object is treated as recently useful.',
        'With a cache of 4 holding A, B, C, D, a scan of X1 through X5 can leave the cache full of X objects that will never return. The policy spent pointer writes on every access and still kept the wrong objects.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'SIEVE changes the question from exact recency to cheap proof of reuse. A hit sets one bit, and eviction later consumes that bit as a second chance.',
        'S3-FIFO adds admission control. New objects must survive a small FIFO filter before they receive space in the main cache, so one-hit objects do not get equal standing with proven residents.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3a/Deque-01.svg/250px-Deque-01.svg.png', alt: 'Double-ended queue diagram with inputs and outputs on both ends', caption: 'Queue variants show why cache policies can separate cheap append and removal mechanics from higher-level admission rules. Source: Wikimedia Commons, David Eppstein, public domain.'},
        'SIEVE stores objects in insertion order and gives each object a visited bit. On a hit, it sets visited to true. On eviction, the hand skips true bits by clearing them, and evicts the first object whose bit is false.',
        'S3-FIFO sends every new object to small first. If it is accessed again before leaving small, it is promoted to main. If an object leaves main, its key can enter ghost, so a returning key can bypass probation.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The SIEVE invariant is that an object survives a hand pass only if it was used since the previous relevant pass. Clearing the bit does not lose the object; it spends the stored evidence and asks the object to prove reuse again.',
        'The S3-FIFO invariant is that main contains objects with reuse evidence, while small limits the damage from newcomers. A scan fills small briefly, but most scan objects never receive the second access needed to displace main residents.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/4/4f/KL_Intel_i7_die.jpg', alt: 'Processor die showing dense repeated compute and cache structures', caption: 'At high request rates, cache-policy metadata writes compete for the same cache hierarchy that user data depends on. Source: Wikimedia Commons, KL/Intel, public domain.'},
        'SIEVE uses O(n) space for n cached objects plus one bit per object. A hit is O(1) and usually one bit write; an eviction is amortized O(1) because each skipped true bit is cleared before it can be skipped again.',
        'The behavior matters more than the notation. When hit volume doubles, strict LRU doubles list splices on shared metadata, while SIEVE doubles cheap bit sets. S3-FIFO pays more metadata than SIEVE, but it spends that cost mostly at admission and eviction boundaries.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'These policies fit high-throughput web, object, and key-value caches where hits are far more common than misses. The access pattern is many concurrent readers touching shared cache state.',
        'They also fit workloads with many one-hit objects, such as crawlers, cache-busting URLs, short-lived media, or block traces with scans. The filter keeps these objects from occupying most of the resident set.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'SIEVE and S3-FIFO are not exact recency policies. If the workload is small, single-threaded, and dominated by true temporal locality, strict LRU may be simpler and just as good.',
        'They also need careful sizing for variable-size objects, expiration, invalidation, and ghost metadata. A cache policy decides what leaves under capacity pressure; it does not solve consistency or freshness by itself.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Suppose a cache holds 4 objects: A:1, B:0, C:1, D:0, where the number is the visited bit and the hand starts at A. A miss for E needs one eviction.',
        'The hand sees A:1, clears A to 0, and moves to B. B is 0, so B is evicted and E enters with bit 0. The resulting queue is A:0, C:1, D:0, E:0, and the eviction work was two inspections, not a hit-path list rewrite.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Study the SIEVE paper by Zhang et al., the S3-FIFO paper by Yang et al., the CLOCK page-replacement algorithm, and the ARC and 2Q cache papers. The useful comparison is not only miss ratio; it is miss ratio per metadata write on the hot path.',
        'Next study LRU Cache for the baseline, Hash Table for resident lookup, Count-Min Sketch for frequency-aware admission, and Cache Invalidation for the correctness problem eviction does not address.',
      ],
    },
  ],
};