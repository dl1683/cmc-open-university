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
    explanation: 'Kimi Delta Attention treats memory like a recurrent finite state. Fine-grained gates decide what to write and keep, so each token can update the state without reading every previous token.',
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
    explanation: 'KDA improves the finite-state side of linear attention, while the full Kimi Linear architecture keeps periodic global attention through MLA blocks.',
    invariant: 'Long-context models choose what form memory should take.',
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
    explanation: 'The public Kimi Linear materials describe a hybrid rhythm: several KDA blocks for efficient recurrent processing, then an MLA block for global attention capacity.',
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
    explanation: 'The shape is the main idea: finite-state layers make decode memory grow much more slowly, while occasional MLA layers retain stronger global access than pure recurrence.',
  };
}

function* longContextEfficiency() {
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
    explanation: 'Kimi Linear reports a 48B-total, 3B-activated model and frames the result as a fair comparison against full attention and MLA baselines.',
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
    explanation: 'Agentic workloads stress both sides: long context and long outputs. Kimi Linear is a case study in reducing decode cost without giving up too much global recall.',
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
    explanation: 'The chart encodes the reported direction: at very long context, Kimi Linear claims much lower time per output token than an MLA-heavy baseline.',
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
    explanation: 'The responsible teaching point is benchmark discipline. Linear attention must win quality, cost, and implementation readiness, not only asymptotic notation.',
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
      heading: 'What it is',
      paragraphs: [
        'Kimi Linear is a hybrid efficient-attention architecture from Moonshot AI. Its core component is Kimi Delta Attention, or KDA, a linear attention module that refines Gated DeltaNet with more fine-grained gating. Instead of keeping every previous token in a full attention cache, KDA maintains a learned finite-state memory.',
        'The architecture is hybrid rather than purely recurrent. Public Kimi Linear materials describe a layer rhythm with KDA blocks and periodic Multi-Head Latent Attention blocks. That makes it a useful bridge between RWKV, Mamba-style state models, RetNet Retention State, DeepSeek MLA, and ordinary Transformer attention.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Full attention stores token-level KV history and compares a new query with many previous keys. Linear attention compresses history into state. KDA improves that state update with gating so the model can decide what information to write, overwrite, or retain. Occasional MLA blocks provide stronger global access than a pure finite-state model would have.',
        'This is best understood as a memory-design problem. The model designer chooses between exact token memory, grouped or latent KV memory, and recurrent state. Kimi Linear combines these choices so long-context decoding can be cheaper while quality remains competitive.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Kimi Linear reduces KV-cache pressure and can improve long-context decode throughput, but it adds architectural and kernel complexity. The KDA kernel, chunkwise algorithm, precision choices, and serving stack all matter. A theoretical O(n) story is not enough; the architecture must run efficiently on real accelerators and maintain quality under the same training recipe.',
      ],
    },
    {
      heading: 'Real-world case study',
      paragraphs: [
        'The Kimi Linear report describes a 48B-total, 3B-activated model with 1M context. It reports that Kimi Linear outperforms full MLA under an identical recipe across evaluated tasks, reduces KV-cache usage by up to 75 percent, and reaches up to 6 times decoding throughput for 1M context. The GitHub release includes KDA kernel and vLLM implementation material, which makes the case study more concrete than a paper-only proposal.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'Linear attention is not automatically better than full attention. A finite state can forget details, fail retrieval, or behave differently under long rollouts. Hybrid designs also make attribution harder: gains can come from KDA, MLA placement, MoE scale, training recipe, kernels, or serving configuration. The correct comparison holds data, model size, compute, and evaluation protocol as constant as possible.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Kimi Linear: An Expressive, Efficient Attention Architecture at https://arxiv.org/abs/2510.26692 and the MoonshotAI Kimi-Linear repository at https://github.com/MoonshotAI/Kimi-Linear. Study Hybrid Attention State Budget Case Study, RetNet Retention State Case Study, FNet Fourier Token Mixing Case Study, Titans Test-Time Neural Memory Case Study, DeepSeek Multi-Head Latent Attention, KV Cache, Attention, RWKV Recurrent Transformer, Selective State Space Models: Mamba, Transformer Inference Roofline, and Benchmark Variance & Model Selection next.',
      ],
    },
  ],
};
