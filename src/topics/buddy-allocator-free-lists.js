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
      heading: 'How to read the animation',
      paragraphs: [
        "Read the animation as the execution trace for Buddy Allocator Free Lists. A memory allocator layout: keep one free list per power-of-two block size, split larger blocks on demand, and coalesce exact buddies on free..",
        {
          type: "callout",
          text: "The allocator wins because every power-of-two block has exactly one legal merge partner.",
        },
        "Active items are the current decision point. Visited markers are state that is already ruled out by proof, not by taste.",
        "Found markers are outcomes now guaranteed true. If this is not visible, the animation can mislead.",
        "At each frame, ask what changed, why that move is legal, and where the idea is strong or fragile.",
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'An allocator has two jobs that fight each other: hand out memory quickly, and later rebuild large free ranges from the pieces that return. A kernel page allocator also has a harder constraint: it often needs physically contiguous page blocks, not just any scattered bytes.',
        'The obvious design is a list of arbitrary free holes. On allocation, search for a hole large enough. On free, put the hole back and try to merge it with neighboring holes. That works, but the allocator now depends on variable-length searches and boundary bookkeeping to keep fragmentation under control.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'Arbitrary holes make both questions expensive: which hole should serve this request, and which free neighbors can merge after this block returns? A long-running system can have plenty of total free memory while still lacking a large contiguous region.',
        'The buddy allocator accepts a narrower shape. Every block size is a power of two. That restriction wastes some space inside allocated blocks, but it gives the allocator a cheap answer to the merge question.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Split memory as a binary tree of power-of-two blocks. At any order, a block has exactly one same-size buddy: the sibling created by the same split. With aligned addresses, the buddy address is found by flipping the bit for that block size.',
        {
          type: 'image',
          src: 'https://mermaid.ink/svg/pako:S8vJL0_OSCwqUQhx4nKMNjNR8HZSKMrPL4lV0NW1U3CKNjZS8HaK5XIEc51hXCcw1yXa0AyJ6wrjuoC5btEWSDx3KM9NQVdPIbUiMblEIak0JaVSQU9XwR2kRk8hOT8xJ7U4ORUk5AQA',
          alt: 'Buddy allocation tree where split blocks form exact sibling buddies and coalesce upward.',
          caption: 'The binary split tree makes the merge candidate local: only the sibling block at the same order can coalesce. Source: https://mermaid.ink/svg/pako:S8vJL0_OSCwqUQhx4nKMNjNR8HZSKMrPL4lV0NW1U3CKNjZS8HaK5XIEc51hXCcw1yXa0AyJ6wrjuoC5btEWSDx3KM9NQVdPIbUiMblEIak0JaVSQU9XwR2kRk8hOT8xJ7U4ORUk5AQA',
        },
        'That one fact turns coalescing from a heap search into a local test. If the exact buddy is free, merge the two children back into their parent. If it is not free, no other block at that order is allowed to merge with this one.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The allocate-and-split view is about controlled waste. A larger block is split only along power-of-two boundaries until the requested order exists. Every unused half goes onto a known free list, so the allocator never loses track of the remaining memory.',
        'The free-and-coalesce view is about local proof. The allocator does not scan the whole heap looking for any neighbor. It computes the exact buddy, checks whether that buddy is free, and merges only when the tree says the two blocks are siblings.',
      ],
    },
    {
      heading: 'How it works (2)',
      paragraphs: [
        'Allocation rounds the request up to an order such as 4 KB, 8 KB, 16 KB, or 32 KB. If that order has a free block, return it. If not, climb to the next larger nonempty order, remove one block, split it into equal halves, place the unused half on the smaller-order free list, and repeat until the target order exists.',
        {
          type: 'image',
          src: 'https://mermaid.ink/svg/pako:PY69CsMgFIV3n-K-QAcjZCwkQ5c4mWYSh_zcUInV1FwppfTdSyzp-p2Pc87swnO89ZFAKqY0F9DUEPGRcCMDp9MZOq1C8hNQAF5CUxvWZS55-c4A5ogIzm4EeF_p9WGSlz9FFPraLwii2L3BhXExTIoip61uV2cJrD-qYUjTZHEzrM1GpSvnwtgTQvB40ItWSCn6nf1f5X3zBQ',
          alt: 'Allocation request rounded to a 16 KB order, satisfied by splitting a 32 KB block into buddies.',
          caption: 'Allocation climbs to a larger free list only when the target order is empty, then splits until one block can serve the request. Source: https://mermaid.ink/svg/pako:PY69CsMgFIV3n-K-QAcjZCwkQ5c4mWYSh_zcUInV1FwppfTdSyzp-p2Pc87swnO89ZFAKqY0F9DUEPGRcCMDp9MZOq1C8hNQAF5CUxvWZS55-c4A5ogIzm4EeF_p9WGSlz9FFPraLwii2L3BhXExTIoip61uV2cJrD-qYUjTZHEzrM1GpSvnwtgTQvB40ItWSCn6nf1f5X3zBQ',
        },
        'Freeing reverses the tree. Compute the buddy for the freed block at its current order. If that buddy is free, remove the buddy from its free list, merge the pair into the next order, and try again. The merge stops when the buddy is allocated, missing, or the region has reached the maximum order.',
        'A practical allocator also needs metadata. It must know each block order, whether a block is free or allocated, which free list owns it, and where the managed region begins. Kernel implementations often combine per-order free lists with page descriptors and zone policy because not all pages are interchangeable.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Suppose the allocator manages a 64 KB region and receives a 10 KB request. It rounds up to a 16 KB order. If no 16 KB block is free but a 64 KB block is available, the allocator splits 64 KB into two 32 KB blocks, splits one 32 KB block into two 16 KB blocks, returns one 16 KB block, and stores the unused halves on the 32 KB and 16 KB free lists.',
        'When the 16 KB block is freed, the allocator computes its buddy by flipping the 16 KB bit in the address. If that buddy is free, they merge into a 32 KB block. If the 32 KB buddy is also free, the merge continues to 64 KB. One free operation can therefore repair several levels of fragmentation.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The invariant is a partition of the managed region into non-overlapping power-of-two blocks. Splitting replaces one valid block with two valid children. Coalescing replaces two free sibling children with their valid parent. No operation invents overlapping memory or loses address space.',
        'The buddy test is correct because only siblings share the same parent at that order. A neighboring non-buddy block may be physically adjacent, but merging it would create a block whose address or size does not match the allocator tree.',
      ],
    },
    {
      heading: 'Cost and behavior',
      paragraphs: [
        'Allocation and free are O(number of orders), which is O(log heap size) for a fixed minimum block size. If the managed region doubles, the allocator adds one more possible order. Common cases are faster because each order has its own free list.',
        'The tax is internal fragmentation. A 33 KB request may consume a 64 KB block. Requests just over half of an order waste almost half the block. External fragmentation is reduced by aggressive coalescing, but it is not eliminated because only exact buddies can merge.',
        'That tradeoff is acceptable when the allocator is managing pages or large aligned regions. It is much less acceptable when the workload is dominated by tiny objects, because rounding error becomes the main cost instead of a secondary tax.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Buddy allocation fits page-level memory management: fixed aligned regions, page-sized units, and a real need for contiguous runs. Linux uses a buddy-style page allocator for physical pages, then places slab-style object allocators above it for small kernel objects.',
        'The pattern also teaches the allocator stack. User-space mallocs such as glibc malloc and jemalloc add bins, arenas, thread caches, and richer policies, but they still face the same pressures: free-list organization, coalescing, locality, concurrency, and fragmentation.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Buddy allocation is not a universal malloc replacement. Small arbitrary objects waste too much space when every request rounds to a power of two. Size-class allocators and slab caches usually fit that workload better.',
        'Coalescing also has a hard limit. If one half of a buddy pair remains allocated, the free half cannot merge with any other neighbor, even if total free memory looks large. Large contiguous allocations can still fail after the pool has fragmented into incompatible buddies.',
        'It also needs policy above the raw algorithm. A kernel may have DMA zones, NUMA nodes, movable pages, reclaimable pages, and huge-page goals. The buddy algorithm can find a free block inside a pool, but higher-level policy decides which pool is allowed to satisfy the request.',
      ],
    },
    {
      heading: 'How it works (3)',
      paragraphs: [
        'When a buddy allocator is under pressure, inspect free blocks by order, not just total free memory. A system can have many free 4 KB pages and still fail a large contiguous allocation because the pages cannot coalesce into the requested order.',
        'Fragmentation metrics should distinguish internal waste from rounded allocations, external fragmentation from incompatible free buddies, and policy fragmentation from memory being free in the wrong zone or NUMA node. Those distinctions matter when diagnosing page allocation failures.',
        'A useful allocator trace records requested size, rounded order, split path, selected zone, merge attempts, and the reason a merge stopped. That trace turns a mysterious allocation failure into a concrete statement about which order, pool, or policy boundary lacked a usable block.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Primary sources: Linux kernel physical page allocation chapter at https://www.kernel.org/doc/gorman/html/understand/understand009.html, linux-mm PageAllocation overview at https://linux-mm.org/PageAllocation, Linux Kernel Labs memory management notes at https://linux-kernel-labs.github.io/refs/pull/345/merge/lectures/memory-management.html, glibc malloc internals at https://sourceware.org/glibc/wiki/MallocInternals, jemalloc manual at https://jemalloc.net/jemalloc.3.html, and Meta engineering on jemalloc at https://engineering.fb.com/2011/01/03/core-infra/scalable-memory-allocation-using-jemalloc/. Study Slab Allocator & Size Classes, TLSF Real-Time Allocator Bitmap Index, Linked List, Binary Search Tree, Ring Buffer, Hazard Pointers & Epoch Reclamation, and LRU Cache next.',
      ],
    },
      {
      heading: 'The obvious approach',
      paragraphs: [
        "Name the reasonable first attempt and why teams reach for it.",
        "Then show the exact place that approach stops scaling or starts breaking.",
        "Treat this section as contrast, not a rejection.",
      ],
    },
    {
      heading: 'Learning map',
      paragraphs: [
        'Before this topic, check your prerequisites and map what is assumed, what is computed, and where this mechanism first appears in real systems.',
        'After this topic, follow each unlock topic and test whether you can explain why this mechanism unlocks it.',
        'Use the frame order to prove one invariant per frame and one cost consequence per major operation.',
      ],
    },

    {
      heading: 'Frame-by-frame checkpoints',
      paragraphs: [
        {
          type: 'bullets',
          items: [
            'Pause on each state change and name exactly what data moved, which references changed, and why the move is legal.',
            'State the invariant that must remain true before the next frame starts.',
            'Track what changed in size, order, ownership, or topology for the operation you are watching.',
            'Translate the active frame into a one-line explanation as if teaching a teammate.',
          ],
        },
      ],
    },

    {
      heading: 'Micro checks',
      paragraphs: [
        {
          type: 'bullets',
          items: [
            'Can you state one operation-level invariant in one sentence?',
            'Can you derive the time cost from the frame sequence without referencing external formulas?',
            'Can you name one hidden edge case where the naive implementation fails?',
            'Can you transfer this mechanism to one system from a different domain?',
          ],
        },
      ],
    },

    {
      heading: 'Try this now',
      paragraphs: [
        'Build one counterexample input by hand and predict every animation frame before running it; compare your prediction to the trace.',
        'Use this topic as a checkpoint: if you can explain why Buddy Allocator Free Lists moves from input to output in the animation and where it fails, you are ready for the next topic.',
      ],
    },

      {
        heading: 'Sources and study next',
        paragraphs: [
          'Read one primary source, one implementation source, and one production case where this idea appears.',
          'If they disagree on a detail, prefer the source with the clearest constraint and define the simplification for this animation.',
          'Then choose three study topics: one prerequisite, one extension, and one case study for your next session.',
        ],
      },
],
};
