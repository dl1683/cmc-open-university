// Transformer inference roofline: prefill is dense arithmetic, decode is
// mostly memory traffic. The bottleneck changes inside the same model.

import { plotState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'transformer-inference-roofline',
  title: 'Transformer Inference Roofline',
  category: 'Systems',
  summary: 'Why prefill can saturate math units while decode is usually memory-bound: arithmetic intensity, KV cache bytes, and serving economics.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['roofline map', 'prefill vs decode'], defaultValue: 'roofline map' },
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

function rooflineState(markers = []) {
  const xs = [0.5, 1, 2, 4, 8, 16, 32, 64, 128, 256, 512];
  const memory = xs.map((x) => ({ x, y: Math.min(100, x * 0.4) }));
  const compute = xs.map((x) => ({ x, y: 100 }));
  return plotState({
    axes: {
      x: { label: 'arithmetic intensity: FLOPs per byte', min: 0, max: 520 },
      y: { label: 'usable compute, normalized', min: 0, max: 110 },
    },
    series: [
      { id: 'memory-roof', label: 'memory roof', points: memory },
      { id: 'compute-roof', label: 'compute roof', points: compute },
    ],
    markers,
  });
}

function* rooflineMap() {
  yield {
    state: rooflineState([
      { id: 'decode', x: 3, y: 1.2, label: 'decode token' },
      { id: 'prefill', x: 260, y: 100, label: 'prefill prompt' },
    ]),
    highlight: { active: ['decode'], found: ['prefill'], compare: ['memory-roof', 'compute-roof'] },
    explanation: 'A roofline chart separates two ceilings: memory bandwidth on the sloped line, peak math on the flat line. Transformer prefill has enough arithmetic per byte to climb toward the compute roof. Autoregressive decode sits near the left edge, where each new token reads a lot of weights and KV cache for little new math.',
  };

  yield {
    state: rooflineState([
      { id: 'fp16-decode', x: 2.5, y: 1.0, label: 'fp16 decode' },
      { id: 'int4-decode', x: 5.5, y: 2.2, label: 'int4 decode' },
      { id: 'prefill', x: 260, y: 100, label: 'prefill' },
    ]),
    highlight: { active: ['fp16-decode', 'int4-decode'], found: ['prefill'] },
    explanation: 'Quantization moves decode to the right because fewer bytes are read per multiply. Structured pruning can do the same only when the sparse path actually packs weights and uses sparse kernels. Neither trick magically turns decode into a dense matrix-multiply workload.',
    invariant: 'The bound is min(peak compute, memory bandwidth times arithmetic intensity).',
  };

  yield {
    state: labelMatrix(
      'Same transformer, different bottleneck',
      [
        { id: 'prefill', label: 'prefill' },
        { id: 'decode', label: 'decode' },
        { id: 'long', label: 'long context' },
        { id: 'batch', label: 'large batch' },
      ],
      [
        { id: 'shape', label: 'work shape' },
        { id: 'dominant', label: 'dominant pressure' },
        { id: 'fix', label: 'main lever' },
      ],
      [
        ['many prompt tokens at once', 'matmul throughput', 'FlashAttention and tensor parallelism'],
        ['one next token per sequence', 'weight and KV reads', 'batching and cache layout'],
        ['cache grows with tokens', 'GPU memory capacity', 'PagedAttention and KV quantization'],
        ['more live sequences', 'tail latency and fairness', 'scheduler policy'],
      ],
    ),
    highlight: { active: ['decode:dominant', 'long:dominant'], found: ['prefill:fix', 'decode:fix'] },
    explanation: 'The serving stack is a phase-change problem. The fastest prefill kernel does not solve decode memory traffic, and the best batching policy does not remove prefill latency. Good systems name the phase before choosing the tool.',
  };

  yield {
    state: labelMatrix(
      'Optimization map',
      [
        { id: 'flash', label: 'IO-aware attention' },
        { id: 'page', label: 'paged KV cache' },
        { id: 'batch', label: 'continuous batching' },
        { id: 'spec', label: 'speculation' },
      ],
      [
        { id: 'bottleneck', label: 'targets' },
        { id: 'why', label: 'why it works' },
      ],
      [
        ['prefill attention IO', 'tiles through fast memory'],
        ['cache fragmentation', 'allocates KV blocks lazily'],
        ['idle decode lanes', 'admits work each iteration'],
        ['serial token dependency', 'verifies several draft tokens at once'],
      ],
    ),
    highlight: { found: ['flash:why', 'page:why', 'batch:why', 'spec:why'] },
    explanation: 'A production inference engine is a stack of phase-specific fixes: FlashAttention for attention IO, PagedAttention for cache allocation, continuous batching for GPU occupancy, and Speculative Decoding for serial latency.',
  };
}

function* prefillVsDecode() {
  yield {
    state: labelMatrix(
      'One request has two execution phases',
      [
        { id: 'prompt', label: 'prompt tokens' },
        { id: 'prefill', label: 'prefill pass' },
        { id: 'first', label: 'first token' },
        { id: 'decode', label: 'decode loop' },
      ],
      [
        { id: 'what', label: 'system does' },
        { id: 'cost', label: 'cost shape' },
      ],
      [
        ['arrive together', 'input length sets prefill work'],
        ['process all prompt positions', 'parallel and compute-heavy'],
        ['stream begins', 'latency-visible boundary'],
        ['append one token at a time', 'memory-heavy and repeated'],
      ],
    ),
    highlight: { active: ['prefill:cost', 'decode:cost'], found: ['first:what'] },
    explanation: 'Users experience one answer, but the runtime sees two phases. Prefill builds the KV Cache from the prompt. Decode repeatedly reads model weights and the existing cache to append one token.',
  };

  yield {
    state: labelMatrix(
      'KV cache converts context into resident memory',
      [
        { id: 'short', label: 'short chat' },
        { id: 'rag', label: 'RAG answer' },
        { id: 'agent', label: 'agent trace' },
        { id: 'batch', label: 'batch capacity' },
      ],
      [
        { id: 'context', label: 'context length' },
        { id: 'effect', label: 'serving effect' },
      ],
      [
        ['small', 'many users fit'],
        ['medium with citations', 'prompt cost matters'],
        ['long tool history', 'cache evicts concurrency'],
        ['fixed by memory', 'tokens compete for residency'],
      ],
    ),
    highlight: { compare: ['short:effect', 'agent:effect'], active: ['batch:effect'] },
    explanation: 'Long context is not just an accuracy feature. Every live context occupies KV cache bytes across layers and heads. When memory fills, the server must reduce batch size, evict work, spill, or reject new requests.',
  };

  yield {
    state: rooflineState([
      { id: 'prefill-small', x: 160, y: 64, label: 'prefill small batch' },
      { id: 'prefill-large', x: 320, y: 100, label: 'prefill large batch' },
      { id: 'decode-small', x: 2, y: 0.8, label: 'decode single' },
      { id: 'decode-batch', x: 12, y: 4.8, label: 'decode batched' },
    ]),
    highlight: { active: ['decode-small', 'decode-batch'], found: ['prefill-large'] },
    explanation: 'Batching raises arithmetic intensity because multiple sequences reuse the same weights. That is why decode throughput improves with batch size, but the batch is limited by KV cache memory and user latency.',
  };

  yield {
    state: labelMatrix(
      'What to measure before optimizing',
      [
        { id: 'ttft', label: 'time to first token' },
        { id: 'tpot', label: 'time per output token' },
        { id: 'tokens', label: 'tokens per second' },
        { id: 'tail', label: 'p99 latency' },
      ],
      [
        { id: 'phase', label: 'mostly sees' },
        { id: 'wrong fix', label: 'wrong fix if misread' },
      ],
      [
        ['prefill and queueing', 'only tuning decode batch'],
        ['decode loop', 'only optimizing prompt kernels'],
        ['aggregate throughput', 'ignoring fairness'],
        ['scheduler and outliers', 'reporting averages'],
      ],
    ),
    highlight: { active: ['ttft:phase', 'tpot:phase', 'tail:phase'], found: ['tail:wrong fix'] },
    explanation: 'The roofline model is useful because it forces metric discipline. Time to first token, time per output token, aggregate throughput, and p99 latency diagnose different bottlenecks.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'roofline map') yield* rooflineMap();
  else if (view === 'prefill vs decode') yield* prefillVsDecode();
  else throw new InputError('Pick a roofline view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'A roofline model explains performance by asking how much arithmetic a program performs for each byte it must move. Transformer inference is an ideal teaching case because one request crosses phases. Transformer Layer FLOPs Cost Model explains the prompt-side arithmetic. Prefill processes a prompt in parallel and can look like dense linear algebra. Decode emits one token at a time and repeatedly reads weights plus KV Cache state. The same model can therefore be compute-bound in one phase and memory-bound in the next.',
        'This matters for product cost. A bigger GPU only helps when the workload can feed its math units. If each generated token mostly waits on memory bandwidth, peak FLOPs are a misleading headline number. The right question becomes: how many useful tokens can the server emit per byte of memory traffic while meeting latency targets?',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The roofline bound is the lower of two ceilings: peak compute and memory bandwidth multiplied by arithmetic intensity. Attention Mechanism prefill has many prompt positions available at once, so batching and IO-aware kernels such as FlashAttention Case Study can raise useful work per byte. Decode has a hard autoregressive dependency: token n must exist before token n+1 can be generated. Batching many users helps reuse weights, but every user also contributes KV cache bytes.',
        'The local corpus notes frame the same distinction as inference economics: prefill is usually compute-heavy, while decode is memory-heavy. Quantization reduces bytes for weights and sometimes cache, Structured Pruning and N:M Sparsity can reduce weight traffic when the kernel path supports the packed mask, PagedAttention reduces stranded cache memory, LLM Continuous Batching keeps live decode lanes packed, and Speculative Decoding tries to turn several serial decode steps into one verification pass.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The main cost variables are model size, prompt length, output length, batch size, KV cache layout, transfer path, and latency target. Long context increases KV memory roughly with live tokens, layers, and KV heads. That memory pressure reduces concurrency even when the GPU still has arithmetic capacity. In disaggregated clusters, KV Cache Transfer Fabric Case Study adds another roofline-like constraint: moving prompt state can be bounded by network bandwidth and congestion rather than GPU math. KV Cache Tiered Offload Store Case Study adds a storage roofline: CPU, SSD, or remote hits help only when fetch and promotion latency beat recompute and stay inside p99. A serving team must therefore tune admission control, prefill scheduling, decode batch size, cache eviction, quantization, transfer routing, offload placement, and tail-latency budgets together.',
        'A common mistake is optimizing the wrong phase. Faster attention kernels can improve time to first token but may not fix slow token streaming. Larger decode batches can improve throughput but harm p99 latency if users wait behind long generations. The roofline picture keeps the diagnosis honest: first identify the ceiling, then choose the lever.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Every high-throughput LLM API, coding-agent service, and enterprise RAG Pipeline runs into this split. Chat products care about time to first token and smooth streaming. Batch summarization cares about tokens per dollar. Long-context agents care about cache residency and eviction. The exact implementation may use tensor parallelism, pipeline parallelism, KV quantization, prefix caching, PagedAttention, or SLO-aware request routing, but the underlying bottleneck map is the same.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'Peak FLOPs do not predict inference cost by themselves. A memory-bound decode workload can leave expensive math units underused. Another misconception is that quantization solves serving. It moves the point rightward on the roofline, but if cache traffic or scheduler stalls dominate, the remaining system can still be memory-bound or queue-bound. Finally, average throughput can hide a failed product: users feel p95 and p99 latency, not the mean.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: the Roofline paper at https://dl.acm.org/doi/10.1145/1498765.1498785, Efficiently Scaling Transformer Inference at https://arxiv.org/abs/2211.05102, and the JAX scaling book chapter on inference at https://jax-ml.github.io/scaling-book/inference/. Study Transformer Layer FLOPs Cost Model, KV Cache, KV Cache Concurrency Capacity Model, Chunked Prefill Token Budget Scheduler, KV Cache Transfer Fabric Case Study, KV Cache Tiered Offload Store Case Study, SLO-Aware LLM Request Router, Grouped-Query Attention, Attention Mechanism, FlashAttention Case Study, RetNet Retention State Case Study, FNet Fourier Token Mixing Case Study, Titans Test-Time Neural Memory Case Study, Quantization, Activation-Aware Quantization Calibration Ledger, Structured Pruning and N:M Sparsity, MoE Expert Capacity and All-To-All Routing Ledger, LLM Continuous Batching, LLM Serving: PagedAttention, Early-Exit Transformer Layer Skipping, Mixture-of-Depths Token Routing, Perceiver IO Latent Array Bottleneck, Heterogeneous AI Compute Workload Router, and Tail Latency & p99 Thinking next.',
      ],
    },
  ],
};
