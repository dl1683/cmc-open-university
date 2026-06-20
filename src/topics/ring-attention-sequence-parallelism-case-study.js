// RingAttention and sequence parallelism: shard the sequence dimension,
// rotate KV blocks across devices, and overlap communication with attention.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'ring-attention-sequence-parallelism-case-study',
  title: 'RingAttention Sequence Parallelism Case Study',
  category: 'Systems',
  summary: 'RingAttention shards long sequences across devices, computes attention block by block, and circulates KV blocks in a ring while overlapping communication with compute.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['ring pass', 'causal balance', 'hybrid mesh'], defaultValue: 'ring pass' },
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

function ringGraph(title) {
  return graphState({
    nodes: [
      { id: 'g0', label: 'GPU 0', x: 2.0, y: 1.5, note: 'Q0 KV0' },
      { id: 'g1', label: 'GPU 1', x: 7.8, y: 1.5, note: 'Q1 KV1' },
      { id: 'g2', label: 'GPU 2', x: 7.8, y: 5.8, note: 'Q2 KV2' },
      { id: 'g3', label: 'GPU 3', x: 2.0, y: 5.8, note: 'Q3 KV3' },
      { id: 'acc0', label: 'accum 0', x: 3.4, y: 3.1, note: 'softmax stats' },
      { id: 'acc1', label: 'accum 1', x: 6.4, y: 3.1, note: 'partial out' },
      { id: 'acc2', label: 'accum 2', x: 6.4, y: 4.5, note: 'partial out' },
      { id: 'acc3', label: 'accum 3', x: 3.4, y: 4.5, note: 'partial out' },
    ],
    edges: [
      { id: 'e-g0-g1', from: 'g0', to: 'g1', weight: 'send KV0' },
      { id: 'e-g1-g2', from: 'g1', to: 'g2', weight: 'send KV1' },
      { id: 'e-g2-g3', from: 'g2', to: 'g3', weight: 'send KV2' },
      { id: 'e-g3-g0', from: 'g3', to: 'g0', weight: 'send KV3' },
      { id: 'e-g0-acc0', from: 'g0', to: 'acc0' },
      { id: 'e-g1-acc1', from: 'g1', to: 'acc1' },
      { id: 'e-g2-acc2', from: 'g2', to: 'acc2' },
      { id: 'e-g3-acc3', from: 'g3', to: 'acc3' },
    ],
  }, { title });
}

function meshGraph(title) {
  return graphState({
    nodes: [
      { id: 'r0c0', label: '0,0', x: 1.0, y: 2.2, note: 'ring col' },
      { id: 'r0c1', label: '0,1', x: 3.5, y: 2.2, note: 'ulysses row' },
      { id: 'r0c2', label: '0,2', x: 6.0, y: 2.2, note: 'ulysses row' },
      { id: 'r0c3', label: '0,3', x: 8.5, y: 2.2, note: 'ring col' },
      { id: 'r1c0', label: '1,0', x: 1.0, y: 5.2, note: 'ring col' },
      { id: 'r1c1', label: '1,1', x: 3.5, y: 5.2, note: 'ulysses row' },
      { id: 'r1c2', label: '1,2', x: 6.0, y: 5.2, note: 'ulysses row' },
      { id: 'r1c3', label: '1,3', x: 8.5, y: 5.2, note: 'ring col' },
    ],
    edges: [
      { id: 'e-r0c0-r0c1', from: 'r0c0', to: 'r0c1', weight: 'all2all' },
      { id: 'e-r0c1-r0c2', from: 'r0c1', to: 'r0c2', weight: 'all2all' },
      { id: 'e-r0c2-r0c3', from: 'r0c2', to: 'r0c3', weight: 'all2all' },
      { id: 'e-r1c0-r1c1', from: 'r1c0', to: 'r1c1', weight: 'all2all' },
      { id: 'e-r1c1-r1c2', from: 'r1c1', to: 'r1c2', weight: 'all2all' },
      { id: 'e-r1c2-r1c3', from: 'r1c2', to: 'r1c3', weight: 'all2all' },
      { id: 'e-r0c0-r1c0', from: 'r0c0', to: 'r1c0', weight: 'ring' },
      { id: 'e-r0c1-r1c1', from: 'r0c1', to: 'r1c1', weight: 'ring' },
      { id: 'e-r0c2-r1c2', from: 'r0c2', to: 'r1c2', weight: 'ring' },
      { id: 'e-r0c3-r1c3', from: 'r0c3', to: 'r1c3', weight: 'ring' },
    ],
  }, { title });
}

