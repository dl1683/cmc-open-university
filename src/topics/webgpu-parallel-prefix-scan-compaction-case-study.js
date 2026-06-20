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
        'The animation traces the execution of a WebGPU parallel prefix scan and stream compaction pipeline. Each view isolates one layer: the workgroup-local Blelloch tree, the multi-pass buffer pipeline, or the end-to-end compaction case.',
        {
          type: 'note',
          text: 'Active nodes are the current computation stage. Found nodes are outputs whose values are now final. Compared nodes show a reference path (like CPU readback) that exists but is not the fast path. If a downstream node is not yet active, data has not reached it.',
        },
        'At each frame, identify which buffer is being read and which is being written. The scan is correct only if every write depends on fully completed reads from the previous tree level or previous pass. That sequencing -- barriers within a workgroup, command ordering across passes -- is the entire correctness story.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Many GPU programs begin with independent per-item decisions and then need a dense result. A particle is visible or invisible. A graph edge enters the next frontier or does not. A row contributes some number of nonzero values. A token, triangle, or document either survives a filter or gets dropped. The first phase is embarrassingly parallel. The second phase is the hard part: every surviving item needs a unique output position, and thousands of threads must agree on who writes where without collisions.',
        {
          type: 'quote',
          attribution: 'Guy Blelloch, "Prefix Sums and Their Applications" (1990)',
          text: 'The prefix sum is perhaps the most important primitive in parallel computing. It converts local information into global addresses.',
        },
        'A prefix scan computes running totals across an array. For 0/1 flags, an exclusive scan answers a placement question: how many kept items came before this one? That answer is exactly the dense output slot where the item should write. This turns unordered independent decisions into ordered, collision-free scatter positions.',
        'WebGPU makes this pattern available in the browser and in portable GPU applications. The work is expressed as compute passes over storage buffers. The payoff is not only speed; it is a clean way to keep filtering, culling, binning, sorting, and sparse data preparation on the GPU without pulling intermediate arrays back to JavaScript after every phase.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'On the CPU, compaction is a loop with a counter. Read each flag, write kept records to output[count], increment count. Five lines of code, easy to reason about, perfectly correct.',
        {
          type: 'code',
          language: 'javascript',
          body: `// CPU compaction: correct, serial, O(n)
function compact(flags, source) {
  const out = [];
  let count = 0;
  for (let i = 0; i < flags.length; i++) {
    if (flags[i]) { out[count] = source[i]; count++; }
  }
  return { out, count };
}`,
        },
        'This works because position count is a running accumulator that only the single thread touches. Every output slot is determined by the complete history of prior flags. For a few thousand items, this loop finishes in microseconds and there is no reason to look further.',
        'The approach also preserves stable order automatically. Item 5 always appears after item 2 in the output if both are kept, because the loop visits items in index order. Stability matters when the compacted list feeds a renderer or a sorted pipeline.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The serial loop is a dependency chain. Each output position depends on every earlier flag. If you put that loop into a GPU-shaped problem -- a million particles, ten million triangles -- thousands of lanes wait on one serial count. The GPU sits nearly idle while one logical thread accumulates.',
        {
          type: 'table',
          headers: ['Approach', 'Write conflicts', 'Stable order', 'Throughput at 1M items'],
          rows: [
            ['Serial CPU loop', 'None (single thread)', 'Yes', '~2 ms on a fast core'],
            ['Atomic counter per item', 'None (atomic CAS)', 'No -- race determines order', '~0.8 ms but order lost'],
            ['Parallel prefix scan', 'None (prefix gives unique slot)', 'Yes', '~0.15 ms on a modern GPU'],
          ],
        },
        'The tempting GPU workaround is a single atomic counter. Every kept item atomically increments the counter and uses the returned value as its slot. That avoids duplicate writes, but it concentrates contention on the hottest memory location in the pass. Worse, it destroys stable order because the increment order depends on warp scheduling. Results become non-reproducible, and debugging a renderer that produces different frame outputs on each run is a special kind of pain.',
        'Prefix scan pays for structured parallel work so each lane computes its rank without fighting over one counter. Instead of asking every item to update a shared variable, the algorithm builds a tree of partial counts and then distributes prefix totals back down. The work is predictable, testable, and composable with later GPU passes.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        {
          type: 'note',
          text: 'An exclusive prefix scan of 0/1 flags assigns each kept item a unique, stable rank equal to the count of kept items before it. No atomics, no contention, no order loss.',
        },
        'For flags [1, 0, 1, 1, 0, 1], the exclusive scan is [0, 1, 1, 2, 3, 3]. Items at indexes 0, 2, 3, and 5 write to output slots 0, 1, 2, and 3. No two kept items share a slot because the count increases exactly at kept positions. Dropped items have scan values too, but they do not write, so their values cause no collisions.',
        'The invariant: if flag[i] is 1, then scan[i] is the number of ones in flags[0..i-1]. That number is the stable rank among kept items. The last scan value plus the last flag gives the total compacted length. Every downstream operation -- scatter, indirect draw count, next-pass dispatch size -- derives from this single prefix array.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A practical GPU scan starts inside one workgroup. The shader loads a tile of values from a storage buffer into workgroup-shared memory. Workgroup memory is much faster than global memory and visible to all invocations in the same group. The tile size is typically 256 or 512 elements -- a power of two chosen to fit the device maxComputeWorkgroupSizeX limit.',
        {
          type: 'diagram',
          alt: 'Blelloch upsweep and downsweep tree on 8 elements',
          label: 'Blelloch scan: upsweep reduces, downsweep distributes prefixes',
          body: `Upsweep (reduce):            Downsweep (distribute):

Level 0:  1  0  1  1  0  1  0  1     0  1  1  2  3  3  4  4
             \\|     \\|     \\|     \\|        /|     /|     /|     /|
Level 1:     1     2     1     1        0     1     3     3
                \\  |        \\  |           /  |        /  |
Level 2:        3           2           0           1
                    \\       |              /       |
Level 3:            5 (total)           0 (identity)`,
          text: `Upsweep (reduce):            Downsweep (distribute):

Level 0:  1  0  1  1  0  1  0  1     0  1  1  2  3  3  4  4
             \\|     \\|     \\|     \\|        /|     /|     /|     /|
Level 1:     1     2     1     1        0     1     3     3
                \\  |        \\  |           /  |        /  |
Level 2:        3           2           0           1
                    \\       |              /       |
Level 3:            5 (total)           0 (identity)`,
        },
        'The Blelloch scan has two tree phases. In the upsweep, pairs of values combine into partial sums level by level until the root holds the total for the tile. For an exclusive scan, the root is then set to the identity (zero for addition). In the downsweep, prefix values propagate back down: each node passes its accumulated prefix to its left child and the sum of its prefix and left child to its right child. After log2(N) levels, every leaf holds the sum of all values before it.',
        {
          type: 'bullets',
          items: [
            'Upsweep: O(N) work across log2(N) levels. Each level halves the active threads. Total additions: N - 1.',
            'Downsweep: O(N) work across log2(N) levels. Each level doubles the active threads. Total additions: N - 1.',
            'Barriers: one workgroupBarrier() between every pair of adjacent levels. Missing a barrier means a thread reads a value another thread has not yet written.',
            'Shared memory: the entire tile lives in var<workgroup> storage. No global memory traffic during the tree phases.',
          ],
        },
        'Workgroup barriers are the correctness boundary. Every level of the tree must finish before the next level reads the values it produced. A missing barrier can produce prefixes that are only occasionally wrong, because the race depends on warp scheduling. Those bugs are hard to diagnose from final output because many incorrect scans still look mostly reasonable -- the numbers are close, just not exactly right.',
      ],
    },
    {
      heading: 'Large buffers need block offsets',
      paragraphs: [
        'One workgroup can only scan one tile. A million elements need thousands of workgroups, and workgroups cannot synchronize with each other inside a single dispatch. A large scan is therefore a multi-pass pipeline.',
        {
          type: 'diagram',
          alt: 'Three-pass scan pipeline for large buffers',
          label: 'Multi-pass pipeline: local scan, sum scan, global offset add',
          body: `Pass 1: Tile scan (each workgroup independently)
  [tile 0: local scan] [tile 1: local scan] [tile 2: local scan] ...
        |                    |                    |
     total_0              total_1              total_2       --> block sums buffer

Pass 2: Scan the block sums
  [total_0, total_1, total_2, ...] --> [0, total_0, total_0+total_1, ...]

Pass 3: Add block offset to each local prefix
  local_prefix[i] + block_offset[workgroup_id] = global_prefix[i]`,
          text: `Pass 1: Tile scan (each workgroup independently)
  [tile 0: local scan] [tile 1: local scan] [tile 2: local scan] ...
        |                    |                    |
     total_0              total_1              total_2       --> block sums buffer

Pass 2: Scan the block sums
  [total_0, total_1, total_2, ...] --> [0, total_0, total_0+total_1, ...]

Pass 3: Add block offset to each local prefix
  local_prefix[i] + block_offset[workgroup_id] = global_prefix[i]`,
        },
        'The first pass scans each tile independently and writes one total per tile into a block-sums buffer. The second pass scans the block sums -- if there are few enough blocks this fits in a single workgroup; otherwise it recurses. The result is one offset per block: the count of kept items in all previous blocks. The final pass adds each block offset to the local prefix values in that block. Every element now has a global rank.',
        {
          type: 'table',
          headers: ['Pass', 'Reads', 'Writes', 'Dispatches'],
          rows: [
            ['1: Tile scan', 'Input flags', 'Local prefixes + block sums', 'ceil(N / tileSize)'],
            ['2: Sum scan', 'Block sums', 'Block offsets', 'ceil(numBlocks / tileSize)'],
            ['3: Offset add', 'Local prefixes + block offsets', 'Global prefixes', 'ceil(N / tileSize)'],
            ['4: Scatter (optional)', 'Global prefixes + source data', 'Compacted output', 'ceil(N / tileSize)'],
          ],
        },
        'This multi-pass structure is why the storage buffers in a WebGPU implementation are explicit. A typical compaction pipeline has: input flags, source records, local prefixes, block sums, scanned block offsets, compacted output, and sometimes a one-element count buffer. Each pass binds only the subset it needs, and command encoder ordering supplies the pass-level sequencing.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Suppose a renderer has six particles and visibility flags [1, 0, 1, 1, 0, 1].',
        {
          type: 'table',
          headers: ['Index', 'Flag', 'Exclusive scan', 'Action'],
          rows: [
            ['0', '1', '0', 'Write source[0] to output[0]'],
            ['1', '0', '1', 'Skip -- particle invisible'],
            ['2', '1', '1', 'Write source[2] to output[1]'],
            ['3', '1', '2', 'Write source[3] to output[2]'],
            ['4', '0', '3', 'Skip -- particle invisible'],
            ['5', '1', '3', 'Write source[5] to output[3]'],
          ],
        },
        'The compacted output has four entries. The draw list is dense and stable -- particle 2 always appears before particle 3 in the output because scan preserves index order.',
        'If the array spans two workgroups with a tile size of four, the first tile contains flags [1, 0, 1, 1] with local scan [0, 1, 1, 2] and total 3. The second tile contains flags [0, 1, _, _] (padded with zeros) with local scan [0, 0, _, _] and total 1. The block-sum scan gives offsets [0, 3]. Every kept element in the second tile adds 3 to its local rank. Particle 5 gets global rank 0 + 3 = 3. That is the entire jump from local correctness to global correctness.',
        {
          type: 'note',
          text: 'The final count (scan[N-1] + flag[N-1]) is needed by later code. A renderer uses it for an indirect draw call. A debugging UI copies it back to JavaScript. A physics pipeline keeps it on the GPU and feeds it to the next dispatch. The best design avoids readback unless the CPU truly needs the value.',
        },
      ],
    },
    {
      heading: 'WebGPU implementation shape',
      paragraphs: [
        'In WebGPU, compute work is recorded into command buffers. A compute pass binds a pipeline and bind groups, then dispatches workgroups. WGSL shaders read and write storage buffers. JavaScript prepares buffer sizes, usage flags, bind group layouts, pipeline objects, and dispatch dimensions.',
        {
          type: 'code',
          language: 'wgsl',
          body: `// WGSL: workgroup-local exclusive scan (Blelloch, tile size 256)
@group(0) @binding(0) var<storage, read>       flags : array<u32>;
@group(0) @binding(1) var<storage, read_write> prefixes : array<u32>;
@group(0) @binding(2) var<storage, read_write> blockSums : array<u32>;

var<workgroup> tile : array<u32, 256>;

@compute @workgroup_size(128)
fn tileScan(@builtin(local_invocation_id) lid : vec3u,
            @builtin(workgroup_id) wid : vec3u) {
  let base = wid.x * 256u;
  // Each thread loads two elements
  tile[2u * lid.x]      = flags[base + 2u * lid.x];
  tile[2u * lid.x + 1u] = flags[base + 2u * lid.x + 1u];
  // Upsweep
  for (var s = 1u; s < 256u; s *= 2u) {
    workgroupBarrier();
    let idx = (2u * lid.x + 1u) * s * 2u - 1u;
    if (idx < 256u) { tile[idx] += tile[idx - s]; }
  }
  // Clear root, downsweep
  if (lid.x == 0u) { blockSums[wid.x] = tile[255]; tile[255] = 0u; }
  for (var s = 128u; s > 0u; s /= 2u) {
    workgroupBarrier();
    let idx = (2u * lid.x + 1u) * s * 2u - 1u;
    if (idx < 256u) {
      let tmp = tile[idx - s];
      tile[idx - s] = tile[idx];
      tile[idx] += tmp;
    }
  }
  workgroupBarrier();
  prefixes[base + 2u * lid.x]      = tile[2u * lid.x];
  prefixes[base + 2u * lid.x + 1u] = tile[2u * lid.x + 1u];
}`,
        },
        'WGSL struct layout has to match the JavaScript side. If the shader expects u32 flags and JavaScript fills a packed byte array, the algorithm reads nonsense even though the scan logic is correct. Buffer usage flags must allow intended roles: STORAGE for compute access, COPY_SRC or COPY_DST for copies, MAP_READ only on staging buffers that the CPU maps.',
        {
          type: 'code',
          language: 'javascript',
          body: `// JavaScript: dispatch the three-pass pipeline
const encoder = device.createCommandEncoder();

// Pass 1: tile-local scan + block sums
const pass1 = encoder.beginComputePass();
pass1.setPipeline(tileScanPipeline);
pass1.setBindGroup(0, tileScanBindGroup);
pass1.dispatchWorkgroups(Math.ceil(N / 256));
pass1.end();

// Pass 2: scan block sums (fits in one workgroup if blocks <= 256)
const pass2 = encoder.beginComputePass();
pass2.setPipeline(sumScanPipeline);
pass2.setBindGroup(0, sumScanBindGroup);
pass2.dispatchWorkgroups(1);
pass2.end();

// Pass 3: add block offsets to local prefixes, scatter
const pass3 = encoder.beginComputePass();
pass3.setPipeline(scatterPipeline);
pass3.setBindGroup(0, scatterBindGroup);
pass3.dispatchWorkgroups(Math.ceil(N / 256));
pass3.end();

// Optional: copy count to staging for CPU readback
encoder.copyBufferToBuffer(countBuffer, 0, stagingBuffer, 0, 4);
device.queue.submit([encoder.finish()]);`,
        },
        'Readback is a boundary, not part of scan. A storage buffer used by compute is copied into a staging buffer before mapAsync. That mapping is asynchronous and stalls frame pacing if done every frame. Production pipelines keep intermediate offsets, compacted records, and counts on the GPU, reading back only for debugging, rare metrics, or explicit data export.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The proof rests on associativity and index order.',
        {
          type: 'bullets',
          items: [
            'Associativity: addition is associative, so a binary tree can combine partial sums in any order and produce the same result as a serial left-to-right pass. The upsweep computes correct subtotals regardless of which pairs combine first at each level.',
            'Downsweep correctness: each node receives the sum of all values to its left in the original array. For the root, that sum is 0 (exclusive scan). Each node passes its prefix to its left child and prefix + left to its right child. By induction, every leaf receives the exact prefix sum.',
            'Stable compaction: if i < j and both are kept, then scan[i] < scan[j] because at least flag[i] = 1 contributes to the count before j. Kept items write to distinct, increasing slots. Dropped items do not write.',
            'Multi-block correctness: local scan gives rank within a tile. Block-offset scan gives the count of kept items in all earlier tiles. Their sum is the global exclusive prefix sum. The invariant holds at two scales by the same argument.',
          ],
        },
        'The conservation law is that the total count (root of the upsweep) equals the sum of all flags. Every flag contributes exactly once during the upsweep. The downsweep redistributes that total as prefix values without creating or losing any count. The number of compacted outputs always equals the number of ones in the input.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        {
          type: 'table',
          headers: ['Metric', 'Value', 'Note'],
          rows: [
            ['Work (additions)', '~4N', 'Two tree traversals, each ~2N; slightly more with multi-block'],
            ['Depth (parallel steps)', 'O(log N)', 'Two phases of log2(tileSize) levels per pass, three passes total'],
            ['Storage buffers', '5-7', 'Flags, prefixes, block sums, block offsets, output, staging, count'],
            ['Dispatches', '3-4', 'Tile scan, sum scan, offset add, optional scatter'],
            ['Barriers per workgroup', '2 * log2(tileSize)', 'One per upsweep level, one per downsweep level'],
          ],
        },
        'Scan has overhead. It launches compute passes, uses barriers, writes intermediate buffers, and performs more total arithmetic than a serial CPU loop. For tiny arrays (under ~10,000 elements), dispatch and pipeline setup dominate. A JavaScript typed-array loop may be faster if the data already lives on the CPU and the result is immediately needed there.',
        'Scan wins when data is large enough to fill GPU lanes and when the compacted result feeds later GPU work. Particle culling, tile binning, visibility lists, GPU sorting, and graph frontiers benefit because the output stays in GPU memory. The scan cost is amortized by removing holes or preparing offsets for a larger parallel stage that would otherwise process dead items.',
        {
          type: 'note',
          text: 'Benchmark the whole path you intend to ship. A chart that times only the compute dispatch but ignores buffer creation, command submission, and readback is incomplete. A benchmark that reads back every frame unfairly punishes a design that would keep data on the GPU. Separate algorithm time, submission overhead, memory transfer, and downstream savings.',
        },
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        {
          type: 'table',
          headers: ['Domain', 'Input', 'Scan produces', 'Downstream consumer'],
          rows: [
            ['Particle rendering', 'Visibility flags', 'Dense draw-list positions', 'Indirect draw call'],
            ['Radix sort', 'Per-digit bucket flags', 'Scatter offsets per digit', 'Next radix pass'],
            ['Graph BFS', 'Frontier membership flags', 'Dense next-frontier array', 'Edge expansion kernel'],
            ['Sparse matrix (CSR)', 'Row nonzero counts', 'Row pointer array', 'SpMV kernel'],
            ['Mesh LOD selection', 'Triangle keep flags', 'Compacted index buffer', 'Rasterizer'],
            ['Collision broadphase', 'AABB overlap flags', 'Dense pair list', 'Narrowphase solver'],
          ],
        },
        'Prefix scan is a foundational GPU primitive because it connects local predicates to global structure. In rendering, it builds visible instance lists, tile queues, light lists, and particle buffers. In data processing, it packs filtered rows, partitions records, computes offsets for variable-length outputs, and prepares radix-sort buckets. In graph processing, it builds dense frontier arrays from sparse edge decisions.',
        'The browser context makes it especially useful. WebGPU applications often want rich client-side computation without server round trips. Scan lets an application keep large interactive buffers resident on the GPU, update them with compute passes, and draw or process only dense active subsets. That is the difference between using the GPU as a display target and using it as a parallel data engine.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        {
          type: 'table',
          headers: ['Failure mode', 'Symptom', 'Fix'],
          rows: [
            ['Tail handling', 'Out-of-bounds read/write when N % tileSize != 0', 'Guard loads and stores with index < N; pad tile with identity (0)'],
            ['Missing barrier', 'Intermittent wrong prefixes, hardware-dependent', 'One workgroupBarrier() between every adjacent tree level'],
            ['Layout mismatch', 'Correct algorithm, garbage output', 'Ensure WGSL struct alignment matches JavaScript ArrayBuffer layout'],
            ['Wrong dispatch count', 'Last block missing', 'Use ceil(N / tileSize), not floor'],
            ['Readback every frame', 'GPU stalls, frame drops', 'Keep data on GPU; readback only when CPU needs the value'],
            ['Block-sum overflow', 'Works for small N, breaks for large N', 'Recurse the sum scan if numBlocks > tileSize'],
          ],
        },
        'Tail handling is the most common correctness trap. Real inputs are not exact multiples of tile size. Out-of-range lanes should contribute the identity element (zero for sum) and avoid invalid reads and writes. Test sizes: 0, 1, tileSize - 1, tileSize, tileSize + 1, and several non-power-of-two lengths.',
        'Barrier placement is the second trap. A workgroupBarrier() belongs between tree levels that communicate through shared memory. Too few barriers create races. Unnecessary barriers can slow the shader or hide a design doing more shared-memory traffic than needed. The goal is not many barriers; it is barriers exactly where previous-level writes must be visible to the next level.',
        'Other failures are systems failures: JavaScript and WGSL disagree on struct layout (WGSL requires 16-byte alignment for vec4), storage buffers are undersized, usage flags do not permit a copy operation, bind groups point at stale buffers after a resize, and validation covers only all-zero or all-one inputs. Scan should be tested against randomized CPU references, not only hand-picked examples.',
      ],
    },
    {
      heading: 'Implementation checklist',
      paragraphs: [
        {
          type: 'bullets',
          items: [
            'Start with an exclusive scan over u32 flags and a CPU reference. Verify the prefix array and compacted output match for random inputs.',
            'Add block sums and block offsets. Only after correctness is stable should you specialize tile size, unroll tree levels, or fuse passes.',
            'Choose tile sizes from device.limits.maxComputeWorkgroupSizeX and measured occupancy, not from a textbook diagram.',
            'Keep buffer allocation outside hot loops. Reuse pipeline and bind group layout objects.',
            'Dispatch with Math.ceil(N / tileSize). A floor() here silently drops the last partial tile.',
            'Keep a separate count path so downstream passes know the compacted length without readback.',
            'Make readback optional and observable in profiling. If mapAsync appears in your per-frame path, justify why.',
            'Do not confuse Fenwick trees with GPU prefix scan. Fenwick is excellent for online point updates and prefix queries on the CPU. GPU scan is a batch primitive: transform a whole buffer into offsets, then feed another buffer-oriented pass. Same vocabulary, different operational problems.',
          ],
        },
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        {
          type: 'bullets',
          items: [
            'Blelloch, "Prefix Sums and Their Applications" (1990) -- the original parallel scan framework; defines upsweep/downsweep and proves work-efficiency.',
            'GPU Gems 3, Chapter 39: "Parallel Prefix Sum (Scan) with CUDA" (Harris, Sengupta, Owens) -- the canonical GPU implementation reference. https://developer.nvidia.com/gpugems/gpugems3/part-vi-gpu-computing/chapter-39-parallel-prefix-sum-scan-cuda',
            'W3C WGSL specification -- storage buffer bindings, workgroup memory, barrier semantics. https://www.w3.org/TR/WGSL/',
            'MDN GPUComputePassEncoder.dispatchWorkgroups -- WebGPU dispatch API. https://developer.mozilla.org/en-US/docs/Web/API/GPUComputePassEncoder/dispatchWorkgroups',
            'WebGPU Fundamentals: compute shaders -- practical introduction with working examples. https://webgpufundamentals.org/webgpu/lessons/webgpu-compute-shaders.html',
          ],
        },
        {
          type: 'table',
          headers: ['Role', 'Topic', 'Why'],
          rows: [
            ['Prerequisite', 'Fenwick Tree', 'Contrasting online prefix-sum structure for CPU point-update/query workloads'],
            ['API mechanics', 'WebGPU Buffer and Bind Group Case Study', 'Buffer usage flags, bind group layouts, and command encoder ordering'],
            ['Extension', 'Radix Sort', 'Multi-pass GPU sort that uses scan as its core offset-computation step'],
            ['Sparse data', 'Compressed Sparse Row Graph', 'Row-pointer arrays built by prefix scan over row nonzero counts'],
            ['Collective op', 'GPU All-Reduce', 'Another fundamental GPU collective; contrasts scan (prefix) with reduce (single value)'],
            ['Buffer reasoning', 'Render Graph Framegraph Resource Lifetimes', 'Reasoning about GPU buffer lifetimes and aliasing across passes'],
          ],
        },
      ],
    },
  ],
};
