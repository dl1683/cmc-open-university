// KV-cache quantization and compression: reduce long-context decode memory by
// compressing cached keys and values without breaking attention quality.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'kv-cache-quantization-compression',
  title: 'KV Cache Quantization & Compression',
  category: 'Systems',
  summary: 'How KIVI, KVQuant, CacheGen, and FlexGen attack the KV-cache memory wall in long-context LLM inference.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['quantized cache path', 'compression tradeoffs'], defaultValue: 'quantized cache path' },
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

function cachePathGraph(title) {
  return graphState({
    nodes: [
      { id: 'prompt', label: 'prompt', x: 0.8, y: 3.4, note: 'tokens' },
      { id: 'prefill', label: 'prefill', x: 2.2, y: 3.4, note: 'build KV' },
      { id: 'k', label: 'K cache', x: 3.8, y: 4.35, note: 'channels' },
      { id: 'v', label: 'V cache', x: 3.8, y: 2.45, note: 'tokens' },
      { id: 'pack', label: 'pack', x: 5.5, y: 3.4, note: '2-4 bit' },
      { id: 'decode', label: 'decode', x: 7.2, y: 3.4, note: 'read cache' },
      { id: 'batch', label: 'batch+', x: 8.8, y: 3.4, note: 'more users' },
    ],
    edges: [
      { id: 'e-prompt-prefill', from: 'prompt', to: 'prefill' },
      { id: 'e-prefill-k', from: 'prefill', to: 'k' },
      { id: 'e-prefill-v', from: 'prefill', to: 'v' },
      { id: 'e-k-pack', from: 'k', to: 'pack' },
      { id: 'e-v-pack', from: 'v', to: 'pack' },
      { id: 'e-pack-decode', from: 'pack', to: 'decode' },
      { id: 'e-decode-batch', from: 'decode', to: 'batch' },
    ],
  }, { title });
}

function* quantizedCachePath() {
  yield {
    state: cachePathGraph('Compress the long-lived KV cache, not just weights'),
    highlight: { active: ['prefill', 'k', 'v', 'pack', 'e-prefill-k', 'e-prefill-v'], found: ['batch'] },
    explanation: 'Long-context inference turns KV cache into the concurrency budget. Weight quantization helps model size, but every live sequence still stores keys and values for every layer and token.',
  };

  yield {
    state: labelMatrix(
      'KIVI grouping rule',
      [
        { id: 'key', label: 'keys' },
        { id: 'value', label: 'values' },
        { id: 'outlier', label: 'outliers' },
        { id: 'kernel', label: 'kernel' },
      ],
      [
        { id: 'group', label: 'group by' },
        { id: 'reason', label: 'reason' },
      ],
      [
        ['channel', 'channel outliers'],
        ['token', 'token locality'],
        ['isolate', 'range control'],
        ['fused read', 'avoid overhead'],
      ],
    ),
    highlight: { active: ['key:group', 'value:group'], compare: ['outlier:reason'], found: ['kernel:reason'] },
    explanation: 'KIVI reports that key and value caches have different distributions. Keys benefit from per-channel quantization; values benefit from per-token quantization. A one-size grouping rule wastes accuracy.',
    invariant: 'Compressing KV cache changes the attention inputs, so grouping and kernels are correctness-critical.',
  };

  yield {
    state: cachePathGraph('Decode becomes a bandwidth and dequantization problem'),
    highlight: { active: ['pack', 'decode', 'e-pack-decode'], compare: ['k', 'v'], found: ['batch'] },
    explanation: 'The decode loop repeatedly reads cached keys and values. Smaller cache entries reduce memory traffic and allow more concurrent requests, but dequantization must be cheap enough to preserve the win.',
  };

  yield {
    state: labelMatrix(
      'What must be measured',
      [
        { id: 'quality', label: 'quality' },
        { id: 'memory', label: 'memory' },
        { id: 'speed', label: 'speed' },
        { id: 'tails', label: 'tails' },
      ],
      [
        { id: 'metric', label: 'metric' },
        { id: 'failure', label: 'failure' },
      ],
      [
        ['perplexity and tasks', 'silent drift'],
        ['GB per live token', 'OOM or eviction'],
        ['tokens per second', 'dequant tax'],
        ['p95/p99 TTFT', 'reload stalls'],
      ],
    ),
    highlight: { active: ['quality:metric', 'memory:metric', 'speed:metric'], found: ['tails:metric'] },
    explanation: 'A good KV-compression result reports quality, memory, throughput, and tail latency together. Saving bytes is not enough if dequantization or cache loading shifts the bottleneck elsewhere.',
  };
}

