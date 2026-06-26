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
  const maxSeqLen = 4096;
  const ssmComplexity = 'O(n)';
  const attentionComplexity = 'O(n^2)';
  const ssmLayerComponents = 4; // hidden state, current token, selection gate, output
  const fitCategories = 4; // long sequences, streaming, language modeling, hybrid

  yield {
    state: scalingPlot([
      { id: 'short', x: 512, y: 2, label: 'short' },
      { id: 'long', x: 4096, y: 100, label: 'long attention' },
      { id: 'longssm', x: 4096, y: 35, label: 'long SSM' },
    ]),
    highlight: { active: ['attention', 'ssm'], found: ['long', 'longssm'] },
    explanation: `Attention compares every token with every other token, so its memory and compute pressure grow roughly as ${attentionComplexity} with sequence length. State space models keep a compact state that updates as the sequence advances, so the core recurrence scales ${ssmComplexity} up to ${maxSeqLen} tokens and beyond.`,
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
    explanation: `Mamba-style selective SSMs make the recurrence input-dependent. Each of the ${ssmLayerComponents} layer components plays a role: the token can change how the state is updated, giving the model a content-based way to remember or forget.`,
    invariant: `The state is fixed-size with respect to sequence length -- it does not grow even at ${maxSeqLen} tokens.`,
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
    explanation: `The serving appeal is clear: Transformer decoding stores a KV Cache that grows with context (${attentionComplexity} pressure). A recurrent state can be constant-size, but it must compress history instead of looking back at every token.`,
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
    explanation: `Selective SSMs are not magic replacements for attention. Across ${fitCategories} use categories, they trade direct all-pairs lookup for compressed, ${ssmComplexity}-scaling, input-controlled memory. The right model depends on the task and serving constraints.`,
  };
}

