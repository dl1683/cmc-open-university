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
  const cacheNodes = ['prefill', 'k', 'v', 'pack'];
  yield {
    state: cachePathGraph('Compress the long-lived KV cache, not just weights'),
    highlight: { active: ['prefill', 'k', 'v', 'pack', 'e-prefill-k', 'e-prefill-v'], found: ['batch'] },
    explanation: `Long-context inference turns KV cache into the concurrency budget. Weight quantization helps model size, but every live sequence still stores ${cacheNodes.length} distinct cache stages (${cacheNodes.join(' → ')}) for every layer and token.`,
  };

  const kiviRows = [
    { id: 'key', label: 'keys' },
    { id: 'value', label: 'values' },
    { id: 'outlier', label: 'outliers' },
    { id: 'kernel', label: 'kernel' },
  ];
  const kiviColumns = [
    { id: 'group', label: 'group by' },
    { id: 'reason', label: 'reason' },
  ];
  yield {
    state: labelMatrix(
      'KIVI grouping rule',
      kiviRows,
      kiviColumns,
      [
        ['channel', 'channel outliers'],
        ['token', 'token locality'],
        ['isolate', 'range control'],
        ['fused read', 'avoid overhead'],
      ],
    ),
    highlight: { active: ['key:group', 'value:group'], compare: ['outlier:reason'], found: ['kernel:reason'] },
    explanation: `KIVI reports that ${kiviRows[0].label} and ${kiviRows[1].label} caches have different distributions. Keys benefit from per-${kiviColumns[0].label.replace('group by', 'channel')} quantization; values benefit from per-token quantization. A one-size grouping rule across ${kiviRows.length} concerns wastes accuracy.`,
    invariant: `Compressing KV cache changes the attention inputs, so ${kiviColumns.map(c => c.label).join(' and ')} decisions are correctness-critical.`,
  };

  yield {
    state: cachePathGraph('Decode becomes a bandwidth and dequantization problem'),
    highlight: { active: ['pack', 'decode', 'e-pack-decode'], compare: ['k', 'v'], found: ['batch'] },
    explanation: `The decode loop repeatedly reads cached keys and values. Smaller cache entries reduce memory traffic and allow more concurrent requests, but dequantization across ${cacheNodes.length} stages must be cheap enough to preserve the win.`,
  };

  const measureRows = [
    { id: 'quality', label: 'quality' },
    { id: 'memory', label: 'memory' },
    { id: 'speed', label: 'speed' },
    { id: 'tails', label: 'tails' },
  ];
  yield {
    state: labelMatrix(
      'What must be measured',
      measureRows,
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
    explanation: `A good KV-compression result reports ${measureRows.map(r => r.label).join(', ')} together. Saving bytes is not enough if dequantization or cache loading shifts the bottleneck among those ${measureRows.length} dimensions.`,
  };
}

