// Slab and size-class allocators: carve pages into fixed-size objects, then
// satisfy small allocations from per-size free lists and thread caches.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'slab-allocator-size-classes',
  title: 'Slab Allocator & Size Classes',
  category: 'Data Structures',
  summary: 'A small-object allocation pattern: round requests to size classes, keep free objects inside slabs/spans, and cache hot freelists per thread or CPU.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['size-class fast path', 'slabs and caches'], defaultValue: 'size-class fast path' },
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

function fastPath(title) {
  return graphState({
    nodes: [
      { id: 'request', label: 'request', x: 0.8, y: 3.2, note: '72 B' },
      { id: 'class', label: 'size class', x: 2.7, y: 3.2, note: '80 B' },
      { id: 'tcache', label: 'tcache', x: 4.6, y: 3.2, note: 'local list' },
      { id: 'slab', label: 'slab/span', x: 6.5, y: 3.2, note: 'objects' },
      { id: 'object', label: 'object', x: 8.4, y: 3.2, note: 'returned' },
    ],
    edges: [
      { id: 'e-request-class', from: 'request', to: 'class' },
      { id: 'e-class-tcache', from: 'class', to: 'tcache' },
      { id: 'e-tcache-slab', from: 'tcache', to: 'slab' },
      { id: 'e-slab-object', from: 'slab', to: 'object' },
    ],
  }, { title });
}

function refillPath(title) {
  return graphState({
    nodes: [
      { id: 'thread', label: 'thread cache', x: 0.8, y: 3.2, note: 'empty' },
      { id: 'central', label: 'central list', x: 2.9, y: 3.2, note: 'batch' },
      { id: 'span', label: 'span/slab', x: 5.0, y: 3.2, note: 'carve' },
      { id: 'page', label: 'page heap', x: 7.0, y: 3.2, note: 'large blocks' },
      { id: 'os', label: 'OS pages', x: 8.9, y: 3.2, note: 'last resort' },
    ],
    edges: [
      { id: 'e-thread-central', from: 'thread', to: 'central' },
      { id: 'e-central-span', from: 'central', to: 'span' },
      { id: 'e-span-page', from: 'span', to: 'page' },
      { id: 'e-page-os', from: 'page', to: 'os' },
    ],
  }, { title });
}

function* sizeClassFastPath() {
  yield {
    state: fastPath('Small allocations hit a size-class cache'),
    highlight: { active: ['class', 'tcache'], found: ['object'] },
    explanation: 'Modern allocators avoid searching the heap for every small request. They round the request to a size class and pop a ready object from a local free list when possible.',
    invariant: 'The returned block is at least the requested size, but belongs to a fixed size class.',
  };

  yield {
    state: labelMatrix(
      'Size-class rounding',
      [
        { id: 'r24', label: '24 B' },
        { id: 'r72', label: '72 B' },
        { id: 'r130', label: '130 B' },
        { id: 'r900', label: '900 B' },
      ],
      [
        { id: 'class', label: 'class' },
        { id: 'waste', label: 'slack' },
      ],
      [
        ['32 B', '8 B'],
        ['80 B', '8 B'],
        ['160 B', '30 B'],
        ['1 KB', '124 B'],
      ],
    ),
    highlight: { active: ['r72:class'], found: ['r72:waste'], compare: ['r900:waste'] },
    explanation: 'Size classes trade a little internal slack for speed and simple reuse. A freed 80-byte object can serve the next request that rounds to the same class.',
  };

  yield {
    state: labelMatrix(
      'Fast path versus refill',
      [
        { id: 'hit', label: 'tcache hit' },
        { id: 'miss', label: 'tcache miss' },
        { id: 'central', label: 'central hit' },
        { id: 'empty', label: 'central empty' },
      ],
      [
        { id: 'action', label: 'action' },
        { id: 'cost', label: 'cost' },
      ],
      [
        ['pop local', 'no lock'],
        ['ask central', 'batch refill'],
        ['move batch', 'amortized lock'],
        ['new span', 'page allocator'],
      ],
    ),
    highlight: { found: ['hit:action'], active: ['miss:action', 'central:action'], compare: ['empty:cost'] },
    explanation: 'Thread caches make the common path lock-free or low-lock. Refills happen in batches so one central-list trip feeds many future small allocations.',
  };

  yield {
    state: refillPath('Refill climbs from local cache to page heap'),
    highlight: { active: ['thread', 'central'], found: ['span'], compare: ['page', 'os'] },
    explanation: 'When a local free list is empty, the allocator refills from a central list. If the central list lacks free objects, it carves a new slab or span from larger page-level memory.',
  };
}

