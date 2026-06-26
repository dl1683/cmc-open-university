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
  const requestSize = 72;
  const classSize = 80;
  const slack = classSize - requestSize;
  const sizeClasses = 4;

  yield {
    state: fastPath('Small allocations hit a size-class cache'),
    highlight: { active: ['class', 'tcache'], found: ['object'] },
    explanation: `Modern allocators avoid searching the heap for every small request. They round a ${requestSize}-byte request to a ${classSize}-byte size class and pop a ready object from a local free list when possible.`,
    invariant: `The returned block is at least the requested ${requestSize} bytes, but belongs to a fixed ${classSize}-byte size class with ${slack} bytes of slack.`,
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
    explanation: `Size classes trade a little internal slack for speed and simple reuse. A freed ${classSize}-byte object can serve the next ${requestSize}-byte request that rounds to the same class, with only ${slack} bytes wasted.`,
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
    explanation: `Thread caches make the common path lock-free or low-lock across all ${sizeClasses} escalation levels. Refills happen in batches so one central-list trip feeds many future small allocations.`,
  };

  yield {
    state: refillPath('Refill climbs from local cache to page heap'),
    highlight: { active: ['thread', 'central'], found: ['span'], compare: ['page', 'os'] },
    explanation: `When a local free list for the ${classSize}-byte class is empty, the allocator refills from a central list. If the central list lacks free objects, it carves a new slab from larger page-level memory.`,
  };
}