function* ringPass() {
  yield {
    state: ringGraph('Each device owns one query and KV sequence shard'),
    highlight: { active: ['g0', 'g1', 'g2', 'g3'], found: ['acc0', 'acc1', 'acc2', 'acc3'] },
    explanation: 'RingAttention starts by sharding the sequence dimension. GPU i keeps query block Qi and key-value block KVi. Each device accumulates attention output for its own query block.',
    invariant: 'The model still computes exact attention; the storage and schedule change.',
  };

  yield {
    state: ringGraph('KV blocks rotate while local attention computes'),
    highlight: { active: ['e-g0-g1', 'e-g1-g2', 'e-g2-g3', 'e-g3-g0'], found: ['acc0', 'acc1', 'acc2', 'acc3'] },
    explanation: 'KV blocks circulate around the ring. While the next block is in flight, each device computes blockwise attention between its local Q block and the KV block it currently holds.',
  };

  yield {
    state: labelMatrix(
      'Blockwise accumulation',
      [
        { id: 'g0', label: 'GPU0' },
        { id: 'g1', label: 'GPU1' },
        { id: 'g2', label: 'GPU2' },
        { id: 'g3', label: 'GPU3' },
      ],
      [
        { id: 'local', label: 'local' },
        { id: 'step1', label: 'step 1' },
        { id: 'step2', label: 'step 2' },
        { id: 'step3', label: 'step 3' },
      ],
      [
        ['Q0-KV0', 'Q0-KV3', 'Q0-KV2', 'Q0-KV1'],
        ['Q1-KV1', 'Q1-KV0', 'Q1-KV3', 'Q1-KV2'],
        ['Q2-KV2', 'Q2-KV1', 'Q2-KV0', 'Q2-KV3'],
        ['Q3-KV3', 'Q3-KV2', 'Q3-KV1', 'Q3-KV0'],
      ],
    ),
    highlight: { active: ['g0:local', 'g0:step1', 'g0:step2', 'g0:step3'], found: ['g3:step3'] },
    explanation: 'After enough rotations, every query shard has attended to every KV shard. Online softmax statistics let the device merge partial results without materializing the full attention matrix.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'devices', min: 1, max: 16 }, y: { label: 'relative max context', min: 0, max: 16 } },
      series: [
        { id: 'single', label: 'single-device limit', points: [
          { x: 1, y: 1 }, { x: 4, y: 1 }, { x: 8, y: 1 }, { x: 16, y: 1 },
        ] },
        { id: 'ring', label: 'sequence sharded', points: [
          { x: 1, y: 1 }, { x: 4, y: 4 }, { x: 8, y: 8 }, { x: 16, y: 16 },
        ] },
      ],
      markers: [
        { id: 'linear', x: 8, y: 8, label: 'linear with devices' },
      ],
    }),
    highlight: { active: ['ring', 'linear'], compare: ['single'] },
    explanation: 'The RingAttention paper frames the benefit as context length scaling with device count, because no single device has to hold the whole sequence activation set.',
  };
}

