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
      heading: 'What it is',
      paragraphs: [
        'A slab or size-class allocator handles small objects by rounding requests to predefined sizes and reusing fixed-size slots. Instead of searching a general heap for a 72-byte object, the allocator routes the request to the 80-byte size class and pops a free object from a list or cache.',
        'The slab idea is especially clear in kernels. A cache for a particular object type, such as task structures or inode structures, owns slabs made of pages. Each slab is divided into equal-size object slots. User-space malloc implementations generalize the idea with size classes, thread caches, central free lists, arenas, spans, and extents.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'On allocation, round the request to a size class. Check the local thread or CPU cache for that class. If it has a free object, pop and return it. If it is empty, refill it from a central list, usually in a batch. If the central list is empty, carve a new slab or span from page-level memory, which may ultimately come from a buddy allocator or the operating system.',
        'On free, the object usually returns to the local cache for its size class. If the local cache grows too large, it flushes a batch back to the central list. Completely empty slabs or spans may be returned to the page heap or purged back to the OS depending on allocator policy.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The common small-allocation path is designed to be O(1): map size to class, pop from a free list, and return. Refill paths are slower but amortized across batches. Space overhead comes from size-class slack, metadata, cached but currently unused objects, and pages that cannot be returned because at least one object is still live.',
        'Concurrency changes the design. One global malloc lock would be disastrous on multicore workloads. Thread caches, per-CPU caches, and arenas reduce contention, but they can increase memory footprint because each local cache may hold idle objects.',
      ],
    },
    {
      heading: 'Real-world case study',
      paragraphs: [
        'Linux SLAB and SLUB allocators organize kernel objects into caches and slabs, sitting above page allocation. The buddy allocator supplies page-sized blocks; the slab layer turns them into many fixed-size objects and keeps hot objects reusable.',
        'TCMalloc uses front-end caches, a transfer cache or central free list, and a page heap. jemalloc uses size classes, thread caches, arenas, bins, and extents. Meta adopted jemalloc for scalable allocation and fragmentation control in server workloads. The exact engineering differs, but the data-structure pattern is the same hierarchy of local free lists, central pools, and larger backing memory.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'The fastest allocator on a microbenchmark can be the wrong allocator for a service. Local caches reduce latency but may raise resident memory. Aggressive purging lowers RSS but can add latency. More arenas reduce lock contention but can increase fragmentation. Allocation behavior depends on size distribution, object lifetime, thread count, and reuse patterns.',
        'Another misconception is that size classes eliminate fragmentation. They mostly control it. Rounding creates internal fragmentation, while partially full slabs create page-level fragmentation. Good allocators monitor, decay, purge, rebalance caches, and expose statistics because the right tradeoff is workload-specific.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Linux slab allocator chapter at https://www.kernel.org/doc/gorman/html/understand/understand011.html, Oracle Linux SLUB internals at https://blogs.oracle.com/linux/linux-slub-allocator-internals-and-debugging-1, TCMalloc design at https://google.github.io/tcmalloc/design.html, gperftools TCMalloc notes at https://pages.cs.wisc.edu/~danb/google-perftools-0.98/tcmalloc.html, jemalloc manual at https://jemalloc.net/jemalloc.3.html, and Meta engineering on jemalloc at https://engineering.fb.com/2011/01/03/core-infra/scalable-memory-allocation-using-jemalloc/. Study Buddy Allocator Free Lists, TLSF Real-Time Allocator Bitmap Index, GPU Memory Pool Fragmentation Ledger, Generational Arena Slot Map, Linked List, Ring Buffer, Hazard Pointers & Epoch Reclamation, and LRU Cache next.',
      ],
    },
  ],
};
