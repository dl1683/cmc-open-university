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
      heading: 'What it is',
      paragraphs: [
        'A parallel prefix scan computes all running totals of an array. For flags, an exclusive scan answers a more concrete systems question: how many kept items appear before this item? That number is a unique output slot, which makes scan the foundation of stream compaction, radix sort, sparse row-pointer construction, and graph frontier building.',
        'On WebGPU, scan is a compute pipeline over storage buffers. JavaScript creates buffers and command passes; WGSL shaders run invocations grouped into workgroups; workgroup memory and barriers coordinate tile-local scan; later passes combine block totals.',
      ],
    },
    {
      heading: 'Workgroup scan',
      paragraphs: [
        'The classic work-efficient GPU scan is the Blelloch upsweep/downsweep pattern. GPU Gems 3 describes the goal as a work-efficient scan that avoids the extra log factor of a naive algorithm and bases the implementation on Blelloch scan: https://developer.nvidia.com/gpugems/gpugems3/part-vi-gpu-computing/chapter-39-parallel-prefix-sum-scan-cuda.',
        'A single workgroup scans one tile. It loads values into workgroup memory, upsweeps to build partial sums, sets the root for exclusive scan, downsweeps to distribute prefixes, and writes local positions. Workgroup barriers are what make the tree levels visible to every invocation before the next level reads them. WGSL is the language reference for WebGPU shaders: https://www.w3.org/TR/WGSL/.',
      ],
    },
    {
      heading: 'Large buffers',
      paragraphs: [
        'A large input buffer needs multiple passes. Pass 1 scans each tile and writes a block sum. Pass 2 scans the block sums. Pass 3 adds the scanned block offset to each local position and scatters kept records. This is a tiny render-graph-like dataflow pipeline, but for compute buffers rather than textures.',
        'MDN documents dispatchWorkgroups as dispatching a grid of workgroups for the current compute pipeline: https://developer.mozilla.org/en-US/docs/Web/API/GPUComputePassEncoder/dispatchWorkgroups. WebGPU Fundamentals gives a practical compute-shader introduction with storage buffers and workgroups: https://webgpufundamentals.org/webgpu/lessons/webgpu-compute-shaders.html.',
      ],
    },
    {
      heading: 'Complete case study: GPU particle compaction',
      paragraphs: [
        'A browser particle system simulates one million particles. A compute shader marks particles visible to the camera. Prefix scan converts those 0/1 flags into dense positions. A scatter pass writes only visible particles into a draw-list buffer. A later render pass draws the dense list instead of carrying dead slots through the frame.',
        'The CPU should not read the full compacted list every frame. It may read a small count for debugging or indirect draw setup, but the winning path keeps the compacted output on the GPU. The moment every frame copies megabytes back to JavaScript, the queue timeline advantage collapses into readback latency.',
      ],
    },
    {
      heading: 'Pitfalls',
      paragraphs: [
        'The common mistakes are missing tail guards when N is not a multiple of tile size, missing barriers between tree levels, mismatched WGSL and JavaScript buffer layout, dispatching many tiny scans where CPU overhead dominates, and validating only power-of-two toy sizes.',
        'Do not confuse Fenwick Tree with parallel scan. Fenwick is excellent for interleaved point updates and prefix queries on the CPU. GPU scan is usually a batch primitive: transform a whole buffer into offsets, then feed another GPU pass.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Study WebGPU Buffer & Bind Group Case Study, Fenwick Tree, Compressed Sparse Row Graph, PageRank, WebGPU Swapchain Frame Pacing, Render Graph Framegraph Resource Lifetimes, GPU All-Reduce, and Radix Sort next.',
      ],
    },
  ],
};
