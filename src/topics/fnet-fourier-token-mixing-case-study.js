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
      heading: 'Why this exists',
      paragraphs: [
        'FNet exists because self-attention is powerful but expensive. In a Transformer encoder, each layer can build an n by n token-routing table. That table lets token 3 read token 97 strongly in one sentence and ignore it in the next sentence. The cost is that sequence length appears twice: longer inputs create many more pairwise scores, more memory traffic, and more intermediate state.',
        'Lee-Thorp, Ainslie, Eckstein, and Ontanon asked whether every encoder workload needs learned token routing. Their answer was FNet: replace the self-attention sublayer with an unparameterized Fourier transform that mixes tokens globally. The rest of the block stays familiar. Embeddings, position information, residual paths, normalization, feed-forward layers, and task heads still learn. The mixer is the part that becomes fixed.',
        {type:'callout', text:'FNet separates global communication from learned routing: a fixed Fourier mixer spreads token information while learned layers decide what matters.'},
        {type:'image', src:'https://upload.wikimedia.org/wikipedia/commons/5/51/Fourier_unit_pulse.svg', alt:'Fourier transform plots for unit pulse functions.', caption:'Fourier transforms of the unit pulse function by Slawomir Bialy and IkamusumeFan, CC BY-SA 4.0, via Wikimedia Commons.'},
      ],
    },
    {
      heading: 'The obvious approach and the wall',
      paragraphs: [
        'The obvious approach is to keep attention and optimize it. Use faster kernels, local windows, sparse patterns, lower precision, padding tricks, distillation, or smaller hidden sizes. These are reasonable moves. Attention is expressive, well-supported, and easy to adapt to masks, cross-attention, and decoder generation.',
        'The wall is that optimized attention is still attention. A full encoder attention layer is built around input-specific all-pairs routing. If the task mostly needs broad evidence from across the sequence, an n by n table can be more machinery than the problem requires. FNet attacks the table directly: remove learned routing from the mixer and ask the learned feed-forward layers to make use of a fixed global blend.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'The core insight is a separation of jobs. Token mixing does not always have to be learned and content-dependent. A fixed linear transform can spread information across the sequence, and learned nonlinear layers can then decide which mixed features matter for the task. That gives up exact input-specific lookup, but it keeps a cheap path for global communication.',
        'The Fourier transform is useful here because it is a structured global linear mixer. It combines positions through sinusoidal frequency bases rather than through learned query-key scores. FNet is therefore not a parameter-free model. It is a model where the token mixer has no learned routing weights while the surrounding layers still carry learned representations.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The hidden state entering an encoder layer is a tokens-by-hidden-dimension array. A standard attention block projects that array into queries, keys, and values, computes token-to-token scores, normalizes them, and forms weighted sums. FNet removes that sublayer. In the standard version, it applies a discrete Fourier transform along the hidden dimension and along the sequence dimension, then sends the real component back into the Transformer block.',
        'Residual connections, normalization, embeddings, and feed-forward layers still matter. The fixed mixer spreads information, but it does not classify, decode, or understand by itself. The feed-forward network supplies learned nonlinear processing at each position. Across layers, fixed global mixing and learned local processing alternate.',
        'This is why FNet is best read as an encoder design point, not as a universal replacement for attention. It is well matched to tasks where a broad global blend is often enough. It is weaker when a token must choose a specific other token, when the model must attend from a decoder to an encoder, or when a causal mask must strictly hide future tokens.',
      ],
    },
    {
      heading: 'What the visual proves',
      paragraphs: [
        'The attention grid shows the baseline: every token can route to every other token, and the routing table changes with the input. The Fourier graph shows the FNet tradeoff: the mixer is fixed, global, and cheap enough to avoid the learned n by n table. The cost plot is the reason this topic belongs in a data-structures course: layout and growth rate shape model architecture.',
        'The last frames show what remains trainable. If the visual makes FNet look like magic signal processing, read the feed-forward and task-head nodes as the correction. Fourier mixing provides communication. The learned layers still decide which mixed features become useful predictions.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'FNet works when the task can tolerate a lossy division of labor. The Fourier transform is a deterministic global mixing operation, so information from many positions can influence each position after the transform. It is not selecting the best source token. It is making the sequence globally entangled in a structured way, then letting learned nonlinear layers extract patterns from that entangled representation.',
        'The proof idea is not a theorem that Fourier beats attention. It is an architectural hypothesis supported by benchmarks: for many encoder classification and long-range tasks, full content-dependent routing is not always necessary. The paper reports that FNet kept a large fraction of BERT counterpart accuracy on GLUE while training faster at 512-token inputs, and showed stronger speed advantages on longer Long Range Arena inputs.',
      ],
    },
    {
      heading: 'Costs and tradeoffs',
      paragraphs: [
        'The headline cost difference is sequence-length behavior. Full attention has a quadratic token-routing term because each token scores every other token. FFT-style mixing grows more gently and removes learned query, key, value, and attention-weight machinery from the mixer. It can also reduce memory pressure because it does not store the same kind of attention table.',
        'The engineering caveat is that asymptotic notation is not a benchmark. FFT kernels, padding, sequence lengths, batch shape, accelerator libraries, precision, memory movement, and compiler support decide the measured speed. Highly optimized attention kernels can be hard to beat on short inputs. FNet also has a masking tax: Hugging Face notes that the model was trained without an attention mask and recommends using the same maximum sequence length for fine-tuning and inference.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'FNet is most attractive for encoder workloads where the product needs classification, ranking, retrieval scoring, moderation, routing, or triage over text, and the answer depends on broad document evidence rather than exact token lookup. A long legal-triage classifier, for example, may need signals from across the document but may not need each token to choose a custom source token in every layer.',
        'It also fits small-model and memory-constrained settings. The paper argues that FNet has a light memory footprint and is efficient at smaller model sizes. A deployment team should still run a matched bake-off: same data, same sequence lengths, same metric slices, same hardware, and same latency and memory budget.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'FNet does not prove attention is useless. It shows that some encoder workloads can trade content-dependent routing for fixed global mixing with limited quality loss. Exact lookup, copying, span extraction, cross-attention, causal generation, retrieval-heavy reasoning, and tasks that need sharp token-to-token routing still favor attention or hybrid designs.',
        'The common mistake is to call the Fourier layer learned memory. It is fixed signal-processing structure inserted into a neural block. Another mistake is to port the idea into a decoder or padded production pipeline without checking masks and padding behavior. A speed claim is not portable until the exact task, sequence length, kernel path, and quality regressions have been measured.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Primary sources: the ACL Anthology paper page at https://aclanthology.org/2022.naacl-main.319/, the arXiv page at https://arxiv.org/abs/2105.03824, and the Hugging Face FNet documentation at https://huggingface.co/docs/transformers/en/model_doc/fnet. Study Attention Mechanism for the baseline routing table, The Transformer Block for residual and feed-forward anatomy, Transformer Inference Roofline for memory and compute limits, Complex-Valued Neural Networks for Fourier representations, MatMul-Free Language Modeling for another architecture tradeoff, Hybrid Attention State Budget Case Study for mixed designs, Titans Test-Time Neural Memory Case Study for learned memory, RWKV Recurrent Transformer for recurrent state, Selective State Space Models: Mamba for state-space sequence modeling, and Kimi Linear Attention for newer efficient-attention work.',
      ],
    },
  ],
};
