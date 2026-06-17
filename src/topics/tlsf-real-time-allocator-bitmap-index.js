// TLSF allocator: two-level segregated free lists plus bitmaps so a suitable
// free block can be found with bounded lookup work.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'tlsf-real-time-allocator-bitmap-index',
  title: 'TLSF Real-Time Allocator Bitmap Index',
  category: 'Data Structures',
  summary: 'A deterministic allocator case study: first-level size classes, second-level sub-bins, bitmap search, free-list blocks, splitting, and immediate coalescing.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['bin map', 'allocate path', 'free coalesce'], defaultValue: 'bin map' },
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

function tlsfGraph(title, notes = {}) {
  return graphState({
    nodes: [
      { id: 'req', label: 'request', x: 0.7, y: 3.8, note: notes.req ?? '100 B' },
      { id: 'map', label: 'map size', x: 2.2, y: 3.8, note: notes.map ?? 'FL6 SL2' },
      { id: 'fl', label: 'FL bits', x: 3.9, y: 2.2, note: notes.fl ?? '100100' },
      { id: 'sl', label: 'SL bits', x: 3.9, y: 5.4, note: notes.sl ?? '0100' },
      { id: 'matrix', label: 'bin table', x: 5.7, y: 3.8, note: notes.matrix ?? 'lists' },
      { id: 'list', label: 'free list', x: 7.5, y: 3.8, note: notes.list ?? 'block' },
      { id: 'split', label: 'split', x: 9.0, y: 2.5, note: notes.split ?? 'tail' },
      { id: 'block', label: 'block', x: 9.0, y: 5.1, note: notes.block ?? 'return' },
    ],
    edges: [
      { id: 'e-req-map', from: 'req', to: 'map' },
      { id: 'e-map-fl', from: 'map', to: 'fl' },
      { id: 'e-map-sl', from: 'map', to: 'sl' },
      { id: 'e-fl-matrix', from: 'fl', to: 'matrix' },
      { id: 'e-sl-matrix', from: 'sl', to: 'matrix' },
      { id: 'e-matrix-list', from: 'matrix', to: 'list' },
      { id: 'e-list-split', from: 'list', to: 'split' },
      { id: 'e-list-block', from: 'list', to: 'block' },
    ],
  }, { title });
}

