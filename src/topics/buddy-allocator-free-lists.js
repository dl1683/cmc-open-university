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
  const flowTitle = 'Allocation rounds to a power of two';
  const activeNodes = ['request', 'round', 'list'];
  const foundNodes = ['split', 'alloc'];
  yield {
    state: allocatorFlow(flowTitle),
    highlight: { active: activeNodes, found: foundNodes },
    explanation: `A buddy allocator rounds each ${activeNodes[0]} up to a block order, then looks for a free block via the ${activeNodes[2]}. If none exists, it finds a larger block and performs a ${foundNodes[0]} into equal buddies until the requested order can be returned to ${foundNodes[1]}.`,
    invariant: `Every free block size is a power of two, and every block has exactly one buddy at the same order — the ${flowTitle.toLowerCase()} step enforces this by rounding through ${activeNodes.length} stages.`,
  };

  const orderRows = [
    { id: 'o0', label: 'order 0' },
    { id: 'o1', label: 'order 1' },
    { id: 'o2', label: 'order 2' },
    { id: 'o3', label: 'order 3' },
  ];
  const sizeValues = [['4 KB', 'A4,C4'], ['8 KB', 'B8'], ['16 KB', 'none'], ['32 KB', 'D32']];
  const requestSize = '13 KB';
  const targetOrder = orderRows[2];
  const donorOrder = orderRows[3];
  yield {
    state: labelMatrix(
      'Free lists by order',
      orderRows,
      [
        { id: 'size', label: 'block size' },
        { id: 'free', label: 'free blocks' },
      ],
      sizeValues,
    ),
    highlight: { active: [`${targetOrder.id}:free`], found: [`${donorOrder.id}:free`] },
    explanation: `A ${requestSize} request needs a ${sizeValues[2][0]} block. If the ${sizeValues[2][0]} list is empty (${sizeValues[2][1]}), the allocator climbs to the next nonempty list, here ${sizeValues[3][0]} (${sizeValues[3][1]}), then splits.`,
  };

  const splitRows = [
    { id: 'start', label: 'take D32' },
    { id: 'split', label: 'split D32' },
    { id: 'keep', label: 'keep half' },
    { id: 'return', label: 'return rest' },
  ];
  const splitData = [
    ['remove from list', '32 KB block'],
    ['halve', '16 KB + 16 KB'],
    ['allocate one', 'request served'],
    ['push buddy', '16 KB free'],
  ];
  yield {
    state: labelMatrix(
      'Split sequence',
      splitRows,
      [
        { id: 'action', label: 'action' },
        { id: 'result', label: 'result' },
      ],
      splitData,
    ),
    highlight: { active: [`${splitRows[1].id}:action`, `${splitRows[2].id}:result`], found: [`${splitRows[3].id}:result`] },
    explanation: `Splitting preserves the buddy invariant: ${splitRows[0].label} (${splitData[0][0]}), then ${splitData[1][0]} into ${splitData[1][1]}. The unused half is immediately placed on the free list as ${splitData[3][1]}, ready for a later request.`,
  };

  const fragRows = [
    { id: 'tiny', label: '1 KB request' },
    { id: 'near', label: '13 KB request' },
    { id: 'exact', label: '16 KB request' },
    { id: 'huge', label: '33 KB request' },
  ];
  const fragData = [
    ['4 KB', '3 KB'],
    ['16 KB', '3 KB'],
    ['16 KB', '0'],
    ['64 KB', '31 KB'],
  ];
  yield {
    state: labelMatrix(
      'Fragmentation tradeoff',
      fragRows,
      [
        { id: 'rounded', label: 'rounded to' },
        { id: 'waste', label: 'internal waste' },
      ],
      fragData,
    ),
    highlight: { found: [`${fragRows[2].id}:waste`], compare: [`${fragRows[3].id}:waste`, `${fragRows[0].id}:waste`] },
    explanation: `Buddy allocation keeps coalescing simple by using powers of two, but rounding can waste memory: a ${fragRows[3].label} rounds to ${fragData[3][0]} wasting ${fragData[3][1]}, while a ${fragRows[2].label} wastes ${fragData[2][1]}. Slab and size-class allocators refine this for small objects.`,
  };
}

