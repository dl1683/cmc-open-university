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
        'The animation shows tokens arriving one at a time. A token is a unit of text after tokenization, such as a word piece. Standard attention stores keys and values for every prior token; linear attention folds them into prefix state.',
        'Read S as the accumulated key-value summary and Z as the accumulated key summary used for normalization. The active query reads from those summaries instead of building a full table against every previous token. The safe inference is that memory grows with feature size, not with the number of stored token pairs.',
        {type: 'image', src: './assets/gifs/linear-attention-prefix-state-primer.gif', alt: 'Animated walkthrough of the linear attention prefix state primer visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Self-attention lets each token use information from earlier tokens, but exact attention builds interactions between many token pairs. For a context of n tokens, the attention table has n by n scores during full-sequence processing. Long context makes that table and the key-value cache expensive.',
        'Linear attention exists to change the storage contract. Instead of keeping every past token separately for the attention computation, it keeps updateable prefix statistics. That makes streaming and long-context processing cheaper when the approximation fits the task.',
        {type: 'callout', text: 'Linear attention trades exact token history for updateable prefix state, so memory grows with feature dimension instead of context length.'},
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is exact softmax attention. For each query, compute its score against every previous key, apply softmax normalization, and take a weighted sum of values. This is expressive because every token can directly attend to every prior token.',
        'Caching helps during generation. The model stores previous keys and values, so each new token only computes attention from the new query to the existing cache. The cache still grows linearly with context length, and prefill still has quadratic all-pairs work.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is sequence length. A 4096-token prompt has over 16 million query-key score positions in full attention. A 65536-token prompt has over 4 billion positions, before counting heads, layers, and batch size.',
        'During decode, memory becomes the bottleneck. Every active request keeps key-value cache entries for every layer and prior token. Long contexts reduce batch size, raise latency, and make serving capacity depend on cache residency as much as raw compute.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Rewrite attention so keys and queries pass through a feature map phi. If attention weights can be expressed through positive feature products, then sums over past tokens can be accumulated incrementally. The model stores S = sum phi(k_t) v_t and Z = sum phi(k_t).',
        'A new query q computes phi(q), then reads numerator phi(q)S and denominator phi(q)Z. The prefix state contains the information needed for the approximation. The old tokens do not need to be revisited individually for that attention read.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/2/23/Directed_graph_no_background.svg', alt: 'Directed graph with nodes connected by arrows.', caption: 'Prefix state is a directed dataflow: key features and values write into S and Z, and later queries read through those states. Source: Wikimedia Commons, David W., public domain.'},
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'For each incoming token, compute its key feature phi(k) and value v. Update S by adding the outer product phi(k) times v. Update Z by adding phi(k). These two updates are the prefix state.',
        'For a later query, compute phi(q). The output is phi(q)S divided by phi(q)Z, with small numerical safeguards to avoid division by zero. Causal order is preserved because each query reads only the prefix state built from earlier tokens.',
        'Training usually processes chunks or sequences with parallel prefix-sum techniques. Inference can update state one token at a time. The exact implementation depends on the chosen feature map, normalization, and model architecture.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The algebraic invariant is that S and Z equal the sums over all previous transformed keys and values. After token t is added, the new state is the old sum plus that token contribution. By induction, the state after t tokens equals the full prefix sum.',
        'The query formula is therefore the same as evaluating the kernelized attention sum over the prefix, but without enumerating each past token. Correctness is exact for the chosen kernelized formula. It is an approximation only relative to softmax attention if the feature map is meant to approximate softmax.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'If the feature dimension is r and value dimension is d, the prefix state S has r by d entries and Z has r entries per head. Updating one token costs O(rd), and reading one query also costs O(rd). The cost no longer grows with context length for each new token.',
        'When context length doubles, exact attention work and cache storage grow with the number of tokens. Linear attention keeps per-layer state size fixed for a stream, but it pays in feature dimension and possible quality loss. The dominant behavior is the chosen r and how much information the compressed state can preserve.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Linear attention is useful for streaming, long-document, audio, and time-series workloads where the model needs long histories but cannot afford exact all-pairs attention. The access pattern is append-only context with repeated reads from the accumulated prefix. That is exactly the pattern prefix state serves.',
        'It also appears in architectures that blend recurrent and attention-like behavior. The model gets constant-size state updates like a recurrent network while retaining a content-based read rule. The fit is strongest when tasks need broad history more than exact token-to-token retrieval.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/4/46/Colored_neural_network.svg', alt: 'Layered neural network diagram with input, hidden, and output nodes.', caption: 'Linear attention is still a neural layer; the storage contract changes, but the state is trained inside the model graph. Source: Wikimedia Commons, Glosser.ca, CC BY-SA 3.0.'},
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'The compressed state can lose information. Exact attention can focus sharply on one specific prior token because that token remains separately addressable. A fixed-size prefix summary may blur distinct events that map to similar features.',
        'Numerical stability also matters. Feature maps must usually be nonnegative for the normalization to behave like attention, and denominators can become small. Some tasks benefit more from exact retrieval, sparse attention, sliding windows, or hybrid memory than from fully linear attention.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Use one head with feature dimension r = 2 and value dimension d = 1. Suppose phi(k1) = [1, 2] with value 3, and phi(k2) = [2, 1] with value 5. Then S = [1*3 + 2*5, 2*3 + 1*5] = [13, 11], and Z = [1+2, 2+1] = [3, 3].',
        'For a query with phi(q) = [1, 1], the numerator is [1,1] dot [13,11] = 24. The denominator is [1,1] dot [3,3] = 6. The output is 24 / 6 = 4, which is the normalized weighted value from the prefix state.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Study Katharopoulos et al., Transformers are RNNs: Fast Autoregressive Transformers with Linear Attention, 2020, and Performer for random-feature softmax approximation. The shared lesson is that algebraic factorization can replace explicit all-pairs attention under the right kernel.',
        'Study next by layer. Review softmax attention, key-value cache, prefix sums, kernel methods, recurrent neural networks, and sliding-window attention. Then compare linear attention with sparse attention, state-space models, and hybrid long-context architectures.',
      ],
    },
  ],
};
