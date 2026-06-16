// xLSTM: modernize LSTM gates and memory for language-model scale.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'xlstm-matrix-memory-case-study',
  title: 'xLSTM Matrix Memory Case Study',
  category: 'Papers',
  summary: 'xLSTM revisits recurrent language models with exponential gates, scalar-memory sLSTM blocks, matrix-memory mLSTM blocks, and residual stacks.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['exponential gates', 'matrix memory', 'scaling ledger'], defaultValue: 'exponential gates' },
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

function gateGraph(title) {
  return graphState({
    nodes: [
      { id: 'x', label: 'x_t', x: 0.7, y: 3.7, note: 'token' },
      { id: 'old', label: 'c_t-1', x: 2.2, y: 5.1, note: 'old memory' },
      { id: 'in', label: 'input gate', x: 2.5, y: 2.5, note: 'exp' },
      { id: 'forget', label: 'forget gate', x: 4.3, y: 5.1, note: 'exp' },
      { id: 'write', label: 'write', x: 4.3, y: 2.5, note: 'candidate' },
      { id: 'norm', label: 'normalize', x: 6.0, y: 3.7, note: 'stabilize' },
      { id: 'new', label: 'c_t', x: 7.8, y: 3.7, note: 'new memory' },
      { id: 'out', label: 'h_t', x: 9.2, y: 3.7, note: 'output' },
    ],
    edges: [
      { id: 'e-x-in', from: 'x', to: 'in' },
      { id: 'e-x-write', from: 'x', to: 'write' },
      { id: 'e-old-forget', from: 'old', to: 'forget' },
      { id: 'e-in-norm', from: 'in', to: 'norm' },
      { id: 'e-write-norm', from: 'write', to: 'norm' },
      { id: 'e-forget-norm', from: 'forget', to: 'norm' },
      { id: 'e-norm-new', from: 'norm', to: 'new' },
      { id: 'e-new-out', from: 'new', to: 'out' },
    ],
  }, { title });
}

function matrixGraph(title) {
  return graphState({
    nodes: [
      { id: 'x', label: 'x_t', x: 0.8, y: 3.8, note: 'token' },
      { id: 'q', label: 'q', x: 2.5, y: 2.1, note: 'read key' },
      { id: 'k', label: 'k', x: 2.5, y: 3.8, note: 'write key' },
      { id: 'v', label: 'v', x: 2.5, y: 5.5, note: 'value' },
      { id: 'cov', label: 'K V^T', x: 4.6, y: 4.6, note: 'outer write' },
      { id: 'mem', label: 'matrix M', x: 6.6, y: 3.8, note: 'memory' },
      { id: 'read', label: 'qM', x: 8.1, y: 2.6, note: 'lookup' },
      { id: 'out', label: 'h_t', x: 9.3, y: 3.8, note: 'output' },
    ],
    edges: [
      { id: 'e-x-q', from: 'x', to: 'q' },
      { id: 'e-x-k', from: 'x', to: 'k' },
      { id: 'e-x-v', from: 'x', to: 'v' },
      { id: 'e-k-cov', from: 'k', to: 'cov' },
      { id: 'e-v-cov', from: 'v', to: 'cov' },
      { id: 'e-cov-mem', from: 'cov', to: 'mem' },
      { id: 'e-q-read', from: 'q', to: 'read' },
      { id: 'e-mem-read', from: 'mem', to: 'read' },
      { id: 'e-read-out', from: 'read', to: 'out' },
    ],
  }, { title });
}

