// Linear attention prefix state: use kernel feature maps and associativity to
// turn causal attention into a recurrent numerator and denominator state.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'linear-attention-prefix-state-primer',
  title: 'Linear Attention Prefix-State Primer',
  category: 'AI & ML',
  summary: 'A primer on kernelized linear attention: feature-map queries and keys, prefix-sum KV state, normalization state, recurrent decode, and approximation limits.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['prefix state', 'normalization limits'], defaultValue: 'prefix state' },
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

function prefixGraph(title) {
  return graphState({
    nodes: [
      { id: 'x', label: 'x_t', x: 0.6, y: 3.5, note: 'token' },
      { id: 'q', label: 'phi(q)', x: 2.2, y: 2.0, note: 'query' },
      { id: 'k', label: 'phi(k)', x: 2.2, y: 3.5, note: 'key' },
      { id: 'v', label: 'v', x: 2.2, y: 5.0, note: 'value' },
      { id: 's', label: 'S += kv', x: 4.4, y: 3.0, note: 'matrix' },
      { id: 'z', label: 'Z += k', x: 4.4, y: 4.8, note: 'vector' },
      { id: 'num', label: 'qS', x: 6.5, y: 3.0, note: 'num' },
      { id: 'den', label: 'qZ', x: 6.5, y: 4.8, note: 'den' },
      { id: 'y', label: 'y_t', x: 8.6, y: 3.8, note: 'output' },
    ],
    edges: [
      { id: 'e-x-q', from: 'x', to: 'q' },
      { id: 'e-x-k', from: 'x', to: 'k' },
      { id: 'e-x-v', from: 'x', to: 'v' },
      { id: 'e-k-s', from: 'k', to: 's' },
      { id: 'e-v-s', from: 'v', to: 's' },
      { id: 'e-k-z', from: 'k', to: 'z' },
      { id: 'e-q-num', from: 'q', to: 'num' },
      { id: 'e-s-num', from: 's', to: 'num' },
      { id: 'e-q-den', from: 'q', to: 'den' },
      { id: 'e-z-den', from: 'z', to: 'den' },
      { id: 'e-num-y', from: 'num', to: 'y' },
      { id: 'e-den-y', from: 'den', to: 'y' },
    ],
  }, { title });
}

function* prefixState() {
  yield {
    state: prefixGraph('Causal linear attention as prefix state'),
    highlight: { active: ['k', 'v', 's', 'z', 'e-k-s', 'e-v-s', 'e-k-z'], found: ['y'] },
    explanation: 'Linear attention replaces softmax all-pairs attention with feature-map keys and queries. Causal decode keeps two prefix states: a key-value matrix S and a key normalizer vector Z.',
    invariant: 'Associativity moves the expensive sum outside the per-token query.',
  };

  yield {
    state: labelMatrix(
      'Prefix-state fields',
      [
        { id: 'phi', label: 'phi' },
        { id: 's', label: 'S' },
        { id: 'z', label: 'Z' },
        { id: 'num', label: 'num' },
        { id: 'den', label: 'den' },
      ],
      [
        { id: 'shape', label: 'shape' },
        { id: 'job', label: 'job' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['d', 'kernel', 'approx'],
        ['d x d', 'KV sum', 'capacity'],
        ['d', 'norm', 'zero'],
        ['d', 'read', 'scale'],
        ['1', 'divide', 'stable'],
      ],
    ),
    highlight: { active: ['s:job', 'z:job', 'num:job', 'den:job'], compare: ['phi:risk'] },
    explanation: 'The state has a numerator path and a denominator path. Forgetting the normalization state is a common source of wrong linear-attention explanations.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'sequence length', min: 0, max: 8192 }, y: { label: 'relative autoregressive work', min: 0, max: 100 } },
      series: [
        { id: 'softmax', label: 'softmax attention', points: [{ x: 512, y: 1 }, { x: 2048, y: 6 }, { x: 4096, y: 25 }, { x: 8192, y: 100 }] },
        { id: 'linear', label: 'linear prefix', points: [{ x: 512, y: 5 }, { x: 2048, y: 14 }, { x: 4096, y: 28 }, { x: 8192, y: 56 }] },
      ],
      markers: [
        { id: 'decode', x: 8192, y: 56, label: 'state decode' },
      ],
    }),
    highlight: { active: ['linear', 'decode'], compare: ['softmax'] },
    explanation: 'The main systems promise is autoregressive decoding with state that does not append a full row of KV for every token. The real speed still depends on the feature dimension and kernel quality.',
  };

  yield {
    state: prefixGraph('Read is a matrix-vector operation'),
    highlight: { active: ['q', 's', 'z', 'num', 'den', 'e-q-num', 'e-s-num', 'e-q-den', 'e-z-den'], found: ['y'] },
    explanation: 'At a new token, the query reads the accumulated state instead of scanning all previous tokens. This is why linear attention is also a recurrent model in disguise.',
  };
}