function* selectiveScan() {
  const tokenCount = 3; // x1, x2, x3 in the scan graph
  const stateCount = 3; // s1, s2, s3 in the scan graph
  const edgeCount = 5; // edges in the scan graph
  const tokenTypes = 4; // name, comma, fact, filler
  const relatedTopics = 4; // attention, KV cache, roofline, gradients

  yield {
    state: scanGraph('A selective recurrence carries state forward'),
    highlight: { active: ['x1', 's1', 'e-x1-s1'], compare: ['x2', 'x3'] },
    explanation: `In recurrent mode, each of the ${tokenCount} tokens updates a state and passes it forward through ${edgeCount} edges. The token-dependent selection controls how strongly new input affects memory.`,
  };

  yield {
    state: scanGraph('The scan can be parallelized for training'),
    highlight: { active: ['e-x1-s1', 'e-x2-s2', 'e-x3-s3'], found: ['s1', 's2', 's3'] },
    explanation: `The Mamba paper pairs the recurrence with a hardware-aware scan so training can remain parallel enough for accelerators. All ${stateCount} states can be computed concurrently -- recurrent semantics without naive serial training.`,
    invariant: `Training and inference can use different execution views of the same recurrence over ${tokenCount} tokens.`,
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
    explanation: `Selectivity is a content-based memory policy. Across ${tokenTypes} token types, important tokens can write state while unimportant tokens leave it mostly unchanged. That is the feature prior SSMs lacked for discrete language-like data.`,
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
    explanation: `Mamba is easiest to understand as a tradeoff against ${relatedTopics} related topics: attention, KV cache, roofline performance, and gradient stability from older sequence models.`,
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
      heading: 'How to read the animation',
      paragraphs: [
        'The animation contrasts attention with a selective state space model. Attention keeps addressable token memory, while the state-space path keeps a fixed-size state that is updated as each token arrives.',
        {type: 'image', src: './assets/gifs/selective-state-space-mamba.gif', alt: 'Animated walkthrough of the selective state space mamba visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
        'Active state marks the current token update, found state marks information retained in the recurrent state, and faded paths mark information that has been compressed away. The safe inference is limited: the model can carry information forward only if the learned update writes it into state.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'A sequence model reads ordered data such as text, audio, DNA, or time series. Transformers use attention, which lets each token compare against earlier tokens, but long contexts make attention memory and compute expensive.',
        'A state space model, or SSM, keeps a hidden state that evolves over time. Mamba is a selective SSM: the current input controls parts of the state update, so different tokens can be kept, ignored, or used to overwrite stale memory.',
        {type: 'callout', text: 'Mamba treats memory as fixed-size state with input-controlled writes, so length grows linearly while recall becomes a compression problem.'},
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is to keep using attention and raise the context length. This preserves direct access to earlier tokens as long as they fit in the context window.',
        'The older alternative is recurrence: maintain one state vector and update it token by token. Recurrence scales well with length, but a fixed state can forget details that attention would have stored directly.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'Attention hits a resource wall because the model compares many token pairs and serving systems carry key-value cache entries for past tokens. Longer contexts can increase memory pressure and reduce throughput.',
        'Plain recurrence hits a memory-quality wall. Compressing all history into one state is efficient, but the model must decide what survives compression, and old RNN-style updates often lacked enough content control.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Mamba makes the recurrence selective. The update parameters depend on the input token, so the model learns a content-dependent write policy instead of applying the same memory rule everywhere.',
        {type: 'image', src: 'https://arxiv.org/html/2312.00752/x1.png', alt: 'Mamba paper overview of selective state space computation and hardware-aware scan', caption: 'The Mamba overview ties the algorithmic move to the systems move: input-dependent state parameters need a scan that avoids materializing huge state tensors. Source: arXiv HTML for Gu and Dao, 2023.'},
        'The systems insight is just as important. A recurrent equation must be implemented with a hardware-aware selective scan so training can run efficiently on accelerators.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A classical SSM updates a state, then projects that state to an output. Mamba keeps that form but makes key update terms functions of the current input.',
        {type: 'image', src: 'https://arxiv.org/html/2312.00752/x3.png', alt: 'Mamba block architecture combining gated projections and a selective SSM branch', caption: 'The block diagram shows why Mamba is an architecture, not only a recurrence equation: projections, gates, SSM state, normalization, and residual flow all set the memory contract. Source: arXiv HTML for Gu and Dao, 2023.'},
        'During inference, the model can advance one token at a time with bounded recurrent state. During training, the scan form lets many updates be organized for parallel hardware rather than executed as a slow serial loop.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The correctness claim is not exact recall. It is a representation claim: if the task-relevant history can be compressed into the learned state, the recurrence can carry that information forward at linear cost.',
        'Selectivity improves the chance of useful compression because language and signals are uneven. A delimiter, entity name, or section boundary should affect memory differently from filler tokens.',
        'The scan matters because an algorithm that is linear but slow on GPUs is not useful at model scale. Mamba ties the mathematical recurrence to an execution plan that can train and serve efficiently.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The main cost behavior is linear in sequence length for the SSM path, with bounded recurrent state during streaming inference. Doubling the sequence roughly doubles the state updates rather than creating all-pairs attention work.',
        'The tax is compression. A Transformer can directly attend to a token that remains in context; Mamba must have stored the relevant information in state before the query arrives.',
        'Implementation complexity moves into kernels, scans, gating, normalization, and evaluation. A paper-level O(n) claim is not enough; throughput, memory, latency, and long-context task quality decide whether the model is useful.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Mamba-like SSMs are explored for language modeling, audio, genomics, time series, long-document processing, and streaming inference. These workloads often contain long sequences where direct all-pairs attention is expensive.',
        'Hybrid models are a common production direction. Attention layers can preserve exact lookup for some positions, while SSM layers handle compressed long-range dynamics at lower memory cost.',
        'The design question is practical: does the task need exact addressable memory, or is a learned evolving summary enough? The answer can differ across retrieval, coding, speech, and sensor workloads.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Mamba can fail on tasks that require exact retrieval of arbitrary old tokens. Needle-in-a-haystack recall, exact copying, legal citations, and long-range code dependencies can punish lossy state compression.',
        'It can also lose in practice when attention implementations are more mature for a given hardware stack. Kernel quality, batching, model size, and serving constraints can outweigh asymptotic shape.',
        'The wrong lesson is that attention is obsolete. The right lesson is that sequence models have different memory contracts, and the contract must match the task.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Suppose a sequence has 1,000 tokens and each token produces a 512-number state. A recurrent SSM updates one 512-number state per token, so the live state size stays 512 numbers while time grows with 1,000 updates.',
        'Full attention instead can compare each token to many previous tokens. A rough all-pairs view has about 1,000 * 1,000 = 1,000,000 token interactions before implementation shortcuts.',
        'If the needed fact appears at token 20 and is queried at token 980, attention can still point at token 20 if it is in context. Mamba can answer only if the learned updates preserved that fact inside the state through the intervening 960 tokens.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Mamba at https://arxiv.org/abs/2312.00752, S4 at https://arxiv.org/abs/2111.00396, RWKV at https://arxiv.org/abs/2305.13048, and Linear Transformers at https://arxiv.org/abs/2006.16236.',
        'Study attention, KV cache, transformer inference rooflines, RetNet, FNet, Titans-style test-time memory, vanishing and exploding gradients, and hybrid attention-state budgets. Compare one exact-copy task with one smooth time-series task to feel the memory tradeoff.',
      ],
    },
  ],
};
