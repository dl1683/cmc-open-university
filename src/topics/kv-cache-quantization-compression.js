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
      heading: 'What it is',
      paragraphs: [
        'KV-cache quantization and compression reduce the memory footprint of the keys and values stored during autoregressive transformer inference. Every generated token must attend to prior tokens, so the server keeps a KV Cache for every live sequence. As context windows and batch sizes grow, those cached tensors can become the dominant memory and bandwidth bottleneck.',
        'This topic is different from ordinary weight Quantization. Weight quantization compresses the model parameters. KV-cache quantization compresses activations produced by each request. That makes it workload-dependent: short requests may barely care, while long-context agents, RAG products, and chat sessions with many concurrent users can hit the KV memory wall quickly.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The server builds KV cache during prefill, then repeatedly reads it during decode. A compression method stores lower-bit representations plus whatever scales, codebooks, outlier values, or bitstreams are needed to reconstruct useful attention inputs. The runtime then dequantizes or decodes the cache in the attention path, ideally with kernels that keep overhead below the memory-bandwidth savings.',
        'KIVI is a clear example because it makes an asymmetric observation: key caches and value caches have different distribution shapes. The paper argues keys should be quantized per channel, while values should be quantized per token, then uses a tuning-free 2-bit scheme: https://arxiv.org/abs/2402.02750. KVQuant pushes the same design space with pre-RoPE key quantization, non-uniform datatypes, and dense-plus-sparse handling for outliers: https://arxiv.org/abs/2401.18079.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The upside is direct: fewer bytes per live token can raise batch size, reduce memory traffic, reduce eviction, and make long-context serving possible on smaller hardware. The downside is also direct: every compressed value must be reconstructed or consumed by a specialized kernel. If dequantization is slow, if scales add too much overhead, or if low-bit error damages attention, the apparent memory win becomes a quality or latency loss.',
        'CacheGen shows another angle. It compresses and streams reusable KV cache so context loading over the network is faster: https://arxiv.org/abs/2310.07240. FlexGen combines 4-bit weight and KV-cache compression with CPU/GPU/disk offloading for throughput-oriented inference on limited hardware: https://arxiv.org/abs/2303.06865. KV Cache Tiered Offload Store Case Study separates the related but different policy question: when should a cache block stay in HBM, move to CPU memory, spill to local SSD, or be served from a remote KV store? These systems make the same larger point: KV cache is now a storage, network, kernel, and scheduler problem.',
      ],
    },
    {
      heading: 'Real-world case study',
      paragraphs: [
        'A long-context customer-support assistant may receive a 100-page policy manual, maintain a multi-turn session, and answer many follow-up questions. Without reuse or compression, prefill creates a large KV cache and decode repeatedly reads it. PagedAttention can reduce fragmentation, Prefix Caching & RadixAttention can avoid recomputing shared prefixes, KV-cache compression can reduce the bytes that must remain resident or move across the serving stack, and tiered offload can keep cold-but-reusable blocks from turning into full recompute misses.',
        'The practical decision should be measured by workload slice. For a short FAQ bot, Semantic Cache for LLMs may skip the model call entirely and matter more than KV compression. For a long-context agent with unique prompts but repeated state, KV-cache compression may be the more relevant lever.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'Do not assume lower bits always mean faster inference. The attention kernel still needs usable keys and values, and the runtime may pay scale loads, unpacking, outlier paths, and extra memory movement. Do not evaluate only perplexity on short sequences if the production workload is long-context retrieval, code generation, or tool-heavy agents. Do not ignore tail latency: loading or decompressing a cache at the wrong time can damage time to first token.',
        'Do not mix up cache compression with cache eviction. Compression makes each resident cache entry cheaper. Eviction decides which entries remain resident. A good server usually needs both, plus observability for cache hit rate, bytes per token, quality drift, and p95/p99 latency.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: KIVI at https://arxiv.org/abs/2402.02750 and https://github.com/jy-yuan/KIVI, KVQuant at https://arxiv.org/abs/2401.18079 and https://github.com/squeezeailab/kvquant, CacheGen at https://arxiv.org/abs/2310.07240 and https://dl.acm.org/doi/10.1145/3651890.3672274, and FlexGen at https://arxiv.org/abs/2303.06865. Study KV Cache, Quantization, Transformer Inference Roofline, LLM Serving: PagedAttention, Prefix Caching & RadixAttention, Prefill/Decode Disaggregation Case Study, KV Cache Tiered Offload Store Case Study, DeepSeek Multi-Head Latent Attention, and LLM Inference Cost Stack next.',
      ],
    },
  ],
};
