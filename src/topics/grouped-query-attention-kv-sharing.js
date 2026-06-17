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

  const activeEdges = layout === 'MHA'
    ? ['e-q0-kv0', 'e-q1-kv1', 'e-q2-kv2', 'e-q3-kv3', 'e-q4-kv4', 'e-q5-kv5', 'e-q6-kv6', 'e-q7-kv7']
    : layout === 'GQA'
      ? ['e-q0-kv0', 'e-q1-kv0', 'e-q2-kv0', 'e-q3-kv0', 'e-q4-kv1', 'e-q5-kv1', 'e-q6-kv1', 'e-q7-kv1']
      : ['e-q0-kv0', 'e-q1-kv0', 'e-q2-kv0', 'e-q3-kv0', 'e-q4-kv0', 'e-q5-kv0', 'e-q6-kv0', 'e-q7-kv0'];

  yield {
    state: sharingGraph(layout),
    highlight: { active: activeEdges, found: ['q0', 'q1', 'q2', 'q3'], compare: ['q4', 'q5', 'q6', 'q7'] },
    explanation: layout === 'MHA'
      ? 'Multi-head attention gives every query head its own cached K/V head. That maximizes per-head separation but stores the largest KV cache.'
      : layout === 'GQA'
        ? 'Grouped-query attention keeps many query heads but shares fewer K/V heads. Here eight query heads read from two cached K/V heads.'
        : 'Multi-query attention is the extreme: many query heads share one cached K/V head. It minimizes KV traffic but can lose quality.',
    invariant: 'Decode cache size scales with KV heads, not query heads.',
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
    explanation: 'GQA sits between MHA and MQA. It captures most of the serving-memory win while keeping more K/V diversity than a single shared head.',
  };

  yield {
    state: bytesPlot([
      { id: 'mqa', x: 1, y: 3.125, label: 'MQA' },
      { id: 'gqa8', x: 8, y: 25, label: 'GQA 8 KV heads' },
      { id: 'mha', x: 32, y: 100, label: 'MHA' },
    ]),
    highlight: { active: ['kv-bytes'], found: ['mqa', 'gqa8', 'mha'] },
    explanation: 'If a model keeps 32 query heads but stores only 8 KV heads, the KV cache is about one quarter of the full multi-head layout.',
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
    explanation: 'The strongest production effect appears during inference. Smaller K/V tensors reduce memory bandwidth, increase concurrency, and make long contexts less punishing.',
  };
}

export const article = {
  sections: [
    {
      heading: `What it is`,
      paragraphs: [
        `Grouped-query attention is an attention layout for transformer decoders that keeps many query heads but shares a smaller number of key/value heads. In ordinary multi-head attention, each query head has its own key projection and value projection. During autoregressive generation, the model caches those keys and values for every previous token so it does not recompute them at every step. That cache is the KV Cache. It is essential for fast decoding, but it grows with context length, batch size, layers, and the number of stored key/value heads.`,
        `GQA changes the cache geometry. A model might keep 32 query heads but store only 8 key/value heads. Each key/value head serves a group of query heads. Multi-query attention is the extreme version, where all query heads share one key/value head. Full multi-head attention is the other extreme, where query heads and key/value heads have the same count. GQA is the middle point: much smaller cache than full multi-head attention, more key/value diversity than multi-query attention.`,
      ],
    },
    {
      heading: `The obvious approach and the wall`,
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
      heading: `Mechanism`,
      paragraphs: [
        `In implementation terms, attention still computes queries, keys, values, attention scores, a softmax, and a weighted sum of values. The change is the shape of the projections. The query projection produces many query heads. The key and value projections produce fewer heads. At attention time, each query head is assigned to a key/value group. The grouped key/value tensors may be repeated or broadcast logically so the attention kernel can pair every query head with its group's cached keys and values.`,
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
      heading: `Where it is useful`,
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
      heading: `Evaluation signals and study next`,
      paragraphs: [
        `Measure both model quality and serving behavior. Quality checks should include perplexity, benchmark accuracy, long-context retrieval tasks, code and math slices, multilingual slices, and side-by-side regressions against a full multi-head baseline or a known production checkpoint. Serving checks should include time to first token, time per output token, tokens per second per GPU, max resident tokens, batch capacity, KV bytes per request, HBM bandwidth, p50 and p99 latency, eviction rate, and behavior under mixed prompt lengths. The best group count is the one that meets product quality while changing the real bottleneck.`,
        `Primary sources are Multi-Query Attention at https://arxiv.org/abs/1911.02150, Grouped-Query Attention at https://arxiv.org/abs/2305.13245, Mistral 7B at https://arxiv.org/abs/2310.06825, and the JAX inference scaling chapter at https://jax-ml.github.io/scaling-book/inference/. Study Attention Mechanism, Multi-Head Attention, KV Cache, Transformer Inference Roofline, KV Cache Concurrency Capacity Model, LLM Serving: PagedAttention, KV Cache Quantization & Compression, Sliding-Window Attention Context Policy, FlashAttention Case Study, DeepSeek Multi-Head Latent Attention, and Benchmark Variance & Model Selection next.`,
      ],
    },
  ],
};