function* compressionTradeoffs() {
  yield {
    state: plotState({
      axes: { x: { label: 'bits per value', min: 2, max: 16 }, y: { label: 'relative KV bytes', min: 0, max: 1.0 } },
      series: [
        { id: 'bytes', label: 'cache bytes', points: [{ x: 16, y: 1.0 }, { x: 8, y: 0.50 }, { x: 4, y: 0.25 }, { x: 3, y: 0.19 }, { x: 2, y: 0.13 }] },
        { id: 'risk', label: 'quality risk', points: [{ x: 16, y: 0.04 }, { x: 8, y: 0.08 }, { x: 4, y: 0.18 }, { x: 3, y: 0.31 }, { x: 2, y: 0.48 }] },
      ],
    }),
    highlight: { active: ['bytes'], compare: ['risk'] },
    explanation: 'Lower precision shrinks cache bytes roughly linearly, but quality risk is not linear. Low-bit KV cache needs distribution-aware grouping, outlier handling, and kernels that do not erase the bandwidth win.',
  };

  yield {
    state: labelMatrix(
      'Representative approaches',
      [
        { id: 'kivi', label: 'KIVI' },
        { id: 'kvquant', label: 'KVQuant' },
        { id: 'cachegen', label: 'CacheGen' },
        { id: 'flexgen', label: 'FlexGen' },
      ],
      [
        { id: 'move', label: 'main move' },
        { id: 'target', label: 'target' },
      ],
      [
        ['2-bit asymmetric KV', 'batch and HBM'],
        ['low-bit plus outliers', 'long context'],
        ['encode and stream KV', 'network load'],
        ['4-bit cache offload', 'limited GPU'],
      ],
    ),
    highlight: { active: ['kivi:move', 'kvquant:move', 'cachegen:move'], compare: ['flexgen:target'] },
    explanation: 'The family is broader than one trick. Some methods quantize tensors kept near the GPU. CacheGen compresses KV cache for loading and streaming. FlexGen combines compression with offloading for throughput-oriented inference.',
  };

  yield {
    state: cachePathGraph('Compression composes with PagedAttention and disaggregation'),
    highlight: { active: ['pack', 'decode', 'batch'], found: ['k', 'v'], compare: ['prefill'] },
    explanation: 'PagedAttention manages where cache blocks live. Prefill/decode disaggregation decides where phases run. KV quantization and compression change how many bytes each cache block costs.',
  };

  yield {
    state: labelMatrix(
      'When not to use it',
      [
        { id: 'short', label: 'short context' },
        { id: 'small', label: 'small model' },
        { id: 'fragile', label: 'fragile task' },
        { id: 'unsupported', label: 'no kernel' },
      ],
      [
        { id: 'why', label: 'why' },
        { id: 'fallback', label: 'fallback' },
      ],
      [
        ['little KV pressure', 'plain fp16'],
        ['weights dominate', 'weight quant'],
        ['accuracy sensitive', 'higher bits'],
        ['dequant overhead', 'runtime support'],
      ],
    ),
    highlight: { removed: ['fragile:why', 'unsupported:why'], active: ['short:fallback', 'small:fallback'] },
    explanation: 'KV compression is most attractive when context length and concurrency make cache bytes the bottleneck. If the workload is short, accuracy-critical, or lacks efficient kernels, the simpler path may win.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'quantized cache path') yield* quantizedCachePath();
  else if (view === 'compression tradeoffs') yield* compressionTradeoffs();
  else throw new InputError('Pick a KV-cache compression view.');
}

export const article = {
  sections: [
    {
      heading: 'Why KV Compression Exists',
      paragraphs: [
        `KV-cache quantization and compression exist because modern LLM serving is often limited less by model weights than by live request state. During prefill, a decoder-only Transformer computes keys and values for every prompt token at every layer. During decode, each new token reads the accumulated keys and values so attention can compare the current query against the past. That cache grows with context length, batch size, layer count, head count, and head dimension.`,
        `Weight quantization helps store the model more cheaply, but it does not remove the fact that each active user creates a private KV cache. A 70B model with long prompts may run out of HBM or memory bandwidth because thousands of old token vectors must remain accessible. Even when HBM capacity is sufficient, decode can become a bandwidth problem: the server reads old K and V entries repeatedly while doing relatively little compute for one new token.`,
        `KV compression is therefore a serving-system idea, not just a numerical trick. It asks how many bytes of request-generated state are really needed to preserve attention quality, and whether the runtime can exploit smaller cache entries without spending the savings on unpacking, scale loads, network transfers, or cache misses.`,
      ],
    },
    {
      heading: 'The Naive Wall',
      paragraphs: [
        `The naive answer is to quantize everything to fewer bits and assume the system gets faster. That fails for two reasons. First, the KV cache is not a passive file on disk. It sits on the critical attention path, so every decode step must either consume compressed values directly or dequantize them cheaply enough that memory savings dominate the extra work. Second, quality can move silently. Small numeric errors in keys alter attention scores; errors in values alter what information attention returns.`,
        `Another naive answer is to use one grouping rule for all cached tensors. That ignores the actual distributions. Keys and values do not necessarily have the same outlier structure, and the best granularity for one may be poor for the other. Low-bit quantization also magnifies scale-selection mistakes. A group that contains one large outlier can waste the range of many ordinary values, while a group that is too small can add too much metadata and kernel overhead.`,
        `A third wall is evaluation. Short perplexity tests may not expose failures in long-context retrieval, code completion, tool traces, or agent memory. KV compression changes the stored evidence attention reads from. It must be judged as part of the serving path, with quality, memory, throughput, time to first token, time per output token, and tail latency reported together.`,
      ],
    },
    {
      heading: 'Core Insight',
      paragraphs: [
        `The core insight is that KV cache is generated state with its own statistics. It is not identical to weights, activations, or logits. The cache is long-lived, read many times, and shaped by attention heads. Compressing it well means respecting where the distribution has outliers, where values are smooth, and where small errors are amplified by softmax attention.`,
        `KIVI is the clean example. It observes that key cache and value cache benefit from different grouping choices. Keys can have channel-wise outlier structure, so per-channel quantization protects important dimensions. Values can be more naturally grouped per token. The resulting asymmetric design is not a cosmetic detail; it is the difference between low-bit KV that preserves accuracy and low-bit KV that corrupts attention.`,
        `KVQuant pushes the same principle further with choices such as pre-RoPE key quantization, non-uniform datatypes, and dense-plus-sparse outlier handling. CacheGen attacks a different bottleneck by compressing KV for transfer and reuse across machines or requests. FlexGen combines compression with offloading across GPU, CPU, and disk. These systems differ, but they share the same lesson: the cache must be optimized as a first-class data structure.`,
      ],
    },
    {
      heading: 'Mechanism',
      paragraphs: [
        `A typical runtime builds the cache during prefill, then stores a compressed representation for future decode steps. That representation may include low-bit packed values, per-group scales and zero points, codebooks, outlier side buffers, or a compressed stream for network loading. During decode, the attention kernel reads the cache block, reconstructs enough numeric information, computes scores and weighted values, and writes the new token's K and V into the cache.`,
        `The fastest designs avoid treating compression as a separate preprocessing stage. If a kernel has to decode a whole cache block into fp16 memory before attention, it may give back much of the memory win. Fused kernels try to load packed entries, apply scales, handle outliers, and feed attention with minimal extra traffic. That is why runtime support is part of the algorithm. A compression paper without a realistic decode kernel is only half a serving result.`,
        `Compression also interacts with cache layout. PagedAttention stores KV in blocks so the runtime can manage many variable-length requests without contiguous allocation. Prefix caching reuses exact cache blocks for shared prompts. Disaggregated serving may move prefills and decodes across machines. Quantization changes the byte size of each block; stream compression changes the cost of moving it; offload systems change which tier owns it.`,
      ],
    },
    {
      heading: 'What The Visual Proves',
      paragraphs: [
        `The cache-path graph locates the intervention precisely. Prefill builds K and V. Compression sits between cache construction and the decode loop that repeatedly reads the cache. The win is not that attention stops needing history; the win is that each unit of history costs fewer bytes and less bandwidth if the representation and kernel are well matched.`,
        `The KIVI grouping table proves that low-bit KV is distribution-aware. Keys and values are not interchangeable arrays. If keys carry channel outliers, per-token grouping can waste precision; if values are better grouped per token, per-channel grouping can be the wrong abstraction. The visual turns a vague phrase like "quantize the cache" into a concrete layout decision.`,
        `The bits-versus-risk plot shows why this is an engineering curve rather than a free lunch. Sixteen to eight bits is often easier than four to two. At very low bit widths, each saved byte buys more quality risk and more metadata sensitivity. The representative-approaches table then separates three use cases: resident low-bit KV in HBM, compressed KV transfer over a network, and compression used together with offload to slower memory.`,
      ],
    },
    {
      heading: 'Why It Works',
      paragraphs: [
        `It works when the serving bottleneck is cache bytes or cache bandwidth and the compressed representation preserves the attention information that matters. In long-context decode, every generated token may read a large fraction of the previous context. Cutting cache bytes can increase the number of live sequences in HBM, reduce paging and offload pressure, improve batching, and reduce memory traffic per token.`,
        `It can also make other optimizations more effective. A paged cache with smaller blocks wastes less HBM per request. A tiered offload store can move more history through the same PCIe or network budget. Prefix-cache reuse becomes cheaper to store and transfer. Disaggregated serving can hand off context with less network load. The cache is a shared currency across the inference system, so reducing its byte cost affects scheduling, placement, and latency.`,
      ],
    },
    {
      heading: 'Costs And Tradeoffs',
      paragraphs: [
        `The obvious cost is accuracy. Attention is sensitive to relative scores, and low-bit keys can change which tokens receive probability mass. Low-bit values can distort the information returned after attention selects a token. Outlier handling, grouping, and calibration reduce this risk, but they do not erase it. The lower the bit width, the more workload-specific validation matters.`,
        `The second cost is overhead. Packed formats need metadata. Dequantization needs arithmetic. Outlier paths can branch or require extra loads. If the runtime reads compressed bytes and then performs enough extra work to become compute-limited, the wall has only moved. This is why papers and production systems should report end-to-end tokens per second and tail latency, not only theoretical memory reduction.`,
        `Compression is also not eviction. Compression makes a resident entry cheaper. Eviction decides which entries remain available at all. A long-context server may need compression, paging, prefix reuse, eviction policy, and offload. Confusing those layers leads to brittle designs: a compressed cache can still OOM, and an eviction system can still be too slow if each block is too large.`,
      ],
    },
    {
      heading: 'Uses And Failure Modes',
      paragraphs: [
        `KV compression is most useful for long prompts, large batches, many simultaneous users, retrieval-heavy agents, and serving stacks where HBM capacity or bandwidth limits throughput. It is less compelling for short prompts, tiny models, one-off offline generation, or cases where weights dominate memory and the KV cache is small. It is risky for tasks that demand exact long-range copying unless validation shows the compressed cache preserves the needed detail.`,
        `Operational failures are subtle. A server may improve average throughput while damaging p99 latency because dequantization creates stalls. A low-bit format may pass generic language benchmarks and fail code completion. A compression level may be acceptable for chat but not for legal retrieval or medical summarization. The practical policy is to make cache format observable: bytes per token, bit width, group size, outlier rate, fallback format, cache hit rate, and quality metrics should be visible by workload.`,
      ],
    },
    {
      heading: 'Study Next',
      paragraphs: [
        `Study KV Cache and Quantization before this topic. Then connect it to Transformer Inference Roofline, LLM Serving: PagedAttention, Prefix Caching and RadixAttention, Prefill/Decode Disaggregation Case Study, KV Cache Transfer Fabric Case Study, KV Cache Tiered Offload Store Case Study, DeepSeek Multi-Head Latent Attention, and LLM Inference Cost Stack. Primary systems to compare include KIVI, KVQuant, CacheGen, and FlexGen. The enduring question is how much exact token history a workload really needs, and what byte format lets the server keep that history without wasting the machine.`,
      ],
    },
  ],
};
