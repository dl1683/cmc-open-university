// FNet: replace learned self-attention token mixing with a fixed Fourier mixer.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'fnet-fourier-token-mixing-case-study',
  title: 'FNet Fourier Token Mixing Case Study',
  category: 'Papers',
  summary: 'A fixed-token-mixing Transformer alternative: replace encoder self-attention with Fourier transforms, keep feed-forward blocks, and audit the speed/quality tradeoff.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['fourier mixer', 'attention tradeoff'], defaultValue: 'fourier mixer' },
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

function encoderGraph(title) {
  return graphState({
    nodes: [
      { id: 'tokens', label: 'tokens', x: 0.7, y: 3.8, note: 'n x d' },
      { id: 'pos', label: 'position', x: 2.0, y: 2.3, note: 'order' },
      { id: 'mix', label: 'DFT mix', x: 3.5, y: 3.8, note: 'fixed' },
      { id: 'real', label: 'real', x: 5.2, y: 3.8, note: 'real out' },
      { id: 'ffn', label: 'FFN', x: 6.9, y: 3.8, note: 'learned' },
      { id: 'head', label: 'head', x: 8.7, y: 3.8, note: 'labels' },
    ],
    edges: [
      { id: 'e-tokens-pos', from: 'tokens', to: 'pos' },
      { id: 'e-pos-mix', from: 'pos', to: 'mix' },
      { id: 'e-tokens-mix', from: 'tokens', to: 'mix' },
      { id: 'e-mix-real', from: 'mix', to: 'real' },
      { id: 'e-real-ffn', from: 'real', to: 'ffn' },
      { id: 'e-ffn-head', from: 'ffn', to: 'head' },
    ],
  }, { title });
}

function attentionGrid(title) {
  return labelMatrix(
    title,
    [
      { id: 'q1', label: 'tok A' },
      { id: 'q2', label: 'tok B' },
      { id: 'q3', label: 'tok C' },
      { id: 'q4', label: 'tok D' },
    ],
    [
      { id: 'k1', label: 'A' },
      { id: 'k2', label: 'B' },
      { id: 'k3', label: 'C' },
      { id: 'k4', label: 'D' },
    ],
    [
      ['.55', '.08', '.25', '.12'],
      ['.06', '.66', '.18', '.10'],
      ['.31', '.12', '.44', '.13'],
      ['.09', '.28', '.20', '.43'],
    ],
  );
}