function* binMap() {
  yield {
    state: tlsfGraph('TLSF indexes free memory with two bitmap levels'),
    highlight: { active: ['map', 'fl', 'sl', 'matrix'], found: ['list', 'block'] },
    explanation: 'TLSF, Two-Level Segregated Fit, keeps free blocks in a matrix of lists. A first-level index chooses a power-of-two size band; a second-level index subdivides that band.',
    invariant: 'The search path is bounded: map size, scan bitmaps, pop a list head.',
  };

  yield {
    state: labelMatrix(
      'Two-level bins',
      [
        { id: 'fl5', label: 'FL 5' },
        { id: 'fl6', label: 'FL 6' },
        { id: 'fl7', label: 'FL 7' },
        { id: 'fl8', label: 'FL 8' },
      ],
      [
        { id: 'range', label: 'range' },
        { id: 'sl0', label: 'SL0' },
        { id: 'sl1', label: 'SL1' },
        { id: 'sl2', label: 'SL2' },
        { id: 'sl3', label: 'SL3' },
      ],
      [
        ['32-63', '32', '40', '48', '56'],
        ['64-127', '64', '80', '96', '112'],
        ['128-255', '128', '160', '192', '224'],
        ['256-511', '256', '320', '384', '448'],
      ],
    ),
    highlight: { active: ['fl6:range', 'fl6:sl2'], found: ['fl6:sl3'], compare: ['fl7:range'] },
    explanation: 'A 100-byte request maps into the 64-127 band and the sub-bin starting at 96. If that exact sub-bin is empty, the allocator looks for the next nonempty sub-bin or higher band.',
  };

  yield {
    state: labelMatrix(
      'Bitmap search',
      [
        { id: 'need', label: 'need bin' },
        { id: 'sl', label: 'SL word' },
        { id: 'fl', label: 'FL word' },
        { id: 'pick', label: 'pick bin' },
      ],
      [
        { id: 'value', label: 'val' },
        { id: 'meaning', label: 'means' },
      ],
      [
        ['FL6 SL2', 'start here'],
        ['0100', 'SL2 has blk'],
        ['100100', 'FL6 live'],
        ['FL6 SL2', 'pop list'],
      ],
    ),
    highlight: { active: ['sl:value', 'fl:value'], found: ['pick:value', 'pick:meaning'] },
    explanation: 'The key data structure is the bitmap index. Machine instructions such as find-first-set can jump to an available bin without walking a long list of arbitrary free blocks.',
  };

  yield {
    state: labelMatrix(
      'Allocator map',
      [
        { id: 'buddy', label: 'buddy' },
        { id: 'slab', label: 'slab' },
        { id: 'tlsf', label: 'TLSF' },
        { id: 'malloc', label: 'malloc bins' },
      ],
      [
        { id: 'index', label: 'index' },
        { id: 'fit', label: 'fit' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['orders', 'power2', 'waste'],
        ['class', 'exact-ish', 'idle objs'],
        ['FL+SL', 'good fit', 'metadata'],
        ['bins/tree', 'varies', 'tail'],
      ],
    ),
    highlight: { found: ['tlsf:index', 'tlsf:fit'], compare: ['buddy:risk', 'malloc:risk'] },
    explanation: 'TLSF sits between simple buddy splitting and general malloc bins. It keeps enough size resolution for good fit while keeping the bin search bounded for real-time use.',
  };

  yield {
    state: labelMatrix(
      'SLI tuning',
      [
        { id: 's4', label: '4 slots' },
        { id: 's8', label: '8 slots' },
        { id: 's16', label: '16 slots' },
        { id: 's32', label: '32 slots' },
      ],
      [
        { id: 'fit', label: 'fit' },
        { id: 'meta', label: 'meta' },
        { id: 'use', label: 'use' },
      ],
      [
        ['coarse', 'small', 'tiny pool'],
        ['ok', 'ok', 'embedded'],
        ['fine', 'more', 'RTOS'],
        ['finer', 'larger', 'server?'],
      ],
    ),
    highlight: { active: ['s8:use', 's16:use'], found: ['s16:fit'], compare: ['s32:meta'] },
    explanation: 'The second-level count is a real design knob. More sub-bins reduce slack and improve fit quality, but they expand the bin matrix and bitmap metadata.',
  };
}

function* allocatePath() {
  yield {
    state: tlsfGraph('Allocation maps size to a nonempty bin'),
    highlight: { active: ['req', 'map', 'fl', 'sl', 'matrix'], found: ['list'] },
    explanation: 'Allocation begins by rounding the request for header and alignment, mapping the adjusted size to first-level and second-level indexes, and consulting the bitmaps.',
    invariant: 'A successful lookup returns a free block at least as large as the adjusted request.',
  };

  yield {
    state: labelMatrix(
      'Allocate steps',
      [
        { id: 'round', label: 'round' },
        { id: 'locate', label: 'locate' },
        { id: 'remove', label: 'remove' },
        { id: 'split', label: 'split' },
        { id: 'return', label: 'return' },
      ],
      [
        { id: 'act', label: 'act' },
        { id: 'bound', label: 'bound' },
      ],
      [
        ['align+hdr', 'constant'],
        ['bit scan', 'constant'],
        ['unlink head', 'constant'],
        ['if tail ok', 'constant'],
        ['payload ptr', 'done'],
      ],
    ),
    highlight: { active: ['locate:act', 'remove:act'], found: ['return:bound'], compare: ['split:act'] },
    explanation: 'The fast path does not compare against many free blocks. It finds a suitable list, removes one block, and optionally splits the leftover tail if the remainder can form a legal free block.',
  };

  yield {
    state: graphState({
      nodes: [
        { id: 'big', label: 'free 160', x: 1.0, y: 3.8, note: 'from bin' },
        { id: 'need', label: 'need 112', x: 3.0, y: 3.8, note: 'incl hdr' },
        { id: 'cut', label: 'cut', x: 5.0, y: 3.8, note: 'split' },
        { id: 'used', label: 'used 112', x: 7.0, y: 2.4, note: 'return' },
        { id: 'tail', label: 'tail 48', x: 7.0, y: 5.2, note: 'free' },
        { id: 'bin', label: 'bin 48', x: 9.0, y: 5.2, note: 'insert' },
      ],
      edges: [
        { id: 'e-big-need', from: 'big', to: 'need' },
        { id: 'e-need-cut', from: 'need', to: 'cut' },
        { id: 'e-cut-used', from: 'cut', to: 'used' },
        { id: 'e-cut-tail', from: 'cut', to: 'tail' },
        { id: 'e-tail-bin', from: 'tail', to: 'bin' },
      ],
    }, { title: 'Split the leftover tail if it is useful' }),
    highlight: { active: ['big', 'cut', 'used'], found: ['tail', 'bin'], compare: ['need'] },
    explanation: 'TLSF is a good-fit allocator, not an exact-fit allocator. A larger free block may be used, but a sufficiently large leftover tail is inserted back into the correct bin.',
  };

  yield {
    state: labelMatrix(
      'Real-time gate',
      [
        { id: 'search', label: 'search' },
        { id: 'split', label: 'split' },
        { id: 'locks', label: 'locks' },
        { id: 'oom', label: 'OOM' },
      ],
      [
        { id: 'promise', label: 'promise' },
        { id: 'audit', label: 'audit' },
      ],
      [
        ['bounded', 'bit ops'],
        ['bounded', 'min tail'],
        ['external', 'RTOS rule'],
        ['possible', 'fail fast'],
      ],
    ),
    highlight: { found: ['search:promise', 'split:promise'], compare: ['locks:audit', 'oom:promise'] },
    explanation: 'The allocator can bound its own bin search and list edits. A real-time system still has to bound synchronization, pool size, and the behavior of code that runs when allocation fails.',
  };

  yield {
    state: labelMatrix(
      'Pool audit',
      [
        { id: 'lat', label: 'latency' },
        { id: 'fail', label: 'fail path' },
        { id: 'largest', label: 'max block' },
        { id: 'frag', label: 'frag' },
      ],
      [
        { id: 'target', label: 'target' },
        { id: 'gate', label: 'gate' },
      ],
      [
        ['bounded', 'p99+max'],
        ['fast', 'no alloc'],
        ['enough', 'no OOM'],
        ['low', 'trend'],
      ],
    ),
    highlight: { found: ['lat:gate', 'fail:gate', 'largest:gate'], compare: ['frag:gate'] },
    explanation: 'A serious allocator rollout measures the whole pool, not only one malloc call. Worst-case latency, largest free block, fragmentation trend, and failure-path behavior all belong in the gate.',
  };
}

function* freeCoalesce() {
  yield {
    state: graphState({
      nodes: [
        { id: 'free', label: 'free ptr', x: 0.8, y: 3.8, note: 'block' },
        { id: 'hdr', label: 'header', x: 2.6, y: 3.8, note: 'size+bits' },
        { id: 'prev', label: 'prev blk', x: 4.4, y: 2.4, note: 'free?' },
        { id: 'next', label: 'next blk', x: 4.4, y: 5.2, note: 'free?' },
        { id: 'merge', label: 'merge', x: 6.4, y: 3.8, note: 'adjacent' },
        { id: 'bin', label: 'insert bin', x: 8.5, y: 3.8, note: 'FL SL' },
      ],
      edges: [
        { id: 'e-free-hdr', from: 'free', to: 'hdr' },
        { id: 'e-hdr-prev', from: 'hdr', to: 'prev' },
        { id: 'e-hdr-next', from: 'hdr', to: 'next' },
        { id: 'e-prev-merge', from: 'prev', to: 'merge' },
        { id: 'e-next-merge', from: 'next', to: 'merge' },
        { id: 'e-merge-bin', from: 'merge', to: 'bin' },
      ],
    }, { title: 'Free checks adjacent physical blocks' }),
    highlight: { active: ['free', 'hdr', 'prev', 'next'], found: ['merge', 'bin'] },
    explanation: 'Freeing is not just pushing a pointer. TLSF reads block metadata, checks adjacent physical blocks, immediately coalesces free neighbors, and inserts the merged block into the right bin.',
    invariant: 'Immediate coalescing keeps future allocation lookup bounded by bin state, not by a later cleanup walk.',
  };

  yield {
    state: labelMatrix(
      'Block header',
      [
        { id: 'size', label: 'size' },
        { id: 'used', label: 'used bit' },
        { id: 'prev', label: 'prev free' },
        { id: 'links', label: 'links' },
      ],
      [
        { id: 'role', label: 'role' },
        { id: 'why', label: 'why' },
      ],
      [
        ['block bytes', 'map bin'],
        ['this state', 'validate'],
        ['left state', 'merge left'],
        ['prev/next', 'free list'],
      ],
    ),
    highlight: { active: ['size:role', 'prev:why'], found: ['links:why'] },
    explanation: 'Metadata makes free bounded. Size maps the merged block back to a bin; state bits tell whether neighbors can merge; free-list links let the allocator remove or insert blocks locally.',
  };

  yield {
    state: labelMatrix(
      'Coalesce cases',
      [
        { id: 'none', label: 'none free' },
        { id: 'left', label: 'left free' },
        { id: 'right', label: 'right free' },
        { id: 'both', label: 'both free' },
      ],
      [
        { id: 'action', label: 'action' },
        { id: 'bin', label: 'bin edit' },
      ],
      [
        ['insert self', 'one add'],
        ['merge left', 'rm+add'],
        ['merge right', 'rm+add'],
        ['merge all', '2rm+add'],
      ],
    ),
    highlight: { active: ['left:action', 'right:action'], found: ['both:action'], compare: ['none:bin'] },
    explanation: 'Coalescing only touches adjacent free blocks. Existing free neighbors are first removed from their old bins; the merged result is inserted into its new bin exactly once.',
  };

  yield {
    state: labelMatrix(
      'Use cases',
      [
        { id: 'rtos', label: 'RTOS' },
        { id: 'game', label: 'game loop' },
        { id: 'audio', label: 'audio' },
        { id: 'server', label: 'server' },
      ],
      [
        { id: 'need', label: 'need' },
        { id: 'watch', label: 'watch' },
      ],
      [
        ['bounded', 'pool size'],
        ['no spikes', 'frags'],
        ['no stalls', 'avoid alloc'],
        ['throughput', 'tcache wins'],
      ],
    ),
    highlight: { found: ['rtos:need', 'game:need', 'audio:need'], compare: ['server:watch'] },
    explanation: 'TLSF is attractive when worst-case allocation time matters more than peak allocator throughput. For many server workloads, thread-cache allocators may still win on average throughput.',
  };

  yield {
    state: labelMatrix(
      'Free audit',
      [
        { id: 'merge', label: 'merge rate' },
        { id: 'holes', label: 'holes' },
        { id: 'bins', label: 'bins' },
        { id: 'owner', label: 'owner' },
      ],
      [
        { id: 'signal', label: 'signal' },
        { id: 'fix', label: 'fix' },
      ],
      [
        ['high', 'healthy'],
        ['many', 'lifetime'],
        ['skewed', 'SLI tune'],
        ['mixed', 'pools'],
      ],
    ),
    highlight: { found: ['merge:fix'], active: ['holes:fix', 'bins:fix'], compare: ['owner:signal'] },
    explanation: 'Free-side telemetry explains fragmentation. If holes stay high, bin pressure is skewed, or many owners share one pool, the fix may be lifetime separation, sub-bin tuning, or per-subsystem pools.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'bin map') yield* binMap();
  else if (view === 'allocate path') yield* allocatePath();
  else if (view === 'free coalesce') yield* freeCoalesce();
  else throw new InputError('Pick a TLSF allocator view.');
}

export const article = {
  sections: [
    {
      heading: 'Why this exists',
      paragraphs: [
        'Real-time systems care about the worst allocation, not the average allocation. An RTOS task, audio callback, robot control loop, or game frame can miss its deadline if malloc occasionally walks a long free list or performs delayed cleanup.',
        'TLSF, Two-Level Segregated Fit, exists to make the allocator lookup path bounded. It does not promise infinite memory or zero fragmentation. It promises that finding, splitting, freeing, and coalescing blocks can be done through fixed-size metadata rather than an unbounded heap walk.',
      ],
    },
    {
      heading: 'The reasonable first attempt',
      paragraphs: [
        'A first-fit allocator keeps a list of free blocks and returns the first block large enough. A best-fit allocator searches for the tightest block. Both are easy to understand, and both can behave well in small or batch workloads.',
        'The problem is that the search path depends on heap state. Fragmentation can make the allocator inspect many blocks before it finds a fit. A real-time system needs a bound that does not depend on how messy the free list became.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'A single broad size class can find blocks quickly but wastes memory through internal slack. A very fine set of size classes improves fit quality, but finding the next nonempty class can become another scan.',
        'Deferred coalescing creates a second wall. If free only marks blocks and cleanup happens during a later allocation, the deadline-sensitive allocation path may pay for old garbage. TLSF keeps free-side cleanup bounded and immediate.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Use two levels of bins and make the bins searchable with bitmaps. The first level chooses a coarse power-of-two size band. The second level subdivides that band into finer slots. Each slot has a free list, and bitmap words record which slots and bands are nonempty.',
        'The bitmap index is the real data structure. A request maps to a starting first-level and second-level bin. Find-first-set style operations jump to that bin or the next nonempty bin without walking arbitrary free blocks.',
      ],
    },
    {
      heading: 'How the visual model teaches it',
      paragraphs: [
        'In the bin-map view, watch a request become coordinates in a two-level table. The highlighted bitmap words matter more than the drawn block: they show how the allocator proves where a suitable free list begins without scanning the heap.',
        'In the allocate and free views, focus on metadata movement. Allocation removes one block from a bin, optionally splits a useful tail, and reinserts the tail under its own size. Free checks neighboring physical blocks, removes old free neighbors from their bins, merges, and inserts the merged block once.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Allocation first adjusts the requested size for alignment, headers, and minimum block size. The adjusted size maps to a first-level band and a second-level slot. If that exact slot is empty, the second-level bitmap or first-level bitmap finds the next nonempty slot that can hold the request.',
        'The allocator removes a block from the chosen free list. If the block is larger than needed and the remainder can form a legal free block, it splits the tail and inserts that tail into the correct bin. The returned pointer points to the payload after the block header.',
        'Freeing uses boundary metadata. The allocator marks the block free, checks whether the previous or next physical neighbor is free, removes those neighbors from their old bins, merges adjacent free space, updates headers, and inserts the merged result into the bin for its new size.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The main invariant is that every free block appears in exactly one free list matching its current size, and the bitmap bits mirror whether those lists are empty. If a list becomes empty, its bit is cleared. If a block is inserted, the bit is set.',
        'Splitting and coalescing preserve that invariant. A split removes one large block and inserts at most one leftover tail. A coalesce removes old neighboring free blocks before inserting the merged block once. The bitmap table remains a truthful index of available memory.',
        'The real-time claim follows from that index. Size mapping, bitmap scans, list unlinking, split checks, and neighbor coalescing each touch a bounded amount of metadata. The bound is on allocator work, not on application memory demand.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Suppose the adjusted request is 100 bytes. It maps into the 64-127 first-level band and the second-level slot that starts at 96. If that slot has a free block, the allocator pops it. If not, the bitmap search chooses the next populated slot in that band or the next populated larger band.',
        'If the chosen block is 160 bytes and the adjusted allocation needs 112 bytes, the allocator returns 112 bytes and keeps a 48-byte tail only if that tail can hold the minimum free-block metadata. The tail is inserted into the bin for 48-byte blocks, and the corresponding bitmap bit is set.',
      ],
    },
    {
      heading: 'Cost and behavior',
      paragraphs: [
        'TLSF allocation and free are O(1) with respect to the number of free blocks. The constant includes mapping arithmetic, bitmap operations, a small number of free-list edits, optional splitting, and optional neighbor coalescing.',
        'The tax is metadata and tuning. More second-level slots improve fit quality but increase bitmap and table footprint. Headers, alignment, minimum block size, pool count, and lock policy affect memory overhead. TLSF can be fast and bounded while still wasting memory if the size-class tuning is poor.',
      ],
    },
    {
      heading: 'Where it is useful',
      paragraphs: [
        'TLSF fits bounded-latency heaps in RTOS services, embedded systems, robotics, games, audio-adjacent systems, packet processing, and fixed memory pools where missed deadlines matter more than peak allocator throughput.',
        'A serious rollout measures worst-case alloc and free time, largest free block, fragmentation trend, allocation failure behavior, lock hold time, and pool pressure by subsystem. Average allocation time is not enough evidence for real-time use.',
      ],
    },
    {
      heading: 'Where it is the wrong tool',
      paragraphs: [
        'TLSF is often the wrong allocator for general server workloads where thread caches, arenas, per-size-class slabs, and throughput under contention matter more than a strict bound on a single allocation path.',
        'It is also the wrong answer for the hardest real-time callbacks if allocation itself is forbidden. In those paths, preallocation or static buffers may be the correct design, with TLSF reserved for less critical bounded dynamic allocation.',
      ],
    },
    {
      heading: 'Failure modes',
      paragraphs: [
        'A fast failed allocation is still a failed allocation. If the pool lacks a sufficiently large contiguous block, TLSF cannot manufacture one. Mixed lifetimes in one pool can keep the bitmap lookup bounded while fragmentation slowly destroys usable capacity.',
        'Other failures sit outside the core algorithm: a global lock can make the system unbounded, a slow out-of-memory path can miss the deadline, corrupted block headers can poison the free lists, and second-level tuning can trade too much memory for too little fit quality or the reverse.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Primary sources: Masmano, Ripoll, Crespo, and Real, TLSF: a New Dynamic Memory Allocator for Real-Time Systems, https://www.gii.upv.es/tlsf/files/papers/ecrts04_tlsf.pdf; the UPV TLSF project page, https://www.gii.upv.es/tlsf/; Matthew Conte TLSF implementation, https://github.com/mattconte/tlsf; and RIOT OS package docs, https://api.riot-os.org/group__pkg__tlsf.html.',
        'Study Buddy Allocator Free Lists for power-of-two splitting, Slab Allocator and Size Classes for object caches, Rank/Select Bitvector for bitmap navigation, Linked List for free-list mechanics, Big-O Growth Rates for bounded-work reasoning, GPU Memory Pool Fragmentation Ledger for fragmentation accounting, and WebAssembly Linear Memory for another bounded-memory environment.',
      ],
    },
  ],
};
