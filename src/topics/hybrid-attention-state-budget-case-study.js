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
      heading: 'Why it exists',
      paragraphs: [
        'Hybrid attention state budgets exist because exact attention is powerful and expensive in a very specific way. During decoding, every active request keeps keys and values for old tokens. Those tensors live in high-bandwidth GPU memory, and they grow with context length, user count, attention layers, KV heads, head dimension, and precision. A model can have enough arithmetic capacity to generate tokens and still run out of memory because the KV cache is too large.',
        'Long-context products make the pressure obvious. A coding agent, legal assistant, research workspace, or support-ticket summarizer may carry tens or hundreds of thousands of tokens. If every layer stores exact token memory, the serving system pays that cache tax for every user. A hybrid model asks which layers truly need exact global recall and which layers can use cheaper state, such as latent KV, grouped KV, linear attention, recurrent state, state-space models, or local convolution.',
        {type:'callout', text:'Hybrid attention makes memory a layer-level budget, spending exact KV cache only where global token recall is worth the bytes.'},
      ],
    },
    {
      heading: 'The naive baseline',
      paragraphs: [
        'The naive architecture is a dense Transformer where every layer has full attention and every token can attend to every previous token. That baseline is simple and strong. It is also blunt. If a stack has thirty-two attention layers, each token stores KV state for all thirty-two layers. Doubling context length doubles cache. Doubling concurrent sessions doubles cache. The design spends exact memory everywhere, even if some layers mostly need local mixing or streaming state.',
        'The opposite naive answer is to remove attention and rely on one cheap recurrent or linear mechanism. That can make memory predictable, but it risks losing exact recall. Many workloads need the model to retrieve a precise earlier clause, variable name, citation, instruction, or table value. Pure compressed state can blur those details. Hybrid design starts from the failure of both extremes: full attention pays too much, and all-compressed state can forget too much.',
      ],
    },
    {
      heading: 'Core insight',
      paragraphs: [
        'The core insight is to treat layer type as a memory budget. Full attention is not a moral requirement. It is one representation of history: exact token-level keys and values. Latent attention compresses that memory. Grouped-query attention reduces the number of KV heads. State-space and recurrent layers carry a fixed or slowly growing state. Convolutions keep a local window. Each representation buys a different point on the price and recall curve.',
        'The useful design target is the knee of the frontier. Spend exact attention where global lookup, instruction binding, and long-range disambiguation matter. Use cheaper state where the model mostly needs local flow, streaming features, or compressed summaries. The architecture is a policy over memory representations. The serving system then inherits that policy as lower cache bytes per token, different kernel requirements, and different failure modes.',
      ],
    },
    {
      heading: 'What the visual is proving',
      paragraphs: [
        'The state-budget visual is a ledger. Tokens can flow into full attention, latent KV, recurrent state, linear state, or local windows, but all paths eventually hit the same serving gate: memory budget, decode latency, and quality. The first plot proves the simple math. KV bytes per token scale linearly with the number of attention layers. Replacing ten exact-attention layers does not merely make a diagram cleaner; it reduces the cache term by that fraction.',
        'The layer-mix view proves that architecture is not enough by itself. A hybrid stack must clear the cache path and the kernel path. A recurrent layer that lacks an optimized kernel can lose the serving benefit. A compressed state that passes aggregate benchmarks can still fail exact long-context recall. The final visual route goes through evaluation before shipping because the right state budget is workload-specific, not a slogan about attention being old or state being new.',
      ],
    },
    {
      heading: 'How the system works',
      paragraphs: [
        'A practical budget starts with the KV formula: KV bytes per live token equals 2 times attention layers times KV heads times head dimension times bytes per element. The 2 is key and value. Hybrid architecture changes the attention-layer term. Grouped-query attention changes the KV-head term. Multi-head latent attention changes the stored representation. Quantization changes bytes per element. Context routing changes live tokens. A production ledger should name which term changed, because each term has different quality and systems consequences.',
        'Model designers then choose a layer rhythm. A stack might alternate exact attention with Mamba-like state-space layers, use mostly linear or recurrent layers with periodic full attention, or combine latent attention with cheaper local operators. Jamba, Mamba, RetNet, RWKV, DeepSeek MLA-style designs, and Kimi Linear-style hybrids all attack the same pressure from different directions: exact token memory is valuable, but not every layer needs to store it in the most expensive form.',
        'Serving turns the layer mix into an admission policy. The scheduler estimates cache bytes per request, reserved output growth, context cap, and concurrent sessions. It also tracks whether the hybrid operators have fast kernels on the target hardware. Evaluation must separate normal short tasks, long-context retrieval, exact-copy recall, reasoning over late evidence, p95 latency, HBM footprint, and quantized behavior. A single average benchmark score cannot tell whether the state budget is safe.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Hybrid state works when sequence processing has mixed memory needs. Many tokens mostly need local syntax, nearby facts, or streaming accumulation. Some positions require exact global lookup. By giving every layer the same expensive memory, a dense Transformer overpays for the local parts. By removing exact attention entirely, a recurrent model may underpay for rare but important lookup. A hybrid model splits the bill.',
        'It also works economically. Lower cache bytes per token can mean more concurrent sessions, longer output budgets, lower eviction pressure, or smaller hardware for the same product promise. Those gains matter most during decoding, where memory bandwidth and resident state often dominate. The architecture win is real only when it survives the hardware path: fused kernels, batching, quantization, cache layout, and scheduler policy.',
      ],
    },
    {
      heading: 'Costs and tradeoffs',
      paragraphs: [
        'The first tradeoff is recall. Exact attention stores token-level history. Compressed state summarizes. Summaries can lose position, rare names, numbers, code identifiers, citations, or contradictions. The second tradeoff is implementation complexity. A clean formula in a paper can become a slow kernel, awkward cache format, poor batching behavior, or quantization problem in a serving stack.',
        'The third tradeoff is training and evaluation cost. Hybrid models often need careful recipes so the different layer types cooperate. They also need targeted evaluations, not just broad language-model scores. The team should measure cache bytes, TTFT, decode throughput, p95 and p99 latency, quality by context length, exact recall, instruction retention, and behavior under reduced precision. Saving memory is not a win if the product loses the facts users came for.',
      ],
    },
    {
      heading: 'Real uses',
      paragraphs: [
        'Hybrid budgets are useful in long-context assistants, coding agents, legal review, customer-support summarization, document QA, and retrieval-heavy research products. These workloads carry large prompts and long traces, so reducing cache per token can increase concurrency or keep sessions alive longer. A model that spends exact attention only where needed may offer a better cost envelope than a dense full-attention stack.',
        'They are also useful on constrained devices and always-on systems. A mobile assistant, local note summarizer, or edge log analyzer may prefer compact recurrent or state-space layers because resident memory is limited. A cloud service with mixed workloads can route high-stakes exact-recall tasks to a denser model and routine streaming tasks to a cheaper hybrid. The state budget becomes part of product routing.',
      ],
    },
    {
      heading: 'Failure modes and limits',
      paragraphs: [
        'The obvious failure is state blur: the model remembers the gist but not the exact token. That is unacceptable when the answer depends on a legal clause, a function name, a medication dose, a number in a table, or a security instruction. Another failure is benchmark masking. A hybrid model can look strong on aggregate short tasks and fail on long-context probes. It can also look good at one context length and degrade at longer rollouts.',
        'A second limit is comparability. Claims about hybrid savings are hard to interpret unless parameter count, active parameters, training data, context length, precision, hardware, kernel maturity, and evaluation are clear. A third limit is universality. There may be no single best ratio of attention to state. Legal review may spend more exact attention. Streaming summarization may spend less. Agentic workflows may need both exact file recall and cheap tool-trace memory.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Study KV Cache Concurrency Capacity Model, KV Cache Quantization & Compression, Transformer Inference Roofline, LLM Serving: PagedAttention, Grouped-Query Attention, DeepSeek Multi-Head Latent Attention, Selective State Space Models: Mamba, Mamba-2 Structured State Space Duality, RWKV Recurrent Transformer, RetNet Retention State Case Study, FNet Fourier Token Mixing Case Study, Titans Test-Time Neural Memory Case Study, Prefill/Decode Disaggregation, Early-Exit Transformer Layer Skipping, On-Device LLM Inference Cost Crossover, and Benchmark Variance & Model Selection. The next skill is learning to read every architecture paper as both a quality claim and a memory-accounting claim.',
      ],
    },
  ],
};
