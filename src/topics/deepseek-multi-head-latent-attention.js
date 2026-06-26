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
  const compressionStages = 5;  // nodes in first graph
  const compressionEdges = 4;   // edges in first graph
  const cacheVariants = 4;      // MHA, MQA, GQA, MLA
  const queryPathNodes = 6;     // nodes in query path graph
  const queryPathEdges = 6;     // edges in query path graph
  const plotSeries = 2;         // mha vs mla series

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
    explanation: `Multi-Head Latent Attention compresses each token into a latent KV vector through ${compressionStages} stages (hidden to decode). During attention, ${compressionEdges} projection steps reconstruct the per-head key and value information the model needs.`,
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
    explanation: `MLA is a different compression move from the other ${cacheVariants - 1} cache strategies (MQA, GQA, MHA). It keeps a compact latent representation and lets learned projections recover the head-specific information.`,
    invariant: `Cache format is an architecture choice across all ${cacheVariants} variants, not only an implementation trick.`,
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
    explanation: `The query path splits into ${queryPathNodes} stages across ${queryPathEdges} edges. The key difficulty is not merely shrinking tensors — the model still needs positional signal, content similarity, and per-head expressivity after compression.`,
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
    explanation: `The ${plotSeries} series show the direction of the DeepSeek-V2 claim: KV cache grows with context either way, but the MLA slope is roughly ${Math.round(0.13 / 1.0 * 100)}% of MHA when the cache stores latent vectors.`,
  };
}

