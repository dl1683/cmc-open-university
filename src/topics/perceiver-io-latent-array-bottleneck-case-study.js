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
      heading: 'Why it exists',
      paragraphs: [
        `Perceiver IO exists because many real inputs are not polite token sequences. Images contain grids, video contains frames, audio contains long time streams, point clouds contain unordered sets, and multimodal examples can mix several of those forms at once. A transformer can process any of these after an adapter turns them into vectors, but the raw number of positions can become much larger than the model can afford to mix at full depth.`,
        `There is also an output problem. Classification wants one label. Optical flow wants a dense grid. Audio generation wants many time samples. A control policy may want a small set of action slots. Perceiver IO treats input size, internal working memory, and output shape as separate design choices instead of forcing one token array to play every role.`,
      ],
    },
    {
      heading: 'The obvious approach and the wall',
      paragraphs: [
        `The obvious approach is to tokenize every input position and run ordinary self-attention over the full set. This is attractive because it keeps the model simple: every token can attend to every other token, and every layer can revise every position using global context.`,
        `The wall is the cost curve. Full self-attention over N input positions costs O(N^2) attention work per layer, and that cost repeats through depth. A 224 by 224 image, a long audio clip, or a dense video sample can produce far more positions than a plain transformer can process economically. Domain-specific encoders reduce cost, but then the architecture becomes less general.`,
        `The output wall is different but just as real. A classifier head is cheap, but it does not describe dense reconstruction or structured prediction. Building a different decoder for every task hides the common pattern and makes it harder to reuse the same internal representation across tasks.`,
      ],
    },
    {
      heading: 'Core insight',
      paragraphs: [
        `The core insight is to separate three arrays that a standard transformer often blends together: the input array of size N, a learned latent array of size M, and an output-query array of size Q. N can be huge, M can stay bounded, and Q can match the shape of the task.`,
        `The latent array is the working memory. Input embeddings provide keys and values. Latent slots provide queries and read from the input through cross-attention. After that read, the model spends most of its depth inside the latent array, where self-attention costs O(M^2) rather than O(N^2).`,
      ],
    },
    {
      heading: 'The invariant',
      paragraphs: [
        `The invariant is that the expensive repeated computation is tied to M, not directly to N. The model may still read all input positions, but it does not repeatedly run full self-attention over them. If M is chosen well, the internal state remains small enough for deep processing while still carrying the evidence the task needs.`,
        `The second invariant is that the output interface is explicit. Output queries are not an afterthought; they are a schema. One query can ask for a class, a grid of queries can ask for pixel values or flow vectors, and a sequence of queries can ask for samples or future tokens. The decoder cost is tied to Q times M.`,
      ],
    },
    {
      heading: 'How the visual model teaches it',
      paragraphs: [
        `The latent-array view shows the main cost move. Inputs feed an adapter, the cross-attention block writes into learned latent slots, and the later transformer blocks refine those slots rather than revisiting every raw input position at full quadratic cost. The graph is meant to make the latent array feel like a bounded data structure, not just a model component.`,
        `The cost plot separates three quantities that are easy to blur together. Dense attention grows like N squared. The input read grows like N times M. The latent loop stays tied to M. The output-query view then adds the Q times M decode budget, so dense outputs are visible as their own cost rather than being confused with input encoding.`,
      ],
    },
    {
      heading: 'Mechanism',
      paragraphs: [
        `The first stage is an adapter. It turns raw modality data into embeddings and position information. For images, that may be pixel or patch features plus coordinates. For audio, it may be time-window features. For point clouds, it may include coordinates and per-point attributes. The adapter must preserve enough structure for attention to make sense.`,
        `The second stage is cross-attention from latents to inputs. The latent slots are queries, and the input embeddings are keys and values. Each latent slot learns what to read from the input buffer. This is the compression step, but it is learned and content-dependent rather than a fixed pooling rule.`,
        `The third stage is latent processing. Several transformer blocks run over the M latent slots. Perceiver IO then uses output queries as a decoder. Those queries attend to the latent memory and produce the requested structure. Autoregressive variants add masks so a prediction cannot read future positions.`,
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        `Perceiver IO works when the task does not need every layer to maintain a separate state for every raw input position. The cross-attention read builds a task-useful summary in the latent array, and the model spends its depth improving that summary. This is a good fit when global evidence matters more than preserving all local detail at every layer.`,
        `The correctness story is not a formal proof like a sorting algorithm. It is an interface argument. If the adapter encodes the input, the latent array has enough capacity, and the output queries ask the right questions, then the architecture can represent functions from arbitrary input shapes to arbitrary output shapes while keeping the repeated attention work bounded by M.`,
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        `Consider a model that sees a short video clip plus audio and predicts both a class label and a dense per-frame map. The input adapter emits video patch embeddings and audio-window embeddings, so N may be large. A plain transformer would mix all of those positions in every layer. A Perceiver-style model reads them into a few hundred latent slots, then runs most depth over those slots.`,
        `For the class label, Q can be one learned query. For the dense map, Q can be one query per output coordinate. The same latent memory supports both outputs, but the decode cost changes with the number of queries. This example shows why Perceiver IO is an input-output architecture, not only an encoder trick.`,
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        `The pattern is useful for large and awkward inputs: high-resolution perception, long audio, video, point clouds, multimodal records, byte streams, and settings where input length changes widely from example to example. It gives the engineer a direct knob, M, for internal capacity and cost.`,
        `It also wins when one encoded memory must serve several output formats. A model can classify, reconstruct, localize, or predict sequences through different query schemas. That makes the interface clean for multitask learning because the encoder does not have to be redesigned every time the output shape changes.`,
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        `The bottleneck can throw information away. If a small object, rare sound, or fine spatial boundary never gets copied into the latent memory, the decoder cannot recover it later. Increasing M helps, but it also raises the cost of the latent loop and can reduce the original advantage.`,
        `Dense outputs are still expensive. A segmentation, optical-flow, or audio reconstruction task can need many output queries, and each query attends to the latent memory. Perceiver IO separates input cost from output cost; it does not make either one vanish.`,
        `Mask and schema bugs are serious. In autoregressive use, future-visible attention creates leakage. In dense prediction, output-query order and coordinates must match the loss. In serving, a schema mismatch between training and deployment can produce silently wrong outputs.`,
      ],
    },
    {
      heading: 'Implementation guidance',
      paragraphs: [
        `Choose M as a capacity budget, not as a magic constant. Start from a value that fits latency and memory limits, then measure accuracy loss as M shrinks and cost growth as M expands. Log N, M, Q, latent depth, cross-attention frequency, activation memory, and p99 latency together.`,
        `Treat adapters as part of the model contract. Normalize each modality, preserve positions, keep coordinate systems stable, and test that padding and masks do not change real examples. A weak adapter can make the latent bottleneck look bad even when the attention design is sound.`,
        `Version output-query schemas. A query can represent a class slot, a grid coordinate, an audio frame, or an action slot. Training code, evaluation code, and serving code must agree on that meaning. If the query layout changes, the model artifact and downstream consumers need to know.`,
      ],
    },
    {
      heading: 'What to study next',
      paragraphs: [
        `Study the original Perceiver paper at https://arxiv.org/abs/2103.03206, Perceiver IO at https://arxiv.org/abs/2107.14795, the OpenReview page at https://openreview.net/forum?id=fILj7WpI-g, Perceiver AR at https://arxiv.org/abs/2202.07765, Set Transformer at https://arxiv.org/abs/1810.00825, and the DeepMind research code at https://github.com/google-deepmind/deepmind-research/blob/master/perceiver/perceiver.py.`,
        `Inside this curriculum, study Attention, Transformer Block, Set Transformer Induced Points, Vision Transformer Register Tokens, AdaTape Adaptive Token Bank, Adaptive Computation Time Halting, Byte Latent Transformer, Tokenization BPE, RAG Pipeline, KV Cache, and Transformer Inference Roofline.`,
      ],
    },
  ],
};
