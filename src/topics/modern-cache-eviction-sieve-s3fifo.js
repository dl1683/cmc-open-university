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
      heading: "Why this exists",
      paragraphs: [
        "Classic cache teaching often stops at LRU: keep a hash table, keep a recency list, move a node to the front on every hit, and evict the tail. That design is clear, but the hit path mutates shared metadata. In a busy production cache, a read can become a write to the policy state.",
        "SIEVE and S3-FIFO exist because modern cache design has two goals, not one. The cache should keep useful objects, but it should also be cheap to run under concurrency. A policy with a slightly better miss ratio can still lose if every hit grabs a lock, rewires a list, or dirties memory that many cores contend over.",
      ],
    },
    {
      heading: "The naive improvement path",
      paragraphs: [
        "The obvious response to LRU's weaknesses is to add more intelligence. Add frequency counters. Add ghost histories. Add segments. Add adaptive weights. These techniques can help, especially against scans and mixed workloads, but they can also make the implementation harder to reason about and harder to scale.",
        "A second naive response is to keep FIFO because it is simple. Insert at one end, evict from the other, and never mutate entries on hit. Plain FIFO has a fatal flaw: it forgets reuse. A hot object inserted long ago can be evicted just because time passed, while a stream of cold newcomers receives equal treatment.",
      ],
    },
    {
      heading: "The core question",
      paragraphs: [
        "SIEVE and S3-FIFO ask whether FIFO-like simplicity can be repaired without returning to full LRU-style promotion. The goal is not to pretend recency and frequency do not matter. The goal is to encode enough reuse evidence with much cheaper state transitions.",
        "This changes the design lens. Instead of asking which policy is most elegant on paper, ask which policy gives a good hit rate per byte of metadata, per hit-path mutation, and per unit of implementation complexity. That is why these algorithms are interesting even when LRU remains a useful baseline.",
      ],
    },
    {
      heading: "SIEVE in one pass",
      paragraphs: [
        "SIEVE keeps a queue plus one visited bit per object. A hit does not move the object. It only sets the bit. On eviction, a hand scans candidate victims. If it sees an object with the bit set, it clears the bit and gives the object a second chance. The first unvisited object becomes the victim.",
        "This is deliberately lazy. Recency is not updated on every hit. Reuse evidence accumulates as a bit and is consumed only when the eviction hand reaches the object. A hot object must keep receiving hits before the hand arrives; otherwise it eventually loses its second chance and leaves.",
      ],
    },
    {
      heading: "S3-FIFO in one pass",
      paragraphs: [
        "S3-FIFO uses FIFO queues as a filter pipeline. A small queue receives new objects and catches bursts. Objects that show reuse can move toward a larger main queue. A ghost queue remembers recently rejected or evicted keys without storing their values, so a repeated key can be treated differently from a pure one-hit object.",
        "The point is that FIFO is not the whole policy. The queues define stages. The small queue absorbs noise. The main queue protects objects that have earned longer residence. The ghost queue supplies memory about recent losers. Together they approximate reuse discrimination while keeping queue operations simple.",
      ],
    },
    {
      heading: "What the visual is proving",
      paragraphs: [
        "The SIEVE visual is proving that a cache hit can be recorded without promotion. The key event is not a node moving to the front; it is a bit flip that the eviction hand will interpret later. This matters because the common case in a good cache is a hit, and SIEVE keeps that path small.",
        "The S3-FIFO visual is proving that FIFO can be a structured admission and retention system, not just a dumb line. Watch where a new object first lands, what evidence lets it survive, and what metadata remains after its value leaves. The queues are a policy pipeline.",
      ],
    },
    {
      heading: "Why these policies work",
      paragraphs: [
        "SIEVE works because many cache objects only need one extra test. If an object is touched again before eviction pressure reaches it, the visited bit records that fact. If it is not touched, it remains a cheap victim. The policy filters one-hit noise without paying full promotion cost on every hit.",
        "S3-FIFO works because many workloads have a large population of objects that are requested once and a smaller population that repeats. A staged FIFO design can make one-hit objects die in a small region, while repeated objects escape into stronger residence. The ghost queue improves adaptation by remembering recent mistakes.",
      ],
    },
    {
      heading: "Implementation details",
      paragraphs: [
        "The practical attraction is that the hot path can be small. In SIEVE, a hit can be reduced to finding the resident object and setting a visited flag. The policy avoids removing and reinserting a node for every successful lookup, which is exactly the operation that makes LRU expensive under contention.",
        "S3-FIFO shifts complexity into queue boundaries. The implementation must decide the sizes of the small, main, and ghost queues, and it must update membership consistently as objects move or leave. Those operations are still simpler than maintaining a total recency order for every resident item.",
      ],
    },
    {
      heading: "Costs and tradeoffs",
      paragraphs: [
        "The main benefit is reduced hit-path work. SIEVE changes a hit into a bit write instead of a list splice. S3-FIFO uses simple queue movement and small metadata instead of fully ordering all residents by recent access. That can improve throughput, lock behavior, and memory locality.",
        "The cost is that these policies are less directly intuitive than textbook LRU. Eviction can do more work because the hand may scan visited entries. Queue sizes and thresholds matter. Ghost metadata consumes space. A clean paper algorithm still needs careful engineering around sharding, counters, item weights, and concurrent updates.",
      ],
    },
    {
      heading: "Reading benchmark results",
      paragraphs: [
        "Cache papers often report miss ratios, but a production reader should also ask what was counted as cost. A policy that wins by a tiny miss-ratio margin may lose after accounting for locks, allocations, metadata writes, and cache-line traffic. The right comparison includes throughput and latency, not only misses.",
        "Trace diversity matters as well. A policy can look excellent on scans, weak on looping working sets, or sensitive to object-size distributions. The lesson is to replay traces from the target service whenever possible, then inspect the losing requests instead of trusting an average alone.",
      ],
    },
    {
      heading: "Real uses and evaluation",
      paragraphs: [
        "These policies are most relevant for high-throughput in-memory caches, storage caches, CDN edges, and service caches where hit rate and policy overhead both matter. They are also useful as research baselines because they challenge the assumption that sophisticated list movement is required for competitive performance.",
        "Evaluation must use real traces. Synthetic traces can make almost any policy look good if the access distribution matches its bias. A serious comparison reports object hit rate, byte hit rate, update cost, memory overhead, concurrency behavior, tail latency, and sensitivity to object-size skew.",
      ],
    },
    {
      heading: "Failure modes and limits",
      paragraphs: [
        "Do not read SIEVE or S3-FIFO as a declaration that LRU is obsolete. LRU remains easy to explain, easy to implement, and strong when temporal locality is the dominant signal. If the cache is small, single-threaded, or not performance critical, simpler textbook LRU may be the right answer.",
        "Queue-based policies can still fail under workload shifts, adversarial scans, poor sizing, or value-size skew. They also do not solve expiration, invalidation, write ordering, stale data, or admission cost by themselves. A cache policy is one part of a service contract, not the contract itself.",
      ],
    },
    {
      heading: "Study next",
      paragraphs: [
        "Primary sources: SIEVE is Simpler than LRU at https://www.usenix.org/conference/nsdi24/presentation/zhang-yazhuo and FIFO Queues Are All You Need for Cache Eviction at https://www.pdl.cmu.edu/ftp/Storage/FIFOqueues-SOSP23_abs.shtml. Read them for both miss-ratio results and implementation motivation.",
        "Study LRU Cache first to understand the baseline mutation cost. Then study W-TinyLFU Cache Admission for admission-vs-eviction separation, Count-Min Sketch for compact frequency evidence, Cache Invalidation for correctness boundaries, Tail Latency for service impact, and Load Balancer for another example where simple state transitions can beat clever but expensive control.",
      ],
    },
  ],
};
