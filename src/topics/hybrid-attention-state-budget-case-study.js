// Hybrid attention state budgets: choose which layers keep exact KV memory and
// which layers use compressed recurrent or linear state.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'hybrid-attention-state-budget-case-study',
  title: 'Hybrid Attention State Budget Case Study',
  category: 'AI & ML',
  summary: 'A memory-budget case study for hybrid sequence models: keep exact attention only where it buys global recall, and replace the rest with cheaper state.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['state budget', 'layer mix'], defaultValue: 'state budget' },
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

function stateGraph(title) {
  return graphState({
    nodes: [
      { id: 'tokens', label: 'tokens', x: 0.8, y: 3.8, note: 'context' },
      { id: 'attn', label: 'attn', x: 2.6, y: 2.4, note: 'exact KV' },
      { id: 'latent', label: 'latent', x: 2.6, y: 3.8, note: 'small KV' },
      { id: 'state', label: 'state', x: 2.6, y: 5.2, note: 'recur' },
      { id: 'budget', label: 'budget', x: 4.7, y: 3.8, note: 'HBM' },
      { id: 'decode', label: 'decode', x: 6.4, y: 2.7, note: 'bytes' },
      { id: 'recall', label: 'recall', x: 6.4, y: 4.9, note: 'quality' },
      { id: 'serve', label: 'serve', x: 8.5, y: 3.8, note: 'users' },
    ],
    edges: [
      { id: 'e-tokens-attn', from: 'tokens', to: 'attn' },
      { id: 'e-tokens-latent', from: 'tokens', to: 'latent' },
      { id: 'e-tokens-state', from: 'tokens', to: 'state' },
      { id: 'e-attn-budget', from: 'attn', to: 'budget', weight: 'large' },
      { id: 'e-latent-budget', from: 'latent', to: 'budget', weight: 'medium' },
      { id: 'e-state-budget', from: 'state', to: 'budget', weight: 'small' },
      { id: 'e-budget-decode', from: 'budget', to: 'decode' },
      { id: 'e-budget-recall', from: 'budget', to: 'recall' },
      { id: 'e-decode-serve', from: 'decode', to: 'serve' },
      { id: 'e-recall-serve', from: 'recall', to: 'serve' },
    ],
  }, { title });
}

function layerGraph(title) {
  return graphState({
    nodes: [
      { id: 'in', label: 'input', x: 0.7, y: 3.8, note: 'tokens' },
      { id: 'a1', label: 'attn', x: 2.2, y: 2.1, note: 'global' },
      { id: 's1', label: 'SSM', x: 2.2, y: 3.8, note: 'state' },
      { id: 's2', label: 'KDA', x: 2.2, y: 5.5, note: 'state' },
      { id: 'mix', label: 'mix', x: 4.4, y: 3.8, note: 'ratio' },
      { id: 'cache', label: 'cache', x: 6.2, y: 2.6, note: 'KV' },
      { id: 'kernel', label: 'kernel', x: 6.2, y: 5.0, note: 'fast path' },
      { id: 'eval', label: 'eval', x: 8.1, y: 3.8, note: 'quality' },
      { id: 'ship', label: 'ship', x: 9.5, y: 3.8, note: 'serve' },
    ],
    edges: [
      { id: 'e-in-a1', from: 'in', to: 'a1' },
      { id: 'e-in-s1', from: 'in', to: 's1' },
      { id: 'e-in-s2', from: 'in', to: 's2' },
      { id: 'e-a1-mix', from: 'a1', to: 'mix' },
      { id: 'e-s1-mix', from: 's1', to: 'mix' },
      { id: 'e-s2-mix', from: 's2', to: 'mix' },
      { id: 'e-mix-cache', from: 'mix', to: 'cache' },
      { id: 'e-mix-kernel', from: 'mix', to: 'kernel' },
      { id: 'e-cache-eval', from: 'cache', to: 'eval' },
      { id: 'e-kernel-eval', from: 'kernel', to: 'eval' },
      { id: 'e-eval-ship', from: 'eval', to: 'ship' },
    ],
  }, { title });
}

