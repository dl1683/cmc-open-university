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
    explanation: `${topic.title} replaces softmax all-pairs attention with feature-map keys and queries. Causal decode keeps two prefix states: a key-value matrix S and a key normalizer vector Z across ${9} graph nodes.`,
    invariant: `Associativity moves the expensive sum outside the per-token query in this ${topic.category} primitive.`,
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
    explanation: `The ${topic.id} state has a numerator path and a denominator path. Forgetting the normalization state is a common source of wrong linear-attention explanations in ${topic.category}.`,
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
    explanation: `The main systems promise of ${topic.title} is autoregressive decoding with state that does not append a full row of KV for every token. At sequence length ${8192}, the real speed still depends on the feature dimension and kernel quality.`,
  };

  yield {
    state: prefixGraph('Read is a matrix-vector operation'),
    highlight: { active: ['q', 's', 'z', 'num', 'den', 'e-q-num', 'e-s-num', 'e-q-den', 'e-z-den'], found: ['y'] },
    explanation: `At a new token, the query reads the accumulated state instead of scanning all previous tokens. This is why ${topic.title} is also a recurrent model in disguise.`,
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
    explanation: `${topic.title} covers a family, not one trick. Some methods use deterministic feature maps; Performer uses random features to approximate softmax attention. Each changes quality and variance in ${topic.category}.`,
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
    explanation: `Prefix state is compressed memory with ${5} failure modes to watch. It needs tests for retrieval blur, numerical normalization, feature-map assumptions, and actual kernel speed.`,
    invariant: `A smaller state in ${topic.title} is useful only if the lost interactions are not needed by the task.`,
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
    explanation: `More feature dimensions can improve the approximation but raise compute and memory. ${topic.title} still has a model-design budget, with the tradeoff around dimension ${96}, just a different budget from KV cache.`,
  };

  yield {
    state: prefixGraph('Complete case: streaming decoder'),
    highlight: { active: ['s', 'z', 'num', 'den', 'y', 'e-s-num', 'e-z-den', 'e-num-y', 'e-den-y'], compare: ['q', 'k', 'v'] },
    explanation: `A streaming decoder keeps S and Z per layer across all ${9} nodes in the ${topic.title} graph. Each new token updates the state, reads through the current query, divides by the normalizer, emits output, and logs numerical health.`,
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
      heading: 'How to read the animation',
      paragraphs: [
        'Follow the visualization step by step. Each frame shows one operation with the current state highlighted. Use the slider or play button to control playback.',
        {type: 'image', src: './assets/gifs/linear-attention-prefix-state-primer.gif', alt: 'Animated walkthrough of the linear attention prefix state primer visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Softmax attention is powerful partly because every token can compare itself to every earlier token. The price is that autoregressive decoding keeps a growing KV cache and each new token has more history to address.',
        'Linear attention exists to ask a data-structure question: can the useful part of the past be stored in fixed-size prefix state instead of a full list of keys and values?',
        {type: 'callout', text: 'Linear attention trades exact token history for updateable prefix state, so memory grows with feature dimension instead of context length.'},
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is to keep exact attention and optimize the cache. That is still the right answer for many workloads. Exact KV state preserves token-level interactions and makes copy, retrieval, and inspection easier.',
        'The wall appears when context gets long, serving memory becomes the bottleneck, or latency grows with every generated token. Compression becomes tempting, but compression means some interactions are no longer individually available.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is the softmax. Standard attention normalizes a query against the actual set of previous keys. You cannot simply sum values and call it attention; the denominator is part of the computation.',
        'The second wall is approximation. Feature maps can make the algebra associative, but they change the attention kernel or approximate it. Faster memory is useful only when the lost exact interactions are not the ones the task needs.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Use a kernel feature map so the attention sum can be rearranged. Instead of computing each query against every past key-value pair, accumulate prefix state first and let the current query read from that state.',
        'There are two states, not one. S stores accumulated key-value outer products for the numerator. Z stores accumulated key features for the denominator. Forgetting Z is the common explanation bug.',
      ],
    },
    {
      heading: 'Data structures',
      paragraphs: [
        'The core records are phi(q), phi(k), value v, numerator state S, denominator state Z, epsilon or stabilization metadata, precision policy, and per-layer reset policy. S is usually an accumulated sum of key-value outer products. Z is the accumulated key-feature vector used to normalize reads.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/2/23/Directed_graph_no_background.svg', alt: 'Directed graph with nodes connected by arrows.', caption: 'Prefix state is a directed dataflow: key features and values write into S and Z, and later queries read through those states. Source: Wikimedia Commons, David W., public domain.'},
        'This looks like a small database index. Writes add key-value evidence, reads query the index, and normalization keeps scores comparable. The difference is that every operation must remain differentiable and accelerator-friendly.',
      ],
    },
    {
      heading: 'What the animation teaches',
      paragraphs: [
        'The prefix-state view shows the algebraic bargain. Instead of keeping every old key and value, the layer keeps accumulated S and Z states. A new query reads through those states and then the current token updates them.',
        'The normalization view shows why this is still attention-shaped. The numerator alone is not enough. The denominator state keeps the output scaled by the accumulated key features, and bad normalization can break an otherwise attractive memory design.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The algebra relies on associativity. A token writes phi(k) outer-product v into S and adds phi(k) into Z. A later query computes phi(q)S for the numerator and phi(q)Z for the denominator, then divides.',
        'During autoregressive decode, this is recurrent. The layer updates S and Z once per token and carries them forward. During training, implementations use scans or chunking to expose parallelism instead of running a fully serial loop.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'It works when the feature map preserves the interactions the task actually needs. The model no longer stores a row for every old token, but it still has an updateable summary that future queries can read.',
        'It also works because the state size can be independent of sequence length. That changes the serving budget: memory and per-token decode can depend more on feature dimension than on the number of previous tokens.',
      ],
    },
    {
      heading: 'Cost and behavior',
      paragraphs: [
        'The cost moves from KV-cache length to feature dimension, state matrices, numerical stability, and kernel quality. A large feature map can erase the practical win. A small one can blur important distinctions.',
        'Production systems should track denominator minima, NaNs, precision casts, state reset boundaries, long-context recall, output drift, and actual accelerator speed. A theoretical linear curve is not enough.',
        'The state also changes observability. With exact KV cache, a system can inspect or reason about individual token positions more directly. With compressed prefix state, the past has been folded into matrices. Debugging a missed citation, copied identifier, or old timestamp may require task-level probes rather than token-level cache inspection.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'Linear attention wins when the workload benefits from long streaming state and does not require exact token-level recall at every layer. It is attractive for streaming summarization, some long-signal modeling, and hybrid architectures that reserve exact attention for selected layers or windows.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/4/46/Colored_neural_network.svg', alt: 'Layered neural network diagram with input, hidden, and output nodes.', caption: 'Linear attention is still a neural layer; the storage contract changes, but the state is trained inside the model graph. Source: Wikimedia Commons, Glosser.ca, CC BY-SA 3.0.'},
        'It is also the conceptual bridge to RetNet, DeltaNet, Gated DeltaNet, Kimi Delta Attention, and SSD-style models. Those systems differ in update rule and gating, but they share the prefix-state question.',
        'It is especially useful as a teaching bridge because it forces the learner to ask what memory means. A KV cache is a list of past token evidence. A prefix state is a compressed sufficient-statistic candidate. Those are different promises.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'It fails when the compressed state loses rare but important interactions: exact IDs, code symbols, citations, timestamps, or needle-in-context facts. Retrieval-heavy tasks often expose this faster than average language-model loss.',
        'It also fails when the explanation ignores normalization. A numerator-only story is not attention. A denominator that gets too small or unstable can produce bad outputs even if the high-level algorithm sounds right.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'A team builds a streaming summarizer for long logs. Full attention is too expensive because the log keeps growing. A linear-attention layer stores prefix state for old log lines. The current token reads from that state, emits output, then writes its own key-value evidence.',
        'The quality gate is strict. The model must still find old error IDs, timestamps, and causal chains. If exact retrieval fails, the architecture may need periodic full attention, an external retrieval tool, or a hybrid state budget rather than pure linear state.',
      ],
    },
    {
      heading: 'Deployment review',
      paragraphs: [
        'A deployment review should compare exact-attention baselines, linear-state variants, and hybrid designs on the same long-context tasks. Measure not only average loss, but needle retrieval, citation accuracy, code-symbol recall, streaming latency, memory footprint, and numerical failures.',
        'The key policy question is where exact memory is still needed. Some architectures keep exact attention over a local window and linear state for distant context. Others add retrieval or periodic summary tokens. The best design is usually a memory budget, not a slogan about linear complexity.',
        'Numerical health belongs in the review. Prefix states can accumulate over long streams, and small denominator values, low-precision accumulation, or reset mistakes can produce unstable outputs. A fast linear layer that silently drifts is not a usable memory system.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Consider a decoder reading a long sensor stream. Each new token contributes a key feature and value to S and Z. The next query reads the accumulated state to produce an output without scanning every prior token. If the task is smoothing or summarizing broad trends, that fixed state can be enough.',
        'Now change the task: the model must remember one exact serial number from 40,000 tokens ago. A compressed prefix state may blur that rare fact. The architecture may need exact local attention, retrieval, or a special memory mechanism. The example shows why linear attention is a tradeoff, not a free replacement for full attention.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Primary sources: Transformers are RNNs: Fast Autoregressive Transformers with Linear Attention at https://arxiv.org/abs/2006.16236, Rethinking Attention with Performers at https://arxiv.org/abs/2009.14794, and Linear Transformers Are Secretly Fast Weight Programmers at https://arxiv.org/abs/2102.11174. Study Fast Weight Delta-Rule Memory Case Study, Mamba-2 Structured State Space Duality Case Study, RetNet Retention State Case Study, Kimi Linear Attention, KV Cache, Attention, and Hybrid Attention State Budget Case Study next.',
      ],
    },
  ],
};
