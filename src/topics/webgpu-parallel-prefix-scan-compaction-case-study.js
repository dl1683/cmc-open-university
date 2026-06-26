// WebGPU parallel prefix scan: workgroup-local upsweep/downsweep, block sums,
// global offsets, stream compaction, storage buffers, barriers, and readback.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'webgpu-parallel-prefix-scan-compaction-case-study',
  title: 'WebGPU Parallel Prefix Scan & Compaction',
  category: 'Systems',
  summary: 'A WebGPU compute case study: workgroup-local Blelloch scan, block sums, global offsets, storage-buffer compaction, and GPU readback gates.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['workgroup scan', 'buffer pipeline', 'compaction case'], defaultValue: 'workgroup scan' },
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

function scanGraph(title, notes = {}) {
  return graphState({
    nodes: [
      { id: 'in', label: 'input', x: 0.7, y: 4.0, note: notes.in ?? 'flags' },
      { id: 'wg', label: 'wg', x: 2.2, y: 4.0, note: notes.wg ?? '256' },
      { id: 'local', label: 'local', x: 3.9, y: 2.2, note: notes.local ?? 'shared' },
      { id: 'up', label: 'up', x: 3.9, y: 5.8, note: notes.up ?? 'reduce' },
      { id: 'down', label: 'down', x: 5.7, y: 4.0, note: notes.down ?? 'scan' },
      { id: 'sum', label: 'sum', x: 7.1, y: 2.2, note: notes.sum ?? 'block' },
      { id: 'off', label: 'offset', x: 7.1, y: 5.8, note: notes.off ?? 'add' },
      { id: 'out', label: 'output', x: 8.9, y: 4.0, note: notes.out ?? 'pos' },
      { id: 'read', label: 'read', x: 9.8, y: 4.0, note: notes.read ?? 'map' },
    ],
    edges: [
      { id: 'e-in-wg', from: 'in', to: 'wg', weight: 'load' },
      { id: 'e-wg-local', from: 'wg', to: 'local', weight: 'tile' },
      { id: 'e-local-up', from: 'local', to: 'up', weight: 'bar' },
      { id: 'e-up-down', from: 'up', to: 'down', weight: 'root' },
      { id: 'e-down-sum', from: 'down', to: 'sum', weight: 'total' },
      { id: 'e-down-off', from: 'down', to: 'off', weight: 'local' },
      { id: 'e-off-out', from: 'off', to: 'out', weight: 'scatter' },
      { id: 'e-sum-off', from: 'sum', to: 'off', weight: 'prefix' },
      { id: 'e-out-read', from: 'out', to: 'read', weight: 'copy' },
    ],
  }, { title });
}