function* stateBudget() {
  yield {
    state: stateGraph('Hybrid models allocate memory by layer type'),
    highlight: { active: ['tokens', 'attn', 'latent', 'state', 'budget', 'e-tokens-attn', 'e-tokens-latent', 'e-tokens-state'], found: ['serve'] },
    explanation: 'A hybrid sequence model is a state-budget decision. Some layers keep exact token-level KV memory, some keep latent KV, and some keep compressed recurrent state.',
    invariant: 'Every attention layer adds a per-token cache tax.',
  };

  yield {
    state: labelMatrix(
      'State choices',
      [
        { id: 'full', label: 'full attn' },
        { id: 'latent', label: 'latent KV' },
        { id: 'linear', label: 'linear' },
        { id: 'ssm', label: 'SSM' },
        { id: 'conv', label: 'conv' },
      ],
      [
        { id: 'state', label: 'state' },
        { id: 'strength', label: 'strength' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['all tokens', 'exact recall', 'big cache'],
        ['small KV', 'global-ish', 'lossy'],
        ['finite', 'cheap decode', 'forget'],
        ['recur', 'long scans', 'content'],
        ['window', 'fast local', 'range'],
      ],
    ),
    highlight: { active: ['full:state', 'latent:state', 'linear:state', 'ssm:state'], compare: ['full:risk'] },
    explanation: 'The design menu is not attention versus no attention. It is a menu of memory representations, each with a different recall, cache, kernel, and training tradeoff.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'attention layers', min: 0, max: 32 }, y: { label: 'KV bytes per token', min: 0, max: 33000 } },
      series: [
        { id: 'kv', label: 'KV tax', points: [
          { x: 0, y: 0 }, { x: 6, y: 6144 }, { x: 12, y: 12288 }, { x: 16, y: 16384 }, { x: 24, y: 24576 }, { x: 32, y: 32768 },
        ] },
      ],
      markers: [
        { id: 'hybrid', x: 6, y: 6144, label: 'hybrid' },
        { id: 'dense', x: 16, y: 16384, label: 'dense' },
      ],
    }),
    highlight: { active: ['kv', 'hybrid'], compare: ['dense'] },
    explanation: 'The local transformer-cost notes make the math plain: KV bytes per token scale linearly with the number of attention layers. Replace ten of sixteen attention layers and the cache tax drops by the same fraction.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'context length', min: 0, max: 128000 }, y: { label: 'cache per user, relative', min: 0, max: 2.1 } },
      series: [
        { id: 'dense', label: '16 attn', points: [{ x: 4000, y: 0.06 }, { x: 32000, y: 0.51 }, { x: 64000, y: 1.02 }, { x: 128000, y: 2.05 }] },
        { id: 'hybrid', label: '6 attn', points: [{ x: 4000, y: 0.02 }, { x: 32000, y: 0.19 }, { x: 64000, y: 0.38 }, { x: 128000, y: 0.77 }] },
      ],
      markers: [
        { id: 'saved', x: 32000, y: 0.19, label: 'saved' },
      ],
    }),
    highlight: { active: ['hybrid', 'saved'], compare: ['dense'] },
    explanation: 'At 32k context, a hybrid stack can free enough cache for more concurrent sessions or a larger output budget. The win is economic, not only algorithmic.',
  };

  yield {
    state: stateGraph('Decode cost and recall must both clear the gate'),
    highlight: { active: ['budget', 'decode', 'recall', 'serve', 'e-budget-decode', 'e-budget-recall', 'e-decode-serve', 'e-recall-serve'], compare: ['state'], found: ['attn'] },
    explanation: 'Compressed state helps only if quality holds. Exact attention is expensive because it remembers token-level history; recurrent or linear state is cheap because it must summarize that history.',
  };

  yield {
    state: labelMatrix(
      'Budget ledger',
      [
        { id: 'layers', label: 'layers' },
        { id: 'heads', label: 'KV heads' },
        { id: 'dim', label: 'head dim' },
        { id: 'prec', label: 'precision' },
        { id: 'ctx', label: 'context' },
      ],
      [
        { id: 'effect', label: 'effect' },
        { id: 'control', label: 'control' },
      ],
      [
        ['linear tax', 'hybrid mix'],
        ['linear tax', 'GQA/MLA'],
        ['linear tax', 'smaller d'],
        ['byte tax', 'KV quant'],
        ['user tax', 'router cap'],
      ],
    ),
    highlight: { active: ['layers:effect', 'heads:effect', 'prec:effect', 'ctx:effect'], found: ['layers:control'] },
    explanation: 'A production architecture ledger should record which cache variable changed. Fewer attention layers, fewer KV heads, lower precision, and shorter contexts save different parts of the same memory equation.',
  };
}

