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
  const decodeIntensity = 3;
  const prefillIntensity = 260;
  const computeCeiling = 100;
  const memBandwidthSlope = 0.4;

  yield {
    state: rooflineState([
      { id: 'decode', x: 3, y: 1.2, label: 'decode token' },
      { id: 'prefill', x: 260, y: 100, label: 'prefill prompt' },
    ]),
    highlight: { active: ['decode'], found: ['prefill'], compare: ['memory-roof', 'compute-roof'] },
    explanation: `A roofline chart separates two ceilings: memory bandwidth on the sloped line (${memBandwidthSlope}x), peak math on the flat line at ${computeCeiling}. Transformer prefill at intensity ~${prefillIntensity} has enough arithmetic per byte to climb toward the compute roof. Autoregressive decode at intensity ~${decodeIntensity} sits near the left edge, where each new token reads a lot of weights and KV cache for little new math.`,
  };

  yield {
    state: rooflineState([
      { id: 'fp16-decode', x: 2.5, y: 1.0, label: 'fp16 decode' },
      { id: 'int4-decode', x: 5.5, y: 2.2, label: 'int4 decode' },
      { id: 'prefill', x: 260, y: 100, label: 'prefill' },
    ]),
    highlight: { active: ['fp16-decode', 'int4-decode'], found: ['prefill'] },
    explanation: `Quantization moves decode from intensity ~${decodeIntensity} to the right because fewer bytes are read per multiply. Structured pruning can do the same only when the sparse path actually packs weights and uses sparse kernels. Neither trick magically turns decode into a dense matrix-multiply workload near prefill's ~${prefillIntensity}.`,
    invariant: `The bound is min(peak compute at ${computeCeiling}, memory bandwidth at ${memBandwidthSlope}x times arithmetic intensity).`,
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
    explanation: `The serving stack is a phase-change problem. Prefill at intensity ~${prefillIntensity} and decode at intensity ~${decodeIntensity} hit different ceilings. The fastest prefill kernel does not solve decode memory traffic, and the best batching policy does not remove prefill latency. Good systems name the phase before choosing the tool.`,
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
    explanation: `A production inference engine stacks phase-specific fixes below the ${computeCeiling}-unit compute ceiling: FlashAttention for attention IO, PagedAttention for cache allocation, continuous batching for GPU occupancy, and Speculative Decoding for serial latency. Together they push decode (intensity ~${decodeIntensity}) and prefill (intensity ~${prefillIntensity}) closer to their respective roofs.`,
  };
}

