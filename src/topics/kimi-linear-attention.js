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
      heading: 'How to read the animation',
      paragraphs: [
        'The animation has two views. Switch between them using the View control.',
        { type: 'callout', text: 'Kimi Linear is a memory-allocation design: cheap recurrent state handles most layers, while periodic global attention preserves long-range recall.' },
        {
          type: 'bullets',
          items: [
            'KDA finite state -- shows a single token flowing through the recurrent pipeline: input, gate, delta write, state, linear read, output. Active (highlighted) nodes are the gating and state-update machinery. The found node is the linear read that produces output without scanning prior tokens.',
            'Long-context efficiency -- shows reported model specs, the agentic decode use case, a throughput plot comparing Kimi Linear to an MLA baseline, and an evaluation checklist. Active series in the plot is the Kimi hybrid; the comparison series is full attention or MLA.',
          ],
        },
        'In the layer-rhythm graph (step 3 of KDA finite state), blue nodes are KDA blocks and the green node is the periodic MLA block. The 3:1 ratio is the reported hybrid cadence: three cheap recurrent layers, then one global attention layer.',
        {
          type: 'note',
          text: 'The throughput plots show the direction of the reported claims, not verified independent benchmarks. Read them as "this is the shape the authors claim," not "this is ground truth." Always check evaluation methodology before trusting absolute numbers.',
        },
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Transformer attention remembers everything by storing a key-value pair for every token in every layer. That exact memory is the source of both its quality and its cost problem.',
        { type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/8/8f/The-Transformer-model-architecture.png', alt: 'Transformer model architecture with encoder and decoder attention blocks', caption: 'The standard Transformer uses attention blocks throughout the stack; Kimi Linear changes the memory form in most layers. Source: https://commons.wikimedia.org/wiki/File:The-Transformer-model-architecture.png.' },
        'At 1M tokens across 80 layers with 128-dimensional heads, KV cache alone can exceed 40 GB. Every generated token must read that entire cache. Decode becomes memory-bandwidth-bound long before compute runs out.',
        {
          type: 'quote',
          text: 'We find that incorporating a small proportion of softmax attention layers within a primarily linear architecture is crucial for maintaining strong language modeling performance.',
          attribution: 'Kimi-Linear team, arXiv:2510.26692',
        },
        'Kimi Linear exists because neither extreme works alone. Pure attention is too expensive at long context. Pure linear recurrence is too lossy for tasks that need exact recall. The architecture mixes both forms so each layer uses the memory mechanism that fits its role.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'Keep full softmax attention in every layer. Each token attends to all prior tokens through explicit key-value pairs. This is the quality ceiling: no information is compressed, no detail is lost, and the model can retrieve any prior token by content match.',
        {
          type: 'table',
          headers: ['Approach', 'Memory per layer', 'Decode cost per token', 'Recall quality'],
          rows: [
            ['Full attention', 'O(n) KV pairs', 'O(n) reads', 'Exact'],
            ['Sliding window', 'O(w) KV pairs', 'O(w) reads', 'Local only'],
            ['Pure linear/recurrent', 'O(1) state matrix', 'O(1) update', 'Compressed'],
          ],
        },
        'Full attention works and is simple to reason about. Sliding windows are cheap but discard everything outside the window. Pure recurrence compresses all history into a fixed-size state, which is constant-cost but lossy.',
        'The obvious instinct is to pick one and accept the tradeoff. Kimi Linear rejects that choice.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'Wall 1: KV cache bandwidth. Full attention stores n key-value pairs per layer. Generating token n+1 requires reading all n pairs to compute attention weights. At 1M context on 80 layers, decode is dominated by memory reads, not arithmetic. The GPU spends most of its time moving cache, not computing.',
        'Wall 2: finite-state capacity. Pure recurrence replaces the KV cache with a fixed-size state matrix, typically d_key x d_value. That matrix must encode everything the model might need from history. When two distant facts compete for the same state dimensions, one gets overwritten. Needle-in-a-haystack retrieval at position 200 out of a million is exactly the task where a fixed state fails.',
        'Wall 3: kernel reality. An architecture can be O(1) per token on paper and still lose to full attention in practice if the implementation requires awkward chunking, precision workarounds, or serialized state updates that prevent batching. The gap between algorithmic complexity and wall-clock throughput is where many linear attention papers stall.',
        {
          type: 'note',
          text: 'The memory-bandwidth wall is quantitative, not just asymptotic. On an H100 with 3.35 TB/s HBM bandwidth, reading a 20 GB KV cache takes ~6 ms per token. At 100 tokens/second target throughput, that single operation consumes 60% of the time budget. This is why KV cache reduction translates directly to decode speed.',
        },
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Kimi Linear stacks two block types in a fixed rhythm.',
        {
          type: 'diagram',
          text: 'Layer rhythm (reported 3:1 ratio):\n\n[KDA] --> [KDA] --> [KDA] --> [MLA] --> [KDA] --> [KDA] --> [KDA] --> [MLA] --> ...\n  |         |         |         |         |         |         |         |\n  v         v         v         v         v         v         v         v\nstate     state     state    global    state     state     state    global\nupdate    update    update   attend    update    update    update   attend',
          label: 'Three recurrent layers for cheap sequential processing, then one global attention layer for broad recall',
        },
        'Kimi Delta Attention (KDA) is the recurrent block. Each token passes through a learned gate that decides what to write into a fixed-size state matrix and what to decay. The update rule is a gated delta: S_t = decay * S_{t-1} + gate * (v_t * k_t^T). Output is computed as y_t = S_t * q_t -- a single matrix-vector multiply, not an attention scan.',
        {
          type: 'code',
          language: 'text',
          text: '# KDA state update (conceptual)\ndecay = sigmoid(W_decay @ x_t)        # what to forget\ngate  = sigmoid(W_gate @ x_t)         # what to write\nk_t   = W_k @ x_t                     # key projection\nv_t   = W_v @ x_t                     # value projection\nq_t   = W_q @ x_t                     # query projection\n\nS_t   = decay * S_{t-1} + gate * outer(v_t, k_t)\ny_t   = S_t @ q_t                     # linear read',
        },
        'Multi-Head Latent Attention (MLA) is the global block, borrowed from DeepSeek. It compresses keys and values into a low-rank latent before computing softmax attention. This gives full-sequence access with a smaller KV footprint than standard multi-head attention.',
        'The hybrid works because KDA handles most tokens cheaply through state updates, and MLA periodically refreshes global access. The 3:1 ratio means 75% of layers are O(1)-per-token recurrent and 25% are softmax attention with compressed KV.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The correctness argument has three parts.',
        'First, most sequential dependencies are local. Syntax, style continuation, coreference within a paragraph, and routine transformations rarely need to look back thousands of tokens. A learned finite state can capture these patterns because the relevant information decays naturally with distance. KDA handles this majority of layers.',
        'Second, the tasks where recurrence fails -- exact retrieval, cross-document reference, long-range factual recall -- are sparse. They need global access, but not at every layer. Periodic MLA blocks provide enough global modeling capacity to handle these cases without paying global cost everywhere.',
        {
          type: 'diagram',
          text: 'Information flow through hybrid layers:\n\nToken 1 ----state----> Token 100 ----state----> Token 10000\n   \\                      |                        /\n    \\--- MLA (layer 4) ---+--- MLA (layer 8) -----/\n         exact access          exact access\n\nRecurrent path: cheap, lossy over distance\nMLA path:       expensive, exact, periodic',
          label: 'KDA carries local context cheaply; MLA recovers distant facts at intervals',
        },
        'Third, the gating mechanism in KDA is learned, not fixed. The model discovers which dimensions of state to preserve and which to overwrite based on training signal. This is strictly more expressive than fixed-decay recurrence (like RetNet) because the forget rate adapts per-token and per-dimension.',
        {
          type: 'note',
          text: 'The hybrid is not provably optimal. It is an empirical bet that the 3:1 ratio captures enough global capacity for current benchmarks. Different tasks may want different ratios. The architecture wins when most processing is genuinely local and the global queries are sparse enough to fit in 25% of layers.',
        },
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        {
          type: 'table',
          headers: ['Operation', 'Full attention', 'Pure KDA', 'Kimi Linear (3:1 hybrid)'],
          rows: [
            ['Prefill (n tokens)', 'O(n^2 d)', 'O(n d^2)', 'O(n d^2) for KDA layers + O(n^2 d / 4) for MLA layers'],
            ['Decode (per token)', 'O(n d) cache read', 'O(d^2) state update', '~75% O(d^2) + ~25% O(n d / r) where r is MLA compression ratio'],
            ['KV cache at context n', 'O(n L d)', 'O(L d^2) fixed', 'O(L_mla * n * d/r + L_kda * d^2)'],
            ['Memory scaling', 'Linear in n', 'Constant in n', 'Sublinear in n (dominated by MLA layers)'],
          ],
        },
        'The reported numbers from the Kimi Linear paper on a 48B-total / 3B-activated MoE model: up to 75% KV cache reduction and up to 6x decode speedup over an MLA-only baseline at very long context. These gains grow with context length because the fixed-cost KDA layers become a larger fraction of total work.',
        'The complexity tax is real. The system has two attention mechanisms with different kernels, a layer-placement hyperparameter (the 3:1 ratio), gating parameters that must be trained, and chunked-state computation for efficient prefill of the recurrent layers. A full-attention model has one mechanism and one kernel.',
        {
          type: 'note',
          text: 'Doubling context length roughly doubles the KV cache cost for full attention. For Kimi Linear, doubling context increases cost only in the MLA layers (25% of total). If d=128 and n goes from 500K to 1M, the KDA layers cost the same. That is the source of the sublinear scaling.',
        },
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        {
          type: 'bullets',
          items: [
            'Long-running agents -- agentic workloads read large codebases and generate long plans. Both input and output are long. KDA layers reduce the per-token decode cost, and MLA layers preserve the ability to reference distant code.',
            'Extended conversation -- multi-turn chats accumulate context over hours. Full attention KV cache grows with every turn. Hybrid recurrence caps the cost of KDA layers regardless of conversation length.',
            'RL rollouts -- reinforcement learning from human feedback generates many candidate completions. Each rollout decodes thousands of tokens. Cheaper decode per token multiplies across rollouts.',
            'Document workflows -- legal review, research synthesis, and report generation over 100K+ token inputs. The periodic MLA layers can attend to key evidence while KDA layers handle the bulk narrative.',
          ],
        },
        'The common pattern: the task has long context, long output, or both, and the bottleneck is decode memory bandwidth rather than compute.',
        'Kimi Linear also serves as a curriculum bridge. It connects attention, KV cache, MLA, recurrent state, Mamba-style models, RetNet, RWKV, and transformer serving rooflines in one concrete architecture. Understanding Kimi Linear means understanding the design space.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        {
          type: 'table',
          headers: ['Failure mode', 'Why it happens', 'Example task'],
          rows: [
            ['Lost needle recall', 'KDA state overwrites old facts; MLA layers may not align with the retrieval point', 'Find the one contract clause that contradicts clause 47, buried at position 200K'],
            ['Short-context overhead', 'Gating and state machinery add parameters and latency that full attention does not need at short context', 'Chatbot with 500-token conversations'],
            ['Kernel immaturity', 'Chunked recurrent kernels are less battle-tested than flash attention', 'Production serving with strict latency SLAs on day one'],
            ['Training recipe sensitivity', 'Hybrid ratio, gating initialization, and MLA placement require careful tuning', 'Teams without resources to sweep architecture hyperparameters'],
          ],
        },
        'The deepest failure is the capacity bound. A d x d state matrix has d^2 scalar slots. If the task requires the model to recall more than d^2 independent facts from history, the state must overwrite something. Full attention has no such limit -- it stores one KV pair per token, scaling recall linearly with context.',
        {
          type: 'quote',
          text: 'Linear attention mechanisms fundamentally trade memory capacity for computational efficiency. The question is not whether information is lost, but whether the lost information matters for the task.',
          attribution: 'Paraphrased from the linear attention literature (Katharopoulos et al., 2020; Kacham et al., 2024)',
        },
        'It also fails as a teaching topic if reduced to "linear attention is faster." The real lesson is the engineering of memory forms: which layers store what, how much global recall survives, whether the kernel actually runs fast, and whether quality holds on the exact workload you care about.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        {
          type: 'table',
          headers: ['Source', 'Role', 'Link'],
          rows: [
            ['Kimi-Linear: An Expressive, Efficient Attention Architecture', 'Primary paper', 'https://arxiv.org/abs/2510.26692'],
            ['MoonshotAI Kimi-Linear repository', 'Reference implementation', 'https://github.com/MoonshotAI/Kimi-Linear'],
            ['DeepSeek-V2 MLA paper', 'MLA mechanism origin', 'https://arxiv.org/abs/2405.04434'],
            ['Transformers are RNNs (Katharopoulos et al., 2020)', 'Linear attention foundation', 'https://arxiv.org/abs/2006.16236'],
          ],
        },
        {
          type: 'bullets',
          items: [
            'Prerequisite: study Attention and KV Cache first. You need to understand what full attention stores and why KV cache grows before the hybrid tradeoff makes sense.',
            'Companion: study DeepSeek Multi-Head Latent Attention to understand the global-attention block that Kimi Linear borrows.',
            'Alternatives: study Selective State Space Models (Mamba), RWKV Recurrent Transformer, and RetNet Retention State to see other answers to the same problem.',
            'Extensions: study Hybrid Attention State Budget Case Study and Titans Test-Time Neural Memory Case Study for deeper analysis of hybrid memory allocation.',
            'Evaluation: study Transformer Inference Roofline and Benchmark Variance & Model Selection to build the tools for judging whether reported gains are real.',
          ],
        },
      ],
    },
  ],
};
