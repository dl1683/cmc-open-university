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
      heading: 'How to read the animation',
      paragraphs: [
        'The animation draws a roofline chart: arithmetic intensity (FLOPs per byte transferred) on the horizontal axis, attainable throughput on the vertical axis. Two lines form the "roof." The sloped line is the memory-bandwidth ceiling -- throughput grows linearly with intensity until the hardware runs out of math units. The flat line is the compute ceiling -- no workload can exceed peak FLOPs regardless of how much data reuse it achieves.',
        'Each marker is a serving phase placed on the chart. The prefill marker sits near the compute roof because processing many prompt tokens at once yields high arithmetic intensity. The decode marker sits near the memory slope because generating one token at a time reads many bytes for little new math. Watch how quantization, batching, and other levers shift markers horizontally -- rightward means more work per byte, which pushes a memory-bound phase closer to the compute roof.',
        'Active markers (highlighted) are the current focus. Found markers are phases whose bottleneck has been identified. When the animation switches to the matrix view, rows are serving phases and columns are diagnostic axes: work shape, dominant pressure, and the lever that actually helps. Read both views together to see that "the model is slow" is never a diagnosis -- the phase determines the fix.',
        {type: 'callout', text: 'Roofline thinking starts by naming the phase. Prefill, decode, long-context cache pressure, and batching can all bottleneck on different physical limits inside the same model.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'GPU vendors quote peak FLOPs. Cloud dashboards report tokens per second. Neither number tells you why a serving deployment is slow or what to do about it. The roofline model, introduced by Williams, Waterman, and Patterson in 2009, connects two physical limits -- compute throughput and memory bandwidth -- through a single diagnostic quantity: arithmetic intensity. A workload that performs many operations per byte of data moved can approach the compute ceiling. A workload that moves many bytes per operation is capped by the memory ceiling. The bound is whichever ceiling is lower.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b1/Example_of_a_Roofline_model.svg/330px-Example_of_a_Roofline_model.svg.png', alt: 'Example roofline model chart with memory and compute ceilings.', caption: 'The roofline chart shows the decision boundary: low arithmetic intensity follows memory bandwidth, while high intensity can reach peak compute. Source: Wikimedia Commons, Tanzima, CC BY-SA 4.0.'},
        'LLM inference is the best modern example of why this matters, because one request hits both ceilings during its lifetime. Prefill processes the entire prompt in parallel -- large matrix multiplies with high data reuse -- and can saturate the compute units. Decode generates tokens one at a time under an autoregressive dependency, reading the full weight matrices and growing KV cache for each new token. The same GPU, the same model, the same request: compute-bound in one phase, memory-bound in the other.',
        {
          type: 'quote',
          text: 'The roofline model ties together floating-point performance, operand locality, and memory bandwidth in a visually intuitive graph.',
          attribution: 'Williams, Waterman, and Patterson, 2009',
        },
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The natural first attempt is to pick hardware by peak FLOPs and optimize the hottest kernel. For training, this works reasonably well -- large matrix multiplies dominate, arithmetic intensity is high, and the workload spends most of its time near the compute ceiling. Teams benchmark a few kernels, choose the card with the biggest TFLOPS number, and move on.',
        'For serving, the same logic is applied: profile, find the slow kernel, speed it up. Attention is famous, so it gets the most engineering attention. Weight matrices are large, so tensor parallelism is added. The expectation is that faster math yields faster tokens.',
        'This works for prefill. For a 2048-token prompt with batch size 1, the QKV projection alone performs roughly 2 * 3 * d_model^2 FLOPs while reading 3 * d_model^2 weight bytes (in fp16, 2 bytes each). For a 4096-dimension model, that is about 100 billion FLOPs against a few hundred megabytes -- plenty of arithmetic intensity to stay compute-bound. The approach feels correct because prefill confirms it.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'Decode shatters the assumption. Each decode step generates one token per sequence. The same weight matrices must be read, but the input is now a single vector instead of a long sequence. Arithmetic intensity collapses. A linear layer that was a large matrix multiply during prefill becomes a matrix-vector product during decode: same bytes read, a fraction of the FLOPs.',
        {
          type: 'bullets',
          items: [
            'Prefill at sequence length 2048 uses an input shaped [2048, d]. The layer performs roughly 2 * 2048 * d^2 work against one weight read, so arithmetic intensity is high and the bottleneck tends toward compute.',
            'Decode uses an input shaped [1, d]. The layer performs roughly 2 * d^2 work while still reading weights and KV cache, so arithmetic intensity is low and the bottleneck tends toward memory bandwidth.',
          ],
        },
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5a/Example_of_a_naive_Roofline_model.svg/330px-Example_of_a_naive_Roofline_model.svg.png', alt: 'Naive roofline chart showing memory and compute limits.', caption: 'A naive roofline still captures the serving lesson: points on the left improve by moving fewer bytes or reusing bytes better, not by chasing peak FLOPs. Source: Wikimedia Commons, Tanzima, CC BY-SA 4.0.'},
        'The KV cache makes it worse. Every decode step reads cached keys and values from all previous tokens across all layers and all attention heads. For a 70B-parameter model with 80 layers and 8192-dimension hidden state, the KV cache at 4096 context length can consume 10+ GB. That memory must be streamed through the memory bus on every single token generation step.',
        'The wall is not that decode is slow. The wall is that the reason it is slow is fundamentally different from why prefill is slow, and optimizing the wrong phase wastes engineering effort. A team that makes attention 2x faster but does not touch memory bandwidth will see prefill improve and decode barely move.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The roofline bound for any phase is: attainable performance = min(peak compute, memory bandwidth * arithmetic intensity). To use it, measure or estimate the FLOPs and bytes for the phase you care about. Divide FLOPs by bytes to get arithmetic intensity. Plot the point. If it falls on the sloped region, the phase is memory-bound and byte reduction is the lever. If it falls on the flat region, the phase is compute-bound and parallelism or kernel efficiency is the lever.',
        {
          type: 'code',
          language: 'python',
          text: '# Arithmetic intensity for self-attention during decode\n# Single query attending to seq_len cached keys\nd_head = 128          # head dimension\nseq_len = 4096        # cached context length\nn_heads = 32          # number of attention heads\n\n# FLOPs: QK^T dot products + softmax-weighted V sum\n# Per head: 2 * seq_len * d_head (QK) + 2 * seq_len * d_head (AV)\nflops = n_heads * (2 * seq_len * d_head + 2 * seq_len * d_head)\n\n# Bytes: read Q (1 vector), K cache, V cache (all fp16 = 2 bytes)\nbytes_q = n_heads * d_head * 2\nbytes_kv = 2 * n_heads * seq_len * d_head * 2  # K and V\ntotal_bytes = bytes_q + bytes_kv\n\narithmetic_intensity = flops / total_bytes\nprint(f"Attention AI: {arithmetic_intensity:.1f} FLOPs/byte")\n# Output: ~2.0 FLOPs/byte -- deeply memory-bound',
        },
        'The code shows why decode attention is memory-bound even with 4096 context tokens: each byte of cached KV produces only about 2 FLOPs of useful work. Compare this to prefill attention where the query matrix has seq_len rows instead of 1 -- arithmetic intensity scales linearly with the number of query positions.',
        {
          type: 'diagram',
          label: 'Roofline plot structure',
          text: 'Attainable\nPerformance\n(FLOP/s)\n    |\n    |          _______________  <-- compute ceiling (peak FLOP/s)\n    |         /\n    |        /\n    |       /   <-- memory ceiling (bandwidth * intensity)\n    |      /\n    |     /\n    |    /  * decode (low intensity, memory-bound)\n    |   /\n    |  /\n    | /                          * prefill (high intensity, compute-bound)\n    |/___________________________\n    0     Arithmetic Intensity (FLOP/byte)  -->',
        },
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The roofline works because it encodes a conservation law. Every floating-point operation requires operands. Those operands either come from registers and caches (reuse) or from main memory (transfer). If a kernel performs I FLOPs for every byte it transfers, and the memory system delivers B bytes per second, the memory can feed at most B * I FLOPs per second. Separately, the compute units cap out at P FLOPs per second regardless of data supply. The attainable rate is min(P, B * I). No amount of kernel tuning can violate this bound without changing I, B, or P.',
        'For transformers, this is not an approximation -- it is the operational reality. During decode, the model weights (~2 * num_params bytes in fp16) must be read from HBM for every forward pass. With a batch of 1, the FLOPs are 2 * num_params (one multiply-accumulate per weight). Arithmetic intensity is exactly 1 FLOP/byte. An A100 with 2 TB/s HBM bandwidth and 312 TFLOP/s peak compute hits the memory ceiling at intensity < 156. Decode at intensity ~1 uses less than 1% of available compute.',
        'Batching is the primary lever because it multiplies FLOPs (each sequence in the batch reuses the same weights) without multiplying weight-read bytes. A batch of B sequences raises decode arithmetic intensity to roughly B FLOPs/byte for the weight-read portion. But batching is constrained: each sequence in the batch carries its own KV cache, and total KV memory grows as batch_size * seq_len * n_layers * 2 * d_model * bytes_per_element. The batch size that saturates compute may exceed available memory.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The roofline itself costs nothing to compute -- it is a diagnostic model, not a runtime system. The cost is in the serving optimizations it motivates, each of which carries a tax.',
        {
          type: 'bullets',
          items: [
            'Quantization shifts decode rightward by reducing bytes per weight, but it needs calibration data, specialized kernels, and quality checks.',
            'Continuous batching raises decode arithmetic intensity through weight reuse, but it increases tail-latency risk and consumes KV cache memory.',
            'Tensor parallelism raises effective peak compute, but it adds all-reduce communication and diminishing returns at high GPU counts.',
            'KV cache quantization and PagedAttention reduce cache bytes or fragmentation, but they add accuracy and allocator complexity.',
            'Speculative decoding turns serial steps into batch-like verification, but draft-model quality controls the acceptance rate.',
            'Prefill and decode disaggregation matches each phase to hardware tuned for its roof, but KV cache transfer and scheduling become product constraints.',
          ],
        },
        'The critical insight about cost is that these optimizations interact. Quantization enables larger batches (less memory per weight), but larger batches increase KV cache pressure (more live sequences). Tensor parallelism raises compute capacity but also raises the ridge point, meaning memory bandwidth must be higher before the investment pays off. A production system must model these interactions, not just apply each optimization independently.',
        {
          type: 'note',
          text: 'KV cache memory per sequence = n_layers * 2 * n_heads * d_head * seq_len * bytes_per_element. For a 70B model (80 layers, 8 KV heads, 128 d_head) at 4096 context in fp16: 80 * 2 * 8 * 128 * 4096 * 2 = ~1.3 GB per sequence. At batch size 32, that is 42 GB of KV cache alone -- often more than the model weights after quantization.',
        },
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'The roofline model wins whenever someone says "the model is slow" without naming the phase. It forces the first diagnostic question: is this prefill-bound, decode-bound, cache-capacity-bound, or scheduler-bound? Each answer leads to a different optimization path.',
        {
          type: 'bullets',
          items: [
            'Capacity planning: given a GPU with known bandwidth and compute, predict the batch size needed to saturate compute during decode, and whether KV cache memory permits it.',
            'Hardware selection: an A100 (2 TB/s, 312 TFLOP/s) and an H100 (3.35 TB/s, 990 TFLOP/s) have different ridge points. The H100 needs higher arithmetic intensity before compute becomes the bottleneck, making batching even more important.',
            'Optimization triage: before spending weeks on a custom attention kernel, check whether the decode phase even reaches the compute ceiling. If arithmetic intensity is 2 and the ridge point is 150, attention speed is irrelevant to decode latency.',
            'Speculative decoding motivation: the roofline explains why speculative decoding helps. Draft models generate candidate tokens cheaply. Verification processes a batch of candidates in one forward pass, converting serial decode into something closer to prefill arithmetic intensity.',
          ],
        },
        'The model also wins for communicating across teams. Product managers who care about time-to-first-token need to understand that their metric is mostly prefill. Backend engineers who care about throughput need to understand that their metric is mostly decode batching. The roofline gives both groups a shared visual language for why their priorities sometimes conflict.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'The roofline is a ceiling model, not a profiler. It tells you the maximum attainable performance given perfect kernel implementation and no overhead. Real systems fall below the roofline for reasons the model does not capture: kernel launch overhead, memory allocator fragmentation, load imbalance across tensor-parallel ranks, queue scheduling policy, CPU-GPU synchronization, and network latency in distributed setups.',
        'It also assumes a single bottleneck at a time. In practice, a decode step might be simultaneously constrained by memory bandwidth (weight reads), memory capacity (KV cache), and compute (attention over long contexts). The roofline plots one point per phase, but a single phase can have sub-kernels on different roofs. FlashAttention is a good example: it restructures attention to be compute-bound by tiling through SRAM, but the surrounding linear layers in the same decode step remain memory-bound.',
        'The model says nothing about quality. A quantized model that moves rightward on the roofline may produce worse outputs. A larger batch that improves throughput may violate latency SLOs. A speculative decoding setup with high acceptance rate on benchmarks may fail on out-of-distribution inputs. The roofline narrows the hypothesis space for performance work; it does not validate that the optimized system still meets product requirements.',
        {
          type: 'bullets',
          items: [
            'Does not detect: bad scheduling policy, router bugs, cold caches, tenant isolation overhead, correctness regressions.',
            'Does not model: network roofs in distributed inference, disk/NVMe roofs for KV offloading, CPU bottlenecks in tokenization or sampling.',
            'Requires: accurate byte and FLOP counts per phase, which are hard to get for fused kernels and custom operators.',
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
            'Williams, Waterman, Patterson -- "Roofline: An Insightful Visual Performance Model for Multicore Architectures" (2009). The original paper. Read sections 2-3 for the bound derivation. https://dl.acm.org/doi/10.1145/1498765.1498785',
            'Pope et al. -- "Efficiently Scaling Transformer Inference" (2022). Applies the roofline model to transformer serving with detailed analysis of prefill vs decode phases. https://arxiv.org/abs/2211.05102',
            'JAX Scaling Book, Inference chapter -- practical roofline calculations for transformer models with code examples. https://jax-ml.github.io/scaling-book/inference/',
            'Kwon et al. -- "Efficient Memory Management for Large Language Model Serving with PagedAttention" (2023). The vLLM paper that treats KV cache as a paging problem.',
            'Leviathan, Kalman, Matias -- "Fast Inference from Transformers via Speculative Decoding" (2023). Converts serial decode into batch verification.',
          ],
        },
        'Study the transformer layer FLOPs cost model next -- you need concrete operation counts before roofline analysis is useful. Then study FlashAttention (IO-aware attention that restructures the compute-vs-memory tradeoff within a single kernel), grouped-query attention (reduces KV bytes per token), and continuous batching (raises arithmetic intensity by filling idle decode slots). Speculative decoding is the natural follow-on: it exists precisely because the roofline reveals that decode is memory-bound and verification is cheap relative to sequential generation.',
        'The test of understanding: given a model size, hardware spec, and target latency, you should be able to calculate the minimum batch size for compute saturation, the KV cache memory at that batch size, and whether the system is memory-capacity-bound before it is bandwidth-bound. If you can do that arithmetic on a napkin, you have internalized the roofline.',
      ],
    },
  ],
};
