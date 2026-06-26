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
  const nodeIds = ['req', 'map', 'fl', 'sl', 'matrix', 'list', 'split', 'block'];
  const reqSize = 100;
  const flLevels = [
    { id: 'fl5', label: 'FL 5', range: '32-63',  slots: ['32', '40', '48', '56'] },
    { id: 'fl6', label: 'FL 6', range: '64-127', slots: ['64', '80', '96', '112'] },
    { id: 'fl7', label: 'FL 7', range: '128-255', slots: ['128', '160', '192', '224'] },
    { id: 'fl8', label: 'FL 8', range: '256-511', slots: ['256', '320', '384', '448'] },
  ];
  const slCount = 4;
  const targetFL = 6;
  const targetSL = 2;
  const flBits = '100100';
  const slBits = '0100';

  yield {
    state: tlsfGraph('TLSF indexes free memory with two bitmap levels'),
    highlight: { active: ['map', 'fl', 'sl', 'matrix'], found: ['list', 'block'] },
    explanation: `TLSF, Two-Level Segregated Fit, keeps free blocks in a matrix of lists. A first-level index chooses a power-of-two size band; a second-level index subdivides that band into ${slCount} sub-bins across ${nodeIds.length} pipeline stages.`,
    invariant: `The search path is bounded: map the ${reqSize}-byte request, scan ${flLevels.length} FL bands and ${slCount} SL slots, pop a list head.`,
  };

  yield {
    state: labelMatrix(
      'Two-level bins',
      flLevels.map(({ id, label }) => ({ id, label })),
      [
        { id: 'range', label: 'range' },
        { id: 'sl0', label: 'SL0' },
        { id: 'sl1', label: 'SL1' },
        { id: 'sl2', label: 'SL2' },
        { id: 'sl3', label: 'SL3' },
      ],
      flLevels.map(({ range, slots }) => [range, ...slots]),
    ),
    highlight: { active: ['fl6:range', 'fl6:sl2'], found: ['fl6:sl3'], compare: ['fl7:range'] },
    explanation: `A ${reqSize}-byte request maps into the ${flLevels[1].range} band (FL ${targetFL}) and the sub-bin starting at ${flLevels[1].slots[targetSL]} (SL ${targetSL}). If that sub-bin is empty, the allocator scans SL bits or advances to the next FL band among ${flLevels.length} levels shown.`,
  };

  const bitmapData = [
    [`FL${targetFL} SL${targetSL}`, 'start here'],
    [slBits, `SL${targetSL} has blk`],
    [flBits, `FL${targetFL} live`],
    [`FL${targetFL} SL${targetSL}`, 'pop list'],
  ];

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
      bitmapData,
    ),
    highlight: { active: ['sl:value', 'fl:value'], found: ['pick:value', 'pick:meaning'] },
    explanation: `The key data structure is the bitmap index. The SL word ${slBits} and FL word ${flBits} let machine instructions like find-first-set jump to FL${targetFL} SL${targetSL} without walking ${bitmapData.length} rows of free blocks.`,
  };

  const allocators = ['buddy', 'slab', 'TLSF', 'malloc bins'];
  const tlsfIndex = 'FL+SL';
  const tlsfFit = 'good fit';

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
        [tlsfIndex, tlsfFit, 'metadata'],
        ['bins/tree', 'varies', 'tail'],
      ],
    ),
    highlight: { found: ['tlsf:index', 'tlsf:fit'], compare: ['buddy:risk', 'malloc:risk'] },
    explanation: `TLSF sits between ${allocators[0]} splitting and general ${allocators[3]}. Its ${tlsfIndex} index provides ${tlsfFit} while keeping the bin search bounded across ${allocators.length} compared strategies.`,
  };

  const sliOptions = [4, 8, 16, 32];

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
    explanation: `The second-level count is a real design knob. Options range from ${sliOptions[0]} to ${sliOptions[sliOptions.length - 1]} sub-bins across ${sliOptions.length} configurations. More sub-bins reduce slack and improve fit quality, but they expand the ${flLevels.length} x N bin matrix and bitmap metadata.`,
  };
}

