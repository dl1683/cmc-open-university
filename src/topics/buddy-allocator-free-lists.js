// Buddy allocator: power-of-two blocks split on allocation and coalesce with a
// uniquely determined buddy on free.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'buddy-allocator-free-lists',
  title: 'Buddy Allocator Free Lists',
  category: 'Data Structures',
  summary: 'A memory allocator layout: keep one free list per power-of-two block size, split larger blocks on demand, and coalesce exact buddies on free.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['allocate and split', 'free and coalesce'], defaultValue: 'allocate and split' },
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

function allocatorFlow(title) {
  return graphState({
    nodes: [
      { id: 'request', label: 'request', x: 0.8, y: 3.2, note: '13 KB' },
      { id: 'round', label: 'round up', x: 2.7, y: 3.2, note: '16 KB' },
      { id: 'list', label: 'free list', x: 4.6, y: 3.2, note: 'by order' },
      { id: 'split', label: 'split', x: 6.5, y: 3.2, note: 'halves' },
      { id: 'alloc', label: 'allocate', x: 8.4, y: 3.2, note: 'block' },
    ],
    edges: [
      { id: 'e-request-round', from: 'request', to: 'round' },
      { id: 'e-round-list', from: 'round', to: 'list' },
      { id: 'e-list-split', from: 'list', to: 'split' },
      { id: 'e-split-alloc', from: 'split', to: 'alloc' },
    ],
  }, { title });
}

function freeFlow(title) {
  return graphState({
    nodes: [
      { id: 'free', label: 'free block', x: 0.8, y: 3.2, note: '16 KB' },
      { id: 'buddy', label: 'buddy', x: 2.7, y: 3.2, note: 'xor size' },
      { id: 'check', label: 'check list', x: 4.6, y: 3.2, note: 'is free?' },
      { id: 'merge', label: 'merge', x: 6.5, y: 3.2, note: '32 KB' },
      { id: 'repeat', label: 'repeat', x: 8.4, y: 3.2, note: 'up orders' },
    ],
    edges: [
      { id: 'e-free-buddy', from: 'free', to: 'buddy' },
      { id: 'e-buddy-check', from: 'buddy', to: 'check' },
      { id: 'e-check-merge', from: 'check', to: 'merge' },
      { id: 'e-merge-repeat', from: 'merge', to: 'repeat' },
    ],
  }, { title });
}

function* allocateAndSplit() {
  yield {
    state: allocatorFlow('Allocation rounds to a power of two'),
    highlight: { active: ['request', 'round', 'list'], found: ['split', 'alloc'] },
    explanation: 'A buddy allocator rounds each request up to a block order, then looks for a free block of that size. If none exists, it finds a larger block and splits it into equal buddies until the requested order exists.',
    invariant: 'Every free block size is a power of two, and every block has exactly one buddy at the same order.',
  };

  yield {
    state: labelMatrix(
      'Free lists by order',
      [
        { id: 'o0', label: 'order 0' },
        { id: 'o1', label: 'order 1' },
        { id: 'o2', label: 'order 2' },
        { id: 'o3', label: 'order 3' },
      ],
      [
        { id: 'size', label: 'block size' },
        { id: 'free', label: 'free blocks' },
      ],
      [
        ['4 KB', 'A4,C4'],
        ['8 KB', 'B8'],
        ['16 KB', 'none'],
        ['32 KB', 'D32'],
      ],
    ),
    highlight: { active: ['o2:free'], found: ['o3:free'] },
    explanation: 'A 13 KB request needs a 16 KB block. If the 16 KB list is empty, the allocator climbs to the next nonempty list, here 32 KB, then splits.',
  };

  yield {
    state: labelMatrix(
      'Split sequence',
      [
        { id: 'start', label: 'take D32' },
        { id: 'split', label: 'split D32' },
        { id: 'keep', label: 'keep half' },
        { id: 'return', label: 'return rest' },
      ],
      [
        { id: 'action', label: 'action' },
        { id: 'result', label: 'result' },
      ],
      [
        ['remove from list', '32 KB block'],
        ['halve', '16 KB + 16 KB'],
        ['allocate one', 'request served'],
        ['push buddy', '16 KB free'],
      ],
    ),
    highlight: { active: ['split:action', 'keep:result'], found: ['return:result'] },
    explanation: 'Splitting preserves the buddy invariant. The unused half is immediately placed on the free list for the smaller order, ready for a later request.',
  };

  yield {
    state: labelMatrix(
      'Fragmentation tradeoff',
      [
        { id: 'tiny', label: '1 KB request' },
        { id: 'near', label: '13 KB request' },
        { id: 'exact', label: '16 KB request' },
        { id: 'huge', label: '33 KB request' },
      ],
      [
        { id: 'rounded', label: 'rounded to' },
        { id: 'waste', label: 'internal waste' },
      ],
      [
        ['4 KB', '3 KB'],
        ['16 KB', '3 KB'],
        ['16 KB', '0'],
        ['64 KB', '31 KB'],
      ],
    ),
    highlight: { found: ['exact:waste'], compare: ['huge:waste', 'tiny:waste'] },
    explanation: 'Buddy allocation keeps coalescing simple by using powers of two, but rounding can waste memory inside allocated blocks. Slab and size-class allocators refine this for small objects.',
  };
}