function* causalBalance() {
  yield {
    state: labelMatrix(
      'Naive causal workload',
      [
        { id: 'q0', label: 'Q0' },
        { id: 'q1', label: 'Q1' },
        { id: 'q2', label: 'Q2' },
        { id: 'q3', label: 'Q3' },
      ],
      [
        { id: 'kv0', label: 'KV0' },
        { id: 'kv1', label: 'KV1' },
        { id: 'kv2', label: 'KV2' },
        { id: 'kv3', label: 'KV3' },
      ],
      [
        ['work', '', '', ''],
        ['work', 'work', '', ''],
        ['work', 'work', 'work', ''],
        ['work', 'work', 'work', 'work'],
      ],
    ),
    highlight: { active: ['q3:kv0', 'q3:kv1', 'q3:kv2', 'q3:kv3'], compare: ['q0:kv0'] },
    explanation: 'Causal attention is lower triangular. If shards are assigned naively, later query blocks do much more work than earlier blocks, so the ring stalls on the busiest device.',
  };

  yield {
    state: labelMatrix(
      'Balanced block assignment',
      [
        { id: 'd0', label: 'dev0' },
        { id: 'd1', label: 'dev1' },
        { id: 'd2', label: 'dev2' },
        { id: 'd3', label: 'dev3' },
      ],
      [
        { id: 'a', label: 'slot A' },
        { id: 'b', label: 'slot B' },
        { id: 'c', label: 'slot C' },
        { id: 'd', label: 'slot D' },
      ],
      [
        ['early', 'late', 'mid', 'late'],
        ['late', 'early', 'late', 'mid'],
        ['mid', 'late', 'early', 'late'],
        ['late', 'mid', 'late', 'early'],
      ],
    ),
    highlight: { found: ['d0:b', 'd1:a', 'd2:d', 'd3:c'], active: ['d0:a', 'd1:b', 'd2:c', 'd3:d'] },
    explanation: 'Load-balanced sequence parallelism reorders blocks so expensive lower-triangular work is spread across devices. The data structure is the block schedule, not only the ring topology.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'device id', min: 0, max: 3 }, y: { label: 'relative work', min: 0, max: 1.0 } },
      series: [
        { id: 'naive', label: 'naive causal', points: [
          { x: 0, y: 0.25 }, { x: 1, y: 0.50 }, { x: 2, y: 0.75 }, { x: 3, y: 1.00 },
        ] },
        { id: 'balanced', label: 'balanced', points: [
          { x: 0, y: 0.62 }, { x: 1, y: 0.64 }, { x: 2, y: 0.63 }, { x: 3, y: 0.65 },
        ] },
      ],
      markers: [
        { id: 'stall', x: 3, y: 1.00, label: 'stall risk' },
      ],
    }),
    highlight: { active: ['balanced'], compare: ['naive', 'stall'] },
    explanation: 'This is why long-context attention is a distributed-systems problem. Good asymptotics can still lose if one device owns the hard part of the causal mask.',
  };

  yield {
    state: graphState({
      nodes: [
        { id: 'schedule', label: 'schedule', x: 0.8, y: 3.7, note: 'permute blocks' },
        { id: 'rope', label: 'positions', x: 2.8, y: 2.5, note: 'RoPE too' },
        { id: 'mask', label: 'mask', x: 2.8, y: 5.0, note: 'causal' },
        { id: 'ring', label: 'ring', x: 5.0, y: 3.7, note: 'KV rotate' },
        { id: 'softmax', label: 'softmax stats', x: 7.0, y: 3.7, note: 'merge' },
        { id: 'out', label: 'output shard', x: 9.0, y: 3.7, note: 'correct order' },
      ],
      edges: [
        { id: 'e-schedule-rope', from: 'schedule', to: 'rope' },
        { id: 'e-schedule-mask', from: 'schedule', to: 'mask' },
        { id: 'e-rope-ring', from: 'rope', to: 'ring' },
        { id: 'e-mask-ring', from: 'mask', to: 'ring' },
        { id: 'e-ring-softmax', from: 'ring', to: 'softmax' },
        { id: 'e-softmax-out', from: 'softmax', to: 'out' },
      ],
    }, { title: 'Correctness follows the permutation ledger' }),
    highlight: { active: ['schedule', 'rope', 'mask'], found: ['softmax', 'out'] },
    explanation: 'Once blocks are reordered, positional encodings, masks, and output reassembly must follow the same ledger. That ledger is the difference between a speedup and a silent model bug.',
  };
}