function* prefillVsDecode() {
  const phases = ['prefill', 'decode'];
  const prefillSmallX = 160;
  const prefillLargeX = 320;
  const decodeSingleX = 2;
  const decodeBatchedX = 12;

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
    explanation: `Users experience one answer, but the runtime sees ${phases.length} phases: ${phases.join(' and ')}. Prefill builds the KV Cache from the prompt. Decode repeatedly reads model weights and the existing cache to append one token.`,
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
    explanation: `Long context is not just an accuracy feature. Every live context occupies KV cache bytes across layers and heads. When memory fills, the server must reduce batch size, evict work, spill, or reject new requests -- this is why ${phases[1]} at intensity ~${decodeSingleX} cannot simply be batched without limit.`,
  };

  yield {
    state: rooflineState([
      { id: 'prefill-small', x: 160, y: 64, label: 'prefill small batch' },
      { id: 'prefill-large', x: 320, y: 100, label: 'prefill large batch' },
      { id: 'decode-small', x: 2, y: 0.8, label: 'decode single' },
      { id: 'decode-batch', x: 12, y: 4.8, label: 'decode batched' },
    ]),
    highlight: { active: ['decode-small', 'decode-batch'], found: ['prefill-large'] },
    explanation: `Batching raises arithmetic intensity because multiple sequences reuse the same weights. A single decode at intensity ~${decodeSingleX} jumps to ~${decodeBatchedX} when batched. ${phases[0]} similarly moves from ~${prefillSmallX} to ~${prefillLargeX} with larger batches, but the batch is limited by KV cache memory and user latency.`,
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
    explanation: `The roofline model is useful because it forces metric discipline. Time to first token mostly reflects ${phases[0]} cost, time per output token mostly reflects the ${phases[1]} loop, aggregate throughput and p99 latency diagnose different bottlenecks.`,
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
      heading: 'How to read the animation',
      paragraphs: [
        'The chart plots arithmetic intensity on the x-axis and attainable throughput on the y-axis. Arithmetic intensity means FLOPs per byte moved from memory, so moving right means the workload reuses bytes more before asking memory for more data.',
        'The sloped roof is memory bandwidth, and the flat roof is peak compute. Decode markers sit near the memory slope, while prefill markers sit closer to the compute roof because prompt tokens can be processed in large parallel batches.',
        {type: 'callout', text: 'Roofline thinking starts by naming the phase. Prefill, decode, long-context cache pressure, and batching can all bottleneck on different physical limits inside the same model.'},
        {type: 'image', src: './assets/gifs/transformer-inference-roofline.gif', alt: 'Animated walkthrough of the transformer inference roofline visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Peak FLOPs do not tell you why an LLM server is slow. The same model can be compute-bound while reading a long prompt and memory-bound while producing one token at a time.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b1/Example_of_a_Roofline_model.svg/330px-Example_of_a_Roofline_model.svg.png', alt: 'Example roofline model chart with memory and compute ceilings.', caption: 'The roofline chart shows the decision boundary: low arithmetic intensity follows memory bandwidth, while high intensity can reach peak compute. Source: Wikimedia Commons, Tanzima, CC BY-SA 4.0.'},
        'The roofline model exists to connect performance to physics: bytes per second and operations per second. It turns vague claims about slow inference into a phase-specific bottleneck diagnosis.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is to buy the GPU with the highest TFLOP number and optimize the most famous kernel. This works decently for training-like dense matrix multiplies because large batches reuse weights well.',
        'It also works for prefill more than decode. A 2048-token prompt creates large matrix-matrix work, so math units can stay busy if kernels are efficient.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'Decode changes the shape. Each request appends one token, so many layers become matrix-vector work that rereads large weights and KV cache for little new arithmetic.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5a/Example_of_a_naive_Roofline_model.svg/330px-Example_of_a_naive_Roofline_model.svg.png', alt: 'Naive roofline chart showing memory and compute limits.', caption: 'A naive roofline still captures the serving lesson: points on the left improve by moving fewer bytes or reusing bytes better, not by chasing peak FLOPs. Source: Wikimedia Commons, Tanzima, CC BY-SA 4.0.'},
        'The wall is not that decode is slow; it is that the limiting resource changed. A faster attention kernel may improve prefill while leaving decode latency almost unchanged if the decode loop is waiting on memory bandwidth.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Attainable performance is bounded by min(peak compute, memory bandwidth * arithmetic intensity). To improve a memory-bound phase, reduce bytes or reuse bytes; to improve a compute-bound phase, raise useful math throughput.',
        'Serving is a phase-change problem. Time to first token mostly exposes prefill and queueing, while time per output token mostly exposes the decode loop and KV-cache behavior.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Estimate FLOPs and bytes for the phase, divide FLOPs by bytes, and place the point on the roofline. If it lands on the slope, byte movement is the bound; if it lands on the flat line, compute is the bound.',
        'Quantization moves points right by reducing bytes per weight. Batching moves decode right by reusing the same weight read across multiple live sequences, but KV-cache memory and latency targets cap the batch size.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The correctness argument is a conservation argument. If a kernel performs I FLOPs per byte and memory delivers B bytes per second, memory can feed at most B * I FLOPs per second, no matter how many compute units exist.',
        'The compute roof is the other limit. Once memory can feed enough operands, peak math throughput caps the workload, so better caching alone cannot exceed the flat roof.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The roofline calculation is cheap, but the optimizations are not. Quantization needs quality checks, batching risks tail latency, tensor parallelism adds communication, and paged KV caches add allocator complexity.',
        'For a 70B-class model, KV cache can consume gigabytes per live sequence at long context. That means the best throughput batch may be impossible because memory capacity fails before bandwidth or compute are saturated.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Use the roofline model for capacity planning, hardware selection, and optimization triage. It tells you whether to chase faster matmuls, fewer bytes, better batching, smaller KV cache, or a different serving schedule.',
        'It also gives product and infrastructure teams a shared language. Time to first token, time per output token, aggregate throughput, and p99 latency point at different phases and should not be optimized with one knob.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'A roofline is a ceiling model, not a profiler. Kernel launch overhead, scheduler bugs, network transfer, CPU tokenization, allocator fragmentation, and tenant isolation can all keep real systems below the roof.',
        'It also does not measure output quality. A quantized or speculative system can look better on the roofline and still fail if answers degrade or latency SLOs are violated on hard inputs.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Assume a GPU has 2 TB/s memory bandwidth and 312 TFLOP/s peak fp16 compute. The ridge point is 312 / 2 = 156 FLOPs per byte, so workloads below 156 FLOPs per byte are memory-bound.',
        'A single-sequence decode layer that effectively does 2 FLOPs per weight byte is far left of 156 and cannot use most compute units. If batching raises effective intensity to 32 FLOPs per byte, it is still memory-bound, but it can run about 16 times faster on the memory slope before other limits appear.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary source: Williams, Waterman, and Patterson, Roofline: An Insightful Visual Performance Model for Multicore Architectures, 2009. For transformers, study Efficiently Scaling Transformer Inference and the JAX Scaling Book inference chapters.',
        'Study transformer layer FLOPs cost model, KV cache, FlashAttention, grouped-query attention, continuous batching, paged attention, and speculative decoding next.',
      ],
    },
  ],
};
