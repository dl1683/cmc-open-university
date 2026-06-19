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
      heading: 'How to read the animation',
      paragraphs: [
        'The SIEVE view shows a queue of cached objects, each carrying one visited bit. Active nodes mark the current eviction candidate under the hand pointer. Found marks the object about to be evicted -- the first candidate whose bit is zero. When a node is skipped, its bit is cleared (second chance consumed), and the hand advances.',
        'The S3-FIFO view shows three FIFO queues: small (admission filter), main (resident set), and ghost (key-only history). Active marks the queue currently receiving or evicting an object. Found marks the object being dropped or promoted. Watch objects enter small, prove reuse to reach main, and leave metadata behind in ghost.',
        {
          type: 'note',
          text: 'Both views show policy state, not data flow. The animation proves that a cache hit need not mutate ordering metadata -- it can be as cheap as flipping one bit or appending to a queue tail.',
        },
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Every cache must answer two questions: what to keep and what to evict. LRU answers both with a single recency list -- on every hit, move the accessed object to the front; on eviction, remove the tail. The logic is simple and the hit rate is good when temporal locality dominates.',
        'The problem is the hit path. Every cache hit in strict LRU requires removing a node from its current position and reinserting it at the head. That is a linked-list splice: update four pointers, acquire a lock (or use a lock-free list with CAS retries), and dirty at least two cache lines. When the cache serves millions of requests per second across 32+ cores, the hit path becomes the bottleneck. The miss ratio might be excellent, but throughput collapses under contention.',
        'SIEVE (Zhang et al., NSDI 2024) and S3-FIFO (Yang et al., SOSP 2023) attack this problem from the same direction: replace per-hit promotion with cheaper evidence accumulation, and defer the real work to eviction time. Both achieve competitive miss ratios while making the common-case hit path nearly free of shared-state mutation.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The natural response to LRU contention is to add sophistication. ARC (Megiddo and Modha, 2003) maintains two LRU lists plus two ghost lists and adapts the split between recency and frequency online. 2Q (Johnson and Shasha, 1994) separates a short-term FIFO from a long-term LRU. W-TinyLFU (Einziger et al., 2017) uses a Count-Min Sketch to gate admission into a segmented LRU. These designs improve miss ratios on mixed workloads, but each one adds per-hit bookkeeping: frequency counters, ghost lookups, adaptive parameters, or multi-list promotions.',
        'A second instinct is to go simpler: use plain FIFO. Insert at the tail, evict from the head, never touch an entry on hit. FIFO has zero hit-path cost, but its miss ratio is terrible. A hot object inserted early gets evicted just because time passed, while a burst of cold objects fills the cache. FIFO has no memory of reuse.',
        'The design space looks like a tradeoff between hit-rate intelligence and hit-path cost. More intelligence means more metadata mutation on the hot path. Less mutation means forgetting which objects matter.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is scan resistance. Consider a cache of size 4 holding objects {A, B, C, D}, all frequently reused. A sequential scan of 5 new objects {X1, X2, X3, X4, X5} arrives -- none will ever be requested again. Under plain FIFO, the scan evicts all four hot objects and fills the cache with one-hit garbage. Under strict LRU, each scan object is promoted to the head, pushing hot objects toward the tail. After the scan, the cache holds {X2, X3, X4, X5} and every future request for A-D is a miss.',
        'This is the one-hit-wonder problem. In production traces (CDN logs, block-storage traces, key-value workloads), 60-80% of objects are accessed exactly once. Any policy that gives a newcomer equal standing with a proven resident will waste most of its capacity on objects that will never return.',
        {
          type: 'note',
          text: 'The wall is not "LRU is slow." LRU is often fast enough. The wall is that per-hit promotion is simultaneously too expensive for throughput AND too generous for one-hit objects. You pay a high price on the hot path to maintain an ordering that scan traffic immediately destroys.',
        },
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'SIEVE keeps all cached objects in a single FIFO queue. Each object carries one visited bit, initially zero. On a cache hit, the only mutation is setting that bit to 1 -- no list movement, no lock on shared structure. On eviction, a hand pointer walks the queue from its current position. If the candidate has visited=1, the hand clears the bit (second chance) and advances. If visited=0, the object is evicted and the hand stops.',
        {
          type: 'diagram',
          label: 'SIEVE lazy promotion with hand pointer',
          text: 'Queue (insertion order, oldest on left):\n\n  [A:1] [B:0] [C:1] [D:0] [E:1]\n   ^\n   hand\n\nEviction walk:\n  A has visited=1 -> clear to 0, advance hand\n  B has visited=0 -> EVICT B, hand stays at C\n\nAfter eviction:\n  [A:0] [C:1] [D:0] [E:1] [F:0]   (F is the new insert)\n         ^\n         hand',
        },
        'S3-FIFO splits the cache into three FIFO queues. The small queue (typically 10% of cache capacity) receives all new objects. When small is full, objects at its head are examined: if the object was re-accessed (its frequency bit is set), it moves to the main queue; otherwise it is evicted immediately. The main queue (90% of capacity) holds proven objects. When main is full, evicted keys (not values) go to the ghost queue. If a new miss hits a key in the ghost queue, the object enters main directly, bypassing the small-queue filter.',
        {
          type: 'code',
          language: 'javascript',
          text: '// SIEVE eviction -- the complete policy in ~30 lines\nfunction sieveEvict(cache) {\n  // cache.hand points to current candidate in the circular queue\n  // cache.queue is a doubly-linked list in insertion order\n  // each node has: key, value, visited (boolean)\n\n  let candidate = cache.hand;\n  while (candidate.visited) {\n    // Second chance: clear the bit, advance\n    candidate.visited = false;\n    candidate = candidate.next || cache.queue.head; // wrap around\n  }\n\n  // candidate.visited === false -- evict it\n  cache.hand = candidate.next || cache.queue.head;\n  cache.map.delete(candidate.key);\n  cache.queue.remove(candidate);\n  cache.size--;\n  return candidate;\n}\n\n// Hit path -- this is the whole point\nfunction sieveAccess(cache, key) {\n  const node = cache.map.get(key);\n  if (node) {\n    node.visited = true;  // no list movement, no lock needed\n    return node.value;\n  }\n  return undefined; // miss -- caller handles insertion + eviction\n}',
        },
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'SIEVE works because one bit of reuse evidence, consumed lazily, is enough to separate one-hit objects from reusable ones. The invariant: an object survives eviction if and only if it was accessed at least once between the previous time the hand passed it and the current pass. Hot objects accumulate visited=1 repeatedly and survive repeated hand sweeps. Cold objects inserted by a scan never get their bit set and are evicted on the first pass.',
        'This is a form of the CLOCK algorithm (Corbato, 1968), but with a key difference. Classic CLOCK walks a circular buffer and treats all entries equally. SIEVE keeps insertion order and walks candidates from old to new, which gives newer objects more time to prove reuse before the hand reaches them. The Zhang et al. paper shows this ordering bias improves miss ratios by 10-40% over standard CLOCK on production traces.',
        'S3-FIFO works because the small queue acts as a probationary filter. Most objects in skewed workloads are one-hit wonders. By confining newcomers to a small region (10% of capacity), the policy ensures that one-hit objects consume little space and leave quickly. Only objects that prove reuse within the small queue earn promotion to main. The ghost queue adds a second chance for objects that were evicted from main -- if they return, they bypass the filter, reflecting learned reuse.',
        {
          type: 'note',
          text: 'The correctness argument is not about optimal eviction. No online algorithm can match the offline optimal (Belady MIN) without future knowledge. The argument is that these policies filter noise cheaply enough that the remaining eviction decisions are good enough, while the hit-path savings compound across billions of requests.',
        },
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        {
          type: 'table',
          headers: ['Policy', 'Hit rate', 'Hit-path cost', 'Eviction cost', 'Metadata per object', 'Implementation complexity'],
          rows: [
            ['LRU', 'Good (baseline)', 'O(1) but list splice + lock', 'O(1) remove tail', 'Two pointers (prev/next) + hash entry', 'Low -- but concurrency is hard'],
            ['CLOCK', 'Fair (~LRU - 5-15%)', 'O(1) set bit', 'O(1) amortized hand scan', 'One bit + circular buffer slot', 'Very low'],
            ['2Q', 'Good-to-strong', 'O(1) but may promote across lists', 'O(1) per list', 'Two list pointers + queue membership', 'Medium -- two lists, threshold tuning'],
            ['ARC', 'Strong (adaptive)', 'O(1) but ghost lookup + list move', 'O(1) + adaptation', 'Four lists + ghost entries', 'High -- patents, parameter adaptation'],
            ['SIEVE', 'Strong (~LRU or better)', 'O(1) set one bit', 'O(1) amortized hand scan', 'One bit + queue position', 'Very low -- ~30 lines of core logic'],
            ['S3-FIFO', 'Strong (often best on traces)', 'O(1) set freq bit', 'O(1) amortized queue ops', 'Freq bit + queue membership + ghost key', 'Medium -- three queues, size tuning'],
          ],
        },
        'SIEVE costs one bit per cached object and zero pointer mutations on hit. Eviction cost is amortized O(1): the hand may scan multiple visited entries before finding a victim, but each scan clears a bit that will not be scanned again until the next cycle. Worst case for a single eviction is O(n) if every object was recently hit, but this is rare in practice and each cleared bit reduces future scan cost.',
        'S3-FIFO costs one frequency bit per object in the small and main queues, plus one key entry per ghost slot (no stored value). The ghost queue is typically bounded at 10-50% of cache capacity in key count. Total metadata overhead is modest compared to ARC (which stores ghost entries with full key metadata across four lists) or W-TinyLFU (which maintains a Count-Min Sketch of 8-10 counters per cache slot).',
        'Both policies share a critical advantage: the hit path does not acquire a global lock or modify shared pointers. This means the hit path can be made lock-free with a single atomic bit-set, or batched with a lightweight per-thread buffer. LRU cannot do this without fundamentally changing its data structure (e.g., approximation via sampling, as in Redis).',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'High-throughput in-memory caches are the primary win. Meta adopted S3-FIFO in CacheLib, their unified caching framework serving billions of requests per day across CDN, social graph, and storage workloads. The Yang et al. paper reports that S3-FIFO matches or beats state-of-the-art policies on 6,594 production traces from 14 companies while using simpler data structures.',
        'CDN edge caches benefit because CDN traffic is heavily skewed: a small fraction of objects account for most hits, while the long tail of one-hit objects (unique URLs, bot crawls, cache-busting query strings) creates constant scan pressure. SIEVE and S3-FIFO filter this noise without paying per-hit promotion cost.',
        {
          type: 'bullets',
          items: [
            'Block storage caches: S3-FIFO tested on MSR Cambridge traces (enterprise file server, email, web server) -- consistently competitive with ARC and 2Q.',
            'Key-value stores: the SIEVE paper demonstrates integration with production-grade caches (libCacheSim benchmarks across Twitter, Meta, Tencent, WikiCDN traces).',
            'Any system where the hit:miss ratio is high (>90% hit rate) and the cache serves many concurrent readers. The savings on the hit path multiply across cores.',
            'Systems where the cache policy must be simple enough to audit. SIEVE is about 30 lines of core logic -- easier to verify than ARC or W-TinyLFU.',
          ],
        },
        'The scaling advantage is real. The SIEVE paper shows 2-3x throughput improvement over promotion-heavy LRU under 16-thread contention, because the hit path avoids pointer mutation entirely. S3-FIFO shows similar concurrency gains because FIFO append is cheaper than LRU splice.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'LRU is not obsolete. When temporal locality is the dominant signal (recently accessed objects are overwhelmingly likely to be accessed again), LRU is hard to beat because its ordering perfectly captures the relevant information. Small caches, single-threaded applications, or workloads without scan pressure may see no benefit from switching.',
        'SIEVE can struggle with looping access patterns. If the working set is slightly larger than the cache and access is cyclic (A, B, C, D, E, A, B, C, D, E... with cache size 4), the hand may clear bits for objects that are about to be needed, leading to thrashing. LRU also thrashes here, but SIEVE does not improve on it.',
        {
          type: 'bullets',
          items: [
            'Variable-size objects: both papers evaluate primarily by object count, not byte weight. A policy that evicts many small objects to keep one large object may waste capacity. Production caches need byte-aware eviction, which neither paper fully addresses.',
            'Expiration and invalidation: cache policies decide what to evict under capacity pressure. They do not handle TTL expiry, explicit invalidation, write-through consistency, or stale-while-revalidate. These are orthogonal concerns.',
            'Ghost queue sizing in S3-FIFO: too small and the ghost provides little memory; too large and it wastes metadata space. The paper uses 10% of cache size, but optimal sizing depends on the workload.',
            'Adversarial access: a carefully crafted access pattern can force SIEVE to scan the entire queue on every eviction by keeping all bits set. This is unlikely in production but relevant for security-sensitive caches.',
          ],
        },
        'Neither policy is a drop-in replacement for all use cases. They are strongest where the workload is skewed, the cache is large, and concurrency matters. For a 100-entry cache in a single-threaded script, use a hash map and a doubly-linked list.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        {
          type: 'bullets',
          items: [
            'SIEVE: "SIEVE is Simpler than LRU: an Efficient Turn-Key Eviction Algorithm for Web Caches" -- Zhang et al., NSDI 2024. https://www.usenix.org/conference/nsdi24/presentation/zhang-yazhuo',
            'S3-FIFO: "FIFO Queues Are All You Need for Cache Eviction" -- Yang et al., SOSP 2023. https://dl.acm.org/doi/10.1145/3600006.3613147',
            'CacheLib: Meta\'s production caching engine where S3-FIFO is integrated. https://cachelib.org/',
            'ARC: "ARC: A Self-Tuning, Low Overhead Replacement Cache" -- Megiddo and Modha, FAST 2003.',
            'CLOCK: Corbato, 1968 -- the original second-chance page replacement algorithm that SIEVE extends.',
          ],
        },
        {
          type: 'table',
          headers: ['Role', 'Topic', 'Why'],
          rows: [
            ['Prerequisite', 'LRU Cache', 'Understand the baseline: doubly-linked list + hash map, per-hit promotion cost, and why it is the default teaching policy.'],
            ['Prerequisite', 'Hash Table', 'The O(1) lookup that every cache policy depends on for the resident-set check.'],
            ['Extension', 'W-TinyLFU Cache Admission', 'Admission control as a separate concern from eviction -- uses a Count-Min Sketch to gate entry.'],
            ['Extension', 'Count-Min Sketch', 'The probabilistic frequency counter that W-TinyLFU and other frequency-aware policies rely on.'],
            ['Contrast', 'Cache Invalidation', 'The correctness boundary that eviction policies do not address: when cached data becomes stale.'],
            ['Production', 'Tail Latency', 'Cache misses hit the tail -- understanding P99 impact of eviction policy choices.'],
          ],
        },
      ],
    },
  ],
};

