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
        "Read the animation as the execution trace for WebGPU Parallel Prefix Scan & Compaction. Run workgroup-local prefix scans over storage buffers, combine block sums, scatter compacted output, and keep GPU readback bounded..",
        "Active items are the current decision point. Visited markers are state that is already ruled out by proof, not by taste.",
        "Found markers are outcomes now guaranteed true. If this is not visible, the animation can mislead.",
        "At each frame, ask what changed, why that move is legal, and where the idea is strong or fragile.",
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        `Many parallel programs begin with independent per-item decisions and then need a dense result. A particle is visible or invisible. A graph edge enters the next frontier or does not. A row contributes some number of nonzero values. A token, triangle, byte range, or document either survives a filter or gets dropped. The first phase is embarrassingly parallel. The second phase is harder because every surviving item needs a unique output position.`,
        `A prefix scan computes running totals across an array. For ordinary numbers, it returns cumulative sums. For 0/1 flags, an exclusive scan answers a placement question: how many kept items came before this one? If the current item is kept, that answer is exactly the dense output slot where it should write. This turns unordered independent decisions into ordered, collision-free scatter positions.`,
        `WebGPU makes this pattern available in the browser and in portable GPU applications. The work is expressed as compute passes over storage buffers. The payoff is not only speed; it is a clean way to keep filtering, culling, binning, sorting, and sparse data preparation on the GPU without pulling intermediate arrays back to JavaScript after every phase.`,
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        `The simple CPU solution is a loop with a counter. Read each flag, write kept records to output[count], and increment count. That is easy to reason about and perfectly fine for small arrays, but it is a dependency chain. Each output position depends on all earlier flags. If you put that exact loop into a GPU-shaped problem, thousands of lanes wait on one serial count.`,
        `The tempting GPU workaround is a single atomic counter. Every kept item atomically increments the counter and uses the returned value as its slot. That avoids duplicate writes, but it concentrates contention on the hottest memory location in the pass. It can also destroy stable order, make results harder to reproduce, and hide a performance cliff behind a deceptively short shader.`,
        `Prefix scan pays for structured parallel work so each lane can compute its rank without fighting over one counter. Instead of asking every item to update a shared variable, it builds a tree of partial counts and then distributes the prefix totals back down. The work is predictable, testable, and composable with later GPU passes.`,
      ],
    },
    {
      heading: 'Scan as rank assignment',
      paragraphs: [
        `For compaction, the input is usually a flag array. A 1 means keep this element and a 0 means drop it. An exclusive prefix scan of those flags gives the number of ones before each index. With flags [1, 0, 1, 1, 0, 1], the exclusive scan is [0, 1, 1, 2, 3, 3]. Items at indexes 0, 2, 3, and 5 write to output slots 0, 1, 2, and 3.`,
        `The invariant is simple: if flag[i] is 1, then scan[i] is the stable rank of item i among kept items. No two kept items have the same rank because the count increases exactly at kept positions. Dropped items may have scan values too, but they do not write. The last flag plus the last scan value gives the compacted length.`,
        `This rank-assignment view explains why scan appears in so many GPU algorithms. Radix sort uses scans to place keys by digit buckets. Graph traversal uses scans to build the next frontier. Sparse matrix code uses scans to turn row counts into row pointers. Histograms, binning pipelines, broad-phase collision systems, and draw-list builders all need the same conversion from local counts to global offsets.`,
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        `A practical GPU scan starts inside one workgroup. The shader loads a tile of values from a storage buffer into workgroup memory. Workgroup memory is much faster than global memory and can be shared by invocations in the same group. The tile size is usually a fixed power of two or a carefully guarded non-power-of-two size chosen to fit device limits.`,
        `The classic Blelloch scan has two tree phases. In the upsweep phase, pairs of values are combined into larger partial sums until the root contains the total for the tile. For an exclusive scan, the root is then set to zero. In the downsweep phase, prefix values are propagated back down the tree so every leaf receives the sum of values that came before it.`,
        `Workgroup barriers are the correctness boundary. Every level of the tree must finish before the next level reads the shared memory values it produced. A missing barrier can produce prefixes that are only occasionally wrong, because the race depends on scheduling. Those bugs are hard to diagnose from final output alone because many incorrect scans still look sorted and mostly reasonable.`,
      ],
    },
    {
      heading: 'Large buffers need block offsets',
      paragraphs: [
        `One workgroup can only scan one tile. A million elements need many workgroups, and workgroups do not implicitly synchronize with each other inside a single dispatch. That means a large scan is a pipeline, not just a local tree. The first pass scans each tile independently and writes one total per tile. Those totals are called block sums.`,
        `The second pass scans the block sums. If there are many blocks, this may recursively use the same scan machinery on a smaller buffer. The result is one offset per block: how many kept items appeared in all previous blocks. The final pass adds the block offset to each local prefix value. Now every element has a global rank, not just a rank inside its workgroup tile.`,
        `This is why the storage buffers in a WebGPU implementation are explicit. A typical compaction pipeline has input flags, optional source records, local positions or per-element prefixes, block sums, scanned block offsets, a compacted output buffer, and sometimes a one-element count buffer. Each pass binds the subset it needs and command order supplies the pass-level sequencing.`,
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        `Suppose a renderer has six particles and visibility flags [1, 0, 1, 1, 0, 1]. The exclusive scan is [0, 1, 1, 2, 3, 3]. Particle 0 writes to compacted[0]. Particle 1 is invisible and writes nowhere. Particle 2 writes to compacted[1]. Particle 3 writes to compacted[2]. Particle 4 writes nowhere. Particle 5 writes to compacted[3]. The draw list is dense and stable.`,
        `If the array spans several workgroups, each group first produces local positions. Imagine the first tile has two visible particles and the second tile has five. The block-sum scan gives the second tile an offset of two. Every kept element in the second tile adds two to its local rank. This is the entire jump from local correctness to global correctness.`,
        `The final count is needed by later code. A renderer might use it for an indirect draw call. A debugging UI might copy it back to JavaScript. A physics pipeline might keep it on the GPU and feed it to another dispatch. The best design avoids readback unless the CPU truly needs the value.`,
      ],
    },
    {
      heading: 'WebGPU implementation shape',
      paragraphs: [
        `In WebGPU, compute work is recorded into command buffers. A compute pass binds a pipeline and bind groups, then dispatches workgroups with dispatchWorkgroups. WGSL shaders read and write storage buffers. JavaScript prepares buffer sizes, usage flags, bind group layouts, pipeline objects, and dispatch dimensions. The API is explicit enough that many scan bugs are layout or binding bugs rather than algorithm bugs.`,
        `WGSL struct layout has to match the JavaScript side. If a shader expects u32 flags and the JavaScript code fills a packed byte array, the algorithm can be perfect and still read nonsense. Buffer usage flags must allow the intended roles: STORAGE for compute access, COPY_SRC or COPY_DST for copies, and MAP_READ only on staging buffers that the CPU maps.`,
        `Readback is a boundary, not part of scan. A storage buffer used by compute is usually copied into a staging buffer before mapAsync. That mapping is asynchronous and can stall frame pacing if done frequently. The strongest scan pipelines keep intermediate offsets, compacted records, and counts on the GPU and only read back for debugging, rare metrics, or explicit user-visible data export.`,
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        `The proof comes from associativity and order. Addition is associative, so a tree can combine partial sums in parallel and still produce the same totals as a serial left-to-right pass. The downsweep distributes exactly the sum of all values to the left of each position. For 0/1 flags, that sum is the number of kept items before the current item.`,
        `Stable compaction follows directly. If i and j are kept and i is less than j, then scan[i] is less than scan[j] because at least the kept item i contributes to the count before j. Therefore kept items write to distinct increasing slots. Dropped items do not write, so their ranks cannot cause collisions.`,
        `The multi-block version keeps the same invariant at two scales. The local scan gives the rank within a tile. The block-offset scan gives the number of kept items in all earlier tiles. Adding them gives the number of kept items before the element in the whole input. That is exactly the global exclusive prefix sum.`,
      ],
    },
    {
      heading: 'Cost and behavior',
      paragraphs: [
        `Scan has overhead. It launches compute passes, uses barriers, writes intermediate buffers, and may perform more total arithmetic than a serial CPU loop. For tiny arrays, that overhead can dominate. A JavaScript loop or a small CPU-side typed-array pass may be faster if the data already lives on the CPU and the result is immediately needed on the CPU.`,
        `Scan wins when data is large enough, when many lanes can be occupied, and when the compacted result feeds later GPU work. Particle culling, tile binning, visibility lists, GPU sorting, and graph frontiers benefit because the output stays in GPU memory. The cost of scan is then amortized by removing holes or preparing offsets for a larger parallel stage.`,
        `Benchmark the whole path you intend to ship. A chart that times only the compute dispatch but ignores buffer creation, command submission, and readback is incomplete. Conversely, a benchmark that reads back every frame may unfairly punish a production design that would keep the data on the GPU. Separate algorithm time, submission overhead, memory transfer, and downstream savings.`,
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        `Tail handling is the most common correctness trap. Real inputs are not always exact multiples of the tile size. Out-of-range lanes should contribute zero and avoid invalid reads and writes. Test sizes zero, one, tile size minus one, tile size, tile size plus one, and several awkward non-power-of-two lengths.`,
        `Barrier placement is another trap. A workgroupBarrier belongs between tree levels that communicate through workgroup memory. Adding too few barriers creates races. Adding unnecessary barriers can slow the shader or hide a design that is doing more shared-memory traffic than needed. The goal is not many barriers; it is barriers exactly where previous-level writes must be visible.`,
        `Other failures are systems failures: JavaScript and WGSL disagree on layout, storage buffers are too small, usage flags do not allow a copy, bind groups point at stale buffers, dispatch counts round down instead of up, block-sum recursion fails for large block counts, and validation covers only all-zero or all-one inputs. Scan should be tested against randomized CPU references, not only against one hand-picked diagram.`,
      ],
    },
    {
      heading: 'Implementation checklist',
      paragraphs: [
        `Start with an exclusive scan over u32 flags and a CPU reference. Verify the prefix array and the compacted contents. Then add block sums and block offsets. Only after correctness is stable should you specialize tile size, unroll tree levels, fuse passes, or switch to more compact flag representations.`,
        `Choose tile sizes from device limits and measured occupancy, not from a diagram. Keep buffer allocation outside hot loops where possible. Reuse pipelines and bind group layouts. Record dispatch counts with ceil(N / tileSize). Keep a separate count path so downstream passes know the compacted length. Make readback optional and observable in profiling.`,
        `Do not confuse a Fenwick tree with a GPU prefix scan. Fenwick is excellent for online point updates and prefix queries, especially on the CPU. WebGPU scan is usually a batch primitive: transform a whole buffer into offsets, then feed another buffer-oriented pass. They share prefix-sum vocabulary but solve different operational problems.`,
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        `Prefix scan is a foundational GPU primitive because it connects local predicates to global structure. In rendering, it builds visible instance lists, tile queues, light lists, and particle buffers. In data processing, it packs filtered rows, partitions records, computes offsets for variable-length outputs, and prepares radix-sort buckets. In graph processing, it builds dense frontier arrays from sparse edge decisions.`,
        `The browser context makes it especially useful. WebGPU applications often want rich client-side computation without server round trips. Scan lets an application keep large interactive buffers resident on the GPU, update them with compute passes, and draw or process only dense active subsets. That is the difference between using the GPU as a display target and using it as a parallel data engine.`,
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        `Primary and practical sources: GPU Gems 3 Parallel Prefix Sum at https://developer.nvidia.com/gpugems/gpugems3/part-vi-gpu-computing/chapter-39-parallel-prefix-sum-scan-cuda, WGSL at https://www.w3.org/TR/WGSL/, MDN dispatchWorkgroups at https://developer.mozilla.org/en-US/docs/Web/API/GPUComputePassEncoder/dispatchWorkgroups, and WebGPU Fundamentals compute shaders at https://webgpufundamentals.org/webgpu/lessons/webgpu-compute-shaders.html.`,
        `Within this curriculum, study WebGPU Buffer and Bind Group Case Study for API mechanics, Radix Sort for another scan-heavy GPU algorithm, Compressed Sparse Row Graph for offset arrays, PageRank for graph workloads, Fenwick Tree for the contrasting online prefix-sum structure, GPU All-Reduce for another collective operation, and Render Graph Framegraph Resource Lifetimes for reasoning about GPU buffers across passes.`,
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
      heading: 'The core insight',
      paragraphs: [
        "The core insight is the smallest idea that changes what can be proven.",
        "Phrase it as an invariant, boundary, or contract that stays true across all transitions.",
        "Everything else in the topic should serve this one sentence.",
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

      {
        heading: 'Learning map',
        paragraphs: [
          'Before this topic, unlock all prerequisites and define the required preconditions.',
          'After this topic, trace where this idea appears in one larger path on this site.',
          'Use unlock relationships to keep one path and one checkpoint per review cycle.',
        ],
      },

      {
        heading: 'Micro checks',
        paragraphs: [
          {
            type: 'bullets',
            items: [
              'Can you state one invariant in one sentence?',
              'Can you prove one transition with pre and post state?',
              'Can you name one hidden edge case in one line?',
              'Can you transfer this mechanism to a neighboring domain?',
            ],
          },
        ],
      },

      {
        heading: 'Try this now',
        paragraphs: [
          'Build one input manually and predict every step before running the animation.',
          'If your predicted final state matches the animation for webgpu-parallel-prefix-scan-compaction-case-study, continue to the next topic in the same track.'
  ],
      },
],
};
