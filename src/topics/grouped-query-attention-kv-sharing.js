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
        'A query head is one attention subspace used by the current token. A key/value head is cached memory from previous tokens. The animation shows many query heads sharing fewer key/value heads.',
        {type: 'callout', text: 'GQA decouples query-head diversity from KV-cache size: many query heads can read a smaller shared set of key and value memories.'},
        'Each edge is an assignment rule. If four query heads point to one key/value head, those query heads ask different questions but read the same cached memory. Cache size follows key/value head count, not query head count.',
        {type: 'image', src: './assets/gifs/grouped-query-attention-kv-sharing.gif', alt: 'Animated walkthrough of the grouped query attention kv sharing visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Transformer decoders generate one token at a time and reuse prior keys and values through a KV cache. That cache grows with layers, sequence length, batch size, element width, and stored key/value heads. GQA exists because decode often runs into cache capacity and memory bandwidth before arithmetic.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/34/Transformer%2C_full_architecture.png/250px-Transformer%2C_full_architecture.png', alt: 'Transformer encoder-decoder architecture with attention blocks', caption: 'The full transformer diagram shows where attention repeats across layers; GQA changes the cached key/value head count inside those decoder attention blocks. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Transformer,_full_architecture.png.'},
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious layout is full multi-head attention. A 32-head model stores separate keys and values for all 32 heads, which is expressive and simple. Multi-query attention is the opposite extreme: many query heads share one key/value head.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'Full multi-head attention stores too much live state during decode. For long prompts and many users, every new token rereads old keys and values across every layer. Multi-query attention can save memory but may remove useful per-head memory detail.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Query diversity and cache diversity are different resources. Queries are computed for the current token, while keys and values are the stored representation of the past. GQA keeps many query heads but stores fewer key/value heads.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The query projection emits many heads, while key and value projections emit fewer heads. Each query head is assigned to one key/value group. The kernel can broadcast or repeat grouped K and V so each query head attends normally.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d2/Multiheaded_attention%2C_block_diagram.png/250px-Multiheaded_attention%2C_block_diagram.png', alt: 'Multi-head attention block showing parallel attention heads and concatenation', caption: 'Multi-head attention begins with parallel heads. GQA keeps many query heads while reducing how many key/value heads are stored in the decode cache. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Multiheaded_attention,_block_diagram.png.'},
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'It works when several query heads can use one stored representation of prior tokens without losing required information. Different query projections still create different attention scores. The correctness claim is empirical equivalence at a chosen quality bar, not mathematical identity with full multi-head attention.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'KV bytes per token per layer equal 2 for K and V times kv_heads times head_dim times bytes_per_element. With 32 query heads, head_dim 128, and fp16, full MHA stores 2 * 32 * 128 * 2 = 16,384 bytes. GQA with 8 KV heads stores 4,096 bytes, so the cache is 4x smaller.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1b/Transformer%2C_attention_block_diagram.png/250px-Transformer%2C_attention_block_diagram.png', alt: 'Scaled dot-product attention block with query, key, value, mask, softmax, and output', caption: 'The attention block highlights why K and V are persistent decode state while the current token supplies a fresh Q. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Transformer,_attention_block_diagram.png.'},
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'GQA fits decoder-only language models, chat serving, long-context inference, and high-concurrency APIs. The access pattern is repeated cache reads for every generated token. Smaller KV state can mean more resident sessions or lower decode latency on the same accelerator.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'GQA fails when sharing removes detail the model needed. Regressions can appear in long-context recall, code, multilingual text, or tool arguments. It also helps less when the workload is prefill-dominated or kernels handle the layout poorly.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Use 32 query heads, head_dim 128, 32 layers, fp16 cache elements, and sequence length 1,024. Full MHA stores 16,384 bytes per token per layer, so one sequence uses 16 MiB per layer and 512 MiB across 32 layers. A batch of 8 uses about 4 GiB of KV cache.',
        'GQA-8 stores 4,096 bytes per token per layer. One sequence uses 4 MiB per layer and 128 MiB across 32 layers. A batch of 8 uses about 1 GiB, while MQA with one KV head would use 128 MiB for the whole batch but with stronger sharing.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Read Shazeer on multi-query attention, Ainslie et al. on grouped-query attention, and Efficiently Scaling Transformer Inference for the KV-cache bottleneck. Study multi-head attention, KV cache, paged attention, FlashAttention, KV-cache quantization, and inference rooflines next.',
      ],
    },
  ],
};
