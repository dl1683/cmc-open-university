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
      heading: 'What it is',
      paragraphs: [
        'TLSF means Two-Level Segregated Fit. It is a dynamic memory allocator designed for real-time systems, where malloc and free should have bounded execution time rather than occasionally walking an unbounded free list.',
        'The data structure is a matrix of free lists indexed by two bitmap levels. The first-level index chooses a coarse size class, usually based on the most significant bit of the block size. The second-level index subdivides that size range into finer bins. A free block lives in exactly one bin list, and bitmap words tell which bins are nonempty.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Allocation rounds the requested size for headers and alignment, maps it to FL and SL indexes, and searches the current or next nonempty bin using bitmap operations. It removes a block from that free list, splits a useful tail when possible, updates headers, and returns the payload pointer.',
        'Freeing checks physical neighbors through block headers, immediately coalesces adjacent free blocks, removes old neighbors from their bins, and inserts the merged block into the bin matching its new size. This immediate coalescing is part of the bounded-time story: the allocator does not defer arbitrary cleanup to a future allocation.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'TLSF is designed so allocation and deallocation take O(1) time with respect to the number of free blocks. The constant includes size mapping, bit scans, a small number of list edits, optional split, and optional neighbor coalescing. That is different from a naive first-fit allocator whose search can lengthen as fragmentation grows.',
        'The tradeoff is metadata and tuning. More second-level bins reduce fit slack but increase bitmap and table footprint. Alignment, minimum block size, headers, pool count, and concurrency policy all affect real behavior. TLSF bounds allocator work; it does not guarantee an allocation succeeds if the pool lacks a sufficiently large contiguous free block.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'Consider a real-time audio engine that allocates small control objects during scene changes and larger buffers during preset loads. A general malloc with occasional long free-list searches can create audible glitches. A TLSF pool gives the engine a bounded allocator path: size maps to bins, bitmaps choose a nonempty list, and free immediately coalesces returned buffers.',
        'The release gate is not just average allocation time. The team measures worst-case alloc/free latency under a fixed workload, peak fragmentation, largest free block, allocation failure behavior, and whether any lock can block the audio thread. Some systems still choose arena preallocation for the audio callback itself and reserve TLSF for bounded but less critical real-time work.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'TLSF is not magic memory. If the requested size cannot fit any free block, allocation fails. If the application fragments the pool into incompatible holes, the bitmap lookup remains fast but may still find no adequate block. Pool sizing and lifetime discipline still matter.',
        'Also distinguish bounded allocator operations from bounded system behavior. If malloc takes a global lock held by another thread, or if allocation failure triggers slow recovery code, the allocator data structure cannot save the deadline. Real-time use requires synchronization, failure paths, and pool ownership to be designed with the same discipline.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Masmano, Ripoll, Crespo, and Real, TLSF: a New Dynamic Memory Allocator for Real-Time Systems, https://www.gii.upv.es/tlsf/files/papers/ecrts04_tlsf.pdf; the UPV TLSF project page, https://www.gii.upv.es/tlsf/; Matthew Conte TLSF implementation, https://github.com/mattconte/tlsf; and RIOT OS package docs, https://api.riot-os.org/group__pkg__tlsf.html. Study Buddy Allocator Free Lists, Slab Allocator & Size Classes, Rank/Select Bitvector, Linked List, Big-O Growth Rates, GPU Memory Pool Fragmentation Ledger, and WebAssembly Linear Memory next.',
      ],
    },
  ],
};
