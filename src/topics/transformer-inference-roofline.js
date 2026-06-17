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
      heading: 'Why it exists',
      paragraphs: [
        `Transformer inference roofline analysis exists because peak FLOPs alone do not predict serving speed. A GPU can advertise huge math throughput and still emit tokens slowly if the decode loop spends most of its time moving weights and KV cache bytes. The roofline model connects two ceilings: the flat compute ceiling and the sloped memory-bandwidth ceiling. A workload's arithmetic intensity, measured as work per byte moved, decides which ceiling is reachable.`,
        `LLM serving is a strong example because one request moves through different phases. Prefill processes the prompt, often many tokens at once, and can use large matrix operations with good hardware utilization. Decode generates one token at a time under an autoregressive dependency. Each decode step must read model weights, attend to cached keys and values, sample the next token, and repeat. The same model can look compute-heavy during prefill and bandwidth-heavy during decode.`,
      ],
    },
    {
      heading: 'The reasonable first attempt',
      paragraphs: [
        `The first attempt is to compare accelerators by peak FLOPs and choose the largest number. That is reasonable for dense training kernels where large matrix multiplies can keep compute units busy. It becomes misleading for serving because users care about time to first token, time per output token, tail latency, and cost per generated token, not only aggregate math rate. A system can have unused compute while still being too slow because memory bandwidth, cache capacity, or scheduling is the limit.`,
        `Another tempting answer is to optimize the most visible kernel. Attention is famous, so a team may focus on attention kernels even when decode is dominated by weight reads or KV movement. Or it may report total tokens per second while hiding slow first-token latency for long prompts and p99 latency for unlucky requests. The wall is diagnostic: without a phase-aware model, optimization effort can land on the wrong roof.`,
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        `The core roofline bound is min(peak compute, memory bandwidth multiplied by arithmetic intensity). Arithmetic intensity is how many operations the workload performs for each byte it moves from memory. Low-intensity work sits under the sloped memory roof: adding compute units will not help much because bytes arrive too slowly. High-intensity work can approach the flat compute roof: memory feeds enough data for math throughput to dominate.`,
        `Transformer serving moves points around that graph. Prefill has many prompt tokens available simultaneously, so batching and IO-aware attention can increase reuse and arithmetic intensity. Decode has a hard serial dependency because token n must be known before token n + 1 can be generated. Batching many decode streams can reuse weights across requests, but it also increases KV cache pressure and latency commitments. The roofline tells you which lever plausibly moves the current bottleneck.`,
      ],
    },
    {
      heading: 'Mechanism',
      paragraphs: [
        `To use the model, estimate or measure the work and bytes for a phase. The y-axis is attainable throughput. The x-axis is arithmetic intensity. The sloped line is memory bandwidth times intensity. The flat line is peak compute. A point below the sloped region is memory-bound; improving math throughput will not move it much. A point near the flat roof is compute-bound; faster memory may not matter unless it raises the point into a new regime.`,
        `Serving optimizations move points in different directions. Quantization reduces bytes per weight or activation and can shift a decode point rightward. Grouped-query attention reduces KV cache bytes per token compared with full multi-head KV storage. PagedAttention improves effective cache use by reducing fragmentation and stranded memory. Continuous batching raises utilization by keeping decode lanes occupied. Speculative decoding tries to verify several proposed tokens at once, converting some serial decode work into a larger batch-like operation. Disaggregated prefill and decode can move phases onto hardware better matched to their roofs, but then KV transfer becomes another bandwidth constraint.`,
      ],
    },
    {
      heading: 'What the visual proves',
      paragraphs: [
        `The visual proves that "the model is slow" is not a diagnosis. A point near the memory slope needs a byte problem solved. A point near the flat roof needs a compute problem solved. The prefill marker sits closer to dense linear algebra because many prompt positions are available together. The decode marker sits closer to the memory-bound side because each output step repeatedly streams state under a serial dependency. Seeing both points on one graph explains why one fix rarely improves every metric.`,
        `The phase view proves that product metrics attach to different parts of the serving path. Time to first token mostly includes queueing and prefill. Time per output token mostly sees the decode loop. Aggregate throughput blends phases and can hide bad user experience. p99 latency exposes scheduler, batching, cache, and outlier effects. The point of the visual is not just to classify kernels; it is to keep metric discipline. A team should not claim a decode improvement from a prefill-only benchmark or a user-latency win from aggregate tokens alone.`,
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        `The roofline works because it applies a conservation argument. Every operation needs data. If a phase performs I operations per byte and the hardware can deliver B bytes per second, memory can feed at most B * I operations per second. No kernel can exceed that memory-fed rate unless it increases reuse, reduces bytes, or changes the phase. Separately, no kernel can exceed the hardware's compute peak. The attainable roof is the smaller of those two limits.`,
        `For transformers, the proof sketch is practical rather than exact. Prefill can reuse weights and use large batches over sequence positions, so the memory-fed bound rises. Decode often has limited work per byte because each step touches large model state for one new token per request. Batching decode streams increases reuse, but latency and KV memory limit batch size. That is why the model explains both hardware behavior and scheduling behavior: arithmetic intensity is not only a kernel property; it is shaped by batching, context length, cache layout, and service-level objectives.`,
      ],
    },
    {
      heading: 'Cost and tradeoffs',
      paragraphs: [
        `The cost of roofline analysis is measurement discipline. You need phase separation, byte estimates, achieved bandwidth, achieved FLOPs, batch shape, sequence length, cache hit behavior, and user-facing latency metrics. Rough analysis is still valuable, but false precision is dangerous. A decode point measured at one batch size may not describe another. A long-context workload may be KV-capacity-bound before it is pure bandwidth-bound. A multi-tenant router may make p99 worse while kernels look efficient in isolation.`,
        `Every serving lever has a tax. Quantization can reduce bytes but may harm quality or require calibration and kernel support. Larger batches improve throughput but increase queueing and tail latency. Tensor parallelism can raise compute capacity but adds communication. Disaggregation can place prefill and decode on suitable hardware but introduces KV transfer and scheduling complexity. Speculative decoding can reduce apparent serial steps but depends on draft-model quality and verification overhead. Roofline analysis helps choose candidates; it does not remove their tradeoffs.`,
      ],
    },
    {
      heading: 'Uses and failure modes',
      paragraphs: [
        `Use this model before selecting an inference optimization. If time to first token is dominated by long prompts, investigate prefill batching, chunked prefill, FlashAttention, tensor parallelism, and prefill/decode disaggregation. If time per output token dominates, investigate quantization, decode batching, KV layout, grouped-query attention, speculative decoding, and memory bandwidth. If long context reduces concurrency, use a KV cache capacity model. In a cluster, add network and storage roofs for KV transfer and offload paths.`,
        `The failure mode is treating the roofline as a profiler. It will not reveal a bad queue policy, a cold cache, a router bug, kernel launch overhead, allocator fragmentation, tenant isolation rules, or a correctness bug. It also will not validate a quality-preserving optimization by itself. A quantized model can move rightward on the graph and still fail a quality bar. A larger decode batch can improve tokens per second and still violate p99. The roofline narrows hypotheses; profiling and workload replay must confirm them.`,
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        `Primary sources are the Roofline paper at https://dl.acm.org/doi/10.1145/1498765.1498785, Efficiently Scaling Transformer Inference at https://arxiv.org/abs/2211.05102, and the JAX scaling book chapter on inference at https://jax-ml.github.io/scaling-book/inference/. Study Transformer Layer FLOPs Cost Model first so work counts are concrete. Then study KV Cache and KV Cache Concurrency Capacity Model for memory pressure, FlashAttention for IO-aware attention, Quantization for byte reduction, Grouped-Query Attention for KV sharing, Chunked Prefill Token Budget Scheduler for TTFT control, SLO-Aware LLM Request Router for tail latency, and Tail Latency for p99 thinking.`,
      ],
    },
  ],
};
