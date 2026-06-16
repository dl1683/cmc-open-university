// RWKV: a language-model architecture with Transformer-like parallel training
// and RNN-like recurrent inference.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'rwkv-recurrent-transformer',
  title: 'RWKV Recurrent Transformer',
  category: 'AI & ML',
  summary: 'RWKV mixes Receptance, Weight decay, Key, and Value signals so a model can train in parallel but decode with a compact recurrent state.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['time-mix block', 'training vs inference'], defaultValue: 'time-mix block' },
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

function rwkvGraph(title) {
  return graphState({
    nodes: [
      { id: 'xt', label: 'token t', x: 0.8, y: 3.8, note: 'current input' },
      { id: 'mix', label: 'token shift', x: 2.4, y: 3.8, note: 'prev+current' },
      { id: 'r', label: 'R', x: 4.0, y: 2.1, note: 'receptance gate' },
      { id: 'k', label: 'K', x: 4.0, y: 3.8, note: 'key' },
      { id: 'v', label: 'V', x: 4.0, y: 5.5, note: 'value' },
      { id: 'w', label: 'W decay', x: 5.8, y: 3.8, note: 'time weighting' },
      { id: 'state', label: 'state', x: 7.4, y: 3.8, note: 'summarized past' },
      { id: 'out', label: 'output', x: 9.0, y: 3.8, note: 'block result' },
    ],
    edges: [
      { id: 'e-xt-mix', from: 'xt', to: 'mix', weight: '' },
      { id: 'e-mix-r', from: 'mix', to: 'r', weight: '' },
      { id: 'e-mix-k', from: 'mix', to: 'k', weight: '' },
      { id: 'e-mix-v', from: 'mix', to: 'v', weight: '' },
      { id: 'e-k-w', from: 'k', to: 'w', weight: '' },
      { id: 'e-v-w', from: 'v', to: 'w', weight: '' },
      { id: 'e-w-state', from: 'w', to: 'state', weight: '' },
      { id: 'e-r-out', from: 'r', to: 'out', weight: '' },
      { id: 'e-state-out', from: 'state', to: 'out', weight: '' },
    ],
  }, { title });
}

function* timeMixBlock() {
  yield {
    state: labelMatrix(
      'RWKV block recipe',
      [
        { id: 'r', label: 'R' },
        { id: 'w', label: 'W' },
        { id: 'k', label: 'K' },
        { id: 'v', label: 'V' },
      ],
      [
        { id: 'role', label: 'role' },
        { id: 'analogy', label: 'analogy' },
      ],
      [
        ['gate', 'query'],
        ['decay', 'pos'],
        ['score', 'key'],
        ['data', 'value'],
      ],
    ),
    highlight: { active: ['r:role', 'w:role', 'k:role', 'v:role'] },
    explanation: 'RWKV stands for the ingredients that replace explicit all-pairs attention: a receptance gate, a trainable time-decay weight, keys, and values.',
  };

  yield {
    state: rwkvGraph('A time-mix block turns past tokens into recurrent state'),
    highlight: { active: ['r', 'w', 'k', 'v'], found: ['state', 'out'] },
    explanation: 'The time-mix block combines current and previous token information, builds R/K/V signals, applies time decay, updates a compact state, and gates what reaches the output.',
    invariant: 'At inference, the block carries state forward instead of storing an attention matrix.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'tokens back in time', min: 0, max: 10 }, y: { label: 'relative memory weight', min: 0, max: 1 } },
      series: [
        { id: 'fast', label: 'fast decay channel', points: [
          { x: 0, y: 1.0 }, { x: 1, y: 0.55 }, { x: 2, y: 0.30 }, { x: 3, y: 0.17 }, { x: 4, y: 0.09 }, { x: 5, y: 0.05 },
        ] },
        { id: 'slow', label: 'slow decay channel', points: [
          { x: 0, y: 1.0 }, { x: 1, y: 0.88 }, { x: 2, y: 0.77 }, { x: 3, y: 0.68 }, { x: 4, y: 0.60 }, { x: 5, y: 0.53 },
        ] },
      ],
      markers: [
        { id: 'recent', x: 1, y: 0.88, label: 'recent' },
        { id: 'long', x: 5, y: 0.53, label: 'longer trace' },
      ],
    }),
    highlight: { active: ['fast', 'slow'], found: ['recent', 'long'] },
    explanation: 'Different channels can learn different decay behavior. Some forget quickly; others preserve longer traces. This is the recurrent memory policy that competes with direct attention.',
  };

  yield {
    state: labelMatrix(
      'Time-mix and channel-mix split the work',
      [
        { id: 'time', label: 'time-mix' },
        { id: 'channel', label: 'channel-mix' },
        { id: 'residual', label: 'residual stack' },
      ],
      [
        { id: 'job', label: 'job' },
        { id: 'transformer rhyme', label: 'transformer rhyme' },
      ],
      [
        ['mix information over positions', 'attention-like role'],
        ['mix features within a token', 'feed-forward-like role'],
        ['add block outputs to stream', 'Transformer block pattern'],
      ],
    ),
    highlight: { active: ['time:job', 'channel:job'], found: ['residual:transformer rhyme'] },
    explanation: 'RWKV is not an old vanilla RNN. It keeps Transformer-era residual blocks and feature mixing while changing how time is handled.',
  };
}