function* layerMix() {
  yield {
    state: layerGraph('A hybrid stack is an architecture policy'),
    highlight: { active: ['in', 'a1', 's1', 's2', 'mix', 'e-in-a1', 'e-in-s1', 'e-in-s2'], found: ['cache', 'kernel'] },
    explanation: 'Hybrid models choose a layer rhythm: how often to pay for global attention, where to use recurrent state, and whether the resulting operators have fast kernels.',
  };

  yield {
    state: labelMatrix(
      'Case-study map',
      [
        { id: 'jamba', label: 'Jamba' },
        { id: 'kimi', label: 'Kimi' },
        { id: 'rwkv', label: 'RWKV' },
        { id: 'retnet', label: 'RetNet' },
        { id: 'mamba', label: 'Mamba' },
        { id: 'cost', label: 'cost math' },
      ],
      [
        { id: 'mix', label: 'mix' },
        { id: 'memory', label: 'memory' },
        { id: 'lesson', label: 'lesson' },
      ],
      [
        ['Attn+Mamba', 'less cache', 'ratio matters'],
        ['KDA+MLA', '-75% KV', 'hybrid wins'],
        ['RNN form', 'constant', 'history loss'],
        ['ret state', 'fixed S', '3 modes'],
        ['SSM', 'linear', 'selectivity'],
        ['formula', 'linear tax', 'price layers'],
      ],
    ),
    highlight: { active: ['jamba:mix', 'kimi:mix', 'rwkv:memory', 'retnet:memory', 'mamba:memory'], found: ['cost:lesson'] },
    explanation: 'The papers differ in mechanism, but the systems lesson is shared: exact token memory is expensive, so architectures spend it only where it is worth the cache tax.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'cache bytes', min: 0, max: 10 }, y: { label: 'exact recall', min: 0, max: 1 } },
      series: [
        { id: 'frontier', label: 'frontier', points: [{ x: 1, y: 0.55 }, { x: 2, y: 0.68 }, { x: 4, y: 0.80 }, { x: 7, y: 0.90 }, { x: 10, y: 0.95 }] },
      ],
      markers: [
        { id: 'state', x: 1.4, y: 0.60, label: 'state' },
        { id: 'hybrid', x: 4.2, y: 0.81, label: 'hybrid' },
        { id: 'full', x: 9.5, y: 0.94, label: 'full' },
      ],
    }),
    highlight: { active: ['frontier', 'hybrid'], compare: ['state', 'full'] },
    explanation: 'The useful search is a frontier. Pure recurrent state can be cheap but forgetful. Full attention can be strong but costly. Hybrid designs aim for the knee.',
  };

  yield {
    state: layerGraph('Kernels decide whether theory survives serving'),
    highlight: { active: ['mix', 'kernel', 'cache', 'eval', 'e-mix-kernel', 'e-mix-cache', 'e-kernel-eval'], compare: ['ship'] },
    explanation: 'A layer mix that looks great on paper can lose if the recurrent or linear operator falls off optimized kernels. Serving metrics must include p95 latency, throughput, cache bytes, and quality.',
  };

  yield {
    state: labelMatrix(
      'Evaluation checklist',
      [
        { id: 'short', label: 'short' },
        { id: 'long', label: 'long' },
        { id: 'recall', label: 'recall' },
        { id: 'serve', label: 'serving' },
        { id: 'edge', label: 'edge' },
      ],
      [
        { id: 'test', label: 'test' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['normal tasks', 'regressions'],
        ['128k+', 'lost facts'],
        ['needle', 'state blur'],
        ['p95+HBM', 'kernel gap'],
        ['INT4', 'drift'],
      ],
    ),
    highlight: { active: ['long:test', 'recall:test', 'serve:test', 'edge:test'], compare: ['short:risk'] },
    explanation: 'Hybrid models should not be evaluated only on aggregate language-model scores. Test exact long-range recall, normal short tasks, serving cost, quantization, and edge-device behavior separately.',
  };

  yield {
    state: layerGraph('The product choice is a route, not a slogan'),
    highlight: { active: ['eval', 'ship', 'e-eval-ship'], found: ['cache', 'kernel'], compare: ['a1', 's1', 's2'] },
    explanation: 'The final route can be workload-specific. Legal review may spend more exact attention. Always-on mobile summarization may prefer compact state. Agentic workloads may need a hybrid knee.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'state budget') yield* stateBudget();
  else if (view === 'layer mix') yield* layerMix();
  else throw new InputError('Pick a hybrid-attention-state-budget view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'A hybrid attention state budget is the architecture-level version of KV-cache optimization. Instead of assuming every layer must keep exact token-level KV memory, the model designer decides which layers need full attention, which can use latent or grouped KV, and which can use recurrent, linear, state-space, or convolutional state.',
        'The local Cost of Transformers notes state the economic reason clearly: decode is memory-bound, and KV cache grows with context, users, layers, heads, dimensions, and precision. Fewer attention layers reduce cache cost in direct proportion to the layers removed. That turns layer mix into a serving-capacity decision.',
      ],
    },
    {
      heading: 'The data structure',
      paragraphs: [
        'The budget ledger stores layer type, attention count, KV-head count, head dimension, precision, context cap, recurrent-state size, kernel path, and quality slice. Full attention stores exact token history. Latent KV and MLA-style designs compress the keys and values. RetNet, RWKV, and Mamba-style SSMs store finite or recurrent state. Convolutions store local windows. Each choice is a different memory representation.',
        'The core formula remains KV bytes per token equals 2 times attention layers times KV heads times head dimension times bytes per element. Hybrid architecture changes the first term. GQA or MLA changes the KV-head or latent width term. Quantization changes bytes per element. Routing and context policy change how many live tokens are admitted.',
      ],
    },
    {
      heading: 'Research case studies',
      paragraphs: [
        'Jamba interleaves Transformer and Mamba layers, adds MoE in selected layers, and reports a hybrid Transformer-Mamba model with long-context capability and smaller memory footprint than a vanilla Transformer: https://arxiv.org/abs/2403.19887. Kimi Linear combines Kimi Delta Attention with periodic Multi-Head Latent Attention and reports up to 75 percent KV-cache reduction and up to 6 times decoding throughput at 1M context: https://arxiv.org/abs/2510.26692.',
        'Mamba introduces selective state spaces with input-dependent state updates and a hardware-aware scan for linear-time sequence modeling: https://arxiv.org/abs/2312.00752. RetNet adds a retention mechanism with parallel, recurrent, and chunkwise recurrent computation: https://arxiv.org/abs/2307.08621. RWKV frames the same pressure from the recurrent side: train in a Transformer-like parallel form, run inference with RNN-like constant state, and trade exact token memory for compressed history: https://arxiv.org/abs/2305.13048.',
      ],
    },
    {
      heading: 'Complete case study: agentic long-context serving',
      paragraphs: [
        'An agent product stores long task instructions, retrieved documents, tool traces, and intermediate plans. A dense attention model with every layer keeping KV memory may hit the HBM ceiling before GPU compute is saturated. A hybrid model can reserve exact attention for occasional global-recall layers while using state-based layers for local or streaming computation. That can increase concurrent sessions or keep longer outputs alive before eviction.',
        'The hard part is proving that the compressed state did not erase the fact the user needed. The evaluation suite should include short tasks, long-context retrieval, needle-in-context tests, file-level QA, multi-turn agent traces, p95 latency, HBM footprint, quantized serving, and protected slices such as legal or code tasks.',
      ],
    },
    {
      heading: 'Pitfalls',
      paragraphs: [
        'Do not treat linear or recurrent state as free memory. It can forget, blur exact positions, drift under long rollouts, or require custom kernels that are slower than the theoretical complexity suggests. Do not compare a hybrid model against a full-attention baseline unless data, training recipe, active parameters, context length, and evaluation protocol are clear.',
        'Also do not assume the best architecture is universal. A high-stakes legal review may need more exact recall. A mobile always-on assistant may need compact state and INT4 stability. A coding agent may need both exact file recall and cheap long tool traces. The state budget is a route decision, not a slogan.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Study KV Cache Concurrency Capacity Model, Transformer Inference Roofline, RetNet Retention State Case Study, FNet Fourier Token Mixing Case Study, Titans Test-Time Neural Memory Case Study, Kimi Linear Attention, RWKV Recurrent Transformer, Selective State Space Models: Mamba, DeepSeek Multi-Head Latent Attention, LLM Inference Scaling Playbook, On-Device LLM Inference Cost Crossover, Prefill/Decode Disaggregation, Early-Exit Transformer Layer Skipping, and Benchmark Variance & Model Selection next.',
      ],
    },
  ],
};
