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
    explanation: 'RWKV stands for the ingredients that replace explicit all-pairs attention: a receptance gate, a trainable time-decay weight, keys, and values.',
  };

  yield {
    state: rwkvGraph('A time-mix block turns past tokens into recurrent state'),
    highlight: { active: ['r', 'w', 'k', 'v'], found: ['state', 'out'] },
    explanation: 'The time-mix block combines current and previous token information, builds R/K/V signals, applies time decay, updates a compact state, and gates what reaches the output.',
    invariant: 'At inference, the block carries state forward instead of storing an attention matrix.',
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
    explanation: 'Different channels can learn different decay behavior. Some forget quickly; others preserve longer traces. This is the recurrent memory policy that competes with direct attention.',
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
    explanation: 'RWKV is not an old vanilla RNN. It keeps Transformer-era residual blocks and feature mixing while changing how time is handled.',
  };
}

function* trainingVsInference() {
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
    explanation: 'The paper frames RWKV as reconciling a classic tradeoff: train in a parallel form like Transformers, then run inference in an RNN form with compact state.',
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
    explanation: 'At decode time, a Transformer KV cache grows with context length. RWKV can carry a fixed-size recurrent state, which makes long streaming contexts attractive if quality holds.',
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
    explanation: 'The model is easiest to reason about as a pair of equivalent execution views: a parallel view for training throughput and a recurrent view for serving.',
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
    explanation: 'RWKV is part of the broader search for sequence models that keep Transformer quality while reducing long-context memory and compute pressure.',
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
      heading: 'Why RWKV Exists',
      paragraphs: [
        `RWKV is a language-model architecture built around a practical tension in sequence modeling. Transformers are strong because every token can directly compare itself with every previous token through attention, and because the whole sequence can be processed in parallel during training. That design is expensive at serving time. A decoder-only Transformer stores a key and value vector for every prior token at every layer, then reads that growing KV cache on each new token. Long context, many users, and large models turn memory bandwidth and cache capacity into first-order limits.`,
        {type: 'callout', text: 'RWKV replaces exact token lookup with learned recurrent state so decoding memory is tied to model size rather than prompt length.'},
        `Classical recurrent neural networks have the opposite shape. They carry a fixed-size state from token to token, so serving memory does not grow with context length in the same way. The cost is that old information has to survive inside a compressed state, and old RNNs were hard to train at scale and usually lost to Transformer quality. RWKV tries to keep the attractive parts of both families: Transformer-like residual blocks and parallel training, plus RNN-like recurrent inference with compact state.`,
        `The name is a mnemonic for the ingredients that replace explicit all-pairs attention: Receptance, Weight decay, Key, and Value. It is not just a relabeled RNN. It is an attempt to make a recurrent memory rule act like an attention alternative: write evidence into state, decay older evidence through learned channels, and gate what the current token reads out.`,
      ],
    },
    {
      heading: 'The Naive Wall',
      paragraphs: [
        `A naive way to improve Transformer serving is to keep the exact architecture and optimize the cache harder. That leads to FlashAttention, PagedAttention, prefix caching, quantized KV cache, offload tiers, and scheduling tricks. Those systems are valuable, but the cache still represents token-level history. If the request grows from 4K tokens to 128K tokens, the server must still represent much more past state or decide what to evict.`,
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1b/Transformer%2C_attention_block_diagram.png/250px-Transformer%2C_attention_block_diagram.png', alt: 'Scaled dot-product attention computation block with query key value mask softmax and output', caption: 'The Transformer baseline keeps explicit query-key-value comparisons; RWKV asks which parts of that behavior can be carried in recurrent state. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Transformer,_attention_block_diagram.png.'},
        `The opposite naive answer is to return to a vanilla RNN. That removes the KV cache wall, but it creates an expressiveness and optimization wall. A single recurrent vector has to carry everything. Gradients must cross many steps. Parallel accelerators are underused if training is strictly sequential. Modern language models are too large and data-hungry for that old execution style to be enough by itself.`,
        `RWKV's wall is therefore not only asymptotic complexity. It is the question of what kind of memory a model can learn. Exact attention gives the current token a direct lookup table over history. RWKV gives it a learned summary whose channels decay at different rates. The architecture is useful only if that summary preserves the information language modeling needs often enough to pay for the serving savings.`,
      ],
    },
    {
      heading: 'Core Insight',
      paragraphs: [
        `The central insight is that some attention-like behavior can be expressed as a recurrence. Instead of materializing a square attention matrix, RWKV updates running numerator and denominator-like state with decayed contributions from past keys and values. Recent tokens can dominate some channels, while other channels decay slowly and preserve longer traces. The learned time decay is the model's memory policy.`,
        `Receptance is the read gate. Keys and values write evidence. Weight decay controls how old evidence fades. The current token does not ask every previous token a fresh question; it receives a gated mixture from the recurrent state. This makes the memory model closer to a bank of learned exponential traces than to a table of exact token records.`,
        `The second insight is execution duality. The same block can be trained in a parallel sequence form, using scan-like computation over positions, and served in a recurrent form, updating state one token at a time. That distinction matters because training throughput and inference latency stress different parts of the machine. RWKV is designed so training can still fill accelerators while decoding avoids an ever-growing cache.`,
      ],
    },
    {
      heading: 'Mechanism',
      paragraphs: [
        `A useful mental model is to split the block into time mixing and channel mixing. Time mixing is the sequence-memory component. It combines the current token representation with a shifted copy from the previous token, produces R, K, and V signals, applies learned decay, updates recurrent state, and gates the result. Channel mixing is closer to a Transformer feed-forward sublayer: it mixes features within a token after the time component has supplied context.`,
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/4/46/Colored_neural_network.svg', alt: 'Layered neural network diagram with colored nodes', caption: 'RWKV keeps the modern deep-network stack shape, but changes how temporal information moves between tokens. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Colored_neural_network.svg.'},
        `The token shift is small but important. It lets the block form features from both the present token and immediate past without asking attention to discover that local dependency from scratch. The decay channels then decide how much older information still matters. Fast-decay channels behave like short-term memory. Slow-decay channels behave like long traces. A stack of layers gives the model many such policies at different feature levels.`,
        `At inference, each layer carries state forward. The server feeds token t, updates the layer states, emits logits, samples or selects token t plus 1, and repeats. The memory footprint is tied to layers and hidden size, not to the full number of previous tokens in the same direct way as Transformer KV cache. At training time, equivalent recurrence formulas allow the sequence to be processed in parallel enough for GPUs to be useful.`,
      ],
    },
    {
      heading: 'What The Visual Proves',
      paragraphs: [
        `The recipe table separates the four letters into jobs rather than treating the name as branding. R is the gate that decides what reaches the output. K and V are the evidence being written. W is the learned time-decay behavior that shapes memory. The block graph then shows the important invariant: the output is produced from the current token plus state, not from a freshly constructed all-pairs attention matrix.`,
        `The decay plot explains why one recurrent state is not necessarily one crude memory. Different channels can learn different forgetting speeds. A channel with steep decay handles local syntax or recency-sensitive information. A slower channel can preserve broader topic or entity traces. The point is not that exponential traces solve every long-range task; the point is that memory duration becomes a learned per-channel resource.`,
        `The training-versus-inference view proves the architectural bargain. During training, RWKV wants the parallelism that made Transformers practical. During serving, it wants constant-state token updates. The memory plot contrasts that with a Transformer KV cache whose decode memory grows with context length. The visual is therefore not a speed benchmark. It is a structural claim about what must be carried forward.`,
      ],
    },
    {
      heading: 'Why It Can Work',
      paragraphs: [
        `RWKV can work because many language-model dependencies do not require exact random access to every token. Recency, topic continuity, style, local syntax, and gradual discourse state can often be represented by learned summaries. Attention is a very general mechanism, but generality is not free. If a compact recurrent state preserves enough task-relevant information, the server can avoid paying for exact token memory on every decode step.`,
        `It also fits hardware incentives. Decode is often memory-bandwidth limited because each new token performs a small amount of compute while reading substantial cached state. Reducing the live memory that must be read per step can improve batch capacity and latency. On the other hand, the benefit only materializes with efficient kernels and numerically stable recurrence. A theoretically lighter architecture can lose in practice if its implementation is less mature than highly optimized attention kernels.`,
      ],
    },
    {
      heading: 'Costs And Tradeoffs',
      paragraphs: [
        `The main cost is compressed history. A Transformer can attend directly to a token from 20,000 positions ago if it remains in the context window. RWKV must have stored the relevant fact in state and kept it alive through decay and transformations. That can fail on exact copying, needle-in-a-haystack retrieval, long code dependencies, or tasks where the answer depends on a small detail that looked unimportant when first read.`,
        `The second cost is ecosystem maturity. Transformer tooling has years of optimization behind it: FlashAttention, tensor parallelism, KV-cache managers, quantization paths, speculative decoding, and deployment stacks. RWKV needs its own kernels, training recipes, scaling laws, evaluation practice, and serving integration. It should be compared on quality, latency, throughput, memory, and operational simplicity, not on the slogan that it has constant state.`,
        `There is also a modeling tradeoff. Learned decay is powerful but biased. It encourages information to be represented through smooth memory traces. That bias can be helpful for streaming and harmful for precise archival recall. This is the same family of tradeoff explored by RetNet, Mamba, linear attention, and hybrid attention-state models.`,
      ],
    },
    {
      heading: 'Uses And Failure Modes',
      paragraphs: [
        `RWKV is most attractive for streaming language modeling, edge inference, memory-constrained serving, long-running agents, and research systems that want an alternative to quadratic attention without abandoning large-scale training. A device that cannot afford a growing KV cache may still afford fixed recurrent state. A server that handles many concurrent streams may care more about predictable per-request memory than about exact attention over every old token.`,
        `Failure modes should be tested directly. If a workload requires exact retrieval from long prompts, compare against a Transformer with the same context and a strong KV-cache implementation. If the workload is chat or streaming continuation, measure quality over long sessions, not only short perplexity. If the selling point is serving, benchmark real decode loops with batching, kernel overhead, and memory pressure included. RWKV is a design point in the sequence-model space, not a universal replacement for attention.`,
      ],
    },
    {
      heading: 'Study Next',
      paragraphs: [
        `Study Attention Mechanism first to understand the exact lookup RWKV avoids. Then read KV Cache, Transformer Inference Roofline, LLM Serving: PagedAttention, RetNet Retention State Case Study, Selective State Space Models: Mamba, Linear Attention, Transformer Block, and Gradient Flow. The useful comparison question is always the same: what information is stored exactly, what is compressed into state, how does the hardware execute the update, and what tasks break the approximation?`,
      ],
    },
  ],
};
