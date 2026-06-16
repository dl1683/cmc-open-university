// Selective state space models: keep a compact recurrent state and let each
// input token decide what to remember, forget, and emit.

import { plotState, matrixState, graphState, InputError } from '../core/state.js';

export const topic = {
  id: 'selective-state-space-mamba',
  title: 'Selective State Space Models: Mamba',
  category: 'AI & ML',
  summary: 'Long-sequence modeling without quadratic attention: input-dependent state updates, selective scan, and linear scaling.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['attention vs recurrence', 'selective scan'], defaultValue: 'attention vs recurrence' },
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

function scalingPlot(markers = []) {
  const lengths = [128, 256, 512, 1024, 2048, 4096];
  return plotState({
    axes: { x: { label: 'sequence length', min: 0, max: 4300 }, y: { label: 'relative cost', min: 0, max: 105 } },
    series: [
      { id: 'attention', label: 'attention O(n^2)', points: lengths.map((x) => ({ x, y: Math.min(100, (x * x) / (4096 * 4096) * 100) })) },
      { id: 'ssm', label: 'state space O(n)', points: lengths.map((x) => ({ x, y: (x / 4096) * 35 })) },
    ],
    markers,
  });
}

function scanGraph(title) {
  return graphState({
    nodes: [
      { id: 'x1', label: 'token 1', x: 0.8, y: 3.8, note: 'input' },
      { id: 's1', label: 'state 1', x: 2.2, y: 3.8, note: 'remember' },
      { id: 'x2', label: 'token 2', x: 3.6, y: 3.8, note: 'input' },
      { id: 's2', label: 'state 2', x: 5.0, y: 3.8, note: 'update' },
      { id: 'x3', label: 'token 3', x: 6.4, y: 3.8, note: 'input' },
      { id: 's3', label: 'state 3', x: 7.8, y: 3.8, note: 'emit' },
    ],
    edges: [
      { id: 'e-x1-s1', from: 'x1', to: 's1', weight: 'select' },
      { id: 'e-s1-x2', from: 's1', to: 'x2', weight: 'carry' },
      { id: 'e-x2-s2', from: 'x2', to: 's2', weight: 'select' },
      { id: 'e-s2-x3', from: 's2', to: 'x3', weight: 'carry' },
      { id: 'e-x3-s3', from: 'x3', to: 's3', weight: 'select' },
    ],
  }, { title });
}

function* attentionVsRecurrence() {
  yield {
    state: scalingPlot([
      { id: 'short', x: 512, y: 2, label: 'short' },
      { id: 'long', x: 4096, y: 100, label: 'long attention' },
      { id: 'longssm', x: 4096, y: 35, label: 'long SSM' },
    ]),
    highlight: { active: ['attention', 'ssm'], found: ['long', 'longssm'] },
    explanation: 'Attention compares every token with every other token, so its memory and compute pressure grow roughly quadratically with sequence length. State space models keep a compact state that updates as the sequence advances, so the core recurrence scales linearly.',
  };

  yield {
    state: labelMatrix(
      'What a state space layer keeps',
      [
        { id: 'state', label: 'hidden state' },
        { id: 'input', label: 'current token' },
        { id: 'select', label: 'selection gate' },
        { id: 'output', label: 'output' },
      ],
      [
        { id: 'role', label: 'role' },
        { id: 'pressure', label: 'pressure' },
      ],
      [
        ['compressed memory', 'must preserve useful history'],
        ['new evidence', 'may overwrite state'],
        ['token-dependent parameters', 'decide remember or forget'],
        ['representation for next layer', 'must expose relevant signal'],
      ],
    ),
    highlight: { active: ['select:role', 'state:role'], compare: ['state:pressure', 'input:pressure'] },
    explanation: 'Mamba-style selective SSMs make the recurrence input-dependent. The token can change how the state is updated, giving the model a content-based way to remember or forget.',
    invariant: 'The state is fixed-size with respect to sequence length.',
  };

  yield {
    state: labelMatrix(
      'Transformer cache vs recurrent state at inference',
      [
        { id: 'attention', label: 'Transformer decode' },
        { id: 'kv', label: 'KV cache' },
        { id: 'ssm', label: 'SSM decode' },
        { id: 'state', label: 'recurrent state' },
      ],
      [
        { id: 'memory', label: 'memory grows with' },
        { id: 'tradeoff', label: 'tradeoff' },
      ],
      [
        ['context length', 'direct access to past tokens'],
        ['tokens x layers x heads', 'serving memory pressure'],
        ['state size', 'compressed history'],
        ['model dimension', 'must decide what to keep'],
      ],
    ),
    highlight: { active: ['kv:memory', 'state:memory'], compare: ['attention:tradeoff', 'ssm:tradeoff'] },
    explanation: 'The serving appeal is clear: Transformer decoding stores a KV Cache that grows with context. A recurrent state can be constant-size, but it must compress history instead of looking back at every token.',
  };

  yield {
    state: labelMatrix(
      'Where SSMs fit',
      [
        { id: 'long', label: 'long sequences' },
        { id: 'stream', label: 'streaming data' },
        { id: 'language', label: 'language modeling' },
        { id: 'hybrid', label: 'hybrid models' },
      ],
      [
        { id: 'benefit', label: 'benefit' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['linear scaling', 'hard retrieval over exact past'],
        ['stateful inference', 'state reset policy'],
        ['fast decode promise', 'quality comparison is empirical'],
        ['mix attention and SSM', 'more architecture complexity'],
      ],
    ),
    highlight: { found: ['long:benefit', 'stream:benefit', 'language:benefit'], compare: ['long:risk'] },
    explanation: 'Selective SSMs are not magic replacements for attention. They trade direct all-pairs lookup for compressed, input-controlled memory. The right model depends on the task and serving constraints.',
  };
}

function* selectiveScan() {
  yield {
    state: scanGraph('A selective recurrence carries state forward'),
    highlight: { active: ['x1', 's1', 'e-x1-s1'], compare: ['x2', 'x3'] },
    explanation: 'In recurrent mode, each token updates a state and passes it forward. The token-dependent selection controls how strongly new input affects memory.',
  };

  yield {
    state: scanGraph('The scan can be parallelized for training'),
    highlight: { active: ['e-x1-s1', 'e-x2-s2', 'e-x3-s3'], found: ['s1', 's2', 's3'] },
    explanation: 'The Mamba paper pairs the recurrence with a hardware-aware scan so training can remain parallel enough for accelerators. That is the systems trick: recurrent semantics without naive serial training.',
    invariant: 'Training and inference can use different execution views of the same recurrence.',
  };

  yield {
    state: labelMatrix(
      'Selective update intuition',
      [
        { id: 'name', label: 'name token' },
        { id: 'comma', label: 'comma' },
        { id: 'fact', label: 'important fact' },
        { id: 'filler', label: 'filler word' },
      ],
      [
        { id: 'gate', label: 'gate behavior' },
        { id: 'effect', label: 'effect on state' },
      ],
      [
        ['open memory', 'store entity'],
        ['small update', 'preserve state'],
        ['strong update', 'write new evidence'],
        ['forget or pass through', 'avoid clutter'],
      ],
    ),
    highlight: { active: ['name:effect', 'fact:effect'], compare: ['filler:effect'] },
    explanation: 'Selectivity is a content-based memory policy. Important tokens can write state; unimportant tokens can leave it mostly unchanged. That is the feature prior SSMs lacked for discrete language-like data.',
  };

  yield {
    state: labelMatrix(
      'Read alongside existing topics',
      [
        { id: 'attention', label: 'Attention Mechanism' },
        { id: 'kv', label: 'KV Cache' },
        { id: 'roof', label: 'Transformer Inference Roofline' },
        { id: 'grad', label: 'Vanishing & Exploding Gradients' },
      ],
      [
        { id: 'connection', label: 'connection' },
        { id: 'question', label: 'question to ask' },
      ],
      [
        ['all-pairs lookup', 'when is exact context worth it?'],
        ['serving memory', 'what grows with context?'],
        ['phase bottlenecks', 'what is memory-bound?'],
        ['long recurrence', 'can gradients preserve memory?'],
      ],
    ),
    highlight: { found: ['attention:question', 'kv:question', 'roof:question', 'grad:question'] },
    explanation: 'Mamba is easiest to understand as a tradeoff against attention and KV cache, with recurrence stability questions inherited from older sequence models.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'attention vs recurrence') yield* attentionVsRecurrence();
  else if (view === 'selective scan') yield* selectiveScan();
  else throw new InputError('Pick a selective-SSM view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'Selective State Space Models, popularized by Mamba, are sequence models that try to keep the long-context efficiency of recurrent systems while recovering some of the content-aware behavior that made Attention Mechanism powerful. Instead of storing every previous token in a KV Cache, an SSM maintains a compact hidden state. Each new token updates that state and produces an output.',
        'The Mamba contribution is selectivity: the state update parameters depend on the input token. That lets the model decide which information to preserve, overwrite, or ignore. The paper also introduces a hardware-aware selective scan so training can be efficient on accelerators even though the model has recurrent structure.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A classical state space layer has equations like state update and output projection: the current input changes the state, and the state produces the output. Structured State Space models made this efficient and stable for long sequences. Mamba changes the parameters of the recurrence as a function of the input, so different tokens can have different memory behavior.',
        'This creates two useful execution views. During inference, the model can run recurrently with a fixed-size state, which is attractive for streaming and long contexts. During training, a scan algorithm parallelizes the recurrence enough to use accelerator hardware well. That dual view is why the topic belongs beside Transformer Inference Roofline and LLM Serving: PagedAttention.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The advantage is linear scaling in sequence length and potentially much smaller inference memory than attention over long contexts. The cost is that history is compressed into state. A Transformer can directly attend to a token thousands of positions back if it is still in context. An SSM must have preserved the relevant information in its state. That makes memory policy and training stability central.',
        'Mamba-style systems also shift complexity into kernels and scans. Efficient training depends on hardware-aware implementations, not only equations. Evaluating these models requires both quality metrics and serving metrics: perplexity, downstream accuracy, context length, throughput, memory, latency, and robustness to tasks that require exact recall.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'SSMs and Mamba-like models are explored for language modeling, audio, genomics, time series, long-document modeling, streaming inference, and hybrid architectures that mix attention with recurrent blocks. RWKV pursues a related goal from another direction: Transformer-like training with RNN-like inference. RetNet Retention State adds a decay-weighted recurrent summary with parallel, recurrent, and chunkwise execution views. The shared theme is that quadratic attention is not the only possible sequence-model backbone.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'Linear scaling does not automatically mean better. Some tasks need direct retrieval over previous tokens, and compressed state can forget details. Another mistake is comparing only asymptotic complexity while ignoring kernel maturity, hardware utilization, and model quality. A slower asymptotic method with excellent kernels can beat a theoretically nicer method in practice until implementations mature.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Mamba at https://arxiv.org/abs/2312.00752, S4 at https://arxiv.org/abs/2111.00396, RWKV at https://arxiv.org/abs/2305.13048, and Linear Transformers at https://arxiv.org/abs/2006.16236. Study Attention Mechanism, KV Cache, Transformer Inference Roofline, RetNet Retention State Case Study, FNet Fourier Token Mixing Case Study, Titans Test-Time Neural Memory Case Study, Hybrid Attention State Budget Case Study, Vanishing & Exploding Gradients, and Transformer Block next.',
      ],
    },
  ],
};
