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
  const components = ['R', 'K', 'V', 'W'];
  const componentCount = components.length;
  const graphNodeCount = 8;
  const graphEdgeCount = 9;
  const decayChannels = 2;
  const decaySteps = 6;

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
    explanation: `RWKV stands for the ${componentCount} ingredients that replace explicit all-pairs attention: ${components.join(', ')} — a receptance gate, a trainable time-decay weight, keys, and values.`,
  };

  yield {
    state: rwkvGraph('A time-mix block turns past tokens into recurrent state'),
    highlight: { active: ['r', 'w', 'k', 'v'], found: ['state', 'out'] },
    explanation: `The time-mix block combines current and previous token information, builds ${components.slice(0, 3).join('/')} signals across ${graphNodeCount} nodes and ${graphEdgeCount} edges, applies time decay, updates a compact state, and gates what reaches the output.`,
    invariant: `At inference, the block carries state forward through ${graphNodeCount} processing stages instead of storing an attention matrix.`,
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
    explanation: `Different channels can learn different decay behavior — ${decayChannels} channels shown across ${decaySteps} time steps. Some forget quickly; others preserve longer traces. This is the recurrent memory policy that competes with direct attention.`,
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
    explanation: `RWKV is not an old vanilla RNN. It keeps Transformer-era residual blocks and feature mixing — time-mix and channel-mix split the ${componentCount} signal roles — while changing how time is handled.`,
  };
}

