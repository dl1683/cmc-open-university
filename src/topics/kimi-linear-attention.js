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
      heading: 'Why this exists',
      paragraphs: [
        'Long-context models have a serving problem. Full attention can remember every previous token directly, but the KV cache grows with context length and layer count. At one million tokens, the memory and decode cost can dominate the entire system.',
        'Kimi Linear exists as one answer to that pressure. It tries to keep much of the quality of attention while replacing many full-token memory operations with a learned finite-state mechanism. The public architecture combines Kimi Delta Attention blocks with periodic Multi-Head Latent Attention blocks, making it a hybrid rather than a pure recurrence.',
        'The topic is useful because it shows modern efficient attention as systems design, not only asymptotic math. The question is no longer "is attention O(n^2)?" in the abstract. The question is what memory form each layer uses, how much global recall remains, what the kernel can run efficiently, and whether quality survives fair comparison.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is to keep full attention everywhere. That is the quality baseline because every token can, in principle, attend to every earlier token. It is also the expensive baseline because long-context decode keeps dragging a large KV history through memory.',
        'Another obvious approach is pure linear attention or pure recurrence. That makes memory cheaper, but it risks compressing history too aggressively. A finite state can lose details that exact token memory would preserve.',
        'Kimi Linear takes the middle path: use efficient state-heavy blocks for most processing, then keep periodic latent global attention to recover some broader recall.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is the KV cache. For full attention, each generated token adds key and value entries across layers. Long contexts and long outputs turn generation into a memory-bandwidth problem. Reducing arithmetic is not enough if cache traffic still dominates.',
        'The second wall is memory capacity. A recurrent state is cheap, but it has limited capacity. If too much information is compressed into a small state, the model may forget precise facts, positions, or rare details.',
        'The third wall is implementation. A paper architecture can look efficient on paper and still lose in production if kernels are slow, chunking is awkward, batching fragments, precision is unstable, or the serving stack cannot schedule it well.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Treat attention as a memory-design problem. Full attention stores token-level memory. Linear attention stores compressed state. MLA stores latent compressed attention memory. Kimi Linear mixes these forms instead of betting everything on one.',
        'Kimi Delta Attention is the efficient state lane. It uses learned gates and delta-style state updates so each token can modify a compact memory without attending over the whole prefix. Periodic MLA blocks supply a stronger global lane, reducing the risk that pure finite state becomes too narrow.',
        'The reported design is therefore a layered compromise: recurrent-style efficiency for most blocks, global latent attention at intervals, and a serving story focused on lower KV-cache use and faster long-context decode.',
      ],
    },
    {
      heading: 'What the animation teaches',
      paragraphs: [
        'The KDA finite-state view shows each token being processed through gates, delta writes, state reads, and output. The key idea is that memory is updated, not searched token by token.',
        'The layer-rhythm view shows why the architecture is hybrid. Several KDA blocks give cheap stateful processing. An MLA block periodically restores more global access. That rhythm is the architectural answer to the finite-state capacity problem.',
        'The long-context plots should be read as serving plots, not as proof of general intelligence. They show the kind of gain expected when KV-cache pressure is reduced at long context. Quality still has to be checked on short tasks, long tasks, retrieval-heavy tasks, and agent rollouts.',
      ],
    },
    {
      heading: 'How KDA works conceptually',
      paragraphs: [
        'KDA belongs to the family of linear attention and state-space-inspired sequence models. Instead of materializing attention against every prior token, it maintains a state that summarizes prior information. A new token computes gates and updates that state.',
        'The important phrase is learned finite state. The state is not a human-written summary. It is a trainable internal memory that the model learns to write and read. Gating decides what should be kept, overwritten, or emphasized.',
        'That makes KDA efficient at decode time because each new token can update a bounded state. It also creates the central risk: a bounded state must choose what to preserve. If the task needs exact recall of many old details, full token memory or explicit retrieval may still be needed.',
      ],
    },
    {
      heading: 'Why hybrid attention matters',
      paragraphs: [
        'Pure recurrence is attractive because it can make sequence length cheap. But language tasks often need nonlocal recall, document-level connections, and exact references. Pure finite-state compression can be too lossy.',
        'Full attention is attractive because it preserves direct token access. But it becomes expensive at very long context, especially during decode. The hybrid design says: do not pay full attention everywhere, and do not remove global access everywhere.',
        'MLA blocks are the global recall lane in this story. They give the architecture periodic chances to use a richer attention mechanism while KDA blocks carry most of the efficient sequential processing.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Imagine an agent reading a long repository and generating a long plan. Full attention keeps KV memory for every token. That preserves access but makes decode expensive as the context grows. A pure rolling window might lose old architectural facts. A pure recurrent model might compress too much into state.',
        'A Kimi-style hybrid can let most layers process the stream through efficient state while occasional MLA layers provide broader access. The result aims to lower cost per output token while preserving enough global behavior for long-context tasks.',
        'The right evaluation is not a single benchmark number. You would test short-task quality, long-document retrieval, needle and multi-needle recall, agent rollouts, code tasks, long-output stability, and actual serving throughput under the same hardware and batching policy.',
      ],
    },
    {
      heading: 'Why it works when it works',
      paragraphs: [
        'It works when most sequence processing can be compressed into learned state without losing the details the task needs. Many local dependencies, style continuations, and routine transformations do not require exact attention over every previous token.',
        'It also works when the expensive global path is used sparingly but strategically. Periodic MLA blocks can provide enough global modeling capacity that the architecture avoids the worst failures of pure linear attention.',
        'Finally, it works only if kernels and serving code are real. Efficient attention is a hardware-facing claim. The algorithm must map cleanly to accelerator memory, batching, precision, and scheduler behavior.',
      ],
    },
    {
      heading: 'Cost and behavior',
      paragraphs: [
        'The claimed benefit is lower KV-cache use and faster decode at very long context. That matters for agentic workloads, long chats, codebase analysis, and any system where output length and context length are both large.',
        'The cost is complexity. KDA state updates, MLA placement, chunking, kernel implementation, numerical precision, and training recipe all become part of the architecture. A simple full-attention baseline is expensive but easier to reason about.',
        'The behavior can also be uneven. A model can be fast on long-context continuation and still fail tasks that require exact old-token recall. A responsible evaluation separates throughput, memory, local fluency, global recall, and task success.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'Kimi Linear wins conceptually where long-context decode is the bottleneck and the task can benefit from bounded or reduced memory: long-running agents, codebase reading, document workflows, extended chat, and RL rollouts that generate many tokens.',
        'It is also a useful curriculum bridge. It connects attention, KV cache, MLA, recurrent state, Mamba-style models, RetNet, RWKV, and transformer serving rooflines in one concrete architecture.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'It fails if finite state loses information that full attention would preserve. Exact citation, legal review, proof checking, and long-document QA may need explicit retrieval or full-token access for key evidence.',
        'It also fails as a teaching topic if reduced to "linear attention is faster." The real lesson is the trade among memory form, global recall, kernel readiness, training recipe, and task-specific evaluation.',
      ],
    },
    {
      heading: 'What to remember',
      paragraphs: [
        'Kimi Linear is a hybrid memory design: KDA state for efficient processing, MLA blocks for periodic global capacity.',
        'Do not judge efficient attention only by asymptotics. Judge memory, throughput, quality, recall, implementation readiness, and the exact workload.',
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