function* hybridMesh() {
  yield {
    state: meshGraph('Unified sequence parallelism uses rows and columns differently'),
    highlight: { active: ['e-r0c0-r0c1', 'e-r0c1-r0c2', 'e-r0c2-r0c3', 'e-r1c0-r1c1', 'e-r1c1-r1c2', 'e-r1c2-r1c3'], found: ['r0c0', 'r1c3'] },
    explanation: 'Ulysses-style sequence parallelism uses all-to-all communication to repartition sequence shards by attention heads. Ring-style parallelism rotates KV blocks. Unified approaches can combine them on a 2D mesh.',
  };

  yield {
    state: meshGraph('Ring columns hide point-to-point communication'),
    highlight: { active: ['e-r0c0-r1c0', 'e-r0c1-r1c1', 'e-r0c2-r1c2', 'e-r0c3-r1c3'], found: ['r0c1', 'r1c1'] },
    explanation: 'Ring columns are useful when head count limits all-to-all parallelism or when the network topology makes local point-to-point movement cheaper than a large collective.',
  };

  yield {
    state: labelMatrix(
      'Sequence-parallel choices',
      [
        { id: 'ulysses', label: 'Ulysses' },
        { id: 'ring', label: 'Ring' },
        { id: 'unified', label: 'Unified' },
        { id: 'plain', label: 'Plain TP' },
      ],
      [
        { id: 'strength', label: 'strength' },
        { id: 'limit', label: 'limit' },
      ],
      [
        ['uses FlashAttn', 'head count'],
        ['no head cap', 'small blocks'],
        ['flexible mesh', 'scheduler'],
        ['mature', 'not enough'],
      ],
    ),
    highlight: { active: ['ulysses:strength', 'ring:strength', 'unified:strength'], compare: ['ulysses:limit', 'ring:limit'] },
    explanation: 'The modern view is not Ring versus Ulysses forever. The right schedule depends on head count, grouped-query attention, tensor parallelism, network topology, and sequence length.',
  };

  yield {
    state: graphState({
      nodes: [
        { id: 'dp', label: 'data parallel', x: 1.0, y: 5.4, note: 'batch' },
        { id: 'tp', label: 'tensor parallel', x: 2.9, y: 3.2, note: 'hidden dim' },
        { id: 'pp', label: 'pipeline', x: 5.0, y: 5.4, note: 'layers' },
        { id: 'sp', label: 'sequence parallel', x: 5.0, y: 2.0, note: 'tokens' },
        { id: 'zero', label: 'ZeRO/FSDP', x: 7.2, y: 3.2, note: 'states' },
        { id: 'plan', label: '4D plan', x: 9.0, y: 3.7, note: 'mesh' },
      ],
      edges: [
        { id: 'e-dp-plan', from: 'dp', to: 'plan' },
        { id: 'e-tp-plan', from: 'tp', to: 'plan' },
        { id: 'e-pp-plan', from: 'pp', to: 'plan' },
        { id: 'e-sp-plan', from: 'sp', to: 'plan' },
        { id: 'e-zero-plan', from: 'zero', to: 'plan' },
      ],
    }, { title: 'Long-context training becomes 4D parallelism' }),
    highlight: { active: ['sp', 'tp', 'zero'], found: ['plan'] },
    explanation: 'Sequence parallelism must compose with data, tensor, pipeline, and optimizer-state sharding. That is why the schedule is a production systems artifact, not a paper diagram.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'ring pass') yield* ringPass();
  else if (view === 'causal balance') yield* causalBalance();
  else if (view === 'hybrid mesh') yield* hybridMesh();
  else throw new InputError('Pick a RingAttention view.');
}

export const article = {
  sections: [
    {
      heading: 'Why this exists',
      paragraphs: [
        `Long-context transformers run into a plain hardware wall: the sequence is too large for one accelerator to hold and process comfortably. Attention connects every query token to key-value tokens. Even when kernels avoid materializing the full attention matrix, the activations, KV blocks, masks, temporary buffers, and gradients still create a large memory and bandwidth problem. Cutting the context shorter is easy, but it changes the task.`,
        `RingAttention exists because some workloads genuinely need long contexts: long video, long documents, codebases, scientific sequences, agent traces, retrieval-heavy training examples, and multi-turn transcripts. The goal is not to invent approximate attention. The goal is to keep exact attention while distributing the sequence dimension across devices so no single device owns the whole context.`,
        {type:'callout', text:`RingAttention preserves exact attention by keeping query shards stationary, rotating key-value blocks, and treating the schedule ledger as part of correctness.`},
        {type:'image', src:'https://upload.wikimedia.org/wikipedia/commons/7/75/RingNetwork.svg', alt:'Ring network diagram with six connected nodes arranged in a loop.', caption:`Ring network diagram by GW Simulations, public domain, via Wikimedia Commons.`},
      ],
    },
    {
      heading: 'The naive approach',
      paragraphs: [
        `The naive distributed approach is to gather the whole sequence onto every device whenever attention runs. Each device can then compute the same attention math it would compute in the single-device case. This is attractive because it preserves a familiar mental model: copy the missing data, run the kernel, move on.`,
        `That gather is exactly the problem. For very long contexts, all-gathering the full sequence or full KV set turns memory pressure into network pressure. Every device repeatedly receives data it cannot permanently keep. The system spends bandwidth rebuilding a global view that the computation only needs block by block. A second naive approach is to split attention approximately, but that changes model behavior and can make evaluation hard. RingAttention instead changes the schedule while keeping the attention result exact.`,
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        `The core insight is to make query ownership stationary and key-value ownership mobile. Each device owns a shard of query tokens and accumulates the output for those queries. Key-value blocks rotate around a ring. At each step, a device computes attention between its local query block and the KV block currently in its memory, then passes the KV block onward.`,
        `After enough rotations, every query shard has interacted with every key-value shard. No device had to hold the full sequence at once. The exact result is recovered by keeping online softmax statistics for each query block, so partial attention outputs can be merged as if the full score vector had been processed together.`,
      ],
    },
    {
      heading: 'How the mechanism works',
      paragraphs: [
        `Suppose four devices split one long sequence into four blocks. GPU 0 starts with Q0 and KV0, GPU 1 with Q1 and KV1, and so on. During the first local step, each device computes attention for its own query block against its own KV block. Then every device sends its KV block to the next device in the ring and receives a KV block from the previous device.`,
        `The device does not replace its query block. It keeps Q fixed and updates an accumulator. For each received KV block, it computes local attention scores, applies the relevant mask, updates the running softmax maximum and denominator, and updates the partial output. This online softmax part is the same mathematical trick that lets blockwise attention avoid materializing a full matrix: rescale old partial sums when a new block changes the maximum score, then add the new block's contribution.`,
        `The schedule also needs a ledger. The ledger says which original token positions are in each block, which KV block is present at each rotation, what causal mask applies, how RoPE or other positional encoding is interpreted, and where the final output shard belongs. Without that ledger, the ring can look fast while silently attending to the wrong positions.`,
      ],
    },
    {
      heading: 'Causal balancing',
      paragraphs: [
        `Causal language modeling adds a second problem. The attention pattern is lower triangular: earlier query blocks see fewer previous tokens, and later query blocks see more. If blocks are assigned naively, one device may own much more work than another. The ring then stalls on the slowest participant even if total memory fits.`,
        `Load-balanced sequence parallelism reorders or pairs blocks so the triangular work is spread more evenly. That reordering is not a cosmetic optimization. Once the physical block order changes, masks, positions, and output assembly must follow the same map. This is why long-context attention is a distributed-systems problem as much as a kernel problem. The correct object is not only the ring. It is the ring plus the block schedule plus the metadata that makes the schedule faithful to the original sequence.`,
      ],
    },
    {
      heading: 'What the visual is proving',
      paragraphs: [
        `The ring-pass view proves the main conservation law: query blocks stay home, KV blocks rotate, and every query block eventually sees every KV block. The accumulators in the middle are not decoration. They represent the running softmax state that lets exact attention be assembled from blockwise work.`,
        `The causal-balance view proves why a simple equal sequence split is not enough. The naive triangular matrix leaves later query blocks with more work. The balanced schedule spreads heavy and light regions so devices finish closer together. The hybrid-mesh view then shows why RingAttention is one piece of a larger parallel plan. Ulysses-style all-to-all, tensor parallelism, pipeline parallelism, data parallelism, and optimizer-state sharding all compete for the same network and memory budget.`,
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        `RingAttention works because attention over a sequence can be partitioned by key-value blocks while each query block keeps enough statistics to merge the pieces. For one query row, the full softmax output is a weighted sum over all key-value positions. Processing those positions in blocks is safe if the algorithm tracks the running maximum, the running normalizer, and the running weighted output. When a later block contains a larger score, previous partial sums are rescaled before the new contribution is added.`,
        `The ring schedule covers the full set of KV blocks exactly once for each query shard, so no attention term is missing and no term is counted twice. Correctness then depends on masks and positions. In non-causal attention, each query can see every KV block. In causal attention, a query may only see allowed positions. The schedule is correct only if the mask is applied according to original token order, not according to whichever device happens to hold a block at that rotation.`,
      ],
    },
    {
      heading: 'Cost and tradeoffs',
      paragraphs: [
        `RingAttention buys memory headroom by spending coordination. Each rotation moves KV blocks through the network. The design is attractive when compute on each block is large enough to hide communication, but weak when blocks are too small, the network is slow, or topology forces traffic through a bottleneck. The best case is not "free communication." It is communication overlapped with useful matrix work.`,
        `The method also does not remove the total cost of exact attention. Longer context still means more attention work, more activation state, more optimizer pressure during training, and more chances for numerical or schedule bugs. RingAttention changes the memory distribution and communication pattern. It does not make quadratic attention disappear.`,
        `Block size is a real tuning knob. Larger blocks improve kernel efficiency but increase memory pressure and may reduce overlap opportunities. Smaller blocks improve streaming and balance but can waste GPU efficiency. Production systems also have to choose how sequence parallelism composes with tensor parallelism, pipeline parallelism, FSDP or ZeRO, activation checkpointing, and mixed precision.`,
      ],
    },
    {
      heading: 'Real use cases',
      paragraphs: [
        `Ring-style sequence parallelism is most relevant for training or fine-tuning models on contexts that exceed a comfortable single-device activation budget. Examples include book-length document modeling, long-code repository examples, long-video or multimodal sequences, genomics-like token streams, and agent traces that preserve many tool calls and observations.`,
        `A practical deployment review would record context length, device mesh, block size, head count, grouped-query or multi-query attention layout, causal load-balance strategy, network bandwidth, achieved overlap, peak memory, model FLOP utilization, and numerical agreement against a shorter single-device reference. Those checks matter because a sequence-parallel run can fail silently: the loss may move, the GPUs may be busy, and the masks may still be wrong.`,
      ],
    },
    {
      heading: 'Failure modes',
      paragraphs: [
        `The most dangerous failure is a corrupted schedule ledger. If RoPE positions, causal masks, block ids, or output reassembly do not agree, the model may attend to future tokens, skip legal tokens, or write outputs into the wrong order. These bugs can be hard to see from throughput metrics.`,
        `The common performance failure is exposed communication. If the ring step takes longer than the local attention work, the devices wait. If one device owns more causal work, the others wait. If the ring crosses a poor topology boundary, bandwidth drops. If the implementation uses block sizes that fight the attention kernel, GPU utilization falls.`,
        `The product failure is treating long context as automatically better. More tokens can help only if the data, objective, retrieval, and evaluation actually reward long-range use. Sequence parallelism can make a longer experiment possible, but it cannot prove the task needed the extra context.`,
      ],
    },
    {
      heading: 'What to study next',
      paragraphs: [
        `Study the attention mechanism and multi-head attention first, because RingAttention is a schedule for exact attention, not a replacement for attention. Study FlashAttention to understand online softmax and blockwise memory behavior. Study tensor parallelism, pipeline parallelism, ZeRO or FSDP, GPU all-reduce, and transformer roofline models to understand the rest of the distributed training budget. Useful starting papers are Ring Attention with Blockwise Transformers at https://arxiv.org/abs/2310.01889, DeepSpeed Ulysses at https://arxiv.org/abs/2309.14509, and Unified Sequence Parallelism at https://arxiv.org/abs/2405.07719.`,
      ],
    },
  ],
};