function* normalizationLimits() {
  yield {
    state: labelMatrix(
      'Attention memory tradeoff',
      [
        { id: 'soft', label: 'softmax' },
        { id: 'lin', label: 'linear' },
        { id: 'perf', label: 'Performer' },
        { id: 'hyb', label: 'hybrid' },
      ],
      [
        { id: 'memory', label: 'memory' },
        { id: 'quality', label: 'quality' },
        { id: 'cost', label: 'cost' },
      ],
      [
        ['KV', 'exact', 'big'],
        ['prefix', 'kernel', 'small'],
        ['random', 'approx', 'var'],
        ['mix', 'guard', 'hard'],
      ],
    ),
    highlight: { active: ['lin:memory', 'perf:memory'], compare: ['soft:cost'], found: ['hyb:quality'] },
    explanation: 'Linear attention is a family, not one trick. Some methods use deterministic feature maps; Performer uses random features to approximate softmax attention. Each changes quality and variance.',
  };

  yield {
    state: labelMatrix(
      'Failure modes',
      [
        { id: 'cap', label: 'cap' },
        { id: 'norm', label: 'norm' },
        { id: 'sign', label: 'sign' },
        { id: 'recall', label: 'recall' },
        { id: 'kernel', label: 'kernel' },
      ],
      [
        { id: 'symptom', label: 'sym' },
        { id: 'gate', label: 'gate' },
      ],
      [
        ['blur', 'retrieval'],
        ['NaN', 'epsilon'],
        ['neg', 'feature'],
        ['miss', 'RULER'],
        ['slow', 'bench'],
      ],
    ),
    highlight: { active: ['cap:gate', 'norm:gate', 'recall:gate', 'kernel:gate'], compare: ['sign:symptom'] },
    explanation: 'Prefix state is compressed memory. It needs tests for retrieval blur, numerical normalization, feature-map assumptions, and actual kernel speed.',
    invariant: 'A smaller state is useful only if the lost interactions are not needed by the task.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'feature dimension', min: 0, max: 256 }, y: { label: 'quality / stability, conceptual', min: 0, max: 1 } },
      series: [
        { id: 'quality', label: 'approx quality', points: [{ x: 16, y: 0.45 }, { x: 32, y: 0.58 }, { x: 64, y: 0.72 }, { x: 128, y: 0.82 }, { x: 256, y: 0.88 }] },
        { id: 'cost', label: 'inverse cost', points: [{ x: 16, y: 0.92 }, { x: 32, y: 0.85 }, { x: 64, y: 0.72 }, { x: 128, y: 0.55 }, { x: 256, y: 0.35 }] },
      ],
      markers: [
        { id: 'trade', x: 96, y: 0.66, label: 'tradeoff' },
      ],
    }),
    highlight: { active: ['quality', 'cost', 'trade'] },
    explanation: 'More feature dimensions can improve the approximation but raise compute and memory. Linear attention still has a model-design budget, just a different one from KV cache.',
  };

  yield {
    state: prefixGraph('Complete case: streaming decoder'),
    highlight: { active: ['s', 'z', 'num', 'den', 'y', 'e-s-num', 'e-z-den', 'e-num-y', 'e-den-y'], compare: ['q', 'k', 'v'] },
    explanation: 'A streaming decoder keeps S and Z per layer. Each new token updates the state, reads through the current query, divides by the normalizer, emits output, and logs numerical health.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'prefix state') yield* prefixState();
  else if (view === 'normalization limits') yield* normalizationLimits();
  else throw new InputError('Pick a linear-attention view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'Linear attention is an attention variant that replaces the softmax attention matrix with kernel feature maps so causal attention can be computed through prefix state. Instead of appending every old key and value to a KV cache, the layer keeps a key-value state matrix and a normalization vector.',
        'This is the missing primitive underneath several later architectures. RetNet, DeltaNet, Gated DeltaNet, Kimi Delta Attention, and SSD-style models all reuse the idea that sequence history can be represented as updateable state rather than a full list of past token vectors.',
      ],
    },
    {
      heading: 'Data structures',
      paragraphs: [
        'The core records are phi(q), phi(k), value v, numerator state S, denominator state Z, epsilon or stabilization metadata, precision policy, and per-layer state reset policy. S is usually an accumulated sum of key-value outer products. Z is the accumulated key feature state used to normalize the output.',
        'This looks like a small database index: writes add key-value evidence, reads query the index, and normalization keeps scores comparable. The difference is that every operation must remain differentiable and accelerator-friendly.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The algebra relies on associativity. Instead of computing each query against every previous key and value separately, the model accumulates key-value products into prefix state. A query then multiplies that state to get a numerator and divides by a query-normalizer product to get the output.',
        'During autoregressive decode, this is recurrent. The layer updates S and Z once per token and carries them forward. During training, implementations may use scans or chunking to expose more parallelism. That is why this topic belongs beside RWKV, Mamba, RetNet, and Mamba-2.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'A team builds a streaming summarizer for long logs. Full attention is too expensive because the log keeps growing. A linear-attention layer stores prefix state for old log lines. The current token reads from that state, emits output, then writes its own key-value evidence. The serving system logs state size, denominator minima, numerical overflows, recall tests, and latency.',
        'The quality gate is strict. The model must still find old error IDs, timestamps, and causal chains. If exact retrieval fails, the architecture may need periodic full attention, a retrieval tool, or a hybrid budget rather than pure linear state.',
      ],
    },
    {
      heading: 'Pitfalls and sources',
      paragraphs: [
        'Do not say linear attention is simply softmax attention made faster. Feature maps change the attention kernel, and approximations can lose exact interactions. Do not ignore the denominator state. Do not evaluate only short contexts, where the memory benefit is least important and recall failures may be hidden.',
        'Primary sources: Transformers are RNNs: Fast Autoregressive Transformers with Linear Attention at https://arxiv.org/abs/2006.16236, Rethinking Attention with Performers at https://arxiv.org/abs/2009.14794, and Linear Transformers Are Secretly Fast Weight Programmers at https://arxiv.org/abs/2102.11174. Study Fast Weight Delta-Rule Memory Case Study, Mamba-2 Structured State Space Duality Case Study, RetNet Retention State Case Study, Kimi Linear Attention, KV Cache, Attention, and Hybrid Attention State Budget Case Study next.',
      ],
    },
  ],
};