function* slabsAndCaches() {
  const slabStates = 4;
  const allocatorCount = 4;

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
    explanation: `A slab is a page or group of pages divided into equal-size objects. Across ${slabStates} slab states, allocators prefer partial slabs so they pack live objects and can eventually reclaim empty slabs.`,
    invariant: `Inside one slab cache, every object slot has the same size and alignment regardless of which of the ${slabStates} states the slab is in.`,
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
    explanation: `The vocabulary differs across ${allocatorCount} allocators, but the same tiers recur: a fast local cache, a central pool by size class, and a large-block/page source underneath.`,
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
    explanation: `Allocators balance ${slabStates} design pressures simultaneously. The same cache that removes locks can retain idle memory. The same size class that enables reuse can create internal slack.`,
  };

  yield {
    state: fastPath('The allocation path is a hierarchy of caches'),
    highlight: { active: ['request', 'class', 'tcache'], found: ['slab', 'object'] },
    explanation: `The final mental model: small allocation is not one global heap search. All ${allocatorCount} allocators route through size classes, local caches, and central pools backed by page-level allocation.`,
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
      heading: 'How to read the animation',
      paragraphs: [
        'Read the animation as small-object allocation through fixed size classes. A size class is a rounded allocation size, and a slab or span is a larger memory region carved into equal slots for one class.',
        {type: "callout", text: "A slab allocator wins by turning the hot path from heap search into class lookup plus free-list pop."},
        'The active item is the request, slot, or free list being touched right now. Found means a reusable slot was returned; visited means the allocator already checked that layer.',
        'The safe inference rule is class ownership. Once a 72-byte request rounds to the 80-byte class, it should be served by an 80-byte slot, not by a custom heap search.',
      
        {type: 'image', src: './assets/gifs/slab-allocator-size-classes.gif', alt: 'Animated walkthrough of the slab allocator size classes visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Modern programs allocate huge numbers of small objects. Request structs, timers, map nodes, AST nodes, socket buffers, and short-lived strings often repeat the same few sizes.',
        {type: "image", src: "https://upload.wikimedia.org/wikipedia/commons/c/c3/Cache_hierarchy.svg", alt: "CPU cache hierarchy from small fast cache to larger slower memory", caption: "Allocator fast paths are designed around this hierarchy: hot free lists should stay close to the CPU. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Cache_hierarchy.svg."},
        'A general allocator can search, split, and coalesce arbitrary blocks, but that flexibility is expensive on a hot path. A slab allocator specializes the common small-object case by reusing equal-size slots quickly.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious allocator is one heap with free blocks of many sizes. Allocation searches for a suitable block, maybe splits it, and free later may coalesce adjacent blocks.',
        'That design is general and useful. It can handle unusual sizes and long-lived blocks without predeclaring every shape.',
        'A buddy allocator is another reasonable baseline for page-sized memory. It splits powers of two cleanly, but it is too coarse for millions of small 24-byte or 72-byte objects.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is paying search and fragmentation costs for requests that are almost identical. A 72-byte request does not need a perfect 72-byte hole; it needs a nearby reusable slot with bounded slack.',
        'Concurrency adds another wall. If every thread uses one central allocator lock, the lock can dominate the cost of allocating a tiny object.',
        'The allocator needs a fast local path for common sizes and a slower central path for refill, balancing, and returning memory to the system.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Round requests into a finite menu of size classes. A request for 72 bytes might round to 80 bytes, making every object in that class interchangeable from the allocator point of view.',
        'Carve larger slabs into equal slots for one class and keep a free list of available slots. Allocation becomes class lookup plus pop; free becomes class lookup plus push.',
        'The allocator trades internal slack for fast reuse. That trade is worthwhile when sizes repeat and allocation rate is high.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Allocation maps the requested byte count to a size class using a table or simple arithmetic. It then checks a thread-local, CPU-local, or arena-local cache for a free slot in that class.',
        'On a local hit, the allocator pops one slot and returns it. On a local miss, it refills from a central list, often in a batch that pays one lock acquisition for several future allocations.',
        'On a central miss, the allocator asks a page heap or buddy layer for a larger span and carves it into equal slots. Free usually returns the slot to a local cache, with overflow batches sent back to the central pool.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The invariant is that every slot in one slab cache has the same size and alignment. Because of that invariant, the allocator never has to test whether a freed 80-byte-class slot fits the next 80-byte-class request.',
        'Batching amortizes slow coordination. One central refill can supply 32 local slots, so the next 32 allocations can avoid the central lock if the workload stays in that class.',
        'Local caches improve cache behavior because recently freed objects are likely to be reused by the same thread or CPU. The hierarchy turns repeated allocation into repeated reuse.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The common small-allocation path is O(1): map size, pop a free-list node, and return a pointer. Free is usually O(1) for the same reason.',
        'The memory cost is slack and retention. A 72-byte request in an 80-byte class wastes 8 bytes internally, and a slab with one live object can pin a whole page.',
        'When thread count doubles, local caches can reduce contention but increase resident memory. The allocator spends memory to buy fewer shared locks and better locality.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Kernel allocators use slab-style caches for frequently allocated kernel objects such as dentries, inodes, sockets, and network buffers. The fit is repeated object shapes under high allocation pressure.',
        {type: "image", src: "https://upload.wikimedia.org/wikipedia/commons/4/4f/KL_Intel_i7_die.jpg", alt: "Intel processor die with visible compute and cache regions", caption: "Small-object allocation is a hardware problem as much as an API problem: pointer chasing, cache locality, and contention decide the real cost. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:KL_Intel_i7_die.jpg."},
        'User-space allocators such as TCMalloc and jemalloc use size classes, local caches, central pools, arenas, and page-level backing memory. The names differ, but the behavior is the same: keep the common path local and fixed-size.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'It fails on workloads with many unusual sizes or poor reuse. Rounding then creates slack without enough repeated allocation to earn it back.',
        'It fails when mostly empty slabs are pinned by a few long-lived objects. The allocator may report modest live bytes while retaining much more memory from the operating system.',
        'It also fails when locality assumptions break. Cross-thread frees, NUMA movement, false sharing, quarantine, and security hardening can all change the measured cost.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Suppose a 4096-byte slab is assigned to the 80-byte size class. It can hold floor(4096 / 80) = 51 slots, using 4080 bytes and leaving 16 bytes for padding or metadata depending on the allocator layout.',
        'A program requests 72 bytes. The allocator rounds to 80, pops one slot from the local 80-byte free list, and the internal slack is 8 bytes for that allocation.',
        'If the local cache refills 16 slots at a time, one central-list refill can serve the next 16 requests without taking the central lock. If only one object remains live in the slab, that 80-byte object can keep the 4096-byte slab from being released.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Linux slab allocator notes at https://www.kernel.org/doc/gorman/html/understand/understand011.html, TCMalloc design at https://google.github.io/tcmalloc/design.html, gperftools TCMalloc notes at https://pages.cs.wisc.edu/~danb/google-perftools-0.98/tcmalloc.html, and the jemalloc manual at https://jemalloc.net/jemalloc.3.html.',
        'Study buddy allocators for page-level backing memory, free lists and linked lists for slot reuse, TLSF for bounded-time allocation, arenas and slot maps for object lifetime, and hazard pointers or epochs for safe reclamation.',
      ],
    },
  ],
};
