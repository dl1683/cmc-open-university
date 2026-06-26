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
    { heading: 'How to read the animation', paragraphs: [
      'Read each GPU as owning one shard of the sequence. Active edges are key-value blocks moving around the ring, found nodes are accumulators holding partial attention output, and compare marks show the single-device or imbalanced schedule being avoided.',
      'The safe inference rule is conservation of attention terms. If every query shard attends to every allowed key-value shard exactly once, and the online softmax accumulator keeps the right maximum, denominator, and weighted output, the distributed schedule computes exact attention.',
    ] },
    { heading: 'Why this exists', paragraphs: [
      'RingAttention exists because long-context attention does not fit comfortably on one accelerator. Attention lets each query token compare with key and value tokens, and exact attention over long sequences needs large activation memory, high bandwidth, and careful masking.',
      'The goal is not approximate attention. The goal is to keep exact attention while sharding the sequence across devices, so no one device holds the entire context at once.',
      {type:'callout', text:`RingAttention preserves exact attention by keeping query shards stationary, rotating key-value blocks, and treating the schedule ledger as part of correctness.`},
      {type:'image', src:'https://upload.wikimedia.org/wikipedia/commons/7/75/RingNetwork.svg', alt:'Ring network diagram with six connected nodes arranged in a loop.', caption:`Ring network diagram by GW Simulations, public domain, via Wikimedia Commons.`},
    ] },
    { heading: 'The obvious approach', paragraphs: [
      'The obvious distributed approach is to gather the full sequence or full key-value set onto every device before attention runs. That preserves the single-device mental model: copy missing data, run the normal kernel, and continue.',
      'The cost is repeated global movement of data that each device only needs block by block. Another easy approach is to shorten the context or approximate attention, but that changes the model behavior the experiment is trying to test.',
    ] },
    { heading: 'The wall', paragraphs: [
      'The wall is the product of memory and network pressure. If eight devices each need the full 1 GB key-value set, an all-gather can move about 7 GB of received data across the group for one attention layer, and it repeats across layers and steps.',
      'Causal masking adds a second wall. Later query blocks have more legal keys than earlier blocks, so a naive split can leave one device with much more work. A ring that waits on the slowest device wastes the parallelism it created.',
    ] },
    { heading: 'The core insight', paragraphs: [
      'Keep query blocks stationary and rotate key-value blocks. Each device accumulates output for its own query block while key-value blocks circulate through the ring.',
      'After enough rotations, every query block has seen every key-value block it is allowed to see. Online softmax lets the device merge blockwise results without materializing the full attention score matrix.',
    ] },
    { heading: 'How it works', paragraphs: [
      'With four devices, GPU 0 starts with Q0 and KV0, GPU 1 with Q1 and KV1, and so on. Each device computes local attention for its query block against the key-value block it currently holds, then sends that key-value block to the next device.',
      'The query block does not move. The accumulator stores the running softmax maximum, normalization denominator, and weighted value sum for that query block. When a new key-value block arrives with larger scores, the old partial output is rescaled before the new contribution is added.',
    ] },
    { heading: 'Why it works', paragraphs: [
      'Attention for one query row is a sum over key-value positions after softmax normalization. Splitting those positions into blocks is safe when the running softmax state is updated exactly as if the full row had been processed at once.',
      'The ring schedule covers the key-value shards once for each query shard, so no term is missing and no term is counted twice. Correctness then depends on the ledger for original token positions, causal masks, RoPE positions, and output reassembly.',
    ] },
    { heading: 'Cost and complexity', paragraphs: [
      'RingAttention buys memory headroom by spending communication and scheduling complexity. The best case occurs when local attention work is large enough to hide the key-value transfer to the next device.',
      'It does not remove the total compute cost of exact attention. Longer context still means more attention work and more activation state. Block size controls the tradeoff: larger blocks use kernels efficiently but increase memory pressure, while smaller blocks improve overlap but can waste GPU efficiency.',
    ] },
    { heading: 'Real-world uses', paragraphs: [
      'Ring-style sequence parallelism is useful for training or fine-tuning on book-length documents, large code repositories, long video or multimodal streams, genomics-like sequences, and agent traces with many tool calls.',
      'It also appears inside larger parallel plans. Real systems combine sequence parallelism with tensor parallelism, pipeline parallelism, data parallelism, optimizer-state sharding, activation checkpointing, and mixed precision.',
    ] },
    { heading: 'Where it fails', paragraphs: [
      'The worst correctness failure is a broken schedule ledger. If masks, positions, block ids, or output order disagree, the model can attend to future tokens, skip legal tokens, or write results into the wrong slot.',
      'The common performance failure is exposed communication. If the transfer step is slower than the local attention step, devices wait. If causal work is not balanced, the ring waits on the heaviest shard. If the topology is poor, point-to-point movement can cross slow links.',
    ] },
    { heading: 'Worked example', paragraphs: [
      'Suppose a 131072-token sequence is split across 8 GPUs, so each device owns 16384 query tokens and one 16384-token key-value shard. A single-device run would need room for the whole sequence activation set; the ring run keeps one query shard and one rotating key-value shard resident per device.',
      'The ring takes 8 local attention steps. If one step takes 6 ms of matrix work and 2 ms of communication that is fully overlapped, the pass costs about 48 ms. If communication is 8 ms and cannot be hidden, the same pass costs about 64 ms or more. The memory win is real, but the runtime win depends on overlap.',
    ] },
    { heading: 'Sources and study next', paragraphs: [
      'Primary sources: Ring Attention with Blockwise Transformers at https://arxiv.org/abs/2310.01889, DeepSpeed Ulysses at https://arxiv.org/abs/2309.14509, and Unified Sequence Parallelism at https://arxiv.org/abs/2405.07719.',
      'Study Attention Mechanism, Multi-Head Attention, FlashAttention, Tensor Parallelism, Pipeline Parallelism, ZeRO or FSDP, GPU All-Reduce, Transformer Inference Roofline, and NCCL Algorithm Protocol Selector next.',
    ] },
  ],
};