function* exponentialGates() {
  yield {
    state: gateGraph('xLSTM keeps the LSTM idea but widens the gates'),
    highlight: { active: ['in', 'forget', 'e-x-in', 'e-old-forget'], found: ['norm'] },
    explanation: 'Classic LSTMs used sigmoid gates. xLSTM uses exponential gating with normalization and stabilization so input and forget decisions can have a broader dynamic range without numerical blowups.',
    invariant: 'The old LSTM lesson survives: memory quality depends on write, forget, and read gates.',
  };

  yield {
    state: labelMatrix(
      'Gate behavior',
      [
        { id: 'sig', label: 'sigmoid' },
        { id: 'exp', label: 'exp gate' },
        { id: 'norm', label: 'normalized' },
        { id: 'mix', label: 'mixed memory' },
      ],
      [
        { id: 'range', label: 'range' },
        { id: 'benefit', label: 'benefit' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['0..1', 'stable', 'saturates'],
        ['positive', 'sharp choice', 'scale'],
        ['controlled', 'trainable', 'cost'],
        ['cross cells', 'capacity', 'complex'],
      ],
    ),
    highlight: { active: ['exp:benefit', 'norm:benefit'], compare: ['sig:risk'] },
    explanation: 'The point is not just a new activation function. xLSTM changes the memory update so stronger gates can be used without making the recurrence numerically fragile.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'gate logit', min: -4, max: 4 }, y: { label: 'gate response', min: 0, max: 1.05 } },
      series: [
        { id: 'sigmoid', label: 'sigmoid', points: [
          { x: -4, y: 0.02 }, { x: -2, y: 0.12 }, { x: 0, y: 0.50 }, { x: 2, y: 0.88 }, { x: 4, y: 0.98 },
        ] },
        { id: 'expnorm', label: 'exp normalized', points: [
          { x: -4, y: 0.01 }, { x: -2, y: 0.04 }, { x: 0, y: 0.28 }, { x: 2, y: 0.82 }, { x: 4, y: 1.00 },
        ] },
      ],
      markers: [
        { id: 'sharp', x: 2, y: 0.82, label: 'sharper select' },
      ],
    }),
    highlight: { active: ['expnorm', 'sharp'], compare: ['sigmoid'] },
    explanation: 'This stylized curve shows the intuition: exponential gates can make sharper keep/write choices, while normalization keeps the state update bounded.',
  };

  yield {
    state: labelMatrix(
      'xLSTM block family',
      [
        { id: 'slstm', label: 'sLSTM' },
        { id: 'mlstm', label: 'mLSTM' },
        { id: 'stack', label: 'xLSTM stack' },
      ],
      [
        { id: 'memory', label: 'memory' },
        { id: 'parallel', label: 'parallel' },
        { id: 'role', label: 'role' },
      ],
      [
        ['scalar', 'limited', 'stable cells'],
        ['matrix', 'strong', 'associative memory'],
        ['residual', 'blockwise', 'LM backbone'],
      ],
    ),
    highlight: { found: ['slstm:memory', 'mlstm:memory', 'stack:role'] },
    explanation: 'The architecture has two memory flavors. sLSTM keeps scalar-style memory with improved mixing; mLSTM uses matrix memory and is the more parallelizable long-context component.',
  };
}

function* matrixMemory() {
  yield {
    state: matrixGraph('mLSTM stores key-value evidence in a matrix memory'),
    highlight: { active: ['k', 'v', 'cov', 'mem', 'e-k-cov', 'e-v-cov', 'e-cov-mem'], found: ['read'] },
    explanation: 'mLSTM turns the memory cell into a matrix. Tokens write an outer-product style update, and queries read from that matrix. This gives the recurrent state more addressable capacity than a scalar cell.',
    invariant: 'The memory is recurrent, but it is not a single vague vector. It has key-value structure.',
  };

  yield {
    state: labelMatrix(
      'Memory structure comparison',
      [
        { id: 'lstm', label: 'LSTM' },
        { id: 'slstm', label: 'sLSTM' },
        { id: 'mlstm', label: 'mLSTM' },
        { id: 'attn', label: 'attention' },
      ],
      [
        { id: 'keeps', label: 'keeps' },
        { id: 'read', label: 'read' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['cell vector', 'gated', 'capacity'],
        ['scalar cells', 'mixed', 'routing'],
        ['matrix state', 'query', 'memory I/O'],
        ['token KV', 'all pairs', 'growth'],
      ],
    ),
    highlight: { active: ['mlstm:keeps', 'mlstm:read'], compare: ['attn:risk', 'lstm:risk'] },
    explanation: 'mLSTM is useful because it makes recurrent memory more structured while avoiding a full token-level attention cache. The cost moves into matrix-state updates and reads.',
  };

  yield {
    state: graphState({
      nodes: [
        { id: 'tokens', label: 'tokens', x: 0.7, y: 3.8, note: 'sequence' },
        { id: 'proj', label: 'Q/K/V', x: 2.3, y: 3.8, note: 'project' },
        { id: 'scan', label: 'scan update', x: 4.2, y: 3.8, note: 'parallel form' },
        { id: 'memory', label: 'M_t', x: 6.0, y: 3.8, note: 'matrix state' },
        { id: 'resid', label: 'residual block', x: 7.8, y: 3.8, note: 'LM stack' },
        { id: 'logits', label: 'logits', x: 9.2, y: 3.8, note: 'next token' },
      ],
      edges: [
        { id: 'e-tokens-proj', from: 'tokens', to: 'proj' },
        { id: 'e-proj-scan', from: 'proj', to: 'scan' },
        { id: 'e-scan-memory', from: 'scan', to: 'memory' },
        { id: 'e-memory-resid', from: 'memory', to: 'resid' },
        { id: 'e-resid-logits', from: 'resid', to: 'logits' },
      ],
    }, { title: 'Language-model xLSTM is a residual stack, not nostalgia' }),
    highlight: { active: ['proj', 'scan', 'memory'], found: ['resid', 'logits'] },
    explanation: 'xLSTM borrows the modern LLM stack around the recurrence: projections, residual blocks, normalization, scaling laws, and careful kernels. That is why it belongs in the Transformer-alternative cluster.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'context length', min: 0, max: 100000 }, y: { label: 'decode memory', min: 0, max: 1.0 } },
      series: [
        { id: 'attn', label: 'attention KV', points: [
          { x: 0, y: 0.02 }, { x: 25000, y: 0.27 }, { x: 50000, y: 0.52 }, { x: 75000, y: 0.76 }, { x: 100000, y: 1.0 },
        ] },
        { id: 'xlstm', label: 'xLSTM state', points: [
          { x: 0, y: 0.12 }, { x: 25000, y: 0.13 }, { x: 50000, y: 0.14 }, { x: 75000, y: 0.15 }, { x: 100000, y: 0.16 },
        ] },
      ],
      markers: [
        { id: 'fixed', x: 75000, y: 0.15, label: 'bounded state' },
      ],
    }),
    highlight: { active: ['xlstm', 'fixed'], compare: ['attn'] },
    explanation: 'As with other recurrent alternatives, the attraction is bounded decode state. The evaluation question is whether that state preserves enough exact information.',
  };
}

