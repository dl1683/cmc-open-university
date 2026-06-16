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
      heading: 'What it is',
      paragraphs: [
        'Grouped-query attention is the middle point between standard multi-head attention and multi-query attention. Standard MHA gives each query head its own key and value head. MQA shares one key/value head across all query heads. GQA shares a smaller number of key/value heads across groups of query heads.',
        'The reason this matters is the KV Cache. During autoregressive decode, the server repeatedly reads cached keys and values for every live token. Query heads are computed for the new token, but K/V heads are stored for the whole context. Fewer K/V heads means fewer resident bytes and less memory bandwidth.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'In MHA, 32 query heads usually pair with 32 K/V heads. In MQA, 32 query heads may share one K/V head. In GQA, those 32 query heads might share 8 K/V heads, with each K/V head serving a group of four query heads. The output still has many query views, but the cached state is smaller.',
        'The implementation is mostly a tensor-layout decision, but it changes serving economics. KV cache bytes scale with the number of stored K/V heads. A 32-to-8 reduction cuts that cache dimension by 4x. KV Cache Concurrency Capacity Model turns that directly into more live requests or longer contexts under the same memory budget.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'MQA offers the strongest memory reduction but can degrade quality because every query head has to use the same key/value representation. GQA trades some of that reduction for more representational diversity. The GQA paper also describes uptraining existing multi-head checkpoints into MQA or GQA variants using a small fraction of original pretraining compute, which matters because retraining from scratch is expensive.',
        'Do not treat GQA as a universal free win. The best group count depends on model size, training recipe, context length, hardware, kernels, and quality target. A serving team should measure time per output token, KV memory, acceptance by eval tasks, and rare long-context failures.',
      ],
    },
    {
      heading: 'Case study',
      paragraphs: [
        'Mistral 7B uses grouped-query attention for faster inference and pairs it with sliding-window attention to reduce long-context cost. The combination is instructive: GQA reduces the cache stored per token, while Sliding-Window Attention Context Policy limits how many old tokens each layer keeps attending to.',
        'A cloud inference service sees the same pattern. With full MHA, long conversations push KV memory up quickly. Switching to GQA can admit more users per GPU or preserve a larger context budget. PagedAttention can then reduce fragmentation, and KV quantization can reduce bytes per element.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'Do not confuse query-head count with KV-head count. A model can keep many query heads while storing fewer K/V heads. Do not assume smaller cache means identical quality; sharing can remove useful per-head detail. Do not evaluate only short prompts. The reason GQA matters often appears most clearly in long-context decode.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Multi-Query Attention at https://arxiv.org/abs/1911.02150, GQA at https://arxiv.org/abs/2305.13245, Mistral 7B at https://arxiv.org/abs/2310.06825, and the JAX inference chapter at https://jax-ml.github.io/scaling-book/inference/. Study Multi-Head Attention, KV Cache, KV Cache Concurrency Capacity Model, Transformer Inference Roofline, and Sliding-Window Attention Context Policy next.',
      ],
    },
  ],
};
