// DeepSeek Multi-Head Latent Attention: compress the KV cache into a latent
// vector while reconstructing per-head keys and values for attention.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'deepseek-multi-head-latent-attention',
  title: 'DeepSeek Multi-Head Latent Attention',
  category: 'AI & ML',
  summary: 'DeepSeek-V2 style MLA: store a compact latent KV vector per token, then reconstruct per-head keys and values to cut decode memory pressure.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['latent KV cache', 'decode economics'], defaultValue: 'latent KV cache' },
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
  return matrixState({ title, rows, columns, values: labelsByRow.map((row) => row.map(code)), format: (value) => labels[value] });
}

function* latentKvCache() {
  yield {
    state: graphState({
      nodes: [
        { id: 'token', label: 'h_t', x: 0.9, y: 2.8, note: 'hidden' },
        { id: 'down', label: 'down', x: 2.8, y: 2.8, note: 'compress' },
        { id: 'latent', label: 'c_KV', x: 4.8, y: 2.8, note: 'cache' },
        { id: 'kv', label: 'K/V', x: 6.7, y: 2.8, note: 'rebuild' },
        { id: 'attn', label: 'attn', x: 8.6, y: 2.8, note: 'decode' },
      ],
      edges: [
        { id: 'e-token-down', from: 'token', to: 'down', weight: '' },
        { id: 'e-down-latent', from: 'down', to: 'latent', weight: '' },
        { id: 'e-latent-kv', from: 'latent', to: 'kv', weight: '' },
        { id: 'e-kv-attn', from: 'kv', to: 'attn', weight: '' },
      ],
    }, { title: 'MLA stores compressed latent KV, not full per-head KV' }),
    highlight: { active: ['down', 'latent'], found: ['attn'] },
    explanation: 'Multi-Head Latent Attention compresses each token into a latent KV vector for the cache. During attention, projections reconstruct the per-head key and value information the model needs.',
  };

  yield {
    state: labelMatrix(
      'Cache object per token',
      [
        { id: 'mha', label: 'MHA' },
        { id: 'mqa', label: 'MQA' },
        { id: 'gqa', label: 'GQA' },
        { id: 'mla', label: 'MLA' },
      ],
      [
        { id: 'stored', label: 'stored' },
        { id: 'shape', label: 'shape' },
        { id: 'tradeoff', label: 'tradeoff' },
      ],
      [
        ['K+V heads', 'large', 'quality'],
        ['one K+V', 'small', 'shared'],
        ['few K+V', 'medium', 'grouped'],
        ['latent c', 'small', 'reconstruct'],
      ],
    ),
    highlight: { active: ['mla:stored', 'mla:tradeoff'], compare: ['mha:stored', 'gqa:stored'] },
    explanation: 'MLA is a different compression move from MQA or GQA. It keeps a compact latent representation and lets learned projections recover the head-specific information.',
    invariant: 'Cache format is an architecture choice, not only an implementation trick.',
  };

  yield {
    state: graphState({
      nodes: [
        { id: 'q', label: 'query', x: 0.8, y: 3.8, note: 'current' },
        { id: 'qproj', label: 'Q path', x: 2.5, y: 3.8, note: 'heads' },
        { id: 'rope', label: 'RoPE part', x: 4.2, y: 2.6, note: 'position' },
        { id: 'norop', label: 'no-RoPE part', x: 4.2, y: 5.0, note: 'content' },
        { id: 'score', label: 'scores', x: 6.2, y: 3.8, note: 'QK' },
        { id: 'value', label: 'values', x: 8.1, y: 3.8, note: 'from latent' },
      ],
      edges: [
        { id: 'e-q-qproj', from: 'q', to: 'qproj', weight: '' },
        { id: 'e-qproj-rope', from: 'qproj', to: 'rope', weight: '' },
        { id: 'e-qproj-norop', from: 'qproj', to: 'norop', weight: '' },
        { id: 'e-rope-score', from: 'rope', to: 'score', weight: '' },
        { id: 'e-norop-score', from: 'norop', to: 'score', weight: '' },
        { id: 'e-score-value', from: 'score', to: 'value', weight: '' },
      ],
    }, { title: 'MLA must preserve both content and position information' }),
    highlight: { active: ['rope', 'norop', 'score'], found: ['value'] },
    explanation: 'The key difficulty is not merely shrinking tensors. The model still needs positional signal, content similarity, and per-head expressivity after compression.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'context tokens', min: 0, max: 128000 }, y: { label: 'relative KV cache bytes', min: 0, max: 1.05 } },
      series: [
        { id: 'mha', label: 'full MHA cache', points: [{ x: 0, y: 0 }, { x: 32000, y: 0.25 }, { x: 64000, y: 0.50 }, { x: 96000, y: 0.75 }, { x: 128000, y: 1.00 }] },
        { id: 'mla', label: 'MLA latent cache', points: [{ x: 0, y: 0 }, { x: 32000, y: 0.04 }, { x: 64000, y: 0.07 }, { x: 96000, y: 0.10 }, { x: 128000, y: 0.13 }] },
      ],
    }),
    highlight: { active: ['mla'], compare: ['mha'] },
    explanation: 'The toy line shows the direction of the DeepSeek-V2 claim: KV cache grows with context either way, but the slope can be much smaller when the cache stores latent vectors.',
  };
}

