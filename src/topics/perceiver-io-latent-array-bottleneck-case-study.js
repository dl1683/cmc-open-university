// Perceiver IO: use a fixed latent array as the working memory between
// arbitrary-sized inputs and arbitrary-shaped output queries.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'perceiver-io-latent-array-bottleneck-case-study',
  title: 'Perceiver IO Latent Array Bottleneck',
  category: 'Papers',
  summary: 'A fixed latent array turns huge multimodal inputs into bounded working memory, then output queries decode task-specific structures from that memory.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['latent array', 'output queries'], defaultValue: 'latent array' },
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

function latentGraph(title) {
  return graphState({
    nodes: [
      { id: 'input', label: 'inputs', x: 0.7, y: 3.8, note: 'huge N' },
      { id: 'adapter', label: 'adapter', x: 2.4, y: 3.8, note: 'embed' },
      { id: 'cross', label: 'cross', x: 4.1, y: 3.8, note: 'read in' },
      { id: 'latents', label: 'latents', x: 5.9, y: 3.8, note: 'fixed M' },
      { id: 'self', label: 'self attn', x: 7.5, y: 2.5, note: 'loop' },
      { id: 'head', label: 'head', x: 8.9, y: 3.8, note: 'task' },
      { id: 'skip', label: 'raw refs', x: 7.5, y: 5.2, note: 'optional' },
    ],
    edges: [
      { id: 'e-input-adapter', from: 'input', to: 'adapter', weight: 'pixels' },
      { id: 'e-adapter-cross', from: 'adapter', to: 'cross', weight: 'K,V' },
      { id: 'e-latents-cross', from: 'latents', to: 'cross', weight: 'Q' },
      { id: 'e-cross-latents', from: 'cross', to: 'latents', weight: 'write' },
      { id: 'e-latents-self', from: 'latents', to: 'self', weight: 'M x M' },
      { id: 'e-self-latents', from: 'self', to: 'latents', weight: 'refine' },
      { id: 'e-latents-head', from: 'latents', to: 'head', weight: 'readout' },
      { id: 'e-input-skip', from: 'input', to: 'skip', weight: 'coords' },
    ],
  }, { title });
}

function queryGraph(title) {
  return graphState({
    nodes: [
      { id: 'latents', label: 'latents', x: 0.8, y: 3.8, note: 'memory' },
      { id: 'queries', label: 'queries', x: 2.7, y: 3.8, note: 'schema' },
      { id: 'decode', label: 'decode', x: 4.6, y: 3.8, note: 'cross' },
      { id: 'class', label: 'class', x: 6.7, y: 1.7, note: '1 token' },
      { id: 'grid', label: 'grid', x: 6.7, y: 3.1, note: 'pixels' },
      { id: 'audio', label: 'audio', x: 6.7, y: 4.5, note: 'frames' },
      { id: 'action', label: 'action', x: 6.7, y: 5.9, note: 'slots' },
      { id: 'loss', label: 'loss', x: 8.6, y: 3.8, note: 'task' },
    ],
    edges: [
      { id: 'e-latents-decode', from: 'latents', to: 'decode', weight: 'K,V' },
      { id: 'e-queries-decode', from: 'queries', to: 'decode', weight: 'Q' },
      { id: 'e-decode-class', from: 'decode', to: 'class', weight: 'label' },
      { id: 'e-decode-grid', from: 'decode', to: 'grid', weight: 'dense' },
      { id: 'e-decode-audio', from: 'decode', to: 'audio', weight: 'time' },
      { id: 'e-decode-action', from: 'decode', to: 'action', weight: 'policy' },
      { id: 'e-grid-loss', from: 'grid', to: 'loss', weight: 'compare' },
      { id: 'e-class-loss', from: 'class', to: 'loss', weight: 'compare' },
    ],
  }, { title });
}

