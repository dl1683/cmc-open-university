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
      heading: 'How to read the animation',
      paragraphs: [
        "Read the animation as the execution trace for xLSTM Matrix Memory Case Study. xLSTM revisits recurrent language models with exponential gates, scalar-memory sLSTM blocks, matrix-memory mLSTM blocks, and residual stacks..",
        "Active items are the current decision point. Visited markers are state that is already ruled out by proof, not by taste.",
        "Found markers are outcomes now guaranteed true. If this is not visible, the animation can mislead.",
        "At each frame, ask what changed, why that move is legal, and where the idea is strong or fragile.",
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'xLSTM exists because the Transformer solved many sequence modeling problems but introduced an expensive memory shape: the KV cache grows with context length. For long-context inference, every generated token carries the burden of prior token keys and values. That is powerful because attention can look back directly, but it is costly in memory, bandwidth, batching, and serving complexity.',
        'Classic LSTMs had the opposite attraction. They carried a bounded recurrent state through time, so decode memory did not grow with the sequence. But old LSTMs were hard to scale into modern language-model training recipes, had limited memory capacity, and lost the systems race to attention. xLSTM asks whether the LSTM idea can be rebuilt with modern gates, memory structure, residual stacks, normalization, and hardware-aware execution.',
        'The topic is therefore not nostalgia. It is a live architecture question: can a recurrent model keep enough useful history in a bounded state while training and serving competitively against attention, state-space models, RWKV, RetNet, and test-time-training memory designs?',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'Process sequences (text, time series, speech). Feed-forward networks have a fixed input size and no memory of previous inputs. The sentence "the cat sat on the ___" -- a feed-forward net sees each word independently and cannot use context. The RNN (Rumelhart et al. 1986) introduced the hidden state: h_t = f(W_h * h_{t-1} + W_x * x_t + b). The hidden state carries information forward through time.',
        'Problem: backpropagation through time (BPTT) multiplies gradients at each step. For long sequences, gradients either vanish (toward 0, losing long-range dependencies) or explode (toward infinity, unstable training). After 20-30 steps, the signal is essentially gone.',
        'The LSTM (Hochreiter & Schmidhuber 1997) adds a cell state c_t that flows through time with minimal transformation. Three gates control information flow: the forget gate (what to erase from the cell), the input gate (what new information to add), and the output gate (what to expose as hidden state). Each gate is a sigmoid layer outputting values between 0 and 1. The cell state pathway uses only element-wise multiply and add, so gradients flow through almost unchanged. This solves vanishing gradients for sequences of 100+ steps.',
        'The GRU (Cho et al. 2014) is a simplified LSTM with 2 gates instead of 3 -- similar performance, fewer parameters. Both were largely superseded by Transformers for most NLP tasks, but remain used for time series and streaming applications. xLSTM asks whether the LSTM idea can be rebuilt with modern gates, richer memory structure, residual stacks, normalization, and hardware-aware execution to compete with attention at language-model scale.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'The core insight is that gated recurrence is still a useful data structure if the gates and memory are upgraded. LSTMs were valuable because they separated writing, forgetting, and reading. xLSTM keeps that lesson but changes the gate dynamics and the memory form.',
        'Exponential gates give sharper write and forget decisions than ordinary sigmoid-style gates, while normalization and stabilization keep scale under control. The memory variants then address capacity. sLSTM keeps scalar-style memory with improved mixing. mLSTM carries a matrix memory that can be written and queried in a key-value-like way.',
        'The important trade is exact token memory versus compressed recurrent memory. Attention stores token-level evidence and can retrieve it directly. xLSTM stores learned state and must preserve the right information through gates. That can be cheaper at decode time, but it is only useful if the compressed state is good enough for the task.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'An xLSTM block starts from the old LSTM update idea: combine old memory, a write candidate, an input gate, a forget gate, and an output path. xLSTM changes the gates to exponential forms and adds normalization so stronger gates do not explode the recurrence. The result is a sharper but controlled memory update.',
        'In mLSTM, the state is no longer just a scalar cell per channel. Tokens produce query, key, and value-like projections. The key and value create an outer-product-style write into a matrix memory. A query then reads from that matrix. This gives the recurrent state more addressable structure than a plain vector while avoiding storage of every token KV pair.',
        'A practical xLSTM language model is not one isolated cell. It is a residual stack with projections, normalization, feed-forward components, careful initialization, and kernels. That matters because architecture papers succeed or fail as systems. A recurrent block that looks good mathematically still needs training throughput, decode throughput, batching behavior, and hardware fit.',
      ],
    }
  ],
};