function* decodeEconomics() {
  yield {
    state: labelMatrix(
      'Inference bottleneck shift',
      [
        { id: 'prefill', label: 'prefill' },
        { id: 'decode', label: 'decode' },
        { id: 'batch', label: 'batching' },
        { id: 'serving', label: 'serving' },
      ],
      [
        { id: 'pressure', label: 'pressure' },
        { id: 'MLA', label: 'MLA effect' },
      ],
      [
        ['FLOPs', 'less direct'],
        ['memory reads', 'cache smaller'],
        ['KV capacity', 'more room'],
        ['cost/token', 'lower if tuned'],
      ],
    ),
    highlight: { found: ['decode:MLA', 'batch:MLA', 'serving:MLA'] },
    explanation: 'MLA mostly matters when decode is memory-bound. A smaller KV cache can allow longer contexts, larger continuous batches, or lower cost per generated token.',
  };

  yield {
    state: graphState({
      nodes: [
        { id: 'arch', label: 'MLA arch', x: 0.9, y: 3.8, note: 'weights' },
        { id: 'kernel', label: 'kernels', x: 2.8, y: 2.7, note: 'FlashMLA' },
        { id: 'scheduler', label: 'scheduler', x: 2.8, y: 4.9, note: 'batches' },
        { id: 'memory', label: 'memory pool', x: 4.9, y: 3.8, note: 'KV pages' },
        { id: 'throughput', label: 'throughput', x: 7.1, y: 3.8, note: 'tokens/s' },
        { id: 'quality', label: 'quality', x: 8.8, y: 3.8, note: 'benchmarks' },
      ],
      edges: [
        { id: 'e-arch-kernel', from: 'arch', to: 'kernel', weight: '' },
        { id: 'e-arch-scheduler', from: 'arch', to: 'scheduler', weight: '' },
        { id: 'e-kernel-memory', from: 'kernel', to: 'memory', weight: '' },
        { id: 'e-scheduler-memory', from: 'scheduler', to: 'memory', weight: '' },
        { id: 'e-memory-throughput', from: 'memory', to: 'throughput', weight: '' },
        { id: 'e-throughput-quality', from: 'throughput', to: 'quality', weight: '' },
      ],
    }, { title: 'Architecture gains need serving-system support' }),
    highlight: { active: ['kernel', 'scheduler', 'memory'], found: ['throughput'] },
    explanation: 'A compressed cache is only useful if kernels and serving code exploit it. The full case study crosses model architecture, memory layout, batching, and quality evaluation.',
  };

  yield {
    state: labelMatrix(
      'DeepSeek-V2 reported case',
      [
        { id: 'params', label: 'params' },
        { id: 'context', label: 'context' },
        { id: 'cache', label: 'KV cache' },
        { id: 'speed', label: 'throughput' },
      ],
      [
        { id: 'claim', label: 'claim' },
        { id: 'lesson', label: 'lesson' },
      ],
      [
        ['236B total', 'MoE matters'],
        ['128K', 'memory bound'],
        ['-93.3%', 'MLA payoff'],
        ['5.76x max', 'system payoff'],
      ],
    ),
    highlight: { found: ['cache:claim', 'speed:claim'], compare: ['params:lesson'] },
    explanation: 'DeepSeek-V2 reports both model-quality and system-efficiency gains. Teach MLA as part of that larger recipe: MoE, long context, cache compression, and serving throughput all interact.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'tokens per request', min: 0, max: 1000000 }, y: { label: 'serving pain', min: 0, max: 1.0 } },
      series: [
        { id: 'full', label: 'full KV pain', points: [{ x: 0, y: 0.02 }, { x: 100000, y: 0.22 }, { x: 300000, y: 0.52 }, { x: 600000, y: 0.82 }, { x: 1000000, y: 0.98 }] },
        { id: 'latent', label: 'latent KV pain', points: [{ x: 0, y: 0.02 }, { x: 100000, y: 0.08 }, { x: 300000, y: 0.19 }, { x: 600000, y: 0.38 }, { x: 1000000, y: 0.62 }] },
      ],
    }),
    highlight: { active: ['latent'], compare: ['full'] },
    explanation: 'For agentic and long-context workloads, decode economics can dominate model choice. MLA is one answer to the question: what should the model remember per token?',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'latent KV cache') yield* latentKvCache();
  else if (view === 'decode economics') yield* decodeEconomics();
  else throw new InputError('Pick a Multi-Head Latent Attention view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'Multi-Head Latent Attention, or MLA, is the attention design highlighted in DeepSeek-V2. Instead of storing full per-head keys and values for every past token, the model stores a compact latent KV vector. Learned projections reconstruct the key and value information used by the attention heads when a new token is decoded.',
        {type: 'callout', text: 'MLA makes the KV cache a learned compressed artifact, trading reconstruction compute for fewer resident bytes per token.'},
        'This topic belongs next to KV Cache because MLA changes the cache object itself. A normal multi-head attention cache stores many key and value vectors per token. MLA stores a lower-dimensional latent representation and spends extra projection work to recover attention inputs. The tradeoff is memory for computation and architectural complexity.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious serving approach is to keep the exact KV cache produced by ordinary multi-head attention and optimize around it. Paged KV memory, quantized cache storage, continuous batching, and better kernels can all help without changing the model architecture.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/d/d2/Multiheaded_attention%2C_block_diagram.png', alt: 'Block diagram of multi-headed attention with separate key value and query projections', caption: 'Standard multi-head attention keeps separate projected views for each head, which is the baseline cache shape MLA compresses. Source: https://upload.wikimedia.org/wikipedia/commons/d/d2/Multiheaded_attention%2C_block_diagram.png'},
        'That approach eventually hits a memory wall. Long contexts and large batches make cache bandwidth and capacity dominate decode economics. Every generated token has to read attention state for prior tokens, so the cache becomes a first-class serving object rather than incidental model scratch space.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is that full per-head KV state grows with layers, heads, head dimension, sequence length, batch size, and precision. Even when parameters fit, the live cache can limit how many requests fit on an accelerator and how long their contexts can be.',
        'A second wall is quality. You cannot simply throw away head-specific key and value information and expect attention to work. Any compression scheme has to preserve enough information for routing, retrieval, position handling, and head diversity.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'MLA treats cached attention state as a learned compressed representation. Store a compact latent vector per token, then reconstruct the key and value information needed by attention heads through learned projections at decode time.',
        'That changes the serving tradeoff. The model pays extra projection work and architectural complexity so the memory object carried across the whole context is smaller. The payoff appears when decode is memory-bound and a smaller cache enables larger batches, longer contexts, or lower cost per token.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A hidden state is compressed through a down-projection into a latent KV vector. That latent vector is cached. At decode time, up-projections turn it into the key and value information needed by attention heads. The query path must also preserve position information, often with careful treatment of RoPE-related dimensions, because long-context attention cannot lose track of order.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1b/Transformer%2C_attention_block_diagram.png/250px-Transformer%2C_attention_block_diagram.png', alt: 'Transformer attention block diagram with scaled dot-product attention', caption: 'The attention block still consumes queries, keys, and values; MLA changes how cached key and value information is stored before that block runs. Source: https://upload.wikimedia.org/wikipedia/commons/thumb/1/1b/Transformer%2C_attention_block_diagram.png/250px-Transformer%2C_attention_block_diagram.png'},
        'The important data-structure idea is that the cache is no longer raw material. It is a compressed representation with a reconstruction contract. Like a B-tree page, a product-quantized vector, or an LSM compaction artifact, the format is chosen to make the downstream workload cheaper.',
      ],
    },
    {
      heading: 'What the animation teaches',
      paragraphs: [
        'Read multi-head latent attention as compressing key/value state through a latent bottleneck. The attention computation still needs useful context, but serving benefits when cached state is smaller.',
        'The animation should make the serving tradeoff visible. Latent compression saves KV-cache memory and bandwidth, but model quality depends on whether the compressed representation preserves the information attention needs.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Imagine a long-context agent request with a 100,000-token prompt. Ordinary attention stores key and value vectors for each token at each layer. If many requests run together, accelerator memory becomes the batching limit before raw compute does.',
        'With MLA, the cache entry for each token is smaller. The serving system may fit more concurrent requests or keep longer contexts resident. The model still has to reconstruct usable keys and values, so the win is not free; it depends on kernels, memory layout, and whether quality holds on long-context tasks.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'MLA works when the learned latent space preserves the attention information that would otherwise be stored redundantly across heads. The projections learn how to recover head-specific key and value views from a shared compact state.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a9/Absolute_positional_encoding.png/250px-Absolute_positional_encoding.png', alt: 'Heatmap of sinusoidal positional encoding dimensions', caption: 'Position information is not optional in long-context attention; compressed cache formats still need a route for order-sensitive signals. Source: https://upload.wikimedia.org/wikipedia/commons/thumb/a/a9/Absolute_positional_encoding.png/250px-Absolute_positional_encoding.png'},
        'The design is plausible because serving does not need the cache to be human-readable or exact in the ordinary MHA format. It needs the cache to support the next-token computation well. If the learned representation supports that computation with fewer bytes, the architecture has changed the system bottleneck.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'MLA reduces KV-cache memory pressure, which can improve long-context serving and continuous batching. It also adds architectural decisions and kernel work. If serving code still treats the cache like ordinary per-head KV tensors, much of the benefit is lost. The full engineering problem includes memory layout, attention kernels, batching policy, precision, and quality evaluation.',
        'The cost moves into model design, projection compute, implementation maturity, and benchmark risk. A cache format that looks elegant in a paper can underperform if kernels are slow, if layout wastes bandwidth, or if the serving scheduler cannot exploit the freed memory.',
      ],
    },
    {
      heading: 'Real-world case study',
      paragraphs: [
        'DeepSeek-V2 reports a 236B-parameter Mixture-of-Experts model with 21B activated parameters per token and 128K context. The paper attributes efficient inference partly to MLA, reporting a 93.3 percent KV-cache reduction and up to 5.76 times maximum generation throughput compared with DeepSeek 67B. Those numbers should be read as a system-level case study, not as a universal MLA constant.',
        'For students, the case is valuable because it links architecture to serving economics. MoE changes activated parameters, MLA changes cache shape, and long context changes memory pressure. The reported throughput is the result of those pieces working together.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'MLA is not simply "smaller cache equals same model." The model must learn to use the latent representation without losing head diversity, positional information, or quality. It is also not a replacement for all serving optimization. Paged KV memory, quantization, batching, speculative decoding, and kernel selection still matter.',
        'It is also not a universal reason to prefer one model. The reported cache and throughput gains come from a specific architecture and serving stack. A deployment still has to measure quality, latency, memory, throughput, and cost on its own workload.',
      ],
    },
    {
      heading: 'Where it wins and fails',
      paragraphs: [
        'MLA wins when decode is memory-bound, contexts are long, and serving throughput is limited by cache size or bandwidth. It is especially relevant to agentic workloads, retrieval-heavy prompts, and continuous batching systems where cache pressure sets the economic ceiling.',
        'It fails when the bottleneck is elsewhere, when exact attention behavior matters more than cache size, or when kernels and schedulers cannot use the compressed state efficiently. The right question is not whether MLA is clever; it is whether it moves the limiting resource in the deployed system.',
      ],
    },
    {
      heading: 'Evaluation review',
      paragraphs: [
        'Evaluate MLA on two axes at the same time: quality and serving economics. Quality tests should include long-context retrieval, code references, multi-hop questions, and tasks where losing a rare token matters. Serving tests should include prefill, decode, memory residency, continuous batching, and cost per generated token.',
        'The comparison should be against strong alternatives, not a weak baseline. Paged KV cache, KV quantization, grouped-query attention, speculative decoding, and batching improvements may solve part of the same problem. MLA earns its place only when it improves the end-to-end system under those competing optimizations.',
        'A useful report separates cache bytes per token, active batch size, tokens per second, time to first token, quality deltas, and kernel maturity. Without that separation, a team can celebrate a smaller cache while missing a quality regression or an implementation bottleneck.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary source: DeepSeek-V2: A Strong, Economical, and Efficient Mixture-of-Experts Language Model at https://arxiv.org/abs/2405.04434. For implementation-adjacent context, study later work on converting MHA to MLA at https://arxiv.org/abs/2502.14837. Study KV Cache, Attention, Multi-Head Attention, RoPE, Transformer Inference Roofline, Mixture of Experts, and Kimi Linear Attention next.',
      ],
    },
  ],
};
