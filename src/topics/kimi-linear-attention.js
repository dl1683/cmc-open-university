// Kimi Linear: a hybrid attention architecture combining Kimi Delta Attention
// recurrence with periodic Multi-Head Latent Attention blocks.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'kimi-linear-attention',
  title: 'Kimi Linear Attention',
  category: 'AI & ML',
  summary: 'Kimi Linear teaches modern linear attention as a hybrid system: KDA recurrent state for most layers plus MLA blocks for global recall.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['KDA finite state', 'long-context efficiency'], defaultValue: 'KDA finite state' },
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
  return matrixState({ title, rows, columns, values: labelsByRow.map((row) => row.map(code)), format: (value) => labels[value] });
}

function* kdaFiniteState() {
  const kdaStages = 6;  // x, gate, delta, state, read, y
  const memoryModels = 4;  // full, linear, kda, hybrid
  const kdaBlocksPerCycle = 3;  // 3 KDA blocks before 1 MLA
  const hybridRatio = '3:1';

  yield {
    state: graphState({
      nodes: [
        { id: 'x', label: 'x_t', x: 0.9, y: 2.8, note: 'input' },
        { id: 'gate', label: 'gate', x: 2.6, y: 2.8, note: 'select' },
        { id: 'delta', label: 'delta', x: 4.3, y: 2.8, note: 'write' },
        { id: 'state', label: 'state', x: 6.0, y: 2.8, note: 'memory' },
        { id: 'read', label: 'read', x: 7.6, y: 2.8, note: 'linear' },
        { id: 'y', label: 'y_t', x: 9.1, y: 2.8, note: 'next' },
      ],
      edges: [
        { id: 'e-x-gate', from: 'x', to: 'gate', weight: '' },
        { id: 'e-gate-delta', from: 'gate', to: 'delta', weight: '' },
        { id: 'e-delta-state', from: 'delta', to: 'state', weight: '' },
        { id: 'e-state-read', from: 'state', to: 'read', weight: '' },
        { id: 'e-read-y', from: 'read', to: 'y', weight: '' },
      ],
    }, { title: 'KDA uses a learned finite-state memory' }),
    highlight: { active: ['gate', 'delta', 'state'], found: ['read'] },
    explanation: `Kimi Delta Attention treats memory like a recurrent finite state with ${kdaStages} stages. Fine-grained gates decide what to write and keep, so each token can update the state without reading every previous token.`,
  };

  yield {
    state: labelMatrix(
      'Attention memory model',
      [
        { id: 'full', label: 'full attention' },
        { id: 'linear', label: 'linear attn' },
        { id: 'kda', label: 'KDA' },
        { id: 'hybrid', label: 'Kimi hybrid' },
      ],
      [
        { id: 'memory', label: 'memory' },
        { id: 'strength', label: 'strength' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['all tokens', 'exact recall', 'large KV'],
        ['state', 'cheap decode', 'capacity'],
        ['gated state', 'selective', 'tuning'],
        ['KDA+MLA', 'balance', 'complex'],
      ],
    ),
    highlight: { active: ['kda:memory', 'hybrid:strength'], compare: ['full:memory'] },
    explanation: `KDA improves the finite-state side of linear attention across ${memoryModels} memory models, while the full Kimi Linear architecture keeps periodic global attention through MLA blocks.`,
    invariant: `Long-context models choose what form memory should take — this matrix compares ${memoryModels} approaches.`,
  };

  yield {
    state: graphState({
      nodes: [
        { id: 'b1', label: 'KDA block', x: 1.0, y: 3.8, note: 'local state' },
        { id: 'b2', label: 'KDA block', x: 2.9, y: 3.8, note: 'local state' },
        { id: 'b3', label: 'KDA block', x: 4.8, y: 3.8, note: 'local state' },
        { id: 'mla', label: 'MLA block', x: 6.9, y: 3.8, note: 'global' },
        { id: 'next', label: 'repeat', x: 8.6, y: 3.8, note: '3:1' },
      ],
      edges: [
        { id: 'e-b1-b2', from: 'b1', to: 'b2', weight: '' },
        { id: 'e-b2-b3', from: 'b2', to: 'b3', weight: '' },
        { id: 'e-b3-mla', from: 'b3', to: 'mla', weight: '' },
        { id: 'e-mla-next', from: 'mla', to: 'next', weight: '' },
      ],
    }, { title: 'Reported Kimi Linear layer rhythm' }),
    highlight: { active: ['b1', 'b2', 'b3'], found: ['mla'] },
    explanation: `The public Kimi Linear materials describe a ${hybridRatio} hybrid rhythm: ${kdaBlocksPerCycle} KDA blocks for efficient recurrent processing, then 1 MLA block for global attention capacity.`,
  };

  yield {
    state: plotState({
      axes: { x: { label: 'context length', min: 0, max: 1000000 }, y: { label: 'state bytes per token', min: 0, max: 1.0 } },
      series: [
        { id: 'full', label: 'full attention KV', points: [{ x: 0, y: 0.04 }, { x: 250000, y: 0.28 }, { x: 500000, y: 0.52 }, { x: 750000, y: 0.76 }, { x: 1000000, y: 1.00 }] },
        { id: 'kimi', label: 'Kimi-style hybrid', points: [{ x: 0, y: 0.04 }, { x: 250000, y: 0.10 }, { x: 500000, y: 0.17 }, { x: 750000, y: 0.23 }, { x: 1000000, y: 0.30 }] },
      ],
    }),
    highlight: { active: ['kimi'], compare: ['full'] },
    explanation: `The shape is the main idea: finite-state layers make decode memory grow much more slowly, while occasional MLA layers (every ${kdaBlocksPerCycle + 1}th layer in a ${hybridRatio} rhythm) retain stronger global access than pure recurrence.`,
  };
}

function* longContextEfficiency() {
  const cacheReduction = 75;  // percent
  const speedup = 6;  // x factor
  const checklistItems = 4;

  yield {
    state: labelMatrix(
      'Kimi Linear reported case',
      [
        { id: 'params', label: 'params' },
        { id: 'train', label: 'training' },
        { id: 'cache', label: 'KV cache' },
        { id: 'speed', label: 'decode' },
      ],
      [
        { id: 'reported', label: 'reported' },
        { id: 'lesson', label: 'lesson' },
      ],
      [
        ['48B / 3B', 'MoE scale'],
        ['fair recipe', 'compare cleanly'],
        ['up to -75%', 'state matters'],
        ['up to 6x', 'long context'],
      ],
    ),
    highlight: { found: ['cache:reported', 'speed:reported'], compare: ['train:lesson'] },
    explanation: `Kimi Linear reports a 48B-total, 3B-activated model with up to ${cacheReduction}% KV cache reduction and ${speedup}x decode speedup, framed as a fair comparison against full attention and MLA baselines.`,
  };

  yield {
    state: graphState({
      nodes: [
        { id: 'agent', label: 'agent task', x: 0.8, y: 3.8, note: 'long I/O' },
        { id: 'state', label: 'KDA state', x: 2.8, y: 2.7, note: 'cheap' },
        { id: 'global', label: 'MLA global', x: 2.8, y: 4.9, note: 'recall' },
        { id: 'decode', label: 'decode loop', x: 5.0, y: 3.8, note: 'many tokens' },
        { id: 'cost', label: 'cost/token', x: 7.1, y: 2.7, note: 'lower' },
        { id: 'quality', label: 'quality', x: 7.1, y: 4.9, note: 'must hold' },
      ],
      edges: [
        { id: 'e-agent-state', from: 'agent', to: 'state', weight: '' },
        { id: 'e-agent-global', from: 'agent', to: 'global', weight: '' },
        { id: 'e-state-decode', from: 'state', to: 'decode', weight: '' },
        { id: 'e-global-decode', from: 'global', to: 'decode', weight: '' },
        { id: 'e-decode-cost', from: 'decode', to: 'cost', weight: '' },
        { id: 'e-decode-quality', from: 'decode', to: 'quality', weight: '' },
      ],
    }, { title: 'Why hybrid attention targets agentic workloads' }),
    highlight: { active: ['state', 'global', 'decode'], found: ['cost', 'quality'] },
    explanation: `Agentic workloads stress both sides: long context and long outputs. Kimi Linear targets up to ${speedup}x decode speedup — a case study in reducing decode cost without giving up too much global recall.`,
  };

  yield {
    state: plotState({
      axes: { x: { label: 'output tokens at 1M context', min: 0, max: 10000 }, y: { label: 'relative time per output token', min: 0, max: 1.0 } },
      series: [
        { id: 'mla', label: 'MLA baseline', points: [{ x: 0, y: 0.95 }, { x: 2500, y: 0.96 }, { x: 5000, y: 0.97 }, { x: 7500, y: 0.98 }, { x: 10000, y: 1.00 }] },
        { id: 'kimi', label: 'Kimi Linear', points: [{ x: 0, y: 0.30 }, { x: 2500, y: 0.25 }, { x: 5000, y: 0.21 }, { x: 7500, y: 0.18 }, { x: 10000, y: 0.16 }] },
      ],
    }),
    highlight: { active: ['kimi'], compare: ['mla'] },
    explanation: `The chart encodes the reported direction: at very long context, Kimi Linear claims up to ${speedup}x lower time per output token than an MLA-heavy baseline.`,
  };

  yield {
    state: labelMatrix(
      'Evaluation checklist',
      [
        { id: 'short', label: 'short tasks' },
        { id: 'long', label: 'long tasks' },
        { id: 'rl', label: 'RL scaling' },
        { id: 'serving', label: 'serving' },
      ],
      [
        { id: 'question', label: 'question' },
        { id: 'failure', label: 'failure' },
      ],
      [
        ['quality same?', 'lost recall'],
        ['1M stable?', 'state limits'],
        ['rollouts fast?', 'bias shift'],
        ['kernel ready?', 'paper-only'],
      ],
    ),
    highlight: { found: ['short:question', 'long:question', 'serving:question'] },
    explanation: `The responsible teaching point is benchmark discipline: all ${checklistItems} checklist areas must pass. Linear attention must win quality, cost, and implementation readiness, not only asymptotic notation.`,
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'KDA finite state') yield* kdaFiniteState();
  else if (view === 'long-context efficiency') yield* longContextEfficiency();
  else throw new InputError('Pick a Kimi Linear Attention view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'Read KDA as a recurrent memory path and MLA as a periodic global-attention path. Active KDA nodes are the gate, delta write, and state update; the found read node is the output computed without scanning every previous token.',
        { type: 'callout', text: 'Kimi Linear is a memory-allocation design: cheap recurrent state handles most layers, while periodic global attention preserves long-range recall.' },
        'The safe inference rule is about memory form. A KDA layer compresses history into a fixed state, while an MLA layer keeps explicit global access through a compressed key-value cache.',
        {type: 'image', src: './assets/gifs/kimi-linear-attention.gif', alt: 'Animated walkthrough of the kimi linear attention visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Full transformer attention stores key and value vectors for every previous token in every attention layer. That key-value cache is accurate memory, but long-context decoding becomes dominated by memory bandwidth.',
        { type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/8/8f/The-Transformer-model-architecture.png', alt: 'Transformer model architecture with encoder and decoder attention blocks', caption: 'The standard Transformer uses attention blocks throughout the stack; Kimi Linear changes the memory form in most layers. Source: https://commons.wikimedia.org/wiki/File:The-Transformer-model-architecture.png.' },
        'Kimi Linear exists because agent and document workloads need both long inputs and long outputs. Pure full attention is expensive at that length, while pure recurrence risks forgetting exact distant facts.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is to keep softmax attention everywhere. Each new token compares its query with all previous keys, reads the matching values, and preserves exact token-level recall.',
        'A cheaper obvious approach is a sliding window or pure linear attention. Sliding windows discard older tokens, while pure finite-state recurrence compresses all history into a fixed-size state.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The first wall is cache growth. If context length doubles, a full-attention layer reads about twice as many key-value entries for every generated token.',
        'The second wall is finite-state capacity. A fixed recurrent state can be cheap per token, but independent facts must share the same limited slots and can overwrite one another.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Use different memory forms in different layers. Most layers use Kimi Delta Attention, or KDA, a gated recurrent state update; periodic layers use Multi-Head Latent Attention, or MLA, to preserve broader global recall.',
        'The reported Kimi Linear design uses a hybrid rhythm with several KDA layers for each MLA layer. The architecture is therefore not linear attention replacing attention everywhere; it is a budgeted mixture.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'KDA updates a state from the current token. The token produces gates, keys, values, and queries; the gates decide what to decay and what new outer-product information to write into the state.',
        'The read operation multiplies the state by the query, so decode avoids scanning all previous tokens in KDA layers. MLA layers still perform global attention, but they compress keys and values into a latent representation to reduce cache size.',
        'The paper reports a 48B-total, 3B-activated mixture-of-experts model using KDA plus MLA. It reports up to 75 percent key-value cache reduction and up to 6 times decoding throughput at very long context under its comparison setup.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The correctness claim is empirical rather than mathematical. If most layer computations only need a compressed running state, KDA can preserve enough information while saving cache reads.',
        'The MLA layers cover the cases where compression is too lossy. They periodically reintroduce global token access, so exact distant evidence does not have to survive only through a finite recurrent state.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Full attention decode cost grows with context length because each generated token reads more cached keys and values. KDA decode cost is closer to fixed per token because it updates and reads a state whose size does not grow with n.',
        'The hybrid cost depends on the layer ratio. If three out of four layers are KDA and one is MLA, doubling context length mostly affects the MLA quarter while KDA layers keep the same state size.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'The target use case is long-context generation: coding agents, legal review, research synthesis, and long conversations. These workloads combine large input context with many generated output tokens, which makes decode cache cost visible.',
        'It also matters for reinforcement-learning rollouts and batch serving. If each rollout or user request produces thousands of tokens, a lower per-token decode cost compounds across the serving fleet.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Kimi Linear can fail when exact recall dominates the task. A fixed KDA state can overwrite rare facts, and the periodic MLA layers may not recover every needed dependency.',
        'It can also lose on short contexts or immature kernels. A full-attention implementation with FlashAttention-style kernels may be faster and simpler when cache size is not the bottleneck.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Suppose a model has 32 attention-like layers and a 1,000,000-token context. A full-attention design keeps cache for all 32 layers, so every generated token must interact with 32 layers worth of long-context memory.',
        'Now use a 3:1 hybrid: 24 KDA layers and 8 MLA layers. The KDA layers keep fixed recurrent states, so the long context mainly affects the 8 MLA layers instead of all 32.',
        'If a full layer would read 1.0 unit of long-context cache, full attention reads 32 units per token. The hybrid reads about 8 MLA units plus fixed KDA work, so the context-dependent cache traffic is roughly one quarter as large before implementation constants.',
        'The tradeoff is information capacity. The 24 KDA layers must compress history, so a fact at token 200,000 may survive if gates preserve it or an MLA layer attends to it, but there is no guarantee that every detail remains available.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary source: Kimi Linear: An Expressive, Efficient Attention Architecture, arXiv:2510.26692, https://arxiv.org/abs/2510.26692. Treat its speed and cache numbers as reported results unless you have independent benchmarks for your hardware, context length, and workload.',
        'Study standard attention and KV cache first, then Multi-Head Latent Attention from DeepSeek-V2, then linear attention such as Katharopoulos et al. 2020. After that, compare Mamba, RetNet, RWKV, and other state-based models as different answers to the same memory-allocation problem.',
      ],
    },
  ],
};