function* fourierMixer() {
  yield {
    state: encoderGraph('FNet swaps the attention mixer'),
    highlight: { active: ['tokens', 'mix', 'real', 'ffn'], compare: ['pos'], found: ['head'] },
    explanation: 'FNet keeps the Transformer encoder skeleton but replaces the self-attention sublayer with a fixed Fourier transform. The mixer has no learned token-to-token weights.',
    invariant: 'The atomic tradeoff: cheap global mixing instead of content-dependent attention.',
  };

  yield {
    state: attentionGrid('Self-attention learns an n x n routing table'),
    highlight: { active: ['q3:k1', 'q2:k2', 'q4:k4'], compare: ['q1:k2', 'q2:k1'] },
    explanation: 'Attention builds a content-dependent all-pairs table. Token C can decide to read token A strongly in this input and read something else in the next input.',
  };

  yield {
    state: labelMatrix(
      'FNet applies a fixed 2D DFT',
      [
        { id: 'x', label: 'in' },
        { id: 'hid', label: 'F_dim' },
        { id: 'seq', label: 'F_seq' },
        { id: 'real', label: 'Re' },
      ],
      [
        { id: 'axis', label: 'axis' },
        { id: 'learned', label: 'params' },
        { id: 'effect', label: 'role' },
      ],
      [
        ['nxd', 'learn', 'embed'],
        ['dim', 'fixed', 'mix d'],
        ['seq', 'fixed', 'mix n'],
        ['real', 'fixed', 'to FFN'],
      ],
    ),
    highlight: { active: ['hid:effect', 'seq:effect'], found: ['real:effect'], compare: ['x:learned'] },
    explanation: 'The standard FNet mixer applies a Fourier transform along the hidden dimension and sequence dimension, then returns the real component to the rest of the block.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'sequence length', min: 0, max: 4096 }, y: { label: 'relative mixer work', min: 0, max: 10 } },
      series: [
        { id: 'attn', label: 'attention n^2', points: [
          { x: 128, y: 0.02 }, { x: 512, y: 0.25 }, { x: 1024, y: 1.0 }, { x: 2048, y: 4.0 }, { x: 4096, y: 10.0 },
        ] },
        { id: 'fft', label: 'FFT n log n', points: [
          { x: 128, y: 0.18 }, { x: 512, y: 0.45 }, { x: 1024, y: 0.75 }, { x: 2048, y: 1.15 }, { x: 4096, y: 1.75 },
        ] },
      ],
      markers: [
        { id: 'long', x: 2048, y: 1.15, label: 'longer input' },
      ],
    }),
    highlight: { active: ['fft', 'long'], compare: ['attn'] },
    explanation: 'The speed story is a growth-rate story. Attention allocates pairwise routing work as context grows; FFT-style mixing grows much more gently and has a smaller memory footprint.',
  };

  yield {
    state: labelMatrix(
      'What remains trainable',
      [
        { id: 'embed', label: 'embeddings' },
        { id: 'mix', label: 'Fourier mix' },
        { id: 'norm', label: 'norm' },
        { id: 'ffn', label: 'FFN' },
        { id: 'head', label: 'head' },
      ],
      [
        { id: 'params', label: 'params' },
        { id: 'job', label: 'job' },
      ],
      [
        ['learned', 'token meaning'],
        ['fixed', 'global mixing'],
        ['learned', 'scale'],
        ['learned', 'nonlinear map'],
        ['learned', 'task logits'],
      ],
    ),
    highlight: { active: ['mix:params'], found: ['ffn:job', 'head:job'], compare: ['embed:params'] },
    explanation: 'FNet is not a parameter-free model. The fixed mixer removes learned token routing, while embeddings, normalization, feed-forward layers, and task heads still carry learned structure.',
  };

  yield {
    state: encoderGraph('The final frame: fixed global mix plus learned local processing'),
    highlight: { active: ['mix', 'real', 'ffn', 'head', 'e-mix-real', 'e-real-ffn', 'e-ffn-head'], found: ['tokens'], compare: ['pos'] },
    explanation: 'The complete mental model: Fourier mixing gives every token a cheap global blend; learned feed-forward layers decide what to do with that blend. Speed improves, but exact content lookup is weaker.',
    invariant: 'FNet is best read as a speed/quality design point, not a universal attention replacement.',
  };
}

