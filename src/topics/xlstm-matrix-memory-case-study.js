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
        'Read the animation as a memory update for a recurrent neural network. A recurrent network processes tokens one after another while carrying a hidden state forward. Active marks show the current token and gate calculation, compare marks show paths that could be written or forgotten, and found marks show state that survives to the next token.',
        'The safe inference is local: a gate value near 1 lets information pass, and a gate value near 0 suppresses it. Matrix memory means the state is not only one scalar per channel; it can store a small learned table that later queries can read. The animation is about bounded state, not proof that recurrence always beats attention.',
        {type: 'callout', text: 'xLSTM is a modern recurrence story: sharper gates and matrix memory try to trade exact token cache growth for bounded learned state.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Transformers use attention, which compares tokens to earlier tokens through key and value vectors. During decoding, those keys and values are stored in a KV cache. The cache is useful because the model can look back exactly, but it grows with sequence length.',
        'Classic LSTMs had the opposite shape. An LSTM, or long short-term memory network, keeps a fixed-size cell state that is updated at each step. xLSTM asks whether modern gates, normalization, residual stacks, and matrix memory can make that fixed-state idea competitive again.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious way to handle long text is to keep using attention and allocate more cache. For a model with many layers, every generated token stores key and value vectors per layer. This preserves direct access to old tokens, so the approach is not naive.',
        'Another obvious way is to return to an old LSTM. The old design has bounded decode memory, but it compresses history into a narrow state and becomes hard to scale. It also lacks the training and hardware recipe that made modern language models work.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is the memory shape. If a Transformer stores 32 KB of KV cache per token for one request, then 10,000 tokens need about 320 MB for that request. One hundred such requests need about 32 GB before counting model weights, activations, and allocator waste.',
        'The old recurrent wall is different. Fixed-size state does not grow with tokens, but it may forget details that a later token needs. A bounded memory architecture only helps if the update rule learns what to preserve and what to erase.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'The core insight is that recurrence is a data-structure tradeoff. Attention stores exact per-token evidence and pays memory proportional to context length. xLSTM stores compressed learned state and pays a fixed state size per layer.',
        'xLSTM changes the old LSTM in two main ways. Exponential gates make write and forget decisions sharper, while stabilization keeps those gates numerically controlled. Matrix memory gives the model a richer state than a single scalar cell, so a query can retrieve from a learned memory matrix.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'At token t, the block computes candidate content and gate values from the token and previous state. The forget gate controls how much old state remains. The input gate controls how much new content is written, and the output path controls what hidden representation leaves the block.',
        'In mLSTM, the model writes an outer-product-like update into a matrix memory. A key chooses where the value should influence memory, and a later query reads from that memory. The state is still bounded by the model dimension rather than by the number of tokens already processed.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The correctness argument is an invariant about state shape. After every token, the block carries one valid recurrent state with the same dimensions as before. The next token needs only that state and its own embedding, so decode memory does not grow with token count.',
        'The modeling argument is weaker than the shape invariant and must be measured. If the gates preserve task-relevant information, the bounded state behaves like useful memory. If the gates erase a detail that attention would have retained, the model cannot recover it later unless the detail is reintroduced in the input.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'For decoding, attention cache memory grows with tokens, while recurrent state memory stays fixed for a given batch and model. If an attention system stores 320 MB for a 10,000-token request, doubling to 20,000 tokens doubles that cache to about 640 MB. A fixed recurrent state does not double when the context doubles.',
        'The tradeoff is computation and quality. Matrix memory adds projections and state updates, and parallel training needs special kernels to avoid losing throughput. The dominant practical cost is not only FLOPs; it is whether hardware can batch and pipeline the recurrence efficiently.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'The natural use is long-sequence modeling where bounded serving memory matters. Examples include time series, logs, streaming audio, device-side models, and language tasks where exact retrieval of every old token is less important than stable running context. The fit is strongest when memory cost limits batch size.',
        'xLSTM is also useful as a comparison point for state-space models, RWKV, RetNet, and attention variants. All of these ask the same systems question: how much history can be represented without storing every token in full. The right choice depends on the access pattern of the task.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'It fails on tasks that require exact recall of many arbitrary earlier tokens. A bounded state can encode a lot, but it is still a compression. If the answer depends on a random string from 12,000 tokens ago, attention or retrieval may be a better structure.',
        'It can also fail as a system if recurrence underuses the GPU. Transformers train well because attention and feed-forward blocks map cleanly to large matrix operations. A recurrent design needs kernels and batching strategy good enough that saved cache memory is not lost as lower throughput.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Assume a 24-layer attention model stores 8 KB of KV cache per token per request. A 4,000-token conversation needs about 32 MB, because 4,000 * 8 KB = 32,000 KB. At 1,000 concurrent requests, the cache alone is about 32 GB.',
        'Now compare a recurrent model that stores 2 MB of state per request. The same 1,000 requests need about 2 GB of recurrent state, and moving from 4,000 to 8,000 tokens does not double that state. The price is that the 2 MB state must summarize what the model needs; it cannot keep every token-level key and value exactly.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Start with Beck et al., xLSTM: Extended Long Short-Term Memory, at https://arxiv.org/abs/2405.04517. Use the original LSTM paper by Hochreiter and Schmidhuber for the old cell-state idea, then compare the xLSTM changes against Transformer attention and KV cache behavior.',
        'Study RNN LSTM for the prerequisite, Selective State Space Mamba for a sibling bounded-state design, RetNet Retention State for another recurrent memory tradeoff, and Transformer Inference Roofline for the serving-cost side of the comparison.',
      ],
    },
  ],
};