function* latentArray() {
  yield {
    state: labelMatrix(
      'Dense attention breaks on giant inputs',
      [
        { id: 'image', label: 'image' },
        { id: 'video', label: 'video' },
        { id: 'audio', label: 'audio' },
        { id: 'points', label: 'points' },
        { id: 'bytes', label: 'bytes' },
      ],
      [
        { id: 'N', label: 'N' },
        { id: 'dense', label: 'dense' },
        { id: 'move', label: 'latent' },
      ],
      [
        ['50k', 'N^2', 'read M'],
        ['frames', 'N^2', 'read M'],
        ['samples', 'N^2', 'read M'],
        ['points', 'N^2', 'read M'],
        ['bytes', 'N^2', 'read M'],
      ],
    ),
    highlight: { active: ['image:move', 'video:move', 'bytes:move'], compare: ['image:dense', 'video:dense'] },
    explanation: 'The original Perceiver targets a structural bottleneck in transformers: dense self-attention couples model cost to the full input length. Its move is to read huge inputs into a smaller latent array with cross-attention.',
  };

  yield {
    state: latentGraph('Cross-attention writes into a fixed latent array'),
    highlight: { active: ['cross', 'latents', 'e-latents-cross', 'e-cross-latents'], found: ['self'], compare: ['input'] },
    explanation: 'The latent array is the working set. Input embeddings provide keys and values, latent slots provide queries, and cross-attention writes a compressed view of the input into a fixed number of learned slots.',
    invariant: 'Input length N can grow while latent count M stays fixed.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'input tokens N', min: 0, max: 100 }, y: { label: 'relative cost', min: 0, max: 110 } },
      series: [
        { id: 'dense', label: 'dense', points: [
          { x: 10, y: 1 }, { x: 25, y: 6 }, { x: 50, y: 25 }, { x: 75, y: 56 }, { x: 100, y: 100 },
        ] },
        { id: 'latent', label: 'latent M', points: [
          { x: 10, y: 5 }, { x: 25, y: 12 }, { x: 50, y: 24 }, { x: 75, y: 36 }, { x: 100, y: 48 },
        ] },
        { id: 'loop', label: 'M loop', points: [
          { x: 10, y: 8 }, { x: 25, y: 8 }, { x: 50, y: 8 }, { x: 75, y: 8 }, { x: 100, y: 8 },
        ] },
      ],
      markers: [
        { id: 'cap', x: 78, y: 40, label: 'M cap' },
      ],
    }),
    highlight: { active: ['latent', 'loop', 'cap'], compare: ['dense'] },
    explanation: 'The cost shape is the whole case study. Cross-attention scales with N times M, while latent self-attention scales with M squared per latent block. That decouples the expensive depth of the model from raw input size.',
  };

  yield {
    state: labelMatrix(
      'Runtime data structures',
      [
        { id: 'inputs', label: 'input buf' },
        { id: 'pos', label: 'pos tags' },
        { id: 'latent', label: 'latent arr' },
        { id: 'cross', label: 'cross map' },
        { id: 'mask', label: 'mask' },
        { id: 'stats', label: 'stats' },
      ],
      [
        { id: 'stores', label: 'stores' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['embeds', 'bad norm'],
        ['coords', 'aliasing'],
        ['M slots', 'too small'],
        ['QK scores', 'copy cost'],
        ['visibility', 'leakage'],
        ['N,M,cost', 'drift'],
      ],
    ),
    highlight: { active: ['latent:stores', 'cross:stores', 'mask:stores'], found: ['stats:risk'] },
    explanation: 'Seen as data structures, Perceiver is not just a model block. It is an input buffer, position metadata, a fixed latent array, a cross-attention score map, visibility masks, and telemetry over N, M, and cost.',
  };

  yield {
    state: graphState({
      nodes: [
        { id: 'x0', label: 'input', x: 0.8, y: 3.8, note: 'fixed' },
        { id: 'l0', label: 'latent 0', x: 2.8, y: 2.1, note: 'init' },
        { id: 'l1', label: 'latent 1', x: 2.8, y: 3.8, note: 'init' },
        { id: 'l2', label: 'latent 2', x: 2.8, y: 5.5, note: 'init' },
        { id: 'attn1', label: 'block 1', x: 5.0, y: 3.0, note: 'refine' },
        { id: 'attn2', label: 'block 2', x: 6.8, y: 4.6, note: 'refine' },
        { id: 'out', label: 'memory', x: 8.8, y: 3.8, note: 'ready' },
      ],
      edges: [
        { id: 'e-x0-l0', from: 'x0', to: 'l0', weight: 'read' },
        { id: 'e-x0-l1', from: 'x0', to: 'l1', weight: 'read' },
        { id: 'e-x0-l2', from: 'x0', to: 'l2', weight: 'read' },
        { id: 'e-l0-attn1', from: 'l0', to: 'attn1', weight: 'slot' },
        { id: 'e-l1-attn1', from: 'l1', to: 'attn1', weight: 'slot' },
        { id: 'e-l2-attn1', from: 'l2', to: 'attn1', weight: 'slot' },
        { id: 'e-attn1-attn2', from: 'attn1', to: 'attn2', weight: 'loop' },
        { id: 'e-attn2-out', from: 'attn2', to: 'out', weight: 'state' },
      ],
    }, { title: 'Iterative attention refines memory, not the raw input' }),
    highlight: { active: ['l0', 'l1', 'l2', 'attn1', 'attn2'], compare: ['x0'], found: ['out'] },
    explanation: 'The Perceiver repeatedly applies transformer-style processing inside the latent array. The raw input can remain external while the latent slots exchange information and become a compact memory state.',
  };

  yield {
    state: labelMatrix(
      'Latent-bottleneck family',
      [
        { id: 'set', label: 'Set Xfmr' },
        { id: 'per', label: 'Perceiver' },
        { id: 'pio', label: 'PIO' },
        { id: 'par', label: 'Perc AR' },
        { id: 'adatape', label: 'AdaTape' },
        { id: 'rag', label: 'RAG' },
      ],
      [
        { id: 'memory', label: 'memory' },
        { id: 'interface', label: 'interface' },
      ],
      [
        ['induce pts', 'set attn'],
        ['latent arr', 'input read'],
        ['latent arr', 'out query'],
        ['latent arr', 'causal read'],
        ['tape bank', 'append toks'],
        ['doc chunks', 'retrieve'],
      ],
    ),
    highlight: { active: ['per:memory', 'pio:interface', 'par:interface'], compare: ['adatape:memory', 'rag:memory'] },
    explanation: 'Perceiver sits in a larger pattern: learned intermediate arrays can be inducing points, latent slots, tape tokens, or retrieved chunks. The design question is what memory is fixed, what is retrieved, and what the decoder is allowed to ask for.',
  };
}

