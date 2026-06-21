// Grouped-query attention and multi-query attention: keep many query heads,
// share fewer key/value heads, and reduce KV-cache traffic during decode.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'grouped-query-attention-kv-sharing',
  title: 'Grouped-Query Attention',
  category: 'AI & ML',
  summary: 'How MQA and GQA share key/value heads across many query heads to reduce decode memory bandwidth and KV-cache capacity.',
  controls: [
    { id: 'layout', label: 'Layout', type: 'select', options: ['MHA', 'GQA', 'MQA'], defaultValue: 'GQA' },
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

function sharingGraph(layout) {
  const queryHeads = Array.from({ length: 8 }, (_, i) => ({
    id: `q${i}`,
    label: `Q${i}`,
    x: 1.2 + i,
    y: 2.1,
    note: '',
  }));
  const kvCount = layout === 'MHA' ? 8 : layout === 'GQA' ? 2 : 1;
  const kvHeads = Array.from({ length: kvCount }, (_, i) => ({
    id: `kv${i}`,
    label: `K/V${i}`,
    x: kvCount === 1 ? 4.7 : 1.2 + i * (7 / Math.max(1, kvCount - 1)),
    y: 4.7,
    note: '',
  }));
  const edges = queryHeads.map((head, i) => {
    const target = layout === 'MHA' ? i : layout === 'GQA' ? Math.floor(i / 4) : 0;
    return { id: `e-q${i}-kv${target}`, from: head.id, to: `kv${target}` };
  });
  return graphState({ nodes: [...queryHeads, ...kvHeads], edges }, { title: `${layout}: 8 query heads, ${kvCount} KV head${kvCount === 1 ? '' : 's'}` });
}

function bytesPlot(markers = []) {
  const points = [1, 2, 4, 8, 16, 32].map((heads) => ({ x: heads, y: (heads / 32) * 100 }));
  return plotState({
    axes: {
      x: { label: 'KV heads stored per layer', min: 0, max: 34 },
      y: { label: 'KV cache bytes, percent of 32-head MHA', min: 0, max: 110 },
    },
    series: [{ id: 'kv-bytes', label: 'KV bytes scale with KV heads', points }],
    markers,
  });
}

export function* run(input) {
  const layout = String(input.layout);
  if (!['MHA', 'GQA', 'MQA'].includes(layout)) throw new InputError('Pick MHA, GQA, or MQA.');

  const kvCount = layout === 'MHA' ? 8 : layout === 'GQA' ? 2 : 1;
  const queryHeadCount = 8;
  const groupSize = queryHeadCount / kvCount;

  const activeEdges = layout === 'MHA'
    ? ['e-q0-kv0', 'e-q1-kv1', 'e-q2-kv2', 'e-q3-kv3', 'e-q4-kv4', 'e-q5-kv5', 'e-q6-kv6', 'e-q7-kv7']
    : layout === 'GQA'
      ? ['e-q0-kv0', 'e-q1-kv0', 'e-q2-kv0', 'e-q3-kv0', 'e-q4-kv1', 'e-q5-kv1', 'e-q6-kv1', 'e-q7-kv1']
      : ['e-q0-kv0', 'e-q1-kv0', 'e-q2-kv0', 'e-q3-kv0', 'e-q4-kv0', 'e-q5-kv0', 'e-q6-kv0', 'e-q7-kv0'];

  yield {
    state: sharingGraph(layout),
    highlight: { active: activeEdges, found: ['q0', 'q1', 'q2', 'q3'], compare: ['q4', 'q5', 'q6', 'q7'] },
    explanation: layout === 'MHA'
      ? `Multi-head attention gives every query head its own cached K/V head. With ${queryHeadCount} query heads and ${kvCount} KV heads, each group has ${groupSize} queries — maximizing per-head separation but storing the largest KV cache.`
      : layout === 'GQA'
        ? `Grouped-query attention keeps ${queryHeadCount} query heads but shares only ${kvCount} KV heads. Each KV head serves a group of ${groupSize} query heads, cutting cache to ${Math.round(100 * kvCount / queryHeadCount)}% of the MHA size.`
        : `Multi-query attention is the extreme: ${queryHeadCount} query heads share ${kvCount} KV head. It minimizes KV traffic to ${Math.round(100 * kvCount / queryHeadCount)}% of MHA but can lose quality.`,
    invariant: `Decode cache size scales with the ${kvCount} KV head${kvCount === 1 ? '' : 's'}, not the ${queryHeadCount} query heads.`,
  };

  yield {
    state: labelMatrix(
      'MHA, GQA, and MQA trade cache bytes for expressivity',
      [
        { id: 'mha', label: 'MHA' },
        { id: 'gqa', label: 'GQA' },
        { id: 'mqa', label: 'MQA' },
      ],
      [
        { id: 'q', label: 'Q heads' },
        { id: 'kv', label: 'KV heads' },
        { id: 'cache', label: 'KV cache' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['many', 'same', 'large', 'bytes'],
        ['many', 'some', 'smaller', 'sharing'],
        ['many', 'one', 'smallest', 'quality'],
      ],
    ),
    highlight: { active: [`${layout.toLowerCase()}:kv`, `${layout.toLowerCase()}:cache`], compare: ['mha:cache', 'mqa:risk'] },
    explanation: `${layout} is the active layout. GQA sits between MHA (${queryHeadCount} KV heads) and MQA (1 KV head), capturing most of the serving-memory win while keeping more K/V diversity than a single shared head.`,
  };

  yield {
    state: bytesPlot([
      { id: 'mqa', x: 1, y: 3.125, label: 'MQA' },
      { id: 'gqa8', x: 8, y: 25, label: 'GQA 8 KV heads' },
      { id: 'mha', x: 32, y: 100, label: 'MHA' },
    ]),
    highlight: { active: ['kv-bytes'], found: ['mqa', 'gqa8', 'mha'] },
    explanation: `If a model keeps ${queryHeadCount} query heads but stores only ${kvCount} KV head${kvCount === 1 ? '' : 's'} (${layout}), the KV cache is about ${Math.round(100 * kvCount / queryHeadCount)}% of the full multi-head layout.`,
  };

  yield {
    state: labelMatrix(
      'Where GQA helps most',
      [
        { id: 'decode', label: 'decode' },
        { id: 'capacity', label: 'capacity' },
        { id: 'long', label: 'long ctx' },
        { id: 'training', label: 'training' },
      ],
      [
        { id: 'why', label: 'why' },
        { id: 'watch', label: 'watch' },
      ],
      [
        ['fewer KV bytes', 'kernels'],
        ['more users', 'scheduler'],
        ['slower growth', 'lost detail'],
        ['convert ckpt', 'uptrain'],
      ],
    ),
    highlight: { found: ['decode:why', 'capacity:why', 'long:why'], compare: ['training:watch'] },
    explanation: `The strongest production effect of ${layout} appears during inference. With ${kvCount} KV head${kvCount === 1 ? '' : 's'} instead of ${queryHeadCount}, smaller K/V tensors reduce memory bandwidth, increase concurrency, and make long contexts less punishing.`,
  };
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        "Read the animation as the execution trace for Grouped-Query Attention. How MQA and GQA share key/value heads across many query heads to reduce decode memory bandwidth and KV-cache capacity..",
        {type: "callout", text: "GQA decouples query-head diversity from KV-cache size: many query heads can read a smaller shared set of key and value memories."},
        "Active items are the current decision point. Visited markers are state that is already ruled out by proof, not by taste.",
        "Found markers are outcomes now guaranteed true. If this is not visible, the animation can mislead.",
        "At each frame, ask what changed, why that move is legal, and where the idea is strong or fragile.",
      
        {type: 'image', src: './assets/gifs/grouped-query-attention-kv-sharing.gif', alt: 'Animated walkthrough of the grouped query attention kv sharing visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},],
    },
    {
      heading: `Why this exists`,
      paragraphs: [
        `Grouped-query attention is an attention layout for transformer decoders that keeps many query heads but shares a smaller number of key/value heads. In ordinary multi-head attention, each query head has its own key projection and value projection. During autoregressive generation, the model caches those keys and values for every previous token so it does not recompute them at every step. That cache is the KV Cache. It is essential for fast decoding, but it grows with context length, batch size, layers, and the number of stored key/value heads.`,
        {type: `image`, src: `https://upload.wikimedia.org/wikipedia/commons/thumb/3/34/Transformer%2C_full_architecture.png/250px-Transformer%2C_full_architecture.png`, alt: `Transformer encoder-decoder architecture with attention blocks`, caption: `The full transformer diagram shows where attention repeats across layers; GQA changes the cached key/value head count inside those decoder attention blocks. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Transformer,_full_architecture.png.`},
        `GQA changes the cache geometry. A model might keep 32 query heads but store only 8 key/value heads. Each key/value head serves a group of query heads. Multi-query attention is the extreme version, where all query heads share one key/value head. Full multi-head attention is the other extreme, where query heads and key/value heads have the same count. GQA is the middle point: much smaller cache than full multi-head attention, more key/value diversity than multi-query attention.`,
      ],
    },
    {
      heading: `The wall`,
      paragraphs: [
        `The obvious modeling approach is full multi-head attention everywhere. It is expressive, familiar, and easy to reason about: every attention head gets its own query, key, and value projections. During training, this gives heads separate channels for different token relationships. During inference, though, every generated token must read the cached keys and values for all previous tokens in every layer. Long prompts, many simultaneous users, and large head counts turn that cache into a memory-capacity and memory-bandwidth problem.`,
        `A second obvious approach is to share everything. Multi-query attention stores one key/value head per layer while keeping many query heads. That can dramatically reduce decode traffic, but it asks all query heads to look through the same key/value representation. For some models and tasks this is acceptable. For others it removes useful per-head detail. The wall is not only accuracy; it is also operational. A serving team wants lower KV bytes without discovering that rare long-context, code, multilingual, or reasoning cases quietly regressed.`,
      ],
    },
    {
      heading: `The core insight`,
      paragraphs: [
        `The core insight is that query diversity and cache diversity do not have to be identical. Query heads decide how the current token asks questions about the past. Key/value heads define what representation of the past is stored and read. Full multi-head attention couples those counts. GQA decouples them. If four query heads can share one key/value representation without losing too much quality, the model can keep the computational pattern of many query heads while shrinking the persistent state that dominates decode.`,
        `This matters because decode is different from prefill. During prefill, the model processes the prompt and builds the cache. During decode, each new token repeatedly reads old keys and values. For a 32-head model with 8 key/value heads, the key/value head dimension of the cache is roughly one quarter of the full 32-head layout. That reduction can become more concurrent sessions, longer supported contexts, lower p99 latency, or lower memory pressure for the same hardware.`,
      ],
    },
    {
      heading: `How it works`,
      paragraphs: [
        `In implementation terms, attention still computes queries, keys, values, attention scores, a softmax, and a weighted sum of values. The change is the shape of the projections. The query projection produces many query heads. The key and value projections produce fewer heads. At attention time, each query head is assigned to a key/value group. The grouped key/value tensors may be repeated or broadcast logically so the attention kernel can pair every query head with its group\'s cached keys and values.`,
        {type: `image`, src: `https://upload.wikimedia.org/wikipedia/commons/thumb/d/d2/Multiheaded_attention%2C_block_diagram.png/250px-Multiheaded_attention%2C_block_diagram.png`, alt: `Multi-head attention block showing parallel attention heads and concatenation`, caption: `Multi-head attention begins with parallel heads. GQA keeps many query heads while reducing how many key/value heads are stored in the decode cache. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Multiheaded_attention,_block_diagram.png.`},
        `The grouping ratio is the main design variable. If there are 32 query heads and 8 key/value heads, each key/value head serves 4 query heads. If there are 32 query heads and 4 key/value heads, each serves 8. The smaller the key/value count, the smaller the cache and the stronger the sharing assumption. Some systems train the model with GQA from the beginning. Others convert an existing multi-head checkpoint by pooling or selecting key/value heads and then uptraining so the model adapts. That conversion is a model change, not a harmless file-format rewrite.`,
      ],
    },
    {
      heading: `Why it works`,
      paragraphs: [
        `GQA works because many transformer heads are not perfectly independent resources that each require a private cache representation. Heads specialize, but their useful information can be partly shared. The model can learn to use different query projections against a smaller set of key/value memories. That preserves several ways for the current token to ask about the past while reducing the amount of past state that must remain resident and be streamed through memory.`,
        `The serving win comes from the shape of the bottleneck. LLM generation often spends decode time reading weights and KV cache bytes rather than saturating arithmetic throughput. Shrinking the KV cache does not make attention free, but it reduces one of the largest per-request state tensors. It also compounds with other memory techniques. PagedAttention can reduce cache fragmentation, KV Cache Quantization & Compression can reduce bytes per element, and Sliding-Window Attention Context Policy can bound how many old tokens remain active. GQA reduces the head dimension of the stored state.`,
      ],
    },
    {
      heading: `Real-world uses`,
      paragraphs: [
        `GQA is most useful in decoder-only language models, high-concurrency inference, long-context serving, chat systems with many active sessions, and deployments where memory bandwidth or cache capacity constrains throughput. It is especially valuable when the product cares about time per output token, total active tokens per GPU, or the number of users that can stay resident without evicting state. A model with a smaller KV cache can often run larger batches or support longer conversations on the same hardware.`,
        `It is also useful in edge and cost-sensitive settings. If an on-device model has limited memory, fewer key/value heads can make longer local context possible. If a cloud system charges by accelerator time, higher decode throughput changes unit economics. The benefit is not restricted to very large models. Any autoregressive decoder that stores keys and values across time faces the same scaling law: cache bytes grow with layers, context length, batch size, element width, and key/value head count.`,
      ],
    },
    {
      heading: `Where it fails`,
      paragraphs: [
        `GQA fails when sharing removes information the model needed. The failures may not show up in an average benchmark. They can appear in long-context recall, code completion, multilingual text, rare formats, instruction following, tool-call arguments, or retrieval-grounded answers that depend on a precise token far back in context. A model can look fine on short prompts while degrading on the exact workloads that motivated cache reduction. That is why group count is a quality parameter as much as a systems parameter.`,
        `It can also fail operationally. If kernels do not support the chosen layout efficiently, the theoretical byte saving may not become latency saving. If the workload is prefill-dominated, GQA may help less than expected because the repeated decode cache read is not the main bottleneck. If weights dominate bandwidth, weight quantization or batching may matter more. If the scheduler is poor, smaller cache may simply expose a different bottleneck. GQA should be evaluated inside the full serving stack, not in an isolated architecture diagram.`,
      ],
    },
    {
      heading: `Study next`,
      paragraphs: [
        `Measure both model quality and serving behavior. Quality checks should include perplexity, benchmark accuracy, long-context retrieval tasks, code and math slices, multilingual slices, and side-by-side regressions against a full multi-head baseline or a known production checkpoint. Serving checks should include time to first token, time per output token, tokens per second per GPU, max resident tokens, batch capacity, KV bytes per request, HBM bandwidth, p50 and p99 latency, eviction rate, and behavior under mixed prompt lengths. The best group count is the one that meets product quality while changing the real bottleneck.`,
        `Primary sources are Multi-Query Attention at https://arxiv.org/abs/1911.02150, Grouped-Query Attention at https://arxiv.org/abs/2305.13245, Mistral 7B at https://arxiv.org/abs/2310.06825, and the JAX inference scaling chapter at https://jax-ml.github.io/scaling-book/inference/. Study Attention Mechanism, Multi-Head Attention, KV Cache, Transformer Inference Roofline, KV Cache Concurrency Capacity Model, LLM Serving: PagedAttention, KV Cache Quantization & Compression, Sliding-Window Attention Context Policy, FlashAttention Case Study, DeepSeek Multi-Head Latent Attention, and Benchmark Variance & Model Selection next.`,
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'Standard multi-head attention gives each head its own Q, K, and V projections. During autoregressive inference you cache K and V for all previous tokens so they are not recomputed at every step. With 32 heads and d_model = 4096 each head has dimension 128. The KV cache per layer per token is 2 (K and V) times 32 heads times 128 floats times 2 bytes in fp16, which is 16 KB. For a sequence of length 2048 that is 32 MB per layer. Stack 32 layers and a single sequence holds 1 GB of KV state. A batch of 64 sequences at length 2048 needs roughly 64 GB of KV cache alone.',
        'Multi-Query Attention (Shazeer 2019) was the first escape: share K and V across all heads so only Q gets per-head projections. The KV cache shrinks by the number of heads, a 32x reduction for a 32-head model. Quality drops slightly because every query head reads the same cached representation. GQA (Ainslie et al. 2023) is the compromise. Groups of query heads share KV projections. Eight groups with 32 query heads means 4 query heads per KV head, giving a 4x cache reduction with negligible quality loss on most benchmarks.',
      ],
    },
    {
      heading: 'Cost and behavior',
      paragraphs: [
        'KV cache bytes per layer equal 2 (K and V) times the number of KV heads times the head dimension times the element width times the sequence length. MHA with 32 heads at d_model = 4096 in fp16 stores 2 * 32 * 128 * 2 = 16,384 bytes per token per layer. GQA-8 stores 2 * 8 * 128 * 2 = 4,096 bytes, a 4x reduction. MQA stores 2 * 1 * 128 * 2 = 512 bytes, a 32x reduction.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1b/Transformer%2C_attention_block_diagram.png/250px-Transformer%2C_attention_block_diagram.png', alt: 'Scaled dot-product attention block with query, key, value, mask, softmax, and output', caption: 'The attention block highlights why K and V are persistent decode state while the current token supplies a fresh Q. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Transformer,_attention_block_diagram.png.'},
        'When sequence length doubles the cache doubles. When batch size doubles the cache doubles. GQA changes the constant factor, not the growth rate. The practical effect is that the same GPU can hold more concurrent sequences or longer contexts before evicting state. On bandwidth-bound decode, reading fewer KV bytes per step directly reduces time per output token. The reduction compounds with KV cache quantization: GQA-8 in int8 is 8x smaller than MHA in fp16.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Model: 32 query heads, d_model = 4096, head_dim = 128, seq_len = 1024, fp16 storage, 32 layers.',
        'MHA KV cache per layer: 2 * 1024 * 4096 * 2 bytes = 16 MB. Across 32 layers: 512 MB per sequence. Batch of 8: 4 GB.',
        'MQA (1 KV head): 2 * 1024 * 128 * 2 = 0.5 MB per layer. Across 32 layers: 16 MB per sequence. Batch of 8: 128 MB. That is a 32x reduction.',
        'GQA-8 (8 KV heads): 2 * 1024 * (8 * 128) * 2 = 4 MB per layer. Across 32 layers: 128 MB per sequence. Batch of 8: 1 GB. That is a 4x reduction with near-zero quality loss, which is why LLaMA 2 70B and Mistral chose this operating point.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Shazeer 2019, "Fast Transformer Decoding: One Write-Head is All You Need" (https://arxiv.org/abs/1911.02150) introduced multi-query attention. Ainslie et al. 2023, "GQA: Training Generalized Multi-Query Transformer Models from Multi-Head Checkpoints" (https://arxiv.org/abs/2305.13245) introduced grouped-query attention and the MHA-to-GQA conversion procedure. Pope et al. 2022, "Efficiently Scaling Transformer Inference" (https://arxiv.org/abs/2211.05102) analyzed the KV cache memory bottleneck and its impact on serving throughput. LLaMA 2 70B and Mistral 7B both deploy GQA in production.',
        'Study Multi-Head Attention first if the baseline is unfamiliar. Study KV Cache to understand the memory it reduces. Study FlashAttention for the orthogonal optimization on the compute side rather than the memory side. Study Quantization for another way to shrink KV cache bytes without changing the head count.',
      ],
    },
    {
      heading: 'Micro checks',
      paragraphs: [
        {
          type: 'bullets',
          items: [
            'Can you compute the KV cache size for a standard 32-head, d_model = 4096 model at sequence length 2048?',
            'Can you explain how MQA reduces cache size and what quality tradeoff it makes?',
            'Can you explain why GQA with g groups is strictly between MQA (g = 1) and MHA (g = h) in both cache size and expressivity?',
            'Can you explain why KV cache matters more at inference than training? (Hint: training does not cache across time steps.)',
          ],
        },
      ],
    },
    {
      heading: 'Try this now',
      paragraphs: [
        'Model: 32 heads, d_model = 4096, seq_len = 1024, fp16. Compute the KV cache per sequence across 32 layers for MHA, MQA, and GQA-8. Then compute the batch of 8 totals.',
        'MHA: 2 * 1024 * 4096 * 2 bytes * 32 layers = 512 MB per sequence, 4 GB for batch of 8. MQA: 2 * 1024 * 128 * 2 * 32 = 16 MB per sequence, 128 MB for batch of 8. GQA-8: 2 * 1024 * 1024 * 2 * 32 = 128 MB per sequence, 1 GB for batch of 8. GQA-8 gives 4x savings over MHA with near-zero quality loss. Verify these numbers match the worked example, then try d_model = 8192 with 64 heads and GQA-8 to see how the savings scale.',
      ],
    },
  ],
};