function* attentionTradeoff() {
  yield {
    state: labelMatrix(
      'Mixer families',
      [
        { id: 'attn', label: 'attention' },
        { id: 'fnet', label: 'FNet' },
        { id: 'rwkv', label: 'RWKV' },
        { id: 'mamba', label: 'Mamba' },
        { id: 'matmul', label: 'MF-LM' },
      ],
      [
        { id: 'memory', label: 'state' },
        { id: 'routing', label: 'routing' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['KV', 'content', 'cache'],
        ['none', 'fixed', 'lookup'],
        ['recur', 'decay', 'forget'],
        ['SSM', 'select', 'kernel'],
        ['MLGRU', 'tern', 'hw'],
      ],
    ),
    highlight: { active: ['fnet:routing', 'fnet:memory'], compare: ['attn:risk'], found: ['mamba:risk', 'matmul:risk'] },
    explanation: 'FNet belongs in the efficient-sequence-model map. It attacks the attention table directly by using a fixed mixer rather than compressed KV state or recurrent state.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'train speed', min: 0.8, max: 2.05 }, y: { label: 'GLUE vs BERT', min: 88, max: 101 } },
      series: [
        { id: 'frontier', label: 'budget', points: [
          { x: 1.0, y: 100 }, { x: 1.25, y: 98 }, { x: 1.45, y: 96 }, { x: 1.7, y: 94 }, { x: 1.8, y: 92 },
        ] },
      ],
      markers: [
        { id: 'bert', x: 1.0, y: 100, label: 'BERT' },
        { id: 'fnet', x: 1.8, y: 94, label: 'FNet' },
      ],
    }),
    highlight: { active: ['fnet', 'frontier'], compare: ['bert'] },
    explanation: 'The reported headline is not free accuracy. The paper reports roughly BERT-level task quality in the 92-97 percent range with faster training at standard 512-token inputs.',
  };

  yield {
    state: labelMatrix(
      'Where fixed mixing helps',
      [
        { id: 'classify', label: 'classification' },
        { id: 'long', label: 'long encoder' },
        { id: 'small', label: 'small model' },
        { id: 'edge', label: 'edge budget' },
      ],
      [
        { id: 'why', label: 'why' },
        { id: 'watch', label: 'watch' },
      ],
      [
        ['global blend enough', 'accuracy gap'],
        ['no n^2 table', 'task fit'],
        ['fewer params', 'capacity'],
        ['light memory', 'FFT kernels'],
      ],
    ),
    highlight: { active: ['long:why', 'small:why', 'edge:why'], compare: ['classify:watch'] },
    explanation: 'FNet is attractive when the task can live with broad global mixing and the product is constrained by memory, training time, or long encoder inputs.',
  };

  yield {
    state: labelMatrix(
      'Attention replacement limits',
      [
        { id: 'lookup', label: 'lookup' },
        { id: 'mask', label: 'causal' },
        { id: 'cross', label: 'cross' },
        { id: 'sparse', label: 'route' },
      ],
      [
        { id: 'need', label: 'need' },
        { id: 'FNet risk', label: 'risk' },
      ],
      [
        ['token j', 'blend'],
        ['mask', 'hard'],
        ['source', 'bridge'],
        ['content', 'fixed'],
      ],
    ),
    highlight: { compare: ['lookup:FNet risk', 'mask:FNet risk', 'cross:FNet risk'], found: ['sparse:need'] },
    explanation: 'The same simplicity creates limits. Fixed Fourier mixing is not a learned memory lookup, and causal decoder or cross-attention variants are much less direct than encoder replacement.',
  };

  yield {
    state: graphState({
      nodes: [
        { id: 'claim', label: 'speed claim', x: 0.8, y: 3.8, note: 'paper' },
        { id: 'task', label: 'task slice', x: 2.6, y: 2.4, note: 'GLUE/LRA' },
        { id: 'kernel', label: 'kernel', x: 2.6, y: 5.2, note: 'FFT path' },
        { id: 'memory', label: 'memory', x: 4.7, y: 3.8, note: 'resident bytes' },
        { id: 'quality', label: 'quality gate', x: 6.7, y: 2.4, note: 'regressions' },
        { id: 'serve', label: 'serve gate', x: 6.7, y: 5.2, note: 'p95/cost' },
        { id: 'ship', label: 'ship?', x: 8.8, y: 3.8, note: 'decision' },
      ],
      edges: [
        { id: 'e-claim-task', from: 'claim', to: 'task' },
        { id: 'e-claim-kernel', from: 'claim', to: 'kernel' },
        { id: 'e-task-memory', from: 'task', to: 'memory' },
        { id: 'e-kernel-memory', from: 'kernel', to: 'memory' },
        { id: 'e-memory-quality', from: 'memory', to: 'quality' },
        { id: 'e-memory-serve', from: 'memory', to: 'serve' },
        { id: 'e-quality-ship', from: 'quality', to: 'ship' },
        { id: 'e-serve-ship', from: 'serve', to: 'ship' },
      ],
    }, { title: 'Production audit before adopting FNet' }),
    highlight: { active: ['task', 'kernel', 'memory', 'quality', 'serve'], found: ['ship'], compare: ['claim'] },
    explanation: 'A serious FNet adoption test profiles the real task, sequence length, FFT kernel path, memory footprint, quality regressions, and p95 serving cost. The paper result is the start, not the gate.',
  };

  yield {
    state: labelMatrix(
      'Study map',
      [
        { id: 'attn', label: 'Attn' },
        { id: 'block', label: 'Block' },
        { id: 'roof', label: 'Roof' },
        { id: 'cvnn', label: 'CVNN' },
        { id: 'hybrid', label: 'Hybrid' },
      ],
      [
        { id: 'question', label: 'q' },
        { id: 'FNet link', label: 'link' },
      ],
      [
        ['n x n?', 'removed'],
        ['plug?', 'sublayer'],
        ['ceiling?', 'bytes'],
        ['complex?', 'DFT Re'],
        ['state?', 'none'],
      ],
    ),
    highlight: { found: ['attn:FNet link', 'block:FNet link', 'roof:FNet link', 'cvnn:FNet link', 'hybrid:FNet link'] },
    explanation: 'Use FNet as a bridge topic: it connects attention mechanics, Transformer-block anatomy, roofline cost, complex Fourier representations, and the broader search for cheaper sequence state.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'fourier mixer') yield* fourierMixer();
  else if (view === 'attention tradeoff') yield* attentionTradeoff();
  else throw new InputError('Pick an FNet Fourier-token-mixing view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'FNet asks a blunt architecture question: what if a Transformer encoder did not learn an attention matrix at all? Lee-Thorp, Ainslie, Eckstein, and Ontanon replace the self-attention sublayer with an unparameterized Fourier transform that mixes tokens. The rest of the encoder skeleton remains recognizable: embeddings, position information, residual paths, normalization, feed-forward layers, and a task head still do learned work.',
        'The important distinction is content dependence. Self-attention computes a fresh token-to-token routing table for each input. FNet uses the same global Fourier mixing rule for every input, then relies on the learned feed-forward layers and task head to extract useful structure from that mixed representation.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The Fourier sublayer treats the hidden states as a tokens-by-dimensions array. In the standard version, it applies a discrete Fourier transform along the hidden dimension and along the sequence dimension, then returns the real part to keep the surrounding Transformer block real-valued. The operation is fixed: it has no learned query, key, value, or attention-weight parameters.',
        'This gives every token access to a cheap global blend of the sequence. The feed-forward network then supplies nonlinear processing. That combination is enough for many encoder-style tasks, but it is not the same as learned retrieval. A token cannot decide, input by input, to read exactly one other token the way attention can.',
      ],
    },
    {
      heading: 'Complete case study: long document encoder',
      paragraphs: [
        'Imagine a moderation or legal-triage classifier that reads long documents and predicts a small set of labels. A BERT-style encoder uses attention to build an n by n routing table in each layer. That can be expensive when the document grows and the task mostly needs broad global evidence rather than precise token-level extraction. An FNet-style encoder replaces that routing table with fixed Fourier mixing, reducing the mixer cost and memory footprint.',
        'The adoption gate is still empirical. The team should compare against the attention baseline on short and long documents, check rare-label recall, inspect failure cases that require exact phrase lookup, profile FFT kernels on the deployment hardware, and measure p95 latency and memory at production batch sizes. FNet is attractive only if the saved mixer cost is larger than the quality and kernel-integration cost.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Attention has a quadratic sequence-length term because every token scores every other token. FFT-style mixing has a much gentler growth rate and a smaller parameter footprint in the mixer. The FNet paper reports 92-97 percent of BERT counterpart accuracy on GLUE while training much faster at 512-token inputs, and reports stronger speed advantages for longer inputs in Long Range Arena comparisons.',
        'The systems caveat is that complexity notation is not the same as product speed. FFT kernels, padding, sequence lengths, accelerator libraries, batching, and memory movement decide the actual roofline point. For small sequences or highly optimized attention kernels, the measured win may be smaller than the asymptotic story suggests.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'FNet does not prove attention is useless. It proves that some encoder workloads can tolerate a fixed global mixer with limited accuracy loss. Exact lookup, causal generation, cross-attention, selective reading, and tasks that depend on sharp token-to-token routing still favor attention or hybrid designs.',
        'Do not call the Fourier layer learned memory. It is fixed signal-processing structure inserted into a neural block. Also do not ignore masks: Hugging Face notes that FNet was trained without an attention mask, because the model is based on Fourier transforms. That matters when porting the idea to padded, causal, or encoder-decoder settings.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: the ACL Anthology paper page at https://aclanthology.org/2022.naacl-main.319/, the arXiv page at https://arxiv.org/abs/2105.03824, and the Hugging Face FNet documentation at https://huggingface.co/docs/transformers/en/model_doc/fnet. Study Attention Mechanism, The Transformer Block, Transformer Inference Roofline, Complex-Valued Neural Networks, MatMul-Free Language Modeling, Hybrid Attention State Budget Case Study, Titans Test-Time Neural Memory Case Study, RWKV Recurrent Transformer, Selective State Space Models: Mamba, and Kimi Linear Attention next.',
      ],
    },
  ],
};