function* compressionTradeoffs() {
  const bitRange = { min: 2, max: 16 };
  const seriesCount = 2;
  yield {
    state: plotState({
      axes: { x: { label: 'bits per value', min: bitRange.min, max: bitRange.max }, y: { label: 'relative KV bytes', min: 0, max: 1.0 } },
      series: [
        { id: 'bytes', label: 'cache bytes', points: [{ x: 16, y: 1.0 }, { x: 8, y: 0.50 }, { x: 4, y: 0.25 }, { x: 3, y: 0.19 }, { x: 2, y: 0.13 }] },
        { id: 'risk', label: 'quality risk', points: [{ x: 16, y: 0.04 }, { x: 8, y: 0.08 }, { x: 4, y: 0.18 }, { x: 3, y: 0.31 }, { x: 2, y: 0.48 }] },
      ],
    }),
    highlight: { active: ['bytes'], compare: ['risk'] },
    explanation: `Lower precision shrinks cache bytes roughly linearly from ${bitRange.max} bits down to ${bitRange.min}, but quality risk is not linear. The ${seriesCount} curves diverge because low-bit KV cache needs distribution-aware grouping, outlier handling, and kernels that do not erase the bandwidth win.`,
  };

  const approaches = [
    { id: 'kivi', label: 'KIVI' },
    { id: 'kvquant', label: 'KVQuant' },
    { id: 'cachegen', label: 'CacheGen' },
    { id: 'flexgen', label: 'FlexGen' },
  ];
  yield {
    state: labelMatrix(
      'Representative approaches',
      approaches,
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
    explanation: `The family of ${approaches.length} approaches (${approaches.map(a => a.label).join(', ')}) is broader than one trick. Some methods quantize tensors kept near the GPU. CacheGen compresses KV cache for loading and streaming. FlexGen combines compression with offloading for throughput-oriented inference.`,
  };

  const composesWith = ['PagedAttention', 'disaggregation'];
  yield {
    state: cachePathGraph('Compression composes with PagedAttention and disaggregation'),
    highlight: { active: ['pack', 'decode', 'batch'], found: ['k', 'v'], compare: ['prefill'] },
    explanation: `Compression composes with ${composesWith.join(' and ')}. ${composesWith[0]} manages where cache blocks live. Prefill/decode ${composesWith[1]} decides where phases run. KV quantization changes how many bytes each cache block costs.`,
  };

  const skipRows = [
    { id: 'short', label: 'short context' },
    { id: 'small', label: 'small model' },
    { id: 'fragile', label: 'fragile task' },
    { id: 'unsupported', label: 'no kernel' },
  ];
  yield {
    state: labelMatrix(
      'When not to use it',
      skipRows,
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
    explanation: `KV compression is most attractive when context length and concurrency make cache bytes the bottleneck. There are ${skipRows.length} situations to watch — ${skipRows.map(r => r.label).join(', ')} — where the simpler path may win.`,
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
    { heading: 'How to read the animation', paragraphs: [
        'The cache-path view shows where compression sits: prefill builds K and V, packing shrinks them, and decode repeatedly reads the packed cache. Active nodes show the current stage, and compare markers show the uncompressed cache that would otherwise be read.',
        {type: 'image', src: './assets/gifs/kv-cache-quantization-compression.gif', alt: 'Animated walkthrough of the kv cache quantization compression visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
        'The tradeoff view reads bits as behavior. Lower bit width saves memory and bandwidth, but the risk curve rises because quantization error changes attention scores and value mixtures.',
      ], },
    { heading: 'Why this exists', paragraphs: [
        'KV-cache compression exists because long-context inference can be limited by request state rather than model weights. Every live sequence stores keys and values at every layer, and decode reads that history for each new token.',
        {
          type: 'callout',
          text: 'KV compression is correct only when smaller cache entries preserve the attention evidence the decoder will reuse.',
        },
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8f/The-Transformer-model-architecture.png/250px-The-Transformer-model-architecture.png',
          alt: 'Transformer architecture diagram showing attention and feed-forward layers',
          caption: 'KV compression targets the cached key and value tensors produced by the attention layers, not the whole model graph. Source: Wikimedia Commons, from Vaswani et al. 2017.',
        },
        'Weight quantization shrinks the model, but it does not shrink the private cache created by each user. KV compression asks whether that generated state can use fewer bytes without changing the answer enough to matter.',
      ], },
    { heading: 'The obvious approach', paragraphs: [
        'The obvious approach is to store every cached value in fp16 or bf16 exactly as the attention kernel produced it. This is simple, accurate, and well supported by GPU kernels.',
        'A second obvious approach is to quantize every KV tensor with one generic low-bit rule. That saves bytes on paper, but it ignores how keys, values, heads, tokens, and outliers behave differently.',
      ], },
    { heading: 'The wall', paragraphs: [
        'KV cache lives on the decode hot path. If compression requires unpacking a large block into fp16 memory before attention, the system may give back the bandwidth win as dequantization overhead.',
        'Quality is the other wall. Errors in keys change dot-product scores and therefore softmax weights; errors in values change the information returned after attention chooses what to read.',
      ], },
    { heading: 'The core insight', paragraphs: [
        'KV cache is its own data distribution, not just weights in another place. Keys may have channel outliers, values may group better by token, and long-context workloads punish small errors differently from short chat.',
        'The useful compression rule is representation plus kernel plus workload validation. A lower bit count is not a result unless the decode path and quality metrics still win end to end.',
      ], },
    { heading: 'How it works', paragraphs: [
        'During prefill, the runtime produces K and V tensors, chooses a grouping rule, stores packed low-bit values, and records metadata such as scales, zero points, codebooks, or outlier buffers. During decode, the attention kernel reads packed blocks and reconstructs enough numeric information to compute scores and weighted values.',
        'Systems differ in where they spend the complexity. KIVI uses asymmetric grouping for keys and values, KVQuant uses low-bit formats with outlier handling, CacheGen compresses cache for transfer, and FlexGen combines compression with offload.',
      ], },
    { heading: 'Why it works', paragraphs: [
        'It works when the bottleneck is cache capacity or memory bandwidth and the compressed representation preserves attention evidence. Smaller blocks let more requests stay resident and reduce the bytes read per decode token.',
        'Correctness is empirical rather than exact. The compressed cache is an approximation, so the argument must be measured on perplexity, task accuracy, retrieval fidelity, throughput, and tail latency for the workload that will run in production.',
      ], },
    { heading: 'Cost and complexity', paragraphs: [
        'Going from 16-bit to 8-bit halves raw KV bytes; going to 4-bit quarters them; going to 2-bit gives one eighth. The behavior is not linear because metadata, outlier paths, and dequantization work remain.',
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/62/AMD%4028nm%40GCN_3th_gen%40Fiji%40Radeon_R9_Nano%40SPMRC_REA0356A-1539_215-0862120_DSC04466_%2829461603171%29.jpg/330px-AMD%4028nm%40GCN_3th_gen%40Fiji%40Radeon_R9_Nano%40SPMRC_REA0356A-1539_215-0862120_DSC04466_%2829461603171%29.jpg',
          alt: 'GPU package with high-bandwidth memory stacks near the processor',
          caption: 'KV compression pays off only if it reduces traffic to the scarce HBM tier without moving the bottleneck into unpacking work. Source: Wikimedia Commons, File:AMD at 28nm GCN Fiji Radeon R9 Nano photo.',
        },
        'The cost also includes calibration, fallback formats, kernel support, observability, and rollback. A 4-bit cache that improves average throughput but hurts p99 latency or code-generation accuracy may be the wrong product choice.',
      ], },
    { heading: 'Real-world uses', paragraphs: [
        'KV compression is useful in long-context chat, agent traces, retrieval-heavy workflows, and high-concurrency serving pools where cache memory limits batch size. It is also useful when cache must move across machines in disaggregated serving.',
        'It composes with PagedAttention, prefix caching, offload, and GQA. Compression shrinks each block, while those other systems decide where blocks live, when they are shared, and when they are evicted.',
      ], },
    { heading: 'Where it fails', paragraphs: [
        'It fails when the KV cache is not the bottleneck. Short prompts, small models, low concurrency, or weight-dominated memory footprints may get little benefit while still paying kernel and validation complexity.',
        'It is risky for tasks that depend on exact long-range copying, legal or medical retrieval, code completion, and adversarial prompts unless workload-specific tests show the compressed cache preserves the needed detail.',
      ], },
    { heading: 'Worked example', paragraphs: [
        'A request with 80 layers, 8 KV heads, head dimension 128, 16,384 tokens, and fp16 cache needs 2 x 80 x 16,384 x 8 x 128 x 2 = 5.37 GB. At 8-bit, raw values drop to 2.68 GB; at 4-bit, they drop to 1.34 GB before metadata.',
        'If a 70 GiB cache budget reserves 10 GiB for safety, fp16 fits about 11 such requests. Four-bit KV could fit about 44 requests if kernels and quality held, which is why the technique is attractive.',
        'Now price the tax. If dequantization adds 8 percent per-token latency and quality drops on long-code tasks, the 4x capacity win may be right for chat but wrong for code agents.',
      ], },
    { heading: 'Sources and study next', paragraphs: [
        'Sources: KIVI, KVQuant, CacheGen, FlexGen, PagedAttention, Multi-Query Attention, and Grouped-Query Attention. Read these as systems papers, not only quantization papers, because the kernel and scheduler decide whether bytes become throughput.',
        'Study KV Cache, Quantization, transformer inference roofline, PagedAttention, prefix caching, and KV offload next. Ask whether a smaller cache entry lowers the real bottleneck without changing model behavior beyond the task budget.',
      ], },
  ],
};