function* trainingVsInference() {
  const executionModes = ['training', 'inference'];
  const maxSeqLen = 4096;
  const fixedStateMemory = 8;
  const comparisonArchitectures = ['Attention', 'Mamba / SSM', 'KV Cache', 'RWKV'];
  const dualGraphNodes = 5;

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
    explanation: `The paper frames RWKV as reconciling a classic tradeoff across ${executionModes.length} modes: train in a parallel form like Transformers (${executionModes[0]}), then run in an RNN form with compact state (${executionModes[1]}).`,
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
    explanation: `At decode time, a Transformer KV cache grows with context length (up to ${maxSeqLen} tokens shown). RWKV carries a fixed-size recurrent state (~${fixedStateMemory}% relative memory), which makes long streaming contexts attractive if quality holds.`,
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
    explanation: `The model is easiest to reason about as a pair of equivalent execution views across ${dualGraphNodes} stages: a parallel view for ${executionModes[0]} throughput and a recurrent view for serving.`,
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
    explanation: `RWKV is part of the broader search for sequence models — compared here alongside ${comparisonArchitectures.length} architectures (${comparisonArchitectures.join(', ')}) — that keep Transformer quality while reducing long-context memory and compute pressure.`,
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
      heading: 'How to read the animation',
      paragraphs: [
        'The time-mix view shows one RWKV block. R means receptance, which is the gate; K means key, V means value, and W means learned time decay. Active nodes are the signals used for the current token, while found marks the compact state and output.',
        {type: 'image', src: './assets/gifs/rwkv-recurrent-transformer.gif', alt: 'Animated walkthrough of the rwkv recurrent transformer visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
        'The training-versus-inference view compares two executions of the same model. During training the sequence can be processed in a parallel form, and during decoding the model updates a recurrent state one token at a time. The safe inference rule is that serving memory is tied to layer state, not to storing an explicit key-value record for every past token.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Transformers train well because every token can compare with every other token through attention. At decoding time, that exact lookup requires a key-value cache that grows with context length and layer count. Long prompts and many simultaneous users make memory bandwidth a hard serving limit.',
        {type: 'callout', text: 'RWKV replaces exact token lookup with learned recurrent state so decoding memory is tied to model size rather than prompt length.'},
        'RWKV exists to test a different bargain. It keeps modern residual blocks and large-scale training habits, but it replaces all-pairs token lookup with a learned recurrent memory update. The goal is Transformer-like language quality with RNN-like streaming state.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is to keep the Transformer and optimize the cache. Systems can use FlashAttention, paged KV caches, prefix sharing, quantization, and offload. These techniques are useful, but they still preserve explicit token history.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1b/Transformer%2C_attention_block_diagram.png/250px-Transformer%2C_attention_block_diagram.png', alt: 'Scaled dot-product attention computation block with query key value mask softmax and output', caption: 'The Transformer baseline keeps explicit query-key-value comparisons; RWKV asks which parts of that behavior can be carried in recurrent state. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Transformer,_attention_block_diagram.png.'},
        'The other obvious approach is to return to a plain recurrent neural network, which carries one state through time. That removes the growing cache but usually loses the training parallelism and quality that made Transformers dominant. RWKV tries to avoid both walls at once.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'Exact attention makes long-context serving expensive because the live state grows with tokens. A 32-layer model that stores keys and values for 128,000 tokens carries much more memory than the same model decoding a short prompt. The server must read, manage, and schedule that cache on every new token.',
        'Plain recurrence compresses history too aggressively. If a fact from token 2 must be copied exactly at token 10,000, the recurrent state must have preserved it through every update. The wall is deciding what can be summarized and what needs exact access.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'RWKV treats sequence memory as learned decayed state. Keys and values write evidence, W controls how older evidence fades, and receptance gates what reaches the output. Different channels can learn different decay rates, so memory is not one crude scalar trace.',
        'The second insight is execution duality. A recurrence can be expressed in a parallel scan-like form for training and as a one-token update for inference. That separation lets the same weights serve two hardware needs: throughput while learning and compact state while decoding.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A time-mix block combines the current token with a shifted version of the previous token. Linear projections produce R, K, and V signals, while learned decay parameters decide how old state contributes. The block then gates the state-derived value before passing it into the residual stream.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/4/46/Colored_neural_network.svg', alt: 'Layered neural network diagram with colored nodes', caption: 'RWKV keeps the modern deep-network stack shape, but changes how temporal information moves between tokens. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Colored_neural_network.svg.'},
        'A channel-mix block then mixes features inside the token representation, similar in role to a Transformer feed-forward layer. Stacking many layers gives the model many memory traces and feature transformations. During inference each layer updates its own recurrent state and emits the next representation.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The correctness argument is an equivalence of execution forms. If the parallel training formula and recurrent decoding formula compute the same state transition, then serving one token at a time produces the same block outputs as scanning the sequence in order. The invariant is that the state after token t summarizes exactly what the recurrence says should be carried from tokens 1 through t.',
        'The modeling argument is weaker and must be tested. RWKV works when language dependencies can be carried by learned summaries: recent syntax, topic state, style, and gradually updated entity information. It fails when the task needs exact random access to a buried token that the state did not keep.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Transformer attention over a full sequence has O(n^2) training attention work per layer and a decode cache that grows O(n) with context length. RWKV decoding uses O(1) recurrent state per layer with respect to sequence length, so doubling context length does not double stored token records. It still performs O(d) or O(d^2) layer computation depending on hidden-size operations.',
        'The cost moves into compressed memory and specialized kernels. A smaller live state can improve serving capacity, but quality may drop on exact retrieval tasks. If kernels are immature, a theoretically lighter recurrence can run slower than highly optimized attention in practice.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'RWKV is useful for streaming generation, edge inference, always-on agents, and serving environments where per-request memory is the bottleneck. A server handling many long conversations may care more about predictable state size than about exact attention over every prior token.',
        'It is also useful as a research comparison point for RetNet, Mamba, linear attention, and hybrid attention-state models. All of these architectures ask which parts of context need exact lookup and which parts can live in state.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'RWKV can fail on needle-in-a-haystack retrieval, exact copying, long code dependencies, and tasks where a small old detail becomes important much later. A Transformer with a retained KV cache can still attend to the old token directly if it is inside the window. RWKV must have compressed that detail into state.',
        'It also faces tooling risk. Transformer serving stacks have mature kernels, quantization paths, schedulers, and monitoring. RWKV needs equally careful evaluation on quality, latency, memory, batching, and operational simplicity before it replaces attention in a production workload.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Assume a Transformer layer stores key and value vectors of 4096 floats each for every token. In float16, that is 4096 * 2 bytes * 2 = 16 KB per token per layer. For 32 layers and 4,096 tokens, the cache is about 16 KB * 32 * 4,096 = 2 GB for one sequence.',
        'Now compare a recurrent state that stores two 4096-float vectors per layer. That is 16 KB per layer, or about 512 KB for 32 layers, independent of whether the stream has 4,096 or 128,000 tokens. The numbers are simplified, but they show the behavior: cache memory grows with context, recurrent state grows with model shape.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary source: the RWKV papers and implementation notes by Peng et al. Study Attention Mechanism and KV Cache first, then compare RetNet, Mamba, linear attention, and Transformer inference roofline analysis.',
        'The useful study path is to separate model math from serving behavior. Ask what state is stored, how it changes per token, what hardware reads during decode, and what long-context tasks break the compression.',
      ],
    },
  ],
};