function* slabsAndCaches() {
  yield {
    state: labelMatrix(
      'Slab states',
      [
        { id: 'empty', label: 'empty slab' },
        { id: 'partial', label: 'partial slab' },
        { id: 'full', label: 'full slab' },
        { id: 'reclaim', label: 'reclaimable' },
      ],
      [
        { id: 'objects', label: 'objects' },
        { id: 'allocator', label: 'allocator action' },
      ],
      [
        ['all free', 'source objects'],
        ['some free', 'prefer allocate'],
        ['none free', 'skip'],
        ['all free', 'return pages'],
      ],
    ),
    highlight: { active: ['partial:allocator'], found: ['empty:allocator'], compare: ['full:allocator'] },
    explanation: 'A slab is a page or group of pages divided into equal-size objects. Allocators prefer partial slabs so they pack live objects and can eventually reclaim empty slabs.',
    invariant: 'Inside one slab cache, every object slot has the same size and alignment.',
  };

  yield {
    state: labelMatrix(
      'Who uses which layer',
      [
        { id: 'linux', label: 'Linux SLUB' },
        { id: 'tcmalloc', label: 'TCMalloc' },
        { id: 'jemalloc', label: 'jemalloc' },
        { id: 'buddy', label: 'buddy pages' },
      ],
      [
        { id: 'front', label: 'front end' },
        { id: 'back', label: 'back end' },
      ],
      [
        ['CPU slab cache', 'pages'],
        ['per-CPU/thread', 'page heap'],
        ['tcache/arena bins', 'extents'],
        ['free lists', 'physical pages'],
      ],
    ),
    highlight: { found: ['linux:front', 'tcmalloc:front', 'jemalloc:front'], compare: ['buddy:front'] },
    explanation: 'The vocabulary differs, but the same tiers recur: a fast local cache, a central pool by size class, and a large-block/page source underneath.',
  };

  yield {
    state: labelMatrix(
      'Design pressures',
      [
        { id: 'speed', label: 'speed' },
        { id: 'fragment', label: 'fragmentation' },
        { id: 'locks', label: 'lock contention' },
        { id: 'rss', label: 'RSS control' },
      ],
      [
        { id: 'tool', label: 'tool' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['local lists', 'idle memory'],
        ['size classes', 'rounding waste'],
        ['arenas/tcache', 'more caches'],
        ['purging/trim', 'latency spikes'],
      ],
    ),
    highlight: { active: ['speed:tool', 'locks:tool'], compare: ['rss:risk', 'fragment:risk'] },
    explanation: 'Allocators are tradeoff machines. The same cache that removes locks can retain idle memory. The same size class that enables reuse can create internal slack.',
  };

  yield {
    state: fastPath('The allocation path is a hierarchy of caches'),
    highlight: { active: ['request', 'class', 'tcache'], found: ['slab', 'object'] },
    explanation: 'The final mental model: small allocation is not one global heap search. It is size-class routing through local and central caches backed by page-level allocation.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'size-class fast path') yield* sizeClassFastPath();
  else if (view === 'slabs and caches') yield* slabsAndCaches();
  else throw new InputError('Pick a slab-allocator view.');
}

export const article = {
  sections: [
    {
      heading: 'Why this exists',
      paragraphs: [
        "Modern systems allocate huge numbers of small objects: request structs, map entries, timers, socket buffers, AST nodes, queue items, and short-lived strings. Treating every 24-byte, 72-byte, or 128-byte request as a custom heap search wastes time and creates fragmentation.",
        "A slab allocator solves the small-object case by admitting that many requests are almost the same size. It rounds requests into size classes, carves larger memory spans into equal slots, and reuses those slots through fast free lists. The source of memory may still be a buddy allocator or page heap, but the hot path is specialized for small, repeatable shapes.",
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        "The obvious allocator is one heap with one free list or a best-fit tree. It can find a block, split it, return the pointer, and later coalesce free blocks. That generality is useful for varied sizes, but it is expensive for millions of tiny allocations that only need a slot from a small menu of sizes.",
        "Another obvious answer is a buddy allocator. Buddies are excellent for page-like blocks because splitting and merging powers of two is simple. But a pure buddy policy can waste a 128-byte block on a 72-byte object. Small-object workloads need finer size classes and faster reuse than page-level allocation provides.",
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        "The wall is shape mismatch. A 72-byte request does not need a unique 72-byte hole; it needs any slot large enough and quick to reuse. A general allocator that keeps searching for the perfect fit is spending precision where the program only needs a bounded amount of slack.",
        "Concurrency is the other wall. If every thread fights over one allocator lock, the lock can cost more than the memory operation. Fast allocators separate the common local path from the rarer central path so most allocations avoid shared contention.",
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        "Round many request sizes into a smaller set of size classes, then keep fixed-size slots for each class. A freed 80-byte slot can serve the next request that rounds to 80 bytes without searching the heap. The allocator trades a little internal slack for a much simpler fast path.",
        "Slabs, spans, or runs supply slots in batches. A page-level allocator gives the slab layer a larger block; the slab layer carves it into equal objects. Thread or CPU caches keep hot free lists local. Central lists rebalance memory when local caches run dry or grow too large.",
      ],
    },
    {
      heading: 'What the animation teaches',
      paragraphs: [
        "The size-class view shows the common path. A request is rounded, mapped to a class, and served from a local free list if possible. The key idea is that allocation is no longer a search problem for the common case; it is a table lookup and a pop.",
        "The slabs-and-caches view shows why the hierarchy exists. Local caches give speed, central lists give sharing, and page-level memory gives large backing chunks. A good allocator moves memory between those layers without making every allocation pay the full coordination cost.",
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        "Allocation starts by mapping the requested size to a class. That mapping may be a lookup table for small sizes and arithmetic for larger classes. The allocator checks a thread-local, CPU-local, or arena-local cache for that class. If a slot is available, it pops the slot and returns it.",
        "On a local miss, the allocator refills from a central free list, usually in a batch. On a central miss, it obtains a new slab or span from page-level memory and carves it into equal slots. Free usually returns the object to the local cache for its class. If that cache is too full, it flushes a batch back to the central pool.",
        "If a slab becomes completely empty, the allocator may return its pages to the page heap or eventually purge memory back to the operating system. Different allocators tune that policy differently because returning memory improves footprint but can hurt latency when the same class becomes hot again.",
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        "A program asks for 72 bytes. The allocator maps 72 to an 80-byte class. The thread-local cache for 80-byte objects has a free slot, so allocation is just a pop from that free list. The program receives 80 usable bytes or 72 requested bytes plus allocator-defined slack, depending on the API contract.",
        "Later the object is freed. The allocator knows the class from metadata, pointer range, page map, or slab header, and returns the slot to the 80-byte free list. The next 72-byte or 80-byte-class request can reuse it immediately. No search for a best-fit heap hole is needed.",
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        "The invariant is simple: every object slot inside one slab cache has the same size and alignment. Because the allocator knows the class, it can push and pop slots from a free list without per-object fitting logic. That is the heart of the speedup.",
        "Batching makes slow paths pay for many future fast paths. One trip to a central list can refill a local cache with several objects, amortizing locks and metadata work across later allocations. The allocator spends coordination only when local supply changes.",
      ],
    },
    {
      heading: 'Cost and behavior',
      paragraphs: [
        "The common small-allocation path is O(1): map size to class, pop from a free list, and return. Refill and page-heap paths are slower, but they happen less often when batches and caches are tuned well. Free is also usually O(1), though debug modes, quarantine, memory tagging, or security hardening can add work.",
        "The costs are slack, metadata, and retained memory. A 72-byte request in an 80-byte class carries 8 bytes of internal slack. A local cache can hold idle objects. A slab with one live object may keep an entire page from being returned. More arenas and local caches reduce contention but can increase resident memory.",
      ],
    },
    {
      heading: 'Design choices',
      paragraphs: [
        "Size-class spacing is a policy decision. Tight classes reduce internal fragmentation but increase metadata, central lists, and cache management. Wider classes simplify the allocator but waste more memory inside each rounded allocation. Allocators choose class tables around expected workloads, cache lines, alignment, and page sizes.",
        "Locality is another policy. Per-thread caches are fast but can hoard memory when many threads become idle. Per-CPU caches can reduce thread explosion but need careful synchronization and migration handling. Arenas reduce global contention but can fragment memory across threads or tenants.",
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        "Slab allocation wins for frequent small allocations with repeatable sizes and lifetimes: kernel objects, network buffers, request structs, compiler nodes, runtime objects, cache entries, and server-side data structures. It is especially valuable when the same sizes are allocated and freed repeatedly.",
        "Linux SLAB and SLUB organize kernel objects into caches and slabs above page allocation. TCMalloc uses front-end caches, central free lists or transfer caches, and a page heap. jemalloc uses size classes, thread caches, arenas, bins, and extents. The names differ, but the hierarchy is stable: local free lists, central pools, and larger backing memory.",
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        "Size classes do not eliminate fragmentation; they choose a controlled form of it. Rounding creates internal slack, and partially full slabs create page-level fragmentation. A workload with many one-off sizes or long-lived objects that pin mostly empty slabs can still waste memory.",
        "The fastest allocator on a microbenchmark can be the wrong allocator for a service. Allocation behavior depends on size distribution, object lifetime, thread count, reuse pattern, NUMA placement, security settings, purging policy, and whether latency or memory footprint matters more.",
      ],
    },
    {
      heading: 'Failure modes',
      paragraphs: [
        "Watch for retained memory after traffic drops, class imbalance where one size class grows without bound, cross-thread frees that defeat locality, false sharing between adjacent objects, and debug features that change the performance profile. Allocator telemetry should separate requested bytes, allocated class bytes, retained bytes, and returned-to-OS bytes.",
        "Security hardening also changes the picture. Quarantine, guard pages, canaries, memory tagging, junk filling, and randomization can make allocation safer but slower or larger. A production allocator choice is a systems tradeoff, not just a data-structure benchmark.",
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        "Primary sources: Linux slab allocator chapter at https://www.kernel.org/doc/gorman/html/understand/understand011.html, Oracle Linux SLUB internals at https://blogs.oracle.com/linux/linux-slub-allocator-internals-and-debugging-1, TCMalloc design at https://google.github.io/tcmalloc/design.html, gperftools TCMalloc notes at https://pages.cs.wisc.edu/~danb/google-perftools-0.98/tcmalloc.html, jemalloc manual at https://jemalloc.net/jemalloc.3.html, and Meta engineering on jemalloc at https://engineering.fb.com/2011/01/03/core-infra/scalable-memory-allocation-using-jemalloc/.",
        "Study Buddy Allocator Free Lists for page-level backing memory, TLSF Real-Time Allocator Bitmap Index for bounded-time allocation, GPU Memory Pool Fragmentation Ledger for another pooling problem, Generational Arena Slot Map for stable object handles, Linked List and Ring Buffer for free-list mechanics, Hazard Pointers and Epoch Reclamation for safe reclamation, and LRU Cache for object reuse under pressure.",
      ],
    },
  ],
};