function* allocatePath() {
  const pipelineNodes = ['req', 'map', 'fl', 'sl', 'matrix', 'list'];
  const reqSize = 100;

  yield {
    state: tlsfGraph('Allocation maps size to a nonempty bin'),
    highlight: { active: ['req', 'map', 'fl', 'sl', 'matrix'], found: ['list'] },
    explanation: `Allocation begins by rounding the ${reqSize}-byte request for header and alignment, mapping the adjusted size to first-level and second-level indexes, and consulting the bitmaps across ${pipelineNodes.length} pipeline stages.`,
    invariant: `A successful lookup returns a free block at least as large as the adjusted ${reqSize}-byte request.`,
  };

  const steps = ['round', 'locate', 'remove', 'split', 'return'];
  const stepActs = ['align+hdr', 'bit scan', 'unlink head', 'if tail ok', 'payload ptr'];
  const stepBounds = ['constant', 'constant', 'constant', 'constant', 'done'];

  yield {
    state: labelMatrix(
      'Allocate steps',
      steps.map((id) => ({ id, label: id })),
      [
        { id: 'act', label: 'act' },
        { id: 'bound', label: 'bound' },
      ],
      steps.map((_, i) => [stepActs[i], stepBounds[i]]),
    ),
    highlight: { active: ['locate:act', 'remove:act'], found: ['return:bound'], compare: ['split:act'] },
    explanation: `The fast path runs ${steps.length} steps, each bounded. It finds a suitable list via ${stepActs[1]}, removes one block (${stepActs[2]}), and optionally splits the leftover tail (${stepActs[3]}) if the remainder can form a legal free block.`,
  };

  const freeSize = 160;
  const needSize = 112;
  const tailSize = freeSize - needSize;

  yield {
    state: graphState({
      nodes: [
        { id: 'big', label: `free ${freeSize}`, x: 1.0, y: 3.8, note: 'from bin' },
        { id: 'need', label: `need ${needSize}`, x: 3.0, y: 3.8, note: 'incl hdr' },
        { id: 'cut', label: 'cut', x: 5.0, y: 3.8, note: 'split' },
        { id: 'used', label: `used ${needSize}`, x: 7.0, y: 2.4, note: 'return' },
        { id: 'tail', label: `tail ${tailSize}`, x: 7.0, y: 5.2, note: 'free' },
        { id: 'bin', label: `bin ${tailSize}`, x: 9.0, y: 5.2, note: 'insert' },
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
    explanation: `TLSF is a good-fit allocator, not an exact-fit allocator. The ${freeSize}-byte free block satisfies a ${needSize}-byte need, and the ${tailSize}-byte leftover tail is inserted back into the bin for ${tailSize}-byte blocks.`,
  };

  const gateChecks = ['search', 'split', 'locks', 'OOM'];
  const gatePromises = ['bounded', 'bounded', 'external', 'possible'];

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
    explanation: `The allocator can bound its own ${gateChecks[0]} (${gatePromises[0]}) and ${gateChecks[1]} (${gatePromises[1]}). But ${gateChecks[2]} are ${gatePromises[2]} and ${gateChecks[3]} is ${gatePromises[3]} -- a real-time system must bound all ${gateChecks.length} concerns.`,
  };

  const auditMetrics = ['latency', 'fail path', 'max block', 'frag'];
  const auditGates = ['p99+max', 'no alloc', 'no OOM', 'trend'];

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
    explanation: `A serious allocator rollout measures ${auditMetrics.length} dimensions: ${auditMetrics[0]} (gate: ${auditGates[0]}), ${auditMetrics[1]} (${auditGates[1]}), ${auditMetrics[2]} (${auditGates[2]}), and ${auditMetrics[3]} (${auditGates[3]}).`,
  };
}

function* freeCoalesce() {
  const freeNodes = ['free', 'hdr', 'prev', 'next', 'merge', 'bin'];
  const freeEdges = [
    { from: 'free', to: 'hdr' },
    { from: 'hdr', to: 'prev' },
    { from: 'hdr', to: 'next' },
    { from: 'prev', to: 'merge' },
    { from: 'next', to: 'merge' },
    { from: 'merge', to: 'bin' },
  ];

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
      edges: freeEdges.map(({ from, to }) => ({ id: `e-${from}-${to}`, from, to })),
    }, { title: 'Free checks adjacent physical blocks' }),
    highlight: { active: ['free', 'hdr', 'prev', 'next'], found: ['merge', 'bin'] },
    explanation: `Freeing is not just pushing a pointer. TLSF walks ${freeNodes.length} stages (${freeNodes.join(' -> ')}): reads block metadata, checks ${freeEdges.filter((e) => e.from === 'hdr').length} adjacent physical blocks, immediately coalesces free neighbors, and inserts the merged block into the right bin.`,
    invariant: `Immediate coalescing across ${freeNodes.length} nodes keeps future allocation lookup bounded by bin state, not by a later cleanup walk.`,
  };

  const headerFields = ['size', 'used bit', 'prev free', 'links'];
  const headerRoles = ['block bytes', 'this state', 'left state', 'prev/next'];
  const headerWhys = ['map bin', 'validate', 'merge left', 'free list'];

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
    explanation: `Metadata makes free bounded. ${headerFields.length} header fields drive the process: ${headerFields[0]} (${headerWhys[0]}), ${headerFields[1]} (${headerWhys[1]}), ${headerFields[2]} (${headerWhys[2]}), and ${headerFields[3]} (${headerWhys[3]}).`,
  };

  const cases = ['none free', 'left free', 'right free', 'both free'];
  const caseActions = ['insert self', 'merge left', 'merge right', 'merge all'];
  const caseBinEdits = ['one add', 'rm+add', 'rm+add', '2rm+add'];

  yield {
    state: labelMatrix(
      'Coalesce cases',
      cases.map((label, i) => ({ id: ['none', 'left', 'right', 'both'][i], label })),
      [
        { id: 'action', label: 'action' },
        { id: 'bin', label: 'bin edit' },
      ],
      cases.map((_, i) => [caseActions[i], caseBinEdits[i]]),
    ),
    highlight: { active: ['left:action', 'right:action'], found: ['both:action'], compare: ['none:bin'] },
    explanation: `Coalescing handles ${cases.length} cases. When ${cases[3]}, the action is ${caseActions[3]} with ${caseBinEdits[3]} (2 removes + 1 add). Even the worst case (${cases[3]}) touches only adjacent free blocks; the merged result is inserted into its new bin exactly once.`,
  };

  const useCases = ['RTOS', 'game loop', 'audio', 'server'];
  const useCaseNeeds = ['bounded', 'no spikes', 'no stalls', 'throughput'];

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
    explanation: `TLSF is attractive for ${useCases.length - 1} of ${useCases.length} listed domains: ${useCases[0]} (${useCaseNeeds[0]}), ${useCases[1]} (${useCaseNeeds[1]}), ${useCases[2]} (${useCaseNeeds[2]}). For ${useCases[3]} workloads seeking ${useCaseNeeds[3]}, thread-cache allocators may still win.`,
  };

  const auditSignals = ['high', 'many', 'skewed', 'mixed'];
  const auditFixes = ['healthy', 'lifetime', 'SLI tune', 'pools'];
  const auditLabels = ['merge rate', 'holes', 'bins', 'owner'];

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
      auditLabels.map((_, i) => [auditSignals[i], auditFixes[i]]),
    ),
    highlight: { found: ['merge:fix'], active: ['holes:fix', 'bins:fix'], compare: ['owner:signal'] },
    explanation: `Free-side telemetry tracks ${auditLabels.length} dimensions. If ${auditLabels[1]} signal is ${auditSignals[1]}, fix via ${auditFixes[1]} separation. If ${auditLabels[2]} are ${auditSignals[2]}, fix via ${auditFixes[2]}. If ${auditLabels[3]} are ${auditSignals[3]}, split into per-subsystem ${auditFixes[3]}.`,
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
    { heading: 'How to read the animation', paragraphs: ['Read the animation as bounded metadata search. TLSF means Two-Level Segregated Fit, an allocator that maps requested sizes to bins. The bitmap highlights show how it finds a nonempty free list without walking the heap.', {type: 'image', src: './assets/gifs/tlsf-real-time-allocator-bitmap-index.gif', alt: 'Animated walkthrough of the tlsf real time allocator bitmap index visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},], },
    { heading: 'Why this exists', paragraphs: ['Real-time systems care about worst allocation time, not average allocation time. A robot loop, audio callback, or packet path can miss a deadline if allocation sometimes scans a long list. TLSF exists to bound lookup, split, free, and coalesce work.', {type: 'callout', text: 'TLSF is a deadline promise about allocator metadata: lookup, split, free, and coalesce must touch bounded structures rather than wandering through heap history.'},], },
    { heading: 'The obvious approach', paragraphs: ['First-fit walks free blocks until one is large enough. Best-fit searches for a tighter block. Segregated free lists improve this by grouping sizes, but finding the next nonempty class can still become a scan.'], },
    { heading: 'The wall', paragraphs: ['The wall is heap-history dependence. Fragmentation can make a normal allocator inspect many blocks before success. Deferred coalescing also moves old cleanup work onto a later allocation, which is bad for deadlines.'], },
    { heading: 'The core insight', paragraphs: ['Use two levels of size classes and make both levels searchable with bitmaps. The first level chooses a coarse power-of-two band, and the second level chooses a finer slot. Find-first-set jumps to a populated slot.', {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/4/4f/KL_Intel_i7_die.jpg', alt: 'Processor die photograph showing dense compute and memory structures', caption: 'Hardware deadlines make allocator latency visible: a bounded bitmap path protects worst-case control loops better than an average-fast heap walk. Source: Wikimedia Commons, KL and Intel, public domain: https://commons.wikimedia.org/wiki/File:KL_Intel_i7_die.jpg.'},], },
    { heading: 'How it works', paragraphs: ['Allocation rounds the request for alignment and headers, maps it to first- and second-level indexes, and uses bitmaps to find a suitable nonempty list. It removes one block, optionally splits a legal tail, and reinserts that tail into the correct bin. Free checks physical neighbors, coalesces immediately, and updates bitmap bits.'], },
    { heading: 'Why it works', paragraphs: ['The invariant is that every free block appears in exactly one free list matching its size, and bitmap bits truthfully mirror nonempty lists. Splitting removes one block and adds at most one tail. Coalescing removes neighbors before inserting the merged block once.'], },
    { heading: 'Cost and complexity', paragraphs: ['Allocation and free are O(1) with respect to the number of heap blocks. The constants are mapping arithmetic, bitmap scans, pointer edits, split checks, and neighbor coalescing. Space cost is headers, list pointers, bitmaps, and alignment slack.'], },
    { heading: 'Real-world uses', paragraphs: ['TLSF fits RTOS services, embedded control, robotics, games, packet processing, and fixed pools where bounded dynamic allocation is allowed. A serious rollout measures worst-case alloc/free time, largest free block, fragmentation, lock hold time, and failure path latency.'], },
    { heading: 'Where it fails', paragraphs: ['TLSF does not create memory. If the pool lacks a large enough contiguous block, allocation fails quickly. It is often the wrong allocator for throughput-heavy server heaps, and hard real-time callbacks may still require preallocation.'], },
    { heading: 'Worked example', paragraphs: ['Suppose an adjusted request is 100 bytes and alignment makes the allocation 112 bytes. It maps to the 64 through 127 band and a second-level slot near 96. If a 160-byte block is chosen, TLSF returns 112 bytes and considers a 48-byte tail.', 'If 48 bytes can hold a free block header and links, the tail is inserted into the 48-byte bin and the bitmap bit is set. If not, the allocator returns the whole 160 bytes to avoid creating an unusable fragment.'], },
    { heading: 'Sources and study next', paragraphs: ['Read Masmano, Ripoll, Crespo, and Real on TLSF, the UPV TLSF materials, Matthew Conte tlsf, and RTOS TLSF docs. Study free lists, buddy allocation, slab allocation, rank/select bitmaps, boundary tags, and fragmentation metrics next.'], },
  ],
};