function* freeAndCoalesce() {
  yield {
    state: freeFlow('Freeing looks for the exact buddy'),
    highlight: { active: ['free', 'buddy', 'check'], found: ['merge'] },
    explanation: 'When a block is freed, the allocator computes its buddy address for that order. If the buddy is also free, remove the buddy from its list and merge the pair into the next order.',
    invariant: 'Coalescing is local: only the unique same-size buddy can merge.',
  };

  yield {
    state: labelMatrix(
      'Buddy computation',
      [
        { id: 'block', label: 'block addr' },
        { id: 'size', label: 'block size' },
        { id: 'buddy', label: 'buddy addr' },
        { id: 'state', label: 'buddy state' },
      ],
      [
        { id: 'value', label: 'value' },
        { id: 'meaning', label: 'meaning' },
      ],
      [
        ['0x40', 'freed block'],
        ['0x10', '16 KB order'],
        ['0x50', 'addr xor size'],
        ['free', 'can merge'],
      ],
    ),
    highlight: { active: ['buddy:value', 'state:value'], found: ['state:meaning'] },
    explanation: 'With aligned power-of-two blocks, the buddy address is the block address with the size bit flipped. That arithmetic is why the structure can find a merge candidate without searching the whole heap.',
  };

  yield {
    state: labelMatrix(
      'Coalesce ladder',
      [
        { id: 's0', label: 'free 16 KB' },
        { id: 's1', label: 'buddy free' },
        { id: 's2', label: 'merge 32 KB' },
        { id: 's3', label: 'try again' },
      ],
      [
        { id: 'list', label: 'free list' },
        { id: 'effect', label: 'effect' },
      ],
      [
        ['order 2', 'insert candidate'],
        ['order 2', 'remove buddy'],
        ['order 3', 'new block'],
        ['order 3', 'maybe merge'],
      ],
    ),
    highlight: { active: ['s1:list', 's2:list'], found: ['s2:effect', 's3:effect'] },
    explanation: 'A free can cascade upward. If the newly merged 32 KB block also has a free buddy, the allocator merges again. This repairs external fragmentation when adjacent buddies become free.',
  };

  yield {
    state: labelMatrix(
      'Allocator case studies',
      [
        { id: 'linux', label: 'Linux pages' },
        { id: 'glibc', label: 'glibc malloc' },
        { id: 'jemalloc', label: 'jemalloc' },
        { id: 'slab', label: 'slab caches' },
      ],
      [
        { id: 'core', label: 'core idea' },
        { id: 'reason', label: 'reason' },
      ],
      [
        ['buddy pages', 'contiguous pages'],
        ['bins/chunks', 'user heap'],
        ['arenas/bins', 'concurrency'],
        ['fixed objects', 'small allocs'],
      ],
    ),
    highlight: { found: ['linux:core'], active: ['jemalloc:core', 'slab:core'], compare: ['glibc:core'] },
    explanation: 'Real allocators combine ideas. A kernel may use buddy allocation for physical pages, then slab caches for common objects. User-space mallocs use bins, arenas, caches, and coalescing policies to balance speed and fragmentation.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'allocate and split') yield* allocateAndSplit();
  else if (view === 'free and coalesce') yield* freeAndCoalesce();
  else throw new InputError('Pick a buddy-allocator view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'A buddy allocator manages memory in power-of-two blocks. Free blocks are grouped by order, where each order represents a block size such as 4 KB, 8 KB, 16 KB, and so on. When a request arrives, the allocator rounds up to the next available order. If no block of that order is free, a larger block is split repeatedly into equal buddies.',
        'The central trick is that every block has exactly one buddy at the same order. When both buddies are free, they can coalesce into their parent block. That makes freeing local and cheap compared with a general allocator that must search arbitrary neighboring chunks.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Allocation starts by rounding the requested size up to an order. Check the free list for that order. If it is empty, climb to a larger nonempty order, remove one block, split it into two halves, put one half on the smaller free list, and continue until the target order exists. Return one block to the caller.',
        'Freeing reverses the process. Compute the block buddy for the current order, often by flipping the size bit in the block address. If the buddy is free, remove it from the free list and merge the pair into the next larger order. Repeat until the buddy is allocated or the allocator reaches the maximum order.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Allocation and free are usually O(number of orders), which is O(log heap size) for the managed region. The free lists make common cases fast, and the buddy computation avoids a broad search for merge candidates. The cost is internal fragmentation: a 33 KB request may consume a 64 KB block. External fragmentation is mitigated but not eliminated, because only exact buddies can merge.',
      ],
    },
    {
      heading: 'Real-world case study',
      paragraphs: [
        'Linux uses a buddy-style page allocator for physical pages. Kernel subsystems often need contiguous page blocks, and the buddy system gives a simple way to split and coalesce page ranges. Smaller kernel objects are then commonly handled by slab-style allocators on top of pages, because allocating every tiny object as a power-of-two page block would waste too much memory.',
        'User-space malloc implementations add more layers. glibc malloc organizes chunks into bins and handles coalescing around heap chunks. jemalloc emphasizes arenas, bins, thread caches, and fragmentation control. These systems are more complicated than a pure buddy allocator, but the same concerns recur: free-list organization, coalescing, size classes, locality, concurrency, and fragmentation.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'Buddy allocation is not a universal malloc replacement. It is easiest to reason about when the managed region is fixed and aligned and when block sizes can be powers of two. For arbitrary small object allocation, size-class allocators and slab caches often waste less memory and reduce lock contention. For huge contiguous allocations, even a buddy allocator can fail if free memory is split into incompatible buddies.',
        'Another misconception is that coalescing solves all fragmentation. Coalescing only works when both exact buddies are free. If one half remains allocated, the allocator cannot merge the other half with a neighboring non-buddy block, even if total free memory looks large.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Linux kernel physical page allocation chapter at https://www.kernel.org/doc/gorman/html/understand/understand009.html, linux-mm PageAllocation overview at https://linux-mm.org/PageAllocation, Linux Kernel Labs memory management notes at https://linux-kernel-labs.github.io/refs/pull/345/merge/lectures/memory-management.html, glibc malloc internals at https://sourceware.org/glibc/wiki/MallocInternals, jemalloc manual at https://jemalloc.net/jemalloc.3.html, and Meta engineering on jemalloc at https://engineering.fb.com/2011/01/03/core-infra/scalable-memory-allocation-using-jemalloc/. Study Slab Allocator & Size Classes, TLSF Real-Time Allocator Bitmap Index, Linked List, Binary Search Tree, Ring Buffer, Hazard Pointers & Epoch Reclamation, and LRU Cache next.',
      ],
    },
  ],
};