function* workgroupScan() {
  yield {
    state: scanGraph('Prefix scan turns per-item flags into output positions'),
    highlight: { active: ['in', 'wg', 'local', 'up', 'down'], found: ['out'], compare: ['read'] },
    explanation: 'A prefix scan takes values such as visibility flags and computes running counts. On the GPU, one workgroup scans a tile in fast workgroup memory, then later passes combine block totals.',
    invariant: 'Scan is the bridge from independent flags to collision-free scatter positions.',
  };

  yield {
    state: labelMatrix(
      'Tile scan',
      [
        { id: 'in', label: 'in' },
        { id: 'up1', label: 'up1' },
        { id: 'up2', label: 'up2' },
        { id: 'root', label: 'root' },
        { id: 'out', label: 'out' },
      ],
      [
        { id: 'i0', label: '0' },
        { id: 'i1', label: '1' },
        { id: 'i2', label: '2' },
        { id: 'i3', label: '3' },
        { id: 'i4', label: '4' },
        { id: 'i5', label: '5' },
        { id: 'i6', label: '6' },
        { id: 'i7', label: '7' },
      ],
      [
        ['1', '0', '1', '1', '0', '1', '0', '1'],
        ['1', '1', '1', '2', '0', '1', '0', '1'],
        ['1', '1', '1', '3', '0', '1', '0', '2'],
        ['1', '1', '1', '3', '0', '1', '0', '5'],
        ['0', '1', '1', '2', '3', '3', '4', '4'],
      ],
    ),
    highlight: { active: ['up1:i3', 'up2:i7', 'root:i7'], found: ['out:i0', 'out:i7'] },
    explanation: 'This is an exclusive scan of eight flags. The output tells each live item how many live items came before it, so that item can write to a unique compacted slot.',
  };

  yield {
    state: labelMatrix(
      'Phase rules',
      [
        { id: 'load', label: 'load' },
        { id: 'up', label: 'up' },
        { id: 'bar', label: 'barrier' },
        { id: 'down', label: 'down' },
        { id: 'write', label: 'write' },
      ],
      [
        { id: 'where', label: 'where' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['local', 'bounds'],
        ['tree', 'race'],
        ['wg', 'missing'],
        ['tree', 'wrong pos'],
        ['global', 'alias'],
      ],
    ),
    highlight: { active: ['bar:where', 'up:risk', 'down:risk'], found: ['write:where'] },
    explanation: 'Within one workgroup, barriers separate tree levels so every invocation sees the writes from the previous level. Without the barriers, the scan reads stale or partial workgroup-memory values.',
  };

  yield {
    state: scanGraph('Large arrays need block sums plus a second scan', { in: 'N items', sum: 'totals', off: 'block off', out: 'global pos' }),
    highlight: { active: ['sum', 'off', 'e-sum-off', 'e-off-out'], found: ['in', 'wg'], compare: ['read'] },
    explanation: 'One workgroup only scans its tile. For a large buffer, the first pass writes one total per block, a second pass scans those totals, and a final pass adds the block offset to each local position.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'N', min: 1000, max: 1000000 }, y: { label: 'ms', min: 0, max: 40 } },
      series: [
        { id: 'cpu', label: 'cpu', points: [{ x: 1000, y: 1 }, { x: 10000, y: 4 }, { x: 100000, y: 18 }, { x: 1000000, y: 36 }] },
        { id: 'gpu', label: 'gpu', points: [{ x: 1000, y: 3 }, { x: 10000, y: 4 }, { x: 100000, y: 7 }, { x: 1000000, y: 12 }] },
      ],
      markers: [
        { id: 'cross', x: 10000, y: 4, label: 'xover' },
      ],
    }),
    highlight: { active: ['gpu', 'cross'], compare: ['cpu'] },
    explanation: 'The GPU is not always faster for tiny buffers because dispatch and readback have fixed costs. Scan wins when the buffer is large enough and the result stays on the GPU for later passes.',
  };
}