function* freeAndCoalesce() {
  const freeTitle = 'Freeing looks for the exact buddy';
  const freeActiveNodes = ['free', 'buddy', 'check'];
  const freeFoundNodes = ['merge'];
  yield {
    state: freeFlow(freeTitle),
    highlight: { active: freeActiveNodes, found: freeFoundNodes },
    explanation: `When a block is freed, the allocator computes its ${freeActiveNodes[1]} address for that order via ${freeActiveNodes[2]}. If the buddy is also free, remove the buddy from its list and ${freeFoundNodes[0]} the pair into the next order.`,
    invariant: `Coalescing is local: only the unique same-size ${freeActiveNodes[1]} can ${freeFoundNodes[0]} — the ${freeTitle.toLowerCase()} to validate.`,
  };

  const buddyRows = [
    { id: 'block', label: 'block addr' },
    { id: 'size', label: 'block size' },
    { id: 'buddy', label: 'buddy addr' },
    { id: 'state', label: 'buddy state' },
  ];
  const buddyData = [
    ['0x40', 'freed block'],
    ['0x10', '16 KB order'],
    ['0x50', 'addr xor size'],
    ['free', 'can merge'],
  ];
  yield {
    state: labelMatrix(
      'Buddy computation',
      buddyRows,
      [
        { id: 'value', label: 'value' },
        { id: 'meaning', label: 'meaning' },
      ],
      buddyData,
    ),
    highlight: { active: [`${buddyRows[2].id}:value`, `${buddyRows[3].id}:value`], found: [`${buddyRows[3].id}:meaning`] },
    explanation: `With aligned power-of-two blocks, the ${buddyRows[2].label} is computed as ${buddyData[2][1]} (${buddyData[0][0]} xor ${buddyData[1][0]} = ${buddyData[2][0]}). That arithmetic finds a merge candidate without searching the whole heap — and the ${buddyRows[3].label} here is "${buddyData[3][0]}", so the blocks ${buddyData[3][1]}.`,
  };

  const coalesceRows = [
    { id: 's0', label: 'free 16 KB' },
    { id: 's1', label: 'buddy free' },
    { id: 's2', label: 'merge 32 KB' },
    { id: 's3', label: 'try again' },
  ];
  const coalesceData = [
    ['order 2', 'insert candidate'],
    ['order 2', 'remove buddy'],
    ['order 3', 'new block'],
    ['order 3', 'maybe merge'],
  ];
  yield {
    state: labelMatrix(
      'Coalesce ladder',
      coalesceRows,
      [
        { id: 'list', label: 'free list' },
        { id: 'effect', label: 'effect' },
      ],
      coalesceData,
    ),
    highlight: { active: [`${coalesceRows[1].id}:list`, `${coalesceRows[2].id}:list`], found: [`${coalesceRows[2].id}:effect`, `${coalesceRows[3].id}:effect`] },
    explanation: `A free can cascade upward: ${coalesceRows[0].label} at ${coalesceData[0][0]}, then ${coalesceRows[1].label} triggers ${coalesceData[1][1]}. The ${coalesceRows[2].label} creates a ${coalesceData[2][1]} at ${coalesceData[2][0]}, and ${coalesceRows[3].label} checks if it can ${coalesceData[3][1]}. This repairs external fragmentation when adjacent buddies become free.`,
  };

  const caseRows = [
    { id: 'linux', label: 'Linux pages' },
    { id: 'glibc', label: 'glibc malloc' },
    { id: 'jemalloc', label: 'jemalloc' },
    { id: 'slab', label: 'slab caches' },
  ];
  const caseData = [
    ['buddy pages', 'contiguous pages'],
    ['bins/chunks', 'user heap'],
    ['arenas/bins', 'concurrency'],
    ['fixed objects', 'small allocs'],
  ];
  yield {
    state: labelMatrix(
      'Allocator case studies',
      caseRows,
      [
        { id: 'core', label: 'core idea' },
        { id: 'reason', label: 'reason' },
      ],
      caseData,
    ),
    highlight: { found: [`${caseRows[0].id}:core`], active: [`${caseRows[2].id}:core`, `${caseRows[3].id}:core`], compare: [`${caseRows[1].id}:core`] },
    explanation: `Real allocators combine ideas. ${caseRows[0].label} uses ${caseData[0][0]} for ${caseData[0][1]}, then ${caseRows[3].label} handle ${caseData[3][1]} with ${caseData[3][0]}. User-space mallocs like ${caseRows[1].label} (${caseData[1][0]}) and ${caseRows[2].label} (${caseData[2][0]} for ${caseData[2][1]}) balance speed and fragmentation.`,
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
        'The animation has two views. The "allocate and split" view shows a request arriving, rounding up to a power-of-two order, climbing the free lists to find a large enough block, and splitting that block into equal halves until the target order is produced. The "free and coalesce" view shows a block being returned, its buddy address computed, and the merge ladder climbing upward when consecutive buddies are free.',
        'Active (highlighted) cells mark the decision the allocator is making right now. Found cells mark the outcome that decision produces. When a cell appears in the "compare" color, it is a contrasting case shown for context, not part of the current operation.',
        {type: 'image', src: './assets/gifs/buddy-allocator-free-lists.gif', alt: 'Animated walkthrough of the buddy allocator free lists visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
        'Watch the free-list table closely. Every split removes one block from a higher-order list and adds two blocks to the next-lower list. Every merge removes two blocks from a lower-order list and adds one to the next-higher list. If those counts ever violate that rule, the allocator has a bug.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'A memory allocator must solve two problems that pull in opposite directions. Problem one: hand out a block of the requested size as fast as possible. Problem two: when blocks come back, reassemble them into the largest contiguous free regions possible so that future large requests can still succeed.',
        'An operating system kernel has an even harder version of problem two. Hardware DMA engines and page tables often require physically contiguous pages, not just any scattered frames. If the allocator cannot produce a contiguous run of, say, 8 pages, the kernel cannot satisfy a huge-page mapping or a device buffer request, even when 8 individual pages are free somewhere.',
        'The buddy allocator is the data structure the Linux kernel uses to solve both problems for physical page allocation. It keeps one free list per power-of-two block size (called an "order"), splits blocks on allocation, and merges exact pairs on free. The result is O(log n) allocation and free with strong coalescing guarantees.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The simplest allocator maintains a single sorted free list of variable-size holes. When a request arrives, walk the list and pick a hole that fits (first-fit, best-fit, or worst-fit). When a block is freed, insert it back into the list and scan for adjacent holes to merge.',
        'This works and many early systems used it. First-fit allocation is O(n) in the number of free holes, and merging requires scanning neighbors. For a kernel managing millions of page frames, that linear scan on every allocation is too slow, and the variable-size bookkeeping makes contiguous-page requests unreliable.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The variable-hole approach hits two walls simultaneously. First, the search cost: with thousands of free holes of different sizes, finding the right one is a linear scan unless you build an auxiliary index, and maintaining that index under rapid alloc/free churn has its own cost. Second, the merge cost: when a block is freed, how do you know which neighbors can merge with it? You need boundary tags or a sorted address list, and you still cannot guarantee that the result is a large aligned block.',
        'The deeper issue is that arbitrary hole sizes produce arbitrary fragmentation. A system with 64 KB free spread across 16 scattered 4 KB holes cannot satisfy a single 64 KB request. The allocator needs a structural rule that makes coalescing predictable rather than opportunistic.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Restrict every block size to a power of two and organize memory as a binary tree of splits. A 64 KB region is either used whole, or split into two 32 KB halves, each of which is either used whole or split into two 16 KB halves, and so on down to some minimum block size. At every level of this tree, a block has exactly one legal merge partner: the sibling that was created by the same split. That sibling is called the block\'s "buddy."',
        {
          type: 'image',
          src: 'https://mermaid.ink/svg/pako:S8vJL0_OSCwqUQhx4nKMNjNR8HZSKMrPL4lV0NW1U3CKNjZS8HaK5XIEc51hXCcw1yXa0AyJ6wrjuoC5btEWSDx3KM9NQVdPIbUiMblEIak0JaVSQU9XwR2kRk8hOT8xJ7U4ORUk5AQA',
          alt: 'Buddy allocation tree where split blocks form exact sibling buddies and coalesce upward.',
          caption: 'The binary split tree makes the merge candidate local: only the sibling block at the same order can coalesce. Source: https://mermaid.ink/svg/pako:S8vJL0_OSCwqUQhx4nKMNjNR8HZSKMrPL4lV0NW1U3CKNjZS8HaK5XIEc51hXCcw1yXa0AyJ6wrjuoC5btEWSDx3KM9NQVdPIbUiMblEIak0JaVSQU9XwR2kRk8hOT8xJ7U4ORUk5AQA',
        },
        'Because blocks are power-of-two aligned, the buddy address can be computed with a single XOR. If your block starts at address A and has size S (a power of two), the buddy starts at A XOR S. No search, no boundary tags, no sorted list. One bit-flip and you know exactly which block is the only legal merge partner.',
        {
          type: 'callout',
          text: 'The allocator wins because every power-of-two block has exactly one legal merge partner.',
        },
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The allocator maintains an array of free lists, one per order. Order 0 holds minimum-size blocks (e.g., 4 KB pages in Linux), order 1 holds 8 KB blocks, order 2 holds 16 KB, and so on up to some maximum order (order 10 = 4 MB in Linux\'s default configuration). Each free list is a doubly-linked list of free blocks at that order.',
        'Allocation: round the requested size up to the nearest power of two to get the target order. Check the free list for that order. If a free block exists, remove it from the list and return it. If the list is empty, climb to the next higher order and repeat. When a larger block is found, split it: remove the block from its free list, cut it in half, put one half on the free list for the next-lower order, and keep splitting the other half until you reach the target order. Return the final piece.',
        {
          type: 'image',
          src: 'https://mermaid.ink/svg/pako:PY69CsMgFIV3n-K-QAcjZCwkQ5c4mWYSh_zcUInV1FwppfTdSyzp-p2Pc87swnO89ZFAKqY0F9DUEPGRcCMDp9MZOq1C8hNQAF5CUxvWZS55-c4A5ogIzm4EeF_p9WGSlz9FFPraLwii2L3BhXExTIoip61uV2cJrD-qYUjTZHEzrM1GpSvnwtgTQvB40ItWSCn6nf1f5X3zBQ',
          alt: 'Allocation request rounded to a 16 KB order, satisfied by splitting a 32 KB block into buddies.',
          caption: 'Allocation climbs to a larger free list only when the target order is empty, then splits until one block can serve the request. Source: https://mermaid.ink/svg/pako:PY69CsMgFIV3n-K-QAcjZCwkQ5c4mWYSh_zcUInV1FwppfTdSyzp-p2Pc87swnO89ZFAKqY0F9DUEPGRcCMDp9MZOq1C8hNQAF5CUxvWZS55-c4A5ogIzm4EeF_p9WGSlz9FFPraLwii2L3BhXExTIoip61uV2cJrD-qYUjTZHEzrM1GpSvnwtgTQvB40ItWSCn6nf1f5X3zBQ',
        },
        'Free: take the block being returned and compute its buddy address (address XOR block_size). Check whether the buddy is free and at the same order. If yes, remove the buddy from its free list, merge the two blocks into one block at the next higher order, and repeat the buddy check at that new order. If the buddy is not free (or is split into smaller pieces), just insert the freed block onto its order\'s free list and stop.',
        'Each order\'s free list is a simple linked list, so insertion and removal are O(1). The total work per allocation or free is bounded by the number of orders, which is the number of splits or merges performed.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The correctness argument rests on one invariant: at all times, the managed memory region is partitioned into non-overlapping power-of-two blocks, each of which is either allocated or on exactly one free list. Splitting takes one block and produces two children whose addresses and sizes tile the parent exactly, with no overlap and no gap. Merging takes two free siblings and produces their parent, again with no overlap and no gap.',
        'The buddy test is safe because only true siblings can merge. Suppose block A at address 0x4000 with size 0x4000 (16 KB) computes its buddy as 0x4000 XOR 0x4000 = 0x0000. That buddy at 0x0000 is the only block that, together with A, forms a valid 32 KB parent starting at 0x0000. A neighboring block at 0x8000 is not A\'s buddy because merging A with 0x8000 would produce a "block" from 0x4000 to 0xC000, which is not power-of-two aligned and does not correspond to any node in the split tree.',
        'This means the allocator never creates an illegal block, never loses memory, and never merges blocks that should stay separate. The tree structure enforces these properties by construction, not by runtime checking.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Let k be the number of orders (so the managed region is 2^k times the minimum block size). Allocation visits at most k free lists: one check per order from the target up to the first nonempty list, then one split per order on the way back down. Each split is O(1) (remove from one list, insert into another). Total allocation cost: O(k).',
        'Free visits at most k orders: compute buddy, check if free, merge, repeat. Each merge is O(1) (remove buddy from its list, no insertion until the merge chain stops). Total free cost: O(k). In Linux with 4 KB minimum pages and order 10 maximum, k = 11, so both operations do at most 11 steps.',
        'The price is internal fragmentation. Every request rounds up to a power of two. A 33 KB request gets a 64 KB block, wasting 31 KB (48%). A 17 KB request gets a 32 KB block, wasting 15 KB (47%). The worst case is always just over half a power of two, which wastes just under 50%. On average across uniformly distributed sizes, the waste is about 25%.',
        'External fragmentation is controlled by coalescing but not eliminated. If one buddy in a pair stays allocated, the free buddy cannot merge with anything else. The allocator can have plenty of total free memory while being unable to produce a large contiguous block.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'The Linux kernel\'s physical page allocator is a buddy system. It manages all physical RAM as zones (DMA, Normal, HighMem) with one buddy allocator per zone. The minimum block is one 4 KB page; the maximum order is typically 10 (4 MB). Every call to alloc_pages() goes through this buddy system. The kernel then layers slab allocators (SLUB, SLAB) on top for small kernel objects like inodes and task structs, drawing their backing pages from the buddy allocator.',
        'The pattern appears beyond Linux. FreeBSD\'s VM system uses a similar page-level buddy allocator. The jemalloc allocator (used by FreeBSD, Firefox, and Redis) organizes large allocations in a buddy-like hierarchy within its arenas, then uses size-class bins for small objects. Even some embedded RTOS kernels use buddy allocation because the O(log n) bound is deterministic and suitable for real-time constraints.',
        'Understanding the buddy allocator also clarifies why /proc/buddyinfo exists in Linux. That file shows the count of free blocks at each order per zone, which is exactly the state of the buddy free lists. When a system cannot allocate a high-order page despite having free memory, buddyinfo reveals the fragmentation: many small-order blocks, few large-order blocks.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Buddy allocation is a poor fit for small-object workloads. If your program allocates millions of 24-byte structs, rounding each to 32 bytes wastes 25% of memory, and the per-block metadata overhead is large relative to the payload. Slab allocators and size-class allocators (tcmalloc, jemalloc bins) handle this by carving pages into fixed-size slots with no rounding.',
        'The "stuck buddy" problem is real. Consider a 1 MB region fully split into 4 KB pages. If every other page is allocated, no two adjacent free pages are buddies, so the allocator cannot merge any of them. The system has 512 KB free but cannot produce a single 8 KB contiguous block. Linux mitigates this with page migration (moving allocated pages to create free buddy pairs) and memory compaction, but those are expensive operations.',
        'The buddy algorithm also has no notion of policy. A kernel must decide which zone to allocate from (DMA-capable memory vs. normal), which NUMA node is closest, whether to reclaim or compact first, and whether to honor huge-page reservations. The buddy allocator is the mechanism that manages free lists within a pool, but the policy layer above it is where most real-world complexity lives.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Start with a fresh 128 KB region. The allocator has one free block at order 5 (128 KB). The free lists for orders 0 through 4 are empty.',
        'Request 1: allocate 10 KB. Round up to 16 KB (order 2). Order 2 is empty, order 3 is empty, order 4 is empty, but order 5 has a 128 KB block. Split: 128 KB becomes two 64 KB blocks; put one on the order-4 list. Split: 64 KB becomes two 32 KB blocks; put one on the order-3 list. Split: 32 KB becomes two 16 KB blocks; put one on the order-2 list. Return the other 16 KB block. Free lists now: order 2 has one block, order 3 has one block, order 4 has one block.',
        'Request 2: allocate 5 KB. Round up to 8 KB (order 1). Order 1 is empty. Take the 16 KB block from order 2 and split: two 8 KB blocks. Put one on order-1 list. Return the other. Free lists: order 1 has one block, order 3 has one block, order 4 has one block.',
        'Free the 10 KB allocation (the 16 KB block at order 2). Compute its buddy via XOR. The buddy is the 8 KB block\'s parent region, but that region is split, not free at order 2. The buddy is not free at order 2, so just insert the freed block onto the order-2 list. Free lists: order 1 has one block, order 2 has one block, order 3 has one block, order 4 has one block.',
        'Now free the 5 KB allocation (the 8 KB block at order 1). Compute its buddy: the other 8 KB block on the order-1 list. That buddy is free. Remove the buddy from order-1, merge into 16 KB at order 2. Now check the order-2 buddy: it is the 16 KB block we just freed. That is also free. Remove it from order-2, merge into 32 KB at order 3. Check the order-3 buddy: it is free too. Merge into 64 KB at order 4. Check the order-4 buddy: also free. Merge into 128 KB at order 5. The allocator has fully coalesced back to the original single block. One free triggered four merges.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'The buddy system was introduced by Kenneth Knowlton in "A Fast Storage Allocator" (Communications of the ACM, 1965). Donald Knuth covers it in The Art of Computer Programming, Volume 1, Section 2.5. For the Linux implementation, read Mel Gorman\'s "Understanding the Linux Virtual Memory Manager," Chapter 6 on physical page allocation (https://www.kernel.org/doc/gorman/html/understand/understand009.html). The linux-mm wiki at https://linux-mm.org/PageAllocation and Linux Kernel Labs notes at https://linux-kernel-labs.github.io/refs/pull/345/merge/lectures/memory-management.html provide additional implementation detail.',
        'For user-space allocators that build on these ideas, read the glibc malloc internals at https://sourceware.org/glibc/wiki/MallocInternals, the jemalloc manual at https://jemalloc.net/jemalloc.3.html, and Meta\'s engineering post on jemalloc at https://engineering.fb.com/2011/01/03/core-infra/scalable-memory-allocation-using-jemalloc/.',
        'Study next: Slab Allocator and Size Classes (how the kernel handles small objects on top of buddy pages), TLSF Real-Time Allocator Bitmap Index (an alternative with O(1) allocation), Linked List (the underlying structure of each free list), and Binary Search Tree (the tree structure that the buddy system implicitly maintains).',
      ],
    },
  ],
};
