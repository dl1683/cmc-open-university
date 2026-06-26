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
      heading: 'How to read the animation',
      paragraphs: [
        'Read the animation as a memory ledger for a long-context model. Active layers are the ones currently spending state, visited layers have already chosen a memory representation, and found layers are the parts of the stack that keep exact token recall. A safe inference is that replacing exact attention in one layer reduces KV cache only for that layer, not for the whole model.',
        {type:'callout', text:'Hybrid attention makes memory a layer-level budget, spending exact KV cache only where global token recall is worth the bytes.'},
      ],
    },
    { heading: 'Why this exists', paragraphs: [
      'A Transformer decoder stores keys and values for previous tokens so each new token can attend to history. That stored state is the KV cache, and it lives in high-bandwidth GPU memory during serving. As context length and concurrent users grow, memory can become the limiting resource before arithmetic does.',
      'Long-context products make the pressure visible. A coding agent or legal assistant may carry 128,000 tokens, and every active request keeps state across many layers. Hybrid attention exists because exact global memory is valuable but too expensive to spend in every layer without question.',
    ] },
    { heading: 'The obvious approach', paragraphs: [
      'The obvious architecture is full attention in every layer. It is strong, simple, and gives each layer exact token-level access to the whole prefix. The cost is blunt: if the model has 32 attention layers, every live token stores KV state for all 32 layers.',
      'The opposite obvious approach is to remove exact attention and use only recurrent, linear, or state-space memory. That makes memory more predictable and often smaller. It risks losing exact recall for names, numbers, code identifiers, citations, and late instructions.',
    ] },
    { heading: 'The wall', paragraphs: [
      'The wall is that serving cost and recall quality do not move together cleanly. Full attention pays too much for layers that mostly need local or streaming features. Fully compressed memory can pass broad benchmarks while failing a task that needs one exact earlier clause.',
      'The wall also appears in hardware. A cheap layer on paper can be slow if it lacks fused kernels, batches poorly, or creates an awkward cache layout. Architecture only reduces serving cost when the runtime and hardware path can exploit the state budget.',
    ] },
    { heading: 'The core insight', paragraphs: [
      'The core insight is to treat layer type as a budget decision. Exact attention stores token-level history, latent attention stores a compressed representation, grouped-query attention reduces KV heads, and recurrent or state-space layers carry compact state. Each choice buys a different point on the cost and recall curve.',
      'The model should spend exact attention where global lookup, instruction binding, and long-range disambiguation matter most. It can spend cheaper state where the layer mostly needs local flow or accumulated features. The architecture becomes a policy over memory representations rather than a uniform stack.',
    ] },
    { heading: 'How it works', paragraphs: [
      'A practical budget starts from the KV formula: bytes per live token equals 2 times attention layers times KV heads times head dimension times bytes per element. The 2 is for keys and values. Hybrid attention changes the attention-layer term, grouped-query attention changes the KV-head term, and quantization changes bytes per element.',
      'Designers choose a rhythm such as periodic exact attention, mostly latent attention with occasional global layers, or alternating attention and state-space layers. Serving then turns that rhythm into admission control: estimate cache bytes per request, reserve output growth, batch compatible operators, and measure whether long-context probes still pass. The same model can be cheap for summarization and unsafe for exact legal lookup.',
    ] },
    { heading: 'Why it works', paragraphs: [
      'The correctness argument is not that compressed state is always enough. It is that sequence processing has mixed memory needs, and the model can allocate exact memory to the layers that need it. If a later exact-attention layer can read the preserved token record, earlier layers do not all need to store the same expensive record.',
      'The serving argument follows the formula. If a 32-layer model replaces 16 exact-attention layers with fixed-state layers, the exact KV term for those layers drops by half, assuming KV heads, head dimension, and precision stay constant. That can increase concurrent sessions, lengthen context, or lower hardware requirements.',
    ] },
    { heading: 'Cost and complexity', paragraphs: [
      'For a concrete model with 32 attention layers, 8 KV heads, head dimension 128, and 2 bytes per element, exact KV costs 2 * 32 * 8 * 128 * 2 = 131,072 bytes per token, or 128 KB per token. A 100,000-token context therefore needs about 12.8 GB of KV cache for one request before batching overhead. Replacing half the exact layers cuts that term to about 6.4 GB.',
      'The cost moves into training recipes, kernels, evaluation, and failure analysis. The team must measure cache bytes, time to first token, decode throughput, p95 latency, exact recall by context length, and behavior under quantization. Saving memory is not a win if the product loses the exact facts users need.',
    ] },
    { heading: 'Real-world uses', paragraphs: [
      'Hybrid budgets fit long-context assistants, coding agents, legal review, research workspaces, document question answering, and customer-support summarization. These workloads carry large prompts and long traces, so cache bytes per token control concurrency. A cheaper state budget can keep more sessions live on the same GPUs.',
      'They also fit constrained devices and routing systems. A local assistant may prefer compact recurrent state because memory is limited. A cloud product can route exact-recall tasks to denser models and routine streaming tasks to cheaper hybrids.',
    ] },
    { heading: 'Where it fails', paragraphs: [
      'The main failure is state blur. The model may remember the gist but lose the exact function name, account number, medication dose, citation, or policy exception. That is unacceptable when the answer depends on precise retrieval from the context.',
      'It also fails when benchmarks hide the relevant weakness. A model can score well on average short tasks and degrade at 64,000 tokens. Claims about savings are hard to compare unless parameter count, context length, precision, hardware, kernel maturity, and evaluation tasks are stated.',
    ] },
    { heading: 'Worked example', paragraphs: [
      'Assume a serving cluster has 80 GB GPUs and reserves 20 GB for weights, runtime buffers, and fragmentation, leaving 60 GB for KV cache. A dense model that needs 128 KB per token can hold about 491,520 live cached tokens on one GPU. That could be four 100,000-token sessions with little room for output growth.',
      'A hybrid model that reduces exact KV to 64 KB per token can hold about 983,040 live cached tokens under the same budget. The operator can serve nine 100,000-token sessions or keep four sessions with larger output reserves. The behavior changes because cache is the scarce resource, not because the arithmetic magically became free.',
    ] },
    { heading: 'Sources and study next', paragraphs: [
      'Study Transformer attention, KV cache capacity models, grouped-query attention, DeepSeek multi-head latent attention, Mamba and Mamba-2 state-space models, RetNet retention, RWKV recurrent transformers, and Kimi Linear-style hybrid work. Then study PagedAttention, transformer inference roofline, cache quantization, and benchmark variance. Read every architecture claim as both a quality claim and a resident-state accounting claim.',
    ] },
  ],
};