function* outputQueries() {
  yield {
    state: queryGraph('Output queries turn memory into a task schema'),
    highlight: { active: ['queries', 'decode', 'e-queries-decode'], found: ['class', 'grid', 'audio', 'action'], compare: ['latents'] },
    explanation: 'Perceiver IO adds an output-query interface. Instead of forcing one fixed classifier head, query tokens ask the latent array for exactly the structure the task needs: a class, a dense grid, frames, or action slots.',
  };

  yield {
    state: labelMatrix(
      'Output query schemas',
      [
        { id: 'class', label: 'class tok' },
        { id: 'pixel', label: 'pixel grid' },
        { id: 'flow', label: 'flow grid' },
        { id: 'audio', label: 'audio fr' },
        { id: 'game', label: 'game acts' },
        { id: 'text', label: 'byte toks' },
      ],
      [
        { id: 'asks', label: 'asks for' },
        { id: 'shape', label: 'shape' },
      ],
      [
        ['label', '1'],
        ['color', 'H x W'],
        ['motion', 'H x W'],
        ['sample', 'T'],
        ['policy', 'slots'],
        ['next byte', 'T'],
      ],
    ),
    highlight: { active: ['pixel:shape', 'flow:shape', 'audio:shape'], compare: ['class:shape'] },
    explanation: 'The query array is a schema. A single query can ask for a label, while thousands of queries can ask for optical-flow vectors, pixels, audio frames, or language positions without changing the latent encoder.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'output queries Q', min: 0, max: 100 }, y: { label: 'decode cost', min: 0, max: 120 } },
      series: [
        { id: 'cross', label: 'Q x M', points: [
          { x: 1, y: 3 }, { x: 10, y: 13 }, { x: 25, y: 31 }, { x: 50, y: 61 }, { x: 100, y: 118 },
        ] },
        { id: 'single', label: '1 query', points: [
          { x: 1, y: 3 }, { x: 10, y: 3 }, { x: 25, y: 3 }, { x: 50, y: 3 }, { x: 100, y: 3 },
        ] },
      ],
      markers: [
        { id: 'dense', x: 78, y: 93, label: 'dense out' },
      ],
    }),
    highlight: { active: ['cross', 'dense'], compare: ['single'] },
    explanation: 'The output side has its own budget. Large dense outputs still cost more because every output query attends to the latent memory, but this cost is separate from how large the original input was.',
  };

  yield {
    state: labelMatrix(
      'Architecture choices',
      [
        { id: 'xfmr', label: 'Xfmr' },
        { id: 'per', label: 'Perceiver' },
        { id: 'pio', label: 'Perc IO' },
        { id: 'adatape', label: 'AdaTape' },
        { id: 'blt', label: 'BLT' },
      ],
      [
        { id: 'input', label: 'input cost' },
        { id: 'output', label: 'out shape' },
        { id: 'knob', label: 'main knob' },
      ],
      [
        ['N^2', 'native', 'tokens'],
        ['N x M', 'head', 'M slots'],
        ['N x M', 'queries', 'Q schema'],
        ['elastic', 'native', 'tape toks'],
        ['patches', 'bytes', 'patch len'],
      ],
    ),
    highlight: { active: ['pio:input', 'pio:output', 'pio:knob'], compare: ['xfmr:input', 'adatape:knob'] },
    explanation: 'Perceiver IO is best understood as interface engineering. A normal transformer uses tokens as both input and output interface. Perceiver IO inserts a latent working memory and lets output queries define the readout.',
  };

  yield {
    state: graphState({
      nodes: [
        { id: 'prefix', label: 'prefix', x: 0.8, y: 3.8, note: 'long ctx' },
        { id: 'mask', label: 'mask', x: 2.4, y: 3.8, note: 'causal' },
        { id: 'latents', label: 'latents', x: 4.2, y: 3.8, note: 'tail Q' },
        { id: 'xattn', label: 'cross', x: 5.9, y: 3.8, note: 'read' },
        { id: 'next', label: 'next toks', x: 7.6, y: 2.7, note: 'AR' },
        { id: 'audit', label: 'audit', x: 7.6, y: 5.0, note: 'leaks' },
        { id: 'loss', label: 'loss', x: 9.0, y: 3.8, note: 'nll' },
      ],
      edges: [
        { id: 'e-prefix-mask', from: 'prefix', to: 'mask', weight: 'limit' },
        { id: 'e-mask-xattn', from: 'mask', to: 'xattn', weight: 'visible' },
        { id: 'e-latents-xattn', from: 'latents', to: 'xattn', weight: 'Q' },
        { id: 'e-xattn-next', from: 'xattn', to: 'next', weight: 'decode' },
        { id: 'e-mask-audit', from: 'mask', to: 'audit', weight: 'tests' },
        { id: 'e-next-loss', from: 'next', to: 'loss', weight: 'score' },
      ],
    }, { title: 'Perceiver AR aligns latents with causal prediction' }),
    highlight: { active: ['mask', 'latents', 'xattn', 'next'], found: ['audit'], compare: ['prefix'] },
    explanation: 'Perceiver AR adapts the latent-array idea to autoregressive modeling. Latents are aligned with the final positions being predicted, and masking makes sure each prediction only reads earlier context.',
  };

  yield {
    state: labelMatrix(
      'Production checklist',
      [
        { id: 'adapt', label: 'adapters' },
        { id: 'pos', label: 'pos enc' },
        { id: 'latent', label: 'M size' },
        { id: 'query', label: 'Q schema' },
        { id: 'mask', label: 'masks' },
        { id: 'serve', label: 'serving' },
      ],
      [
        { id: 'must', label: 'must lock' },
        { id: 'failure', label: 'failure' },
      ],
      [
        ['modality', 'bad scale'],
        ['coords', 'aliasing'],
        ['capacity', 'lost info'],
        ['task shape', 'wrong out'],
        ['visibility', 'leakage'],
        ['N,M,Q', 'p99 cost'],
      ],
    ),
    highlight: { active: ['latent:must', 'query:must', 'mask:must'], found: ['serve:failure'] },
    explanation: 'The engineering checklist is specific: normalize each modality, preserve positions, choose latent count M, define output-query schemas, test masks for leakage, and monitor N, M, Q, latency, and memory.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'latent array') yield* latentArray();
  else if (view === 'output queries') yield* outputQueries();
  else throw new InputError('Pick a Perceiver IO view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'Read the picture as three arrays with different jobs. The input array has N raw positions, the latent array has M learned memory slots, and the output-query array has Q questions the model asks of that memory.',
        'The safe inference is about cost. When the deep stack runs on M latent slots instead of N input positions, the repeated attention cost follows M squared rather than N squared.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Perceiver IO exists because many inputs are too large or too awkward for full self-attention at every layer. Images, audio, video, point clouds, and mixed records can all become long position sets after an adapter turns them into vectors.',
        'The architecture also separates output shape from input shape. A classifier needs one label, optical flow needs many grid values, and a policy may need a few action slots, so one fixed token array should not have to serve every role.',
        {type:'callout', text:`Perceiver IO separates raw input size, bounded latent memory, and output query shape so the expensive depth runs over the controllable middle.`},
        {type:'image', src:'https://upload.wikimedia.org/wikipedia/commons/3/34/Transformer%2C_full_architecture.png', alt:'Diagram of a transformer encoder decoder architecture with self attention and cross attention blocks.', caption:`Transformer architecture showing the attention interface that Perceiver IO reworks. Image by dvgodoy, CC BY 4.0, via Wikimedia Commons.`},
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is to tokenize every input position and run ordinary transformer self-attention over the full set. That is attractive because every token can directly mix with every other token in every layer.',
        'For small inputs this is the cleanest model. The implementation is simple, the representation is uniform, and the attention matrix gives a direct path between any two positions.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is the square cost of attention. If N input positions attend to N positions, one layer builds an N by N interaction table, so 10,000 positions imply 100,000,000 attention scores before heads and batch size.',
        'Depth multiplies the problem. A 24-layer stack repeats that cost 24 times, and dense outputs add another cost if each output position must query the internal state.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'The core insight is to read a large input into a bounded latent memory, then spend the expensive depth there. Cross-attention from M latent queries to N input keys and values costs N times M, while self-attention inside the latent array costs M squared.',
        'The invariant is that repeated computation is tied to M, not directly to N. Output queries then read from the latent memory, so Q controls output cost instead of being hidden inside the input encoder.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'An adapter first turns raw modality data into embeddings and positions. For an image that may be patches plus coordinates, while for audio it may be time-window features.',
        'Learned latent slots query those inputs through cross-attention and write a compact working state. Transformer blocks then refine the latent state, and output queries attend to the latents to produce labels, grids, samples, or action slots.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'This is not a sorting-style proof; it is an interface correctness argument. If the adapter preserves useful evidence, the latent array has enough capacity, and the output queries ask the right questions, the model can represent functions from many input shapes to many output shapes.',
        'The architecture is trustworthy only within that capacity budget. Information that never enters the latent state cannot be recovered by the decoder later, so correctness depends on learned attention and enough latent memory.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Full input self-attention costs O(N^2) per layer. Perceiver-style input reading costs O(NM), latent processing costs O(M^2) per latent layer, and decoding costs O(QM).',
        'With N = 50,000 and M = 512, one input read is about 25,600,000 score terms, while one full input attention layer would be 2,500,000,000 score terms. The tradeoff is that the 512 latent slots must carry enough information for the task.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'The pattern fits high-resolution perception, long audio, video, point clouds, byte streams, and multimodal records where raw input length varies widely. It gives the engineer a direct capacity knob: choose M based on latency, memory, and accuracy.',
        'It also fits multitask models. The same latent memory can feed one class query, many dense grid queries, or a sequence of output queries without rebuilding the whole encoder.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'It fails when fine detail is lost in the bottleneck. A rare sound, tiny object, or sharp boundary that the latent slots do not capture cannot be restored by a later output query.',
        'Dense outputs can still dominate cost. If Q is 100,000 output positions and M is 512, the decoder alone performs about 51,200,000 query-latent score terms before heads and layers.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Consider a 224 by 224 image represented as one token per pixel, so N = 50,176. Full self-attention over those pixels needs about 2.5 billion pair scores per layer, and 12 layers would repeat that table 12 times.',
        'With M = 512 latents, the input read is about 25.7 million scores, and each latent self-attention layer is about 262,000 scores. If the output is one class query, Q = 1 adds only 512 more scores; if the output is a 196-cell grid, decoding adds about 100,000 scores.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Perceiver at https://arxiv.org/abs/2103.03206, Perceiver IO at https://arxiv.org/abs/2107.14795, OpenReview at https://openreview.net/forum?id=fILj7WpI-g, Perceiver AR at https://arxiv.org/abs/2202.07765, and DeepMind research code at https://github.com/google-deepmind/deepmind-research/blob/master/perceiver/perceiver.py.',
        'Study Attention, Transformer Block, Set Transformer Induced Points, Vision Transformer Register Tokens, AdaTape Adaptive Token Bank, Byte Latent Transformer, Tokenization BPE, KV Cache, and Transformer Inference Roofline.',
      ],
    },
  ],
};