function* trainingVsInference() {
  yield {
    state: labelMatrix(
      'Two execution views of the same model',
      [
        { id: 'train', label: 'training' },
        { id: 'infer', label: 'inference' },
      ],
      [
        { id: 'view', label: 'view' },
        { id: 'benefit', label: 'benefit' },
        { id: 'cost', label: 'cost' },
      ],
      [
        ['parallel sequence computation', 'accelerator-friendly', 'more complex kernels'],
        ['recurrent state update', 'constant memory per token', 'compressed history'],
      ],
    ),
    highlight: { active: ['train:benefit', 'infer:benefit'], compare: ['infer:cost'] },
    explanation: 'The paper frames RWKV as reconciling a classic tradeoff: train in a parallel form like Transformers, then run inference in an RNN form with compact state.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'sequence length', min: 0, max: 4096 }, y: { label: 'relative decode memory', min: 0, max: 100 } },
      series: [
        { id: 'transformer', label: 'Transformer KV cache', points: [
          { x: 256, y: 6 }, { x: 512, y: 12 }, { x: 1024, y: 25 }, { x: 2048, y: 50 }, { x: 4096, y: 100 },
        ] },
        { id: 'rwkv', label: 'RWKV recurrent state', points: [
          { x: 256, y: 8 }, { x: 512, y: 8 }, { x: 1024, y: 8 }, { x: 2048, y: 8 }, { x: 4096, y: 8 },
        ] },
      ],
      markers: [
        { id: 'longctx', x: 4096, y: 8, label: 'fixed state' },
      ],
    }),
    highlight: { active: ['rwkv'], compare: ['transformer'], found: ['longctx'] },
    explanation: 'At decode time, a Transformer KV cache grows with context length. RWKV can carry a fixed-size recurrent state, which makes long streaming contexts attractive if quality holds.',
  };

  yield {
    state: graphState({
      nodes: [
        { id: 'tokens', label: 'tokens', x: 0.9, y: 3.8, note: 'sequence' },
        { id: 'parallel', label: 'parallel train', x: 3.0, y: 2.4, note: 'batch scan' },
        { id: 'weights', label: 'same weights', x: 5.0, y: 3.8, note: 'RWKV block' },
        { id: 'state', label: 'stateful decode', x: 7.0, y: 5.2, note: 'one token step' },
        { id: 'serve', label: 'serve stream', x: 9.0, y: 3.8, note: 'constant state' },
      ],
      edges: [
        { id: 'e-tokens-parallel', from: 'tokens', to: 'parallel', weight: '' },
        { id: 'e-parallel-weights', from: 'parallel', to: 'weights', weight: '' },
        { id: 'e-weights-state', from: 'weights', to: 'state', weight: '' },
        { id: 'e-state-serve', from: 'state', to: 'serve', weight: '' },
      ],
    }, { title: 'Parallel training and recurrent serving meet at the same block' }),
    highlight: { active: ['parallel', 'state'], found: ['serve'] },
    explanation: 'The model is easiest to reason about as a pair of equivalent execution views: a parallel view for training throughput and a recurrent view for serving.',
  };

  yield {
    state: labelMatrix(
      'RWKV belongs beside attention, Mamba, and KV cache',
      [
        { id: 'attention', label: 'Attention' },
        { id: 'mamba', label: 'Mamba / SSM' },
        { id: 'kv', label: 'KV Cache' },
        { id: 'rwkv', label: 'RWKV' },
      ],
      [
        { id: 'memory model', label: 'memory model' },
        { id: 'core question', label: 'core question' },
      ],
      [
        ['direct all-pairs lookup', 'is exact context worth O(n^2)?'],
        ['selective recurrent state', 'what should the state remember?'],
        ['stored keys and values', 'what grows while decoding?'],
        ['decayed recurrent mixing', 'does compact state preserve quality?'],
      ],
    ),
    highlight: { found: ['rwkv:core question', 'mamba:core question', 'kv:core question'], compare: ['attention:memory model'] },
    explanation: 'RWKV is part of the broader search for sequence models that keep Transformer quality while reducing long-context memory and compute pressure.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'time-mix block') yield* timeMixBlock();
  else if (view === 'training vs inference') yield* trainingVsInference();
  else throw new InputError('Pick an RWKV view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'RWKV is a sequence-model architecture designed to combine Transformer-era training with RNN-style inference. The name comes from four ingredients: Receptance, Weight decay, Key, and Value. Instead of building an explicit attention matrix between all token pairs, RWKV maintains recurrent state and uses learned decay behavior to mix information from the past.',
        'The motivation is the same pressure that makes KV Cache and Selective State Space Models important. Transformers train and perform extremely well, but attention has quadratic prefill cost and decode memory that grows with context. Classical RNNs decode cheaply but have struggled to match Transformer quality and training parallelism. RWKV tries to occupy the middle: parallelizable enough for training, recurrent enough for efficient serving.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'RWKV blocks contain time-mixing and channel-mixing components inside a residual stack. Time-mixing handles sequence memory. It combines current and previous token information, creates R, K, and V signals, applies learned decay, and updates a compact recurrent state. The receptance gate controls how much of the mixed value is accepted into the output. Channel-mixing plays a role closer to the Transformer feed-forward network, mixing features within a token.',
        'The important mental model is two equivalent execution views. During training, the recurrence can be expressed in a parallel form so accelerators can process sequences efficiently. During inference, the model can update a fixed-size state one token at a time. That is different from Transformer decoding, where every new token reads a growing KV cache.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The serving advantage is memory: recurrent state can remain constant with respect to context length, while a Transformer cache grows with tokens, layers, heads, and head dimension. The cost is compressed history. Attention can directly compare the current token to an exact cached representation of every previous token. RWKV must preserve useful information through its decay and state update dynamics. That tradeoff is empirical, not guaranteed by asymptotic notation.',
        'The engineering complexity also moves into kernels, numerical stability, and architecture details. A recurrent model with poor kernels can lose to a Transformer with mature FlashAttention and paging. A compact-state model can also underperform on tasks that require exact copying or retrieval unless the learned state captures the needed facts.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'RWKV is relevant for long-context language modeling, streaming generation, edge inference, memory-constrained serving, and research into alternatives to quadratic attention. It should be studied alongside Mamba, RetNet Retention State, Linear Transformers, Transformer Inference Roofline, and LLM Serving: PagedAttention. Each system asks the same architectural question: what should be stored exactly, what can be compressed, and what does the hardware make cheap?',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'Do not read RWKV as "RNNs beat Transformers" or "attention is obsolete." It is a serious alternative design point with its own tradeoffs. Quality depends on model scale, data, training recipe, implementation, and task. Constant-state inference is attractive, but compressed memory can fail on exact long-range retrieval. As with Mamba, compare both quality and serving metrics before choosing an architecture.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: RWKV: Reinventing RNNs for the Transformer Era at https://arxiv.org/abs/2305.13048, the RWKV project site at https://www.rwkv.com/, the RWKV-LM repository at https://github.com/BlinkDL/RWKV-LM, and the RWKV architecture notes at https://wiki.rwkv.com/basic/architecture.html. Study Attention Mechanism, KV Cache, Transformer Inference Roofline, RetNet Retention State Case Study, FNet Fourier Token Mixing Case Study, Titans Test-Time Neural Memory Case Study, Hybrid Attention State Budget Case Study, Selective State Space Models: Mamba, Transformer Block, and Gradient Flow next.',
      ],
    },
  ],
};