function* bufferPipeline() {
  yield {
    state: scanGraph('The WebGPU pipeline is a sequence of storage-buffer passes'),
    highlight: { active: ['in', 'wg', 'sum', 'off', 'out'], found: ['read'] },
    explanation: 'A WebGPU scan pipeline is not one magic shader. It is a small dataflow graph of storage buffers: input flags, per-block local scans, block sums, scanned block offsets, compacted output, and optional readback.',
  };

  yield {
    state: labelMatrix(
      'Buffers',
      [
        { id: 'flags', label: 'flags' },
        { id: 'local', label: 'local pos' },
        { id: 'sums', label: 'sums' },
        { id: 'offs', label: 'offsets' },
        { id: 'out', label: 'output' },
      ],
      [
        { id: 'usage', label: 'usage' },
        { id: 'owner', label: 'owner' },
      ],
      [
        ['storage', 'pass 1'],
        ['storage', 'pass 1'],
        ['storage', 'pass 1'],
        ['storage', 'pass 2'],
        ['storage', 'pass 3'],
      ],
    ),
    highlight: { active: ['flags:usage', 'sums:owner', 'offs:owner', 'out:owner'] },
    explanation: 'The buffers are explicit because WebGPU validates usage. Each pass binds the buffers it reads and writes, and the command encoder records the order before queue submission.',
  };

  yield {
    state: labelMatrix(
      'Dispatch plan',
      [
        { id: 'p1', label: 'pass 1' },
        { id: 'p2', label: 'pass 2' },
        { id: 'p3', label: 'pass 3' },
        { id: 'copy', label: 'copy' },
      ],
      [
        { id: 'does', label: 'does' },
        { id: 'count', label: 'count' },
      ],
      [
        ['tile scan', 'ceil N/T'],
        ['sum scan', 'ceil B/T'],
        ['scatter', 'ceil N/T'],
        ['readback', '1'],
      ],
    ),
    highlight: { active: ['p1:does', 'p2:does', 'p3:does'], compare: ['copy:does'] },
    explanation: 'The dispatch count is based on elements and tile size. The readback copy is optional for UI/debugging; most production pipelines keep the compacted output on the GPU.',
  };

  yield {
    state: scanGraph('Readback is a staging-buffer boundary, not the scan itself', { read: 'staging', out: 'GPU only' }),
    highlight: { active: ['out', 'read', 'e-out-read'], found: ['off'], compare: ['in'] },
    explanation: 'GPU output usually lives in a storage buffer. If JavaScript needs the count or compacted rows, copy to a MAP_READ staging buffer and wait for mapping. Pulling data back every frame can erase the compute win.',
  };

  yield {
    state: labelMatrix(
      'Pipeline gates',
      [
        { id: 'align', label: 'align' },
        { id: 'bounds', label: 'bounds' },
        { id: 'barrier', label: 'barrier' },
        { id: 'order', label: 'order' },
        { id: 'read', label: 'read' },
      ],
      [
        { id: 'test', label: 'test' },
        { id: 'bug', label: 'bug' },
      ],
      [
        ['layout', 'bad bytes'],
        ['N tail', 'OOB'],
        ['levels', 'race'],
        ['passes', 'stale'],
        ['async', 'stall'],
      ],
    ),
    highlight: { active: ['bounds:test', 'barrier:test', 'order:test'], compare: ['read:bug'] },
    explanation: 'The failure modes are concrete: mismatched struct layout, missing tail guards, missing barriers inside a workgroup, command ordering mistakes across passes, and avoidable readback stalls.',
  };
}