function* scalingLedger() {
  yield {
    state: labelMatrix(
      'Scaling ledger',
      [
        { id: 'train', label: 'training' },
        { id: 'decode', label: 'decode' },
        { id: 'quality', label: 'quality' },
        { id: 'kernels', label: 'kernels' },
      ],
      [
        { id: 'question', label: 'question' },
        { id: 'gate', label: 'gate' },
      ],
      [
        ['parallel enough?', 'throughput'],
        ['state small?', 'p99'],
        ['beats baselines?', 'benchmarks'],
        ['fused?', 'hardware'],
      ],
    ),
    highlight: { active: ['train:gate', 'decode:gate', 'quality:gate'], found: ['kernels:question'] },
    explanation: 'The xLSTM research question is not whether LSTMs were historically useful. It is whether a modernized recurrent block scales competitively when measured with today\'s training and inference stack.',
  };

  yield {
    state: graphState({
      nodes: [
        { id: 'old', label: 'old LSTM', x: 0.8, y: 4.8, note: 'gates' },
        { id: 'gates', label: 'exp gates', x: 2.7, y: 3.2, note: 'range' },
        { id: 'memory', label: 'new memory', x: 4.5, y: 3.2, note: 's + m' },
        { id: 'stack', label: 'residual stack', x: 6.3, y: 3.2, note: 'LM' },
        { id: 'eval', label: 'eval', x: 8.2, y: 3.2, note: 'compare' },
        { id: 'serve', label: 'serve?', x: 9.4, y: 4.8, note: 'if kernels win' },
      ],
      edges: [
        { id: 'e-old-gates', from: 'old', to: 'gates' },
        { id: 'e-gates-memory', from: 'gates', to: 'memory' },
        { id: 'e-memory-stack', from: 'memory', to: 'stack' },
        { id: 'e-stack-eval', from: 'stack', to: 'eval' },
        { id: 'e-eval-serve', from: 'eval', to: 'serve' },
      ],
    }, { title: 'The practical path from LSTM to xLSTM' }),
    highlight: { active: ['gates', 'memory', 'stack', 'e-gates-memory', 'e-memory-stack'], found: ['eval', 'serve'] },
    explanation: 'xLSTM is best taught as an engineering update path: preserve the gating insight, replace fragile memory limits, put the block inside a modern residual backbone, then compare honestly.',
  };

  yield {
    state: labelMatrix(
      'What to compare next',
      [
        { id: 'mamba', label: 'Mamba' },
        { id: 'rwkv', label: 'RWKV' },
        { id: 'ttt', label: 'TTT' },
        { id: 'attn', label: 'Attention' },
      ],
      [
        { id: 'memory', label: 'memory' },
        { id: 'question', label: 'question' },
      ],
      [
        ['selective SSM', 'state capacity'],
        ['decay state', 'quality'],
        ['hidden model', 'update cost'],
        ['token KV', 'exact recall'],
      ],
    ),
    highlight: { found: ['mamba:memory', 'ttt:memory', 'attn:question'], active: ['rwkv:question'] },
    explanation: 'The useful comparison set is the whole memory-design family. xLSTM is one candidate in a broader contest over exact memory, learned state, and hardware fit.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'model scale', min: 0, max: 7 }, y: { label: 'relative maturity', min: 0, max: 1.0 } },
      series: [
        { id: 'transformer', label: 'Transformer stack', points: [
          { x: 1, y: 0.70 }, { x: 3, y: 0.84 }, { x: 5, y: 0.93 }, { x: 7, y: 0.98 },
        ] },
        { id: 'xlstm', label: 'xLSTM stack', points: [
          { x: 1, y: 0.35 }, { x: 3, y: 0.52 }, { x: 5, y: 0.66 }, { x: 7, y: 0.76 },
        ] },
      ],
      markers: [
        { id: 'gap', x: 5, y: 0.66, label: 'kernel + eval gap' },
      ],
    }),
    highlight: { active: ['xlstm', 'gap'], compare: ['transformer'] },
    explanation: 'This is a maturity chart, not a benchmark claim. Transformers still have a massive systems advantage. xLSTM becomes serious when its kernels, training recipes, and eval coverage catch up.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'exponential gates') yield* exponentialGates();
  else if (view === 'matrix memory') yield* matrixMemory();
  else if (view === 'scaling ledger') yield* scalingLedger();
  else throw new InputError('Pick an xLSTM view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'xLSTM is a modern attempt to scale the LSTM idea back into the language-model era. It keeps the central insight of LSTMs, gated memory over time, but changes the gates and memory structures so the architecture can compete with Transformers and state-space models.',
        'The xLSTM paper introduces exponential gates with normalization and stabilization, plus two memory variants. sLSTM uses scalar memory with new mixing. mLSTM uses a matrix memory with a covariance-like update and a more parallel execution path. Stacked inside modern residual blocks, these become xLSTM language-model backbones.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The first change is gate dynamics. Instead of relying only on sigmoid gates, xLSTM uses exponential gating so write and forget decisions can be sharper. Normalization keeps the recurrence stable. The second change is memory shape. Matrix memory lets the recurrent state hold addressable key-value style evidence rather than compressing everything into a scalar or simple vector cell.',
        'mLSTM is especially important because it moves recurrent memory closer to associative memory. Tokens create query, key, and value-like projections. Writes update a matrix state; reads query that matrix. This echoes attention without storing every token as a full KV cache.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The attraction is decode memory. Recurrent state can remain bounded while a Transformer KV cache grows with context length. The tradeoff is capacity and exact recall. Attention can look back at every cached token directly. xLSTM must preserve the right information through gates and matrix-state updates.',
        'The engineering risk is systems maturity. Transformers have FlashAttention, PagedAttention, continuous batching, prefix caching, and a deep kernel ecosystem. A recurrent alternative must win through real wall-clock performance, not only a nicer asymptotic chart.',
      ],
    },
    {
      heading: 'Case study',
      paragraphs: [
        'A practical xLSTM evaluation should put it beside Mamba, RWKV, RetNet, TTT, Kimi Linear, and full attention. Measure language modeling, long-context retrieval, code tasks, exact copying, training throughput, decode p99, memory footprint, and kernel portability. That comparison teaches the real design axis: memory form.',
        'The module therefore treats xLSTM as a data-structure case study. The data structure is not a list or a map. It is a learned recurrent memory with gated update semantics, capacity limits, and hardware behavior.',
      ],
    },
    {
      heading: 'Pitfalls',
      paragraphs: [
        'Do not read xLSTM as simple nostalgia for old RNNs. It is a modern block design. Also do not assume bounded state means better long context. Bounded state means compressed history; the model still has to learn what to keep. Finally, paper-scale comparisons need careful control over training data, model size, kernel maturity, and benchmark selection.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Primary sources: xLSTM: Extended Long Short-Term Memory at https://arxiv.org/abs/2405.04517 and the official repository at https://github.com/NX-AI/xlstm.',
        'Study RWKV Recurrent Transformer, Selective State Space Models: Mamba, RetNet Retention State Case Study, Test-Time Training Layer Case Study, Kimi Linear Attention, KV Cache, Transformer Inference Roofline, and Hybrid Attention State Budget Case Study next.',
      ],
    },
  ],
};
