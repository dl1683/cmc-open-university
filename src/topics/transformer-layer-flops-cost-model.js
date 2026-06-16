// Transformer layer FLOPs cost model: split the dense per-token work from
// the pairwise attention work so long-context tradeoffs are visible.

import { matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'transformer-layer-flops-cost-model',
  title: 'Transformer Layer FLOPs Cost Model',
  category: 'AI & ML',
  summary: 'A decoder-layer cost primer: why dense projections scale like n d^2, attention scales like n^2 d, and long context changes the bottleneck.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['term breakdown', 'context crossover'], defaultValue: 'term breakdown' },
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

function costPlot(markers = []) {
  const d = 4096;
  const tokenCounts = [512, 1024, 2048, 4096, 8192, 16384, 24576, 32768, 65536];
  const dense = tokenCounts.map((n) => ({ x: n, y: (24 * n * d * d) / 1e12 }));
  const attention = tokenCounts.map((n) => ({ x: n, y: (4 * n * n * d) / 1e12 }));
  return plotState({
    axes: {
      x: { label: 'context tokens n', min: 0, max: 68000 },
      y: { label: 'relative TFLOPs per layer', min: 0, max: 75 },
    },
    series: [
      { id: 'dense', label: 'dense terms: 24 n d^2', points: dense },
      { id: 'attention', label: 'attention terms: 4 n^2 d', points: attention },
    ],
    markers,
  });
}

function* termBreakdown() {
  yield {
    state: labelMatrix(
      'Decoder layer forward-pass terms',
      [
        { id: 'qkv', label: 'QKV' },
        { id: 'out', label: 'O proj' },
        { id: 'mlp', label: 'MLP' },
        { id: 'scores', label: 'QK' },
        { id: 'mix', label: 'AV' },
      ],
      [
        { id: 'shape', label: 'shape' },
        { id: 'term', label: 'cost term' },
        { id: 'scales', label: 'axis' },
      ],
      [
        ['tok x d', '6 n d^2', 'n,d'],
        ['tok x d', '2 n d^2', 'n,d'],
        ['4d MLP', '16 n d^2', 'n,d'],
        ['pairs', '2 n^2 d', 'n^2'],
        ['pairs', '2 n^2 d', 'n^2'],
      ],
    ),
    highlight: { active: ['qkv:term', 'out:term', 'mlp:term'], compare: ['scores:term', 'mix:term'] },
    explanation: 'The useful split is dense work versus pairwise work. Projections and the MLP scale with n d^2. Attention scores and value mixing scale with n^2 d.',
    invariant: 'A rough decoder-layer estimate is 24 n d^2 + 4 n^2 d.',
  };

  yield {
    state: labelMatrix(
      'Which optimization touches which term',
      [
        { id: 'flash', label: 'Flash' },
        { id: 'gqa', label: 'GQA/MQA' },
        { id: 'window', label: 'window' },
        { id: 'moe', label: 'MoE FFN' },
        { id: 'quant', label: 'quantization' },
      ],
      [
        { id: 'main', label: 'target' },
        { id: 'effect', label: 'effect' },
      ],
      [
        ['attn IO', 'fewer trips'],
        ['KV heads', 'less cache'],
        ['pairs', 'n^2 to n w'],
        ['MLP', 'fewer FFNs'],
        ['bytes', 'higher AI'],
      ],
    ),
    highlight: { active: ['flash:main', 'window:effect'], found: ['gqa:effect', 'moe:effect', 'quant:effect'] },
    explanation: 'Different tricks attack different terms. A clean cost model prevents category errors: FlashAttention improves attention IO, while grouped-query attention mainly reduces KV cache traffic during decode.',
  };

  yield {
    state: labelMatrix(
      'Training, prefill, and cached decode use different accounting',
      [
        { id: 'train', label: 'training' },
        { id: 'prefill', label: 'prefill' },
        { id: 'decode', label: 'decode' },
        { id: 'long', label: 'long ctx' },
      ],
      [
        { id: 'parallelism', label: 'shape' },
        { id: 'dominant', label: 'question' },
      ],
      [
        ['all tokens', 'acts + FLOPs'],
        ['prompt', 'TTFT'],
        ['one token', 'bytes moved'],
        ['many old', 'KV capacity'],
      ],
    ),
    highlight: { active: ['prefill:dominant', 'decode:dominant'], compare: ['train:dominant', 'long:dominant'] },
    explanation: 'The same transformer block changes character by phase. A formula for prompt FLOPs is not enough to explain decode latency, because cached decode is often limited by bytes moved.',
  };
}

function* contextCrossover() {
  yield {
    state: costPlot([
      { id: 'short', x: 4096, y: 1.7, label: '4k prompt' },
      { id: 'cross', x: 24576, y: 9.9, label: 'n = 6d' },
    ]),
    highlight: { active: ['dense'], compare: ['attention'], found: ['short', 'cross'] },
    explanation: 'With d fixed at 4096, dense terms dominate typical short contexts. The attention curve catches up near n = 6d because n^2 d eventually beats n d^2.',
  };

  yield {
    state: costPlot([
      { id: 'rag', x: 8192, y: 3.3, label: 'RAG prompt' },
      { id: 'agent', x: 32768, y: 17.6, label: 'agent trace' },
      { id: 'book', x: 65536, y: 70.4, label: 'book context' },
    ]),
    highlight: { active: ['attention'], compare: ['dense'], found: ['agent', 'book'] },
    explanation: 'Long context makes attention visible in the bill. Past a threshold, adding tokens is not just more input; it creates many more token pairs.',
  };

  yield {
    state: labelMatrix(
      'Design reading from the formula',
      [
        { id: 'short', label: 'chat' },
        { id: 'rag', label: 'RAG' },
        { id: 'agent', label: 'agent' },
        { id: 'corpus', label: 'corpus' },
      ],
      [
        { id: 'shape', label: 'shape' },
        { id: 'first lever', label: 'lever' },
      ],
      [
        ['small n', 'batch + quant'],
        ['repeat prefix', 'prefix cache'],
        ['large state', 'KV policy'],
        ['huge n', 'window/RAG'],
      ],
    ),
    highlight: { found: ['short:first lever', 'rag:first lever', 'agent:first lever', 'corpus:first lever'] },
    explanation: 'The formula becomes an architecture map. Short prompts want throughput. Repeated prompts want reuse. Very long prompts need a context policy, not only a faster kernel.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'term breakdown') yield* termBreakdown();
  else if (view === 'context crossover') yield* contextCrossover();
  else throw new InputError('Pick a transformer FLOPs view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'The Transformer Layer FLOPs Cost Model is the back-of-the-envelope calculation that turns a transformer block into a few visible terms. For a common decoder block with model width d, sequence length n, dense Q/K/V/O projections, and an MLP hidden width around 4d, a useful forward-pass estimate is 24 n d^2 + 4 n^2 d.',
        'The exact constants change with SwiGLU, grouped-query attention, multi-query attention, mixture-of-experts routing, fused kernels, and implementation details. The split is the durable lesson: projections and the MLP scale linearly in token count but quadratically in width; attention scores and value mixing scale quadratically in token count.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Dense projections treat each token mostly independently: Q, K, V, the attention output projection, and the feed-forward block multiply token representations by learned matrices. That is why those terms look like n d^2. Attention creates relationships between token pairs. A prompt with n tokens has about n^2 possible query-key comparisons, so the attention terms look like n^2 d.',
        'The crossover point is easy to read from the toy formula. Set 24 n d^2 equal to 4 n^2 d and attention catches the dense terms around n = 6d. With d = 4096, that is around 24k tokens. Before that point, dense layers can dominate FLOPs; after it, pairwise attention becomes hard to ignore.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'This model is most useful for training and prefill reasoning. Cached decode has different physics. During decode, the server emits one token at a time, reuses the KV Cache, and repeatedly reads model weights and cache state. Transformer Inference Roofline explains why that phase is often memory-bound even when the FLOP count looks modest.',
        'The model also explains why long context is an economic decision. A 4k prompt, a 32k agent trace, and a 128k document prompt are not just different input sizes. They change which term dominates and which system lever is credible: FlashAttention for IO-aware attention, Grouped-Query Attention for smaller KV traffic, Sliding-Window Attention Context Policy for bounded pair count, or retrieval when the prompt should not be one giant sequence.',
      ],
    },
    {
      heading: 'Case study',
      paragraphs: [
        'Consider an enterprise assistant that moves from short chat to repository-scale context. At 2k tokens, the system may care most about batching and quantized weights. At 16k tokens, prefill and cache residency begin to show up in time-to-first-token and concurrency. At 64k tokens, the team must ask whether all pairs of tokens need to attend, whether repeated prefixes should be cached, and whether retrieval can replace some raw context.',
        'A good architecture review writes the terms down before choosing a product feature. Long context, RAG Pipeline, Prefix Caching & RadixAttention, and KV Cache Concurrency Capacity Model are linked decisions. The cost model gives the shared language for those decisions.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'Do not treat one FLOP formula as the whole serving story. FLOPs ignore memory bandwidth, queueing, tail latency, kernel launch overhead, activation memory, and cache fragmentation. Do not assume FlashAttention changes the mathematical n^2 term; it changes how attention is computed and materialized. Do not assume grouped-query attention is mainly a training-FLOP trick; its biggest serving win is often KV memory and bandwidth.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Attention Is All You Need at https://arxiv.org/abs/1706.03762, the JAX scaling book transformer math chapter at https://jax-ml.github.io/scaling-book/transformers/, the JAX inference chapter at https://jax-ml.github.io/scaling-book/inference/, Efficiently Scaling Transformer Inference at https://arxiv.org/abs/2211.05102, and FlashAttention at https://arxiv.org/abs/2205.14135. Study The Transformer Block, Attention Mechanism, Transformer Inference Roofline, KV Cache, Grouped-Query Attention, and Sliding-Window Attention Context Policy next.',
      ],
    },
  ],
};