function* compactionCase() {
  yield {
    state: labelMatrix(
      'Compaction',
      [
        { id: 'p0', label: 'p0' },
        { id: 'p1', label: 'p1' },
        { id: 'p2', label: 'p2' },
        { id: 'p3', label: 'p3' },
        { id: 'p4', label: 'p4' },
        { id: 'p5', label: 'p5' },
      ],
      [
        { id: 'keep', label: 'keep' },
        { id: 'pos', label: 'pos' },
        { id: 'out', label: 'out' },
      ],
      [
        ['1', '0', '0'],
        ['0', '1', '-'],
        ['1', '1', '1'],
        ['1', '2', '2'],
        ['0', '3', '-'],
        ['1', '3', '3'],
      ],
    ),
    highlight: { active: ['p0:out', 'p2:out', 'p3:out', 'p5:out'], compare: ['p1:out', 'p4:out'] },
    explanation: 'Stream compaction is the complete case: each particle or row computes a keep flag, scan converts flags to positions, and kept items scatter into a dense output buffer.',
    invariant: 'No atomics are needed when scan gives every kept item a unique destination.',
  };

  yield {
    state: scanGraph('Particle culling uses scan to build a dense draw list', { in: 'visible?', wg: 'tiles', out: 'draw list', read: 'count' }),
    highlight: { active: ['in', 'wg', 'down', 'off', 'out'], found: ['sum'], compare: ['read'] },
    explanation: 'A renderer can cull particles or instances on the GPU, compact visible instances into a draw list, and draw only the dense list. The CPU only needs a count when issuing indirect draws or reporting metrics.',
  };

  yield {
    state: labelMatrix(
      'Use cases',
      [
        { id: 'cull', label: 'cull' },
        { id: 'radix', label: 'radix' },
        { id: 'bfs', label: 'BFS' },
        { id: 'spmv', label: 'SpMV' },
      ],
      [
        { id: 'input', label: 'input' },
        { id: 'scan', label: 'scan' },
      ],
      [
        ['flags', 'pack'],
        ['digits', 'offsets'],
        ['frontier', 'next'],
        ['row nnz', 'row ptr'],
      ],
    ),
    highlight: { active: ['cull:scan', 'radix:scan', 'bfs:scan'], found: ['spmv:scan'] },
    explanation: 'Prefix scan is a GPU building block. It appears in compaction, radix sort, graph frontier construction, sparse matrix row pointers, histograms, and many binning pipelines.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'keep', min: 0, max: 100 }, y: { label: 'writes', min: 0, max: 100 } },
      series: [
        { id: 'raw', label: 'raw', points: [{ x: 0, y: 100 }, { x: 25, y: 100 }, { x: 50, y: 100 }, { x: 75, y: 100 }, { x: 100, y: 100 }] },
        { id: 'pack', label: 'pack', points: [{ x: 0, y: 0 }, { x: 25, y: 25 }, { x: 50, y: 50 }, { x: 75, y: 75 }, { x: 100, y: 100 }] },
      ],
      markers: [
        { id: 'half', x: 50, y: 50, label: 'half' },
      ],
    }),
    highlight: { active: ['pack', 'half'], compare: ['raw'] },
    explanation: 'Compaction pays a scan to reduce later work. If only half the particles survive, later passes write and shade roughly half as many records instead of carrying holes forward.',
  };

  yield {
    state: labelMatrix(
      'Ship gate',
      [
        { id: 'speed', label: 'speed' },
        { id: 'valid', label: 'valid' },
        { id: 'read', label: 'read' },
        { id: 'tail', label: 'tail' },
      ],
      [
        { id: 'watch', label: 'watch' },
        { id: 'pass', label: 'pass' },
      ],
      [
        ['gpu ms', 'lower'],
        ['CPU chk', 'same'],
        ['map', 'rare'],
        ['N%T', 'safe'],
      ],
    ),
    highlight: { active: ['speed:pass', 'valid:pass', 'tail:pass'], compare: ['read:watch'] },
    explanation: 'A serious scan rollout checks speed, correctness against a CPU reference, rare readback, and tail handling when N is not a multiple of tile size.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'workgroup scan') yield* workgroupScan();
  else if (view === 'buffer pipeline') yield* bufferPipeline();
  else if (view === 'compaction case') yield* compactionCase();
  else throw new InputError('Pick a WebGPU prefix-scan view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'Read the scan view as local facts becoming global positions. Active nodes are tree levels, workgroup tiles, block sums, block offsets, or scatter writes. Found nodes are prefix values whose dependencies are complete.',
        'The safe inference is dependency completion. A scan value is final only after every earlier flag that can affect it has been included, either inside the workgroup tree or through a block offset. Barriers and pass ordering are the correctness boundary.',
        {type: 'callout', text: 'Prefix scan turns independent flags into stable global positions by making ordering a parallel dataflow problem instead of a shared counter.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Many GPU programs first make independent yes-or-no decisions and then need a dense output. A particle is visible, a triangle survives culling, an edge enters the next frontier, or a row emits records. The decision is parallel, but the output positions are not obvious.',
        'Compaction means removing holes while preserving the order of kept items. A GPU cannot let thousands of lanes write to one shared counter without contention or nondeterministic order. Prefix scan computes the rank each kept item should use.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'On the CPU, compaction is a loop with a counter. Read each flag, and when flag[i] is 1, write source[i] to output[count] and increment count. This is simple, stable, and correct because one thread owns the counter.',
        'A tempting GPU version uses one atomic counter. Every kept item atomically increments the counter and writes to the returned slot. That avoids duplicate slots, but it serializes the hottest part of the pass and loses stable order.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is a dependency chain. The output position for item i is the number of kept items before i. A serial counter knows that number only after reading every earlier flag. That structure wastes the GPU because most lanes wait on one global dependency.',
        'Atomic counters remove duplicate writes but create a new wall. The order of atomic increments depends on scheduling, so output order can change across runs. For rendering, sorting, and graph frontiers, nondeterministic compaction can break later assumptions.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'An exclusive prefix scan of 0/1 flags gives each item the count of kept items before it. If flag[i] is 1, that count is exactly the stable output slot. Dropped items get prefix values too, but they do not write.',
        'The invariant is scan[i] = sum(flags[0] through flags[i - 1]). If i < j and both flags are 1, then scan[i] < scan[j]. That proves kept items write to distinct slots in original order.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Inside one workgroup, a Blelloch scan loads a tile into workgroup memory. The upsweep combines pairs into partial sums until the root holds the tile total. For an exclusive scan, the root becomes zero, and the downsweep distributes prefixes back to the leaves.',
        'Large buffers need multiple passes because workgroups cannot synchronize with each other inside one dispatch. Pass 1 scans each tile and writes block totals. Pass 2 scans the block totals. Pass 3 adds each block offset to local prefixes, and a scatter pass writes kept records into compacted output.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The proof rests on associativity and index order. Addition is associative, so the tree can combine partial sums and produce the same totals as a serial pass. During downsweep, each subtree receives the sum of all values to its left, so every leaf receives its exclusive prefix.',
        'Multi-block correctness repeats the same argument at a larger scale. A local scan gives rank within a tile. The scanned block totals give the count of kept items in all earlier tiles. Adding them gives the global rank without any shared counter.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Scan does more total work than a CPU loop but exposes parallel depth. A tile of 256 values needs 255 additions in the upsweep and 255 in the downsweep, plus barriers between tree levels. The depth is about 2 * log2(256), or 16 synchronization levels inside the tile.',
        'For 1,000,000 flags with tile size 256, the first pass launches 3,907 workgroups. It writes 1,000,000 local prefixes and 3,907 block sums. The extra buffers and dispatches are worth it only when the compacted result feeds more GPU work or the input is large enough to amortize setup.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Prefix scan is used for particle visibility lists, tile binning, light lists, radix sort offsets, sparse matrix row pointers, graph BFS frontiers, mesh level-of-detail selection, and collision pair lists. The access pattern is local predicate first, dense global structure second.',
        'In WebGPU, this matters because data can remain in storage buffers. A renderer can compact visible instances and feed an indirect draw without copying the list to JavaScript. A graph kernel can compact the next frontier and dispatch the next expansion on the GPU.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'It fails for tiny arrays where dispatch overhead dominates. If 1,000 flags already live in JavaScript and the compacted result is needed on the CPU, a typed-array loop is usually simpler and faster. GPU scan pays off when data is large or already GPU-resident.',
        'It also fails on boundary bugs. Non-power-of-two lengths need tail guards and identity padding. Missing workgroupBarrier calls cause intermittent wrong prefixes. Wrong dispatch counts drop the final partial tile. These errors should be tested against randomized CPU references.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Flags are [1, 0, 1, 1, 0, 1]. The exclusive scan is [0, 1, 1, 2, 3, 3]. Items 0, 2, 3, and 5 write to output slots 0, 1, 2, and 3. The compacted length is scan[5] + flag[5] = 4.',
        'Now split into tiles of 4. Tile 0 flags [1, 0, 1, 1] produce local scan [0, 1, 1, 2] and total 3. Tile 1 flags [0, 1, 0, 0] produce local scan [0, 0, 1, 1] and total 1. The block offsets are [0, 3], so item 5 gets global rank 0 + 3 = 3.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Blelloch, Prefix Sums and Their Applications at https://www.cs.cmu.edu/~guyb/papers/Ble93.pdf, GPU Gems 3 Chapter 39 at https://developer.nvidia.com/gpugems/gpugems3/part-vi-gpu-computing/chapter-39-parallel-prefix-sum-scan-cuda, W3C WGSL at https://www.w3.org/TR/WGSL/, and MDN dispatchWorkgroups at https://developer.mozilla.org/en-US/docs/Web/API/GPUComputePassEncoder/dispatchWorkgroups.',
        'Study next by role: Fenwick Tree for online CPU prefix sums, WebGPU Buffer and Bind Group for storage-buffer mechanics, Radix Sort for scan-driven sorting, Compressed Sparse Row Graph for row-pointer construction, and GPU All-Reduce for a contrasting collective operation.',
      ],
    },
  ],
};