function* decodeEconomics() {
  const bottleneckRows = 4;     // prefill, decode, batch, serving
  const archNodes = 6;          // nodes in architecture graph
  const archEdges = 6;          // edges in architecture graph
  const reportedMetrics = 4;    // rows in DeepSeek-V2 case matrix
  const cacheReduction = 93.3;  // percent KV-cache reduction reported
  const throughputGain = 5.76;  // max generation throughput multiplier

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
    explanation: `MLA affects all ${bottleneckRows} serving dimensions (prefill, decode, batching, serving cost). It mostly matters when decode is memory-bound — a smaller KV cache can allow longer contexts, larger continuous batches, or lower cost per generated token.`,
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
    explanation: `A compressed cache is only useful if all ${archNodes} system components (architecture through quality) work together across ${archEdges} dependency edges. The full case study crosses model architecture, memory layout, batching, and quality evaluation.`,
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
    explanation: `DeepSeek-V2 reports ${reportedMetrics} key metrics: ${cacheReduction}% KV-cache reduction and up to ${throughputGain}x throughput. Teach MLA as part of that larger recipe — MoE, long context, cache compression, and serving throughput all interact.`,
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
    explanation: `For agentic and long-context workloads, latent KV pain stays at ${Math.round(0.62 * 100)}% even at 1M tokens while full KV hits ${Math.round(0.98 * 100)}%. MLA is one answer to the question: what should the model remember per token?`,
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
      heading: 'How to read the animation',
      paragraphs: [
        'The first view, latent KV cache, walks through the core MLA pipeline: a hidden state h_t is down-projected into a compact latent vector c_KV, that vector is cached, and up-projections reconstruct the per-head keys and values needed for attention. Watch the highlighted nodes move from left to right. The second frame compares four cache strategies side by side: MHA (full per-head storage), MQA (one shared KV set), GQA (a few shared groups), and MLA (a single latent vector with learned reconstruction). The third frame splits the query path into its RoPE (position-sensitive) and content branches, showing why naive compression would lose positional information. The final frame plots KV cache size against context length for MHA versus MLA.',
        {type: 'image', src: './assets/gifs/deepseek-multi-head-latent-attention.gif', alt: 'Animated walkthrough of the deepseek multi head latent attention visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
        'The second view, decode economics, shifts focus to the serving stack. It shows where inference bottlenecks live (prefill, decode, batching, cost), how the architecture flows from MLA weights through kernels and schedulers into throughput, and the specific numbers DeepSeek-V2 reported. The final frame plots "serving pain" as context grows toward one million tokens, making the memory-bandwidth advantage concrete.',
        'Switch between views using the dropdown at the top. Each frame includes an explanation line below the visualization. Read the explanation first, then examine the highlighted elements to see which parts of the system are active at that step.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Large language models generate text one token at a time. To produce token number 5,001, the model must attend to all 5,000 previous tokens. Standard multi-head attention (MHA) stores a separate key vector and value vector for every past token, at every layer, for every attention head. This collection of vectors is the KV cache, and it is the dominant memory consumer during autoregressive decoding.',
        {type: 'callout', text: 'MLA makes the KV cache a learned compressed artifact, trading reconstruction compute for fewer resident bytes per token.'},
        'The KV cache determines how many requests a GPU can serve simultaneously and how long their contexts can be. A 70B-parameter model with 80 layers and 64 heads, using a head dimension of 128 in FP16, stores 2 * 80 * 64 * 128 * 2 = 2,621,440 bytes per token. At 100,000 tokens, that is roughly 250 GB of cache alone, exceeding the memory of most single accelerators. This is not a theoretical concern; it is the binding constraint on production serving cost.',
        'Multi-Head Latent Attention (MLA), introduced in the DeepSeek-V2 paper (May 2024), attacks this constraint directly. Instead of caching full per-head key and value vectors, MLA caches a single low-dimensional latent vector per token per layer and uses learned projections to reconstruct the per-head K and V on the fly during decoding. The result: DeepSeek-V2 reports a 93.3% reduction in KV cache size and up to 5.76x higher generation throughput.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'Before changing the model architecture, the obvious move is to optimize around the existing cache format. Paged attention (vLLM) treats the KV cache like virtual memory pages, eliminating fragmentation. KV cache quantization stores vectors in INT8 or INT4 instead of FP16, halving or quartering memory. Continuous batching lets new requests enter while old ones decode, improving GPU utilization without touching model weights.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/d/d2/Multiheaded_attention%2C_block_diagram.png', alt: 'Block diagram of multi-headed attention with separate key value and query projections', caption: 'Standard multi-head attention keeps separate projected views for each head, which is the baseline cache shape MLA compresses. Source: https://upload.wikimedia.org/wikipedia/commons/d/d2/Multiheaded_attention%2C_block_diagram.png'},
        'A second family of approaches changes the architecture slightly. Multi-Query Attention (MQA) uses one shared key-value head across all query heads, shrinking the cache by a factor equal to the number of heads (often 32x-128x). Grouped-Query Attention (GQA), used in Llama 2 70B and Mistral, compromises: a few KV head groups (say 8) share among many query heads, reducing cache 4x-16x while preserving more head diversity than MQA.',
        'These approaches work and are widely deployed. MQA and GQA are the status quo for efficient inference in most open-weight models. The question MLA asks is: can we compress further than GQA without sacrificing the quality that MQA sometimes loses?',
        'The answer MLA proposes is: yes, if you are willing to let the compression be learned rather than structural. Instead of sharing heads by grouping, learn a low-rank projection that captures the essential information across all heads in a smaller vector.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is arithmetic. KV cache size scales as: 2 (keys + values) * L (layers) * n_kv_heads * d_head * seq_len * batch_size * bytes_per_element. For DeepSeek-V2\'s 60-layer, 128-head architecture with d_head = 128 in FP16, each token costs 2 * 60 * 128 * 128 * 2 = 3,932,160 bytes, roughly 3.75 MB per token per request. A batch of 32 requests at 32K context each would need 32 * 32,000 * 3.75 MB = 3.84 TB of cache. No single accelerator has that.',
        'GQA helps. With 8 KV groups instead of 128, the cache shrinks 16x to about 240 GB for that same scenario. That fits on a multi-GPU node, but it still dominates memory and limits how many concurrent requests fit. The memory bandwidth cost of reading the cache during each decode step also grows linearly with cache size, directly throttling tokens-per-second.',
        'The second wall is quality. MQA, with a single KV head, sometimes underperforms MHA on tasks requiring diverse attention patterns. Different heads learn to attend to different types of information: syntactic structure, entity coreference, positional proximity, semantic similarity. Collapsing all of that into one shared KV set discards specialization that the model trained to develop.',
        'MLA aims to sit below GQA in cache size while preserving or exceeding MHA-level quality. The mechanism: instead of sharing heads (which discards diversity) or keeping all heads (which is expensive), project the combined information into a learned bottleneck that preserves diversity in a compressed form.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'The key and value vectors across all heads at a given layer are not independent. They are all linear projections of the same hidden state. If h_t is the hidden state for token t at some layer, then K_i = W_K^i * h_t and V_i = W_V^i * h_t for each head i. All heads\' keys and values live in the column space of their respective projection matrices applied to the same input. This means there is redundancy: the information content of all heads\' K and V vectors together cannot exceed the information in h_t itself.',
        'MLA exploits this redundancy. Instead of caching the full set of per-head K and V vectors, compress h_t into a much smaller latent vector c_KV = W_down * h_t, where W_down projects from dimension d_model (e.g., 5120) to d_latent (e.g., 512). At decode time, reconstruct per-head keys and values as K_i = W_UK^i * c_KV and V_i = W_UV^i * c_KV. The cache stores c_KV (512 dimensions) instead of 128 heads * 128 dimensions * 2 (K+V) = 32,768 dimensions worth of vectors.',
        'The compression ratio is d_latent / (n_heads * d_head * 2). With d_latent = 512, n_heads = 128, d_head = 128: 512 / 32,768 = 1.56%, or a 64x reduction. DeepSeek-V2 reports 93.3% reduction (about 15x), which accounts for the additional RoPE-related dimensions that must also be cached (more on this below).',
        'The insight is not just "make things smaller." It is that the cache does not need to store pre-computed K and V in their final form. It stores a learned compressed representation, and the model\'s up-projection weights serve as the decompression codebook. The codebook is fixed after training, so reconstruction is a deterministic matrix multiply, not an approximation.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Start with the hidden state h_t of dimension d_model at some layer. The KV compression path applies a down-projection: c_KV = W_DKV * h_t, producing a latent vector of dimension d_c (much smaller than d_model). This c_KV is the only thing stored in the KV cache for token t at this layer. At decode time, per-head keys and values are reconstructed: K = W_UK * c_KV (producing n_heads * d_head dimensions) and V = W_UV * c_KV (same shape). These are then reshaped into per-head views for the standard scaled dot-product attention computation.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1b/Transformer%2C_attention_block_diagram.png/250px-Transformer%2C_attention_block_diagram.png', alt: 'Transformer attention block diagram with scaled dot-product attention', caption: 'The attention block still consumes queries, keys, and values; MLA changes how cached key and value information is stored before that block runs. Source: https://upload.wikimedia.org/wikipedia/commons/thumb/1/1b/Transformer%2C_attention_block_diagram.png/250px-Transformer%2C_attention_block_diagram.png'},
        'The query path has a parallel structure but with a critical twist. Queries also get a low-rank compression: c_Q = W_DQ * h_t, then Q = W_UQ * c_Q. But queries are not cached (only the current token\'s query is needed), so the compression here serves a different purpose: it reduces the parameter count of the query projection, not the cache size. The up-projection W_UQ can share structure with the key up-projection, which the DeepSeek-V2 paper exploits for an algebraic absorption trick that avoids materializing the full reconstructed K matrix.',
        'The position problem is the hardest part. Rotary Position Embedding (RoPE) injects position information by rotating key and query vectors by position-dependent angles. If you compress keys into c_KV before applying RoPE, the position signal is lost. If you apply RoPE before compression, the compression must preserve position-dependent rotations, which couples position to content in the latent space. MLA\'s solution: split each query and key into two parts. One part carries RoPE (position-sensitive, not compressed, small dimension d_rope). The other part carries content (compressed through the latent, no RoPE). The final attention score is the sum of the RoPE-part dot product and the content-part dot product.',
        'This means the actual cache per token per layer stores: c_KV (d_c dimensions) plus k_rope (d_rope dimensions per head, but shared or small). The RoPE part is a small overhead on top of the compressed latent. DeepSeek-V2 uses d_c = 512 and d_rope = 64, so the total cached dimensions are 576 versus the MHA baseline of 32,768, yielding the reported compression.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The mathematical justification rests on the rank of the KV information. All per-head K and V vectors at a given layer are linear functions of h_t, which has dimension d_model. The concatenation of all heads\' K and V vectors lives in a subspace of dimension at most d_model. If d_model = 5120 and the concatenated KV has 32,768 dimensions, there is at most 5120 dimensions of actual information. A latent of size 512 is a further 10x compression below d_model, which works when the effective rank of the KV information is much lower than d_model -- a condition that empirically holds in trained transformers, where attention patterns are often low-rank.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a9/Absolute_positional_encoding.png/250px-Absolute_positional_encoding.png', alt: 'Heatmap of sinusoidal positional encoding dimensions', caption: 'Position information is not optional in long-context attention; compressed cache formats still need a route for order-sensitive signals. Source: https://upload.wikimedia.org/wikipedia/commons/thumb/a/a9/Absolute_positional_encoding.png/250px-Absolute_positional_encoding.png'},
        'The position-content split works because RoPE\'s rotations are orthogonal to the content signal. Position tells the model where a token is; content tells it what the token means for attention routing. By giving each its own channel, compression can be aggressive on the content path (which is high-dimensional but low-rank) without corrupting the position path (which is low-dimensional but essential for long-range order).',
        'The absorption trick makes this practical. In standard attention, score = Q * K^T. With MLA, the content part of this becomes (W_UQ * c_Q)^T * (W_UK * c_KV) = c_Q^T * (W_UQ^T * W_UK) * c_KV. The product W_UQ^T * W_UK can be precomputed into a single matrix, so the model never materializes the full reconstructed K. Attention is computed directly between compressed representations, and the up-projection cost folds into the weight matrices. This is why MLA\'s decode compute overhead is smaller than a naive "decompress then attend" would suggest.',
        'Quality holds because the compression is trained end-to-end. The down-projection W_DKV and up-projections W_UK, W_UV are learned jointly with the rest of the model. The latent space is not an afterthought bolted onto a pretrained model; it is the native representation the model learns to use. DeepSeek-V2 matches or exceeds the quality of comparably sized MHA models on standard benchmarks, suggesting the latent bottleneck does not discard information the model actually needs.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The primary cost saving is memory. In DeepSeek-V2, the KV cache per token per layer drops from about 32,768 FP16 values to 576 FP16 values (512 latent + 64 RoPE), a 57x reduction per layer. Across 60 layers, a 128K-context request\'s cache shrinks from roughly 480 GB to about 8.4 GB. That is the difference between needing a full 8-GPU node for one request\'s cache versus fitting dozens of concurrent requests on the same hardware.',
        'The secondary cost saving is memory bandwidth. During each decode step, the model reads the entire KV cache for all past tokens to compute attention. On an A100 GPU with 2 TB/s of HBM bandwidth, reading a 480 GB MHA cache takes 240 ms per decode step, limiting throughput to about 4 tokens per second. Reading an 8.4 GB MLA cache takes about 4.2 ms, allowing roughly 238 tokens per second from memory bandwidth alone. The real throughput depends on compute and other overheads, but the bandwidth ceiling lifts dramatically.',
        'The cost MLA adds is compute. Reconstructing K and V from c_KV requires matrix multiplications: W_UK * c_KV and W_UV * c_KV for each past token at each layer. For n past tokens, this is 2 * n * d_c * n_heads * d_head FLOPs per layer. With n = 128,000, d_c = 512, n_heads * d_head = 16,384: that is about 2.15 trillion FLOPs per layer, or 129 trillion across 60 layers. However, the absorption trick eliminates most of this by folding the up-projection into the attention weight matrices, so the actual added compute is much lower.',
        'The engineering cost is real. MLA requires custom attention kernels (FlashMLA), careful memory layout for the latent cache, modified batching logic, and RoPE handling that differs from standard implementations. A serving system optimized for MHA or GQA cannot simply swap in MLA weights and benefit; the entire inference stack must understand the latent cache format.',
        'Training cost is comparable to MHA. The down-projection and up-projection weights add parameters, but the latent bottleneck reduces the effective parameter count of the KV projections. DeepSeek-V2 trains at similar cost to models of equivalent quality, with the cache savings appearing only at inference time.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'DeepSeek-V2 is the flagship deployment. It is a 236B-parameter Mixture-of-Experts model with 21B activated parameters per token, 128K context length, and MLA in every attention layer. The DeepSeek API serves this model to millions of users, and the cache compression directly translates into lower serving cost per token. The reported 5.76x throughput improvement over DeepSeek 67B is a system-level number combining MLA, MoE routing, and serving optimizations.',
        'DeepSeek-V3 and DeepSeek-R1 continue to use MLA, confirming that the approach scales to larger models and reasoning-heavy workloads. The technique is not a one-off experiment; it is a production architecture choice carried across model generations.',
        'Agentic workloads benefit most. An AI agent that maintains a long conversation context, reads documents, calls tools, and generates multi-step plans creates exactly the scenario where KV cache is the binding constraint. MLA lets the serving system maintain longer agent contexts and more concurrent agent sessions on the same hardware.',
        'Long-document processing (legal analysis, code review, research synthesis) also benefits. A 128K-token document fills a standard KV cache to the point where batch size drops to 1 on most hardware. With MLA\'s 15-60x compression, the same hardware can process multiple long documents concurrently, improving throughput per dollar.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'MLA fails when the bottleneck is not memory. Short-context, low-batch workloads where the KV cache fits comfortably in memory see no benefit from compression. The extra projection compute is pure overhead in this regime. A chatbot handling 500-token conversations with no batching pressure gains nothing from MLA.',
        'It fails when the latent dimension is too small for the task. If the model needs to attend to very fine-grained per-head information that cannot be reconstructed from a low-rank latent, quality degrades. This is a risk for tasks requiring precise factual retrieval over very long contexts, where every cached token must be distinguishable. The right d_c is an empirical choice, and setting it too low trades quality for memory.',
        'Existing serving infrastructure is a barrier. MLA requires purpose-built kernels. FlashAttention does not natively support MLA\'s latent cache format; DeepSeek developed FlashMLA as a separate kernel. Frameworks like vLLM and TensorRT-LLM have added MLA support, but it lags behind MHA/GQA support in maturity and optimization. A team that cannot modify their serving stack cannot deploy MLA effectively.',
        'MLA also does not compose trivially with all other inference optimizations. Speculative decoding, KV cache quantization, prefix caching, and tensor parallelism strategies all assume specific cache formats. Each must be adapted for the latent cache, and not all combinations have been validated. The engineering surface area is larger than for GQA.',
        'Finally, MLA is a training-time architectural decision. You cannot convert a pretrained MHA or GQA model to MLA without retraining or significant fine-tuning. Unlike post-training quantization or distillation, MLA must be committed to from the start of training.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Consider a model with 60 layers, 128 attention heads, head dimension 128, and FP16 precision (2 bytes per value). Standard MHA caches both K and V per head, so per token per layer, the cache stores 2 (K+V) * 128 heads * 128 dimensions * 2 bytes = 65,536 bytes. Across 60 layers, one token costs 60 * 65,536 = 3,932,160 bytes, about 3.75 MB. For a 100,000-token context, the KV cache is 100,000 * 3.75 MB = 375 GB.',
        'Now apply MLA with d_c = 512 and d_rope = 64. Per token per layer, the cache stores (512 + 64) * 2 bytes = 1,152 bytes. Across 60 layers, one token costs 60 * 1,152 = 69,120 bytes, about 0.066 MB. For 100,000 tokens, the MLA cache is 100,000 * 0.066 MB = 6.6 GB. The reduction factor is 375 / 6.6 = 56.8x, or a 98.2% reduction.',
        'On an A100 80 GB GPU, the MHA cache of 375 GB does not fit on a single device -- it needs at least 5 GPUs just for KV cache, leaving no room for model weights. The MLA cache of 6.6 GB fits easily, leaving about 73 GB for model weights (the activated 21B parameters need about 42 GB in FP16) and compute buffers. This is the difference between a 5-GPU and a 1-GPU serving setup for the same context length.',
        'The bandwidth cost during decoding: each generated token reads the full KV cache. At 2 TB/s HBM bandwidth, reading 375 GB takes 187.5 ms, capping decode throughput at about 5.3 tokens/second. Reading 6.6 GB takes 3.3 ms, allowing up to 303 tokens/second from bandwidth alone. Even after accounting for compute and kernel overhead, the bandwidth headroom is transformative.',
        'The added compute for reconstruction: per decode step, reconstructing K and V for all 100,000 past tokens at one layer costs 2 * 100,000 * 512 * 16,384 = 1.68 trillion FLOPs. Across 60 layers, that is 100.7 trillion FLOPs. An A100 delivers about 312 TFLOPS in FP16, so reconstruction alone would take 322 ms per token -- worse than MHA. This is why the absorption trick matters: by folding up-projections into the attention weight matrices, the actual decode path avoids materializing full K/V and computes attention directly on compressed representations, bringing the compute overhead down to a fraction of the naive estimate.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'The primary source is the DeepSeek-V2 paper: "DeepSeek-V2: A Strong, Economical, and Efficient Mixture-of-Experts Language Model" (https://arxiv.org/abs/2405.04434). Section 3.1 of the paper describes MLA in full mathematical detail, including the compression dimensions, the RoPE decoupling, and the absorption trick.',
        'For converting existing MHA models to MLA post-training, see "MHA2MLA: Towards Multi-Head Latent Attention for LLM Efficiency" (https://arxiv.org/abs/2502.14837), which explores fine-tuning strategies for retrofitting MLA onto pretrained checkpoints.',
        'FlashMLA, the optimized kernel for MLA decoding, is open-sourced by DeepSeek on GitHub. Studying its implementation reveals how the latent cache format maps to GPU memory access patterns and warp-level parallelism.',
        'Study these related topics next: KV Cache (what MLA compresses), Multi-Head Attention (the baseline architecture), Grouped-Query Attention and Multi-Query Attention (alternative cache reduction strategies), Rotary Position Embedding (why the position-content split is necessary), Mixture of Experts (the other half of DeepSeek-V2\'s efficiency story), and Transformer Inference Optimization (the broader serving context MLA operates in).',
      ],
    },
  ],
};
