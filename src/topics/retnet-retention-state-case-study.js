// RetNet retention state: decay-weighted recurrent memory with parallel,
// recurrent, and chunkwise execution views.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'retnet-retention-state-case-study',
  title: 'RetNet Retention State Case Study',
  category: 'Papers',
  summary: 'A RetNet case study: decay-weighted retention state, multi-scale heads, parallel training, recurrent decode, and chunkwise long-context execution.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['retention state', 'execution modes', 'deployment fit'], defaultValue: 'retention state' },
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

function retentionGraph(title) {
  return graphState({
    nodes: [
      { id: 'x', label: 'x_t', x: 0.7, y: 3.8, note: 'token' },
      { id: 'q', label: 'Q', x: 2.4, y: 2.2, note: 'read' },
      { id: 'k', label: 'K', x: 2.4, y: 3.8, note: 'addr' },
      { id: 'v', label: 'V', x: 2.4, y: 5.4, note: 'data' },
      { id: 'decay', label: 'decay', x: 4.5, y: 3.0, note: 'gamma' },
      { id: 'write', label: 'write', x: 4.5, y: 4.8, note: 'K x V' },
      { id: 'state', label: 'ret state', x: 6.8, y: 3.8, note: 'matrix' },
      { id: 'out', label: 'y_t', x: 9.0, y: 3.8, note: 'output' },
    ],
    edges: [
      { id: 'e-x-q', from: 'x', to: 'q' },
      { id: 'e-x-k', from: 'x', to: 'k' },
      { id: 'e-x-v', from: 'x', to: 'v' },
      { id: 'e-k-write', from: 'k', to: 'write' },
      { id: 'e-v-write', from: 'v', to: 'write' },
      { id: 'e-decay-state', from: 'decay', to: 'state' },
      { id: 'e-write-state', from: 'write', to: 'state' },
      { id: 'e-q-state', from: 'q', to: 'state' },
      { id: 'e-state-out', from: 'state', to: 'out' },
    ],
  }, { title });
}

function chunkGraph(title) {
  return graphState({
    nodes: [
      { id: 'c1', label: 'chunk 1', x: 0.8, y: 2.4, note: 'parallel' },
      { id: 's1', label: 'sum 1', x: 2.8, y: 2.4, note: 'state' },
      { id: 'c2', label: 'chunk 2', x: 0.8, y: 4.2, note: 'parallel' },
      { id: 's2', label: 'sum 2', x: 2.8, y: 4.2, note: 'state' },
      { id: 'c3', label: 'chunk 3', x: 0.8, y: 6.0, note: 'parallel' },
      { id: 's3', label: 'sum 3', x: 2.8, y: 6.0, note: 'state' },
      { id: 'scan', label: 'scan', x: 5.0, y: 4.2, note: 'carry' },
      { id: 'read', label: 'local read', x: 7.0, y: 4.2, note: 'inside' },
      { id: 'out', label: 'tokens', x: 9.0, y: 4.2, note: 'outputs' },
    ],
    edges: [
      { id: 'e-c1-s1', from: 'c1', to: 's1' },
      { id: 'e-c2-s2', from: 'c2', to: 's2' },
      { id: 'e-c3-s3', from: 'c3', to: 's3' },
      { id: 'e-s1-scan', from: 's1', to: 'scan' },
      { id: 'e-s2-scan', from: 's2', to: 'scan' },
      { id: 'e-s3-scan', from: 's3', to: 'scan' },
      { id: 'e-scan-read', from: 'scan', to: 'read' },
      { id: 'e-read-out', from: 'read', to: 'out' },
    ],
  }, { title });
}

function* retentionState() {
  yield {
    state: retentionGraph('Retention replaces token list reads with a state'),
    highlight: { active: ['k', 'v', 'write', 'state', 'e-k-write', 'e-v-write', 'e-write-state'], found: ['out'], compare: ['q'] },
    explanation: 'RetNet keeps a decay-weighted retention state. Each token writes a key-value outer product into state, old state decays, and the next query reads the compressed history.',
    invariant: 'The data structure is not a KV list. It is a per-head recurrent summary of past key-value evidence.',
  };

  yield {
    state: labelMatrix(
      'State update row',
      [
        { id: 'old', label: 'old S' },
        { id: 'decay', label: 'decay' },
        { id: 'write', label: 'write' },
        { id: 'read', label: 'read' },
        { id: 'next', label: 'next S' },
      ],
      [
        { id: 'stored', label: 'stored' },
        { id: 'op', label: 'op' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['history', 'carry', 'stale'],
        ['gamma*S', 'forget', 'short'],
        ['KxV', 'add', 'noise'],
        ['Q*S', 'lookup', 'blur'],
        ['state', 'keep', 'drift'],
      ],
    ),
    highlight: { active: ['decay:op', 'write:op', 'next:stored'], compare: ['read:risk'] },
    explanation: 'The recurrent form is a small ledger: decay the old state, add the new key-value write, then read with the current query. The benefit is fixed-size state; the cost is compressed memory.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'tokens back', min: 0, max: 12 }, y: { label: 'retention', min: 0, max: 1 } },
      series: [
        { id: 'fast', label: 'fast head', points: [
          { x: 0, y: 1.0 }, { x: 2, y: 0.42 }, { x: 4, y: 0.18 }, { x: 6, y: 0.08 }, { x: 8, y: 0.03 }, { x: 10, y: 0.01 },
        ] },
        { id: 'mid', label: 'mid head', points: [
          { x: 0, y: 1.0 }, { x: 2, y: 0.68 }, { x: 4, y: 0.46 }, { x: 6, y: 0.31 }, { x: 8, y: 0.21 }, { x: 10, y: 0.14 },
        ] },
        { id: 'slow', label: 'slow head', points: [
          { x: 0, y: 1.0 }, { x: 2, y: 0.88 }, { x: 4, y: 0.78 }, { x: 6, y: 0.69 }, { x: 8, y: 0.61 }, { x: 10, y: 0.54 },
        ] },
      ],
      markers: [
        { id: 'multi', x: 8, y: 0.61, label: 'multi-scale' },
      ],
    }),
    highlight: { active: ['fast', 'mid', 'slow'], found: ['multi'] },
    explanation: 'Multi-scale retention gives different heads different decay horizons. Some channels behave like short memory; others carry older evidence longer. This is how RetNet avoids one global forgetting rate.',
  };

  yield {
    state: labelMatrix(
      'Memory forms',
      [
        { id: 'attn', label: 'attention' },
        { id: 'rwkv', label: 'RWKV' },
        { id: 'mamba', label: 'Mamba' },
        { id: 'retnet', label: 'RetNet' },
      ],
      [
        { id: 'stored', label: 'keeps' },
        { id: 'read', label: 'read' },
        { id: 'trade', label: 'risk' },
      ],
      [
        ['KV', 'smx', 'cost'],
        ['state', 'gate', 'blur'],
        ['state', 'sel', 'kernel'],
        ['S', 'Q*S', 'gamma'],
      ],
    ),
    highlight: { active: ['retnet:stored', 'retnet:read'], compare: ['attn:stored'] },
    explanation: 'RetNet belongs beside RWKV and Mamba, but its state has a distinct attention-like shape: queries read a decay-weighted key-value summary rather than a raw hidden vector alone.',
  };

  yield {
    state: retentionGraph('The contract is compressed recall, not exact recall'),
    highlight: { active: ['state', 'decay', 'write', 'e-decay-state', 'e-write-state'], found: ['out'], compare: ['q', 'k', 'v'] },
    explanation: 'The clean mental model: RetNet turns long context into a rolling state. That can reduce decode memory, but tasks needing exact old-token lookup must prove the state preserved the needed fact.',
  };
}

function* executionModes() {
  yield {
    state: labelMatrix(
      'Three views',
      [
        { id: 'parallel', label: 'parallel' },
        { id: 'recur', label: 'recurrent' },
        { id: 'chunk', label: 'chunkwise' },
      ],
      [
        { id: 'best', label: 'use' },
        { id: 'state', label: 'state' },
        { id: 'cost', label: 'cost' },
      ],
      [
        ['train', 'all tok', 'wide'],
        ['decode', 'one S', 'fixed'],
        ['long', 'ch S', 'linear'],
      ],
    ),
    highlight: { active: ['parallel:best', 'recur:best', 'chunk:best'], found: ['recur:state'] },
    explanation: 'The rows are schedules for the same retention rule. Training wants wide parallel work, decoding wants one carried state, and long sequences need chunk summaries so the scan does not become a serial bottleneck.',
    invariant: 'The same retention math can be scheduled differently for training and serving.',
  };

  yield {
    state: labelMatrix(
      'Parallel retention map',
      [
        { id: 't1', label: 't1' },
        { id: 't2', label: 't2' },
        { id: 't3', label: 't3' },
        { id: 't4', label: 't4' },
      ],
      [
        { id: 'k1', label: 'k1' },
        { id: 'k2', label: 'k2' },
        { id: 'k3', label: 'k3' },
        { id: 'k4', label: 'k4' },
      ],
      [
        ['1', '', '', ''],
        ['g', '1', '', ''],
        ['g2', 'g', '1', ''],
        ['g3', 'g2', 'g', '1'],
      ],
    ),
    highlight: { active: ['t4:k1', 't4:k2', 't4:k3', 't4:k4'], compare: ['t1:k1'] },
    explanation: 'In parallel form, the retention weights look like a causal lower-triangular map. Older keys are still visible, but they are discounted by powers of the decay factor.',
  };

  yield {
    state: retentionGraph('Recurrent decode updates one state per token'),
    highlight: { active: ['decay', 'write', 'state', 'out', 'e-decay-state', 'e-write-state', 'e-state-out'], compare: ['q'] },
    explanation: 'In recurrent decode, the runtime does not append a KV row for every past token. It updates the retention state once and carries that state to the next token.',
  };

  yield {
    state: chunkGraph('Chunkwise mode mixes local parallelism with carried state'),
    highlight: { active: ['c1', 'c2', 'c3', 's1', 's2', 's3'], found: ['scan', 'read'], compare: ['out'] },
    explanation: 'Chunkwise mode is the compromise. Tokens inside a chunk can run in parallel, but each chunk still exports a summary that later chunks depend on. Boundary tests matter because the carried state is compressed.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'seq len', min: 0, max: 145 }, y: { label: 'bytes', min: 0, max: 108 } },
      series: [
        { id: 'kv', label: 'KV', points: [
          { x: 8, y: 6 }, { x: 16, y: 12 }, { x: 32, y: 25 }, { x: 64, y: 50 }, { x: 128, y: 100 },
        ] },
        { id: 'ret', label: 'Ret S', points: [
          { x: 8, y: 9 }, { x: 16, y: 9 }, { x: 32, y: 9 }, { x: 64, y: 9 }, { x: 128, y: 9 },
        ] },
        { id: 'chunk', label: 'chunk', points: [
          { x: 8, y: 10 }, { x: 16, y: 12 }, { x: 32, y: 16 }, { x: 64, y: 24 }, { x: 128, y: 40 },
        ] },
      ],
      markers: [
        { id: 'cap', x: 128, y: 9, label: 'fixed' },
      ],
    }),
    highlight: { active: ['ret', 'chunk'], compare: ['kv'], found: ['cap'] },
    explanation: 'The serving appeal is memory shape. A Transformer cache grows with context. RetNet recurrent decode carries fixed state, while chunkwise mode adds bounded summaries for long training or batched processing.',
  };
}

function* deploymentFit() {
  yield {
    state: graphState({
      nodes: [
        { id: 'workload', label: 'workload', x: 0.7, y: 3.8, note: 'long ctx' },
        { id: 'need', label: 'recall need', x: 2.6, y: 2.8, note: 'exact?' },
        { id: 'budget', label: 'HBM cap', x: 2.6, y: 4.8, note: 'bytes' },
        { id: 'route', label: 'route', x: 4.6, y: 3.8, note: 'model' },
        { id: 'retnet', label: 'RetNet', x: 6.7, y: 2.6, note: 'state' },
        { id: 'hybrid', label: 'hybrid', x: 6.7, y: 4.0, note: 'some attn' },
        { id: 'full', label: 'full attn', x: 6.7, y: 5.4, note: 'KV' },
        { id: 'eval', label: 'eval', x: 8.9, y: 3.8, note: 'prove' },
      ],
      edges: [
        { id: 'e-work-need', from: 'workload', to: 'need' },
        { id: 'e-work-budget', from: 'workload', to: 'budget' },
        { id: 'e-need-route', from: 'need', to: 'route' },
        { id: 'e-budget-route', from: 'budget', to: 'route' },
        { id: 'e-route-retnet', from: 'route', to: 'retnet' },
        { id: 'e-route-hybrid', from: 'route', to: 'hybrid' },
        { id: 'e-route-full', from: 'route', to: 'full' },
        { id: 'e-retnet-eval', from: 'retnet', to: 'eval' },
        { id: 'e-hybrid-eval', from: 'hybrid', to: 'eval' },
        { id: 'e-full-eval', from: 'full', to: 'eval' },
      ],
    }, { title: 'A RetNet migration is a route decision' }),
    highlight: { active: ['workload', 'budget', 'route', 'retnet'], found: ['eval'], compare: ['full'] },
    explanation: 'RetNet is attractive when long-context memory is the bottleneck. But the route still depends on exact-recall needs, kernel maturity, quantization, and task slices.',
  };

  yield {
    state: labelMatrix(
      'Fit ledger',
      [
        { id: 'stream', label: 'streaming' },
        { id: 'needle', label: 'needle' },
        { id: 'edge', label: 'edge' },
        { id: 'kernel', label: 'kernel' },
        { id: 'eval', label: 'eval' },
      ],
      [
        { id: 'good', label: 'good' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['fixed S', 'blur'],
        ['maybe', 'exact miss'],
        ['low mem', 'INT drift'],
        ['scan path', 'fallback'],
        ['slice win', 'avg hides'],
      ],
    ),
    highlight: { active: ['stream:good', 'edge:good', 'kernel:good'], compare: ['needle:risk', 'eval:risk'] },
    explanation: 'The production ledger should separate where RetNet should win from where it can fail. Streaming and edge memory are natural fits; exact retrieval and weak kernels are danger zones.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'memory', min: 0, max: 10 }, y: { label: 'recall', min: 0, max: 1 } },
      series: [
        { id: 'frontier', label: 'frontier', points: [
          { x: 1.2, y: 0.58 }, { x: 2.2, y: 0.68 }, { x: 4.5, y: 0.82 }, { x: 7.5, y: 0.91 }, { x: 9.5, y: 0.95 },
        ] },
      ],
      markers: [
        { id: 'ret', x: 1.5, y: 0.62, label: 'RetNet' },
        { id: 'mix', x: 4.6, y: 0.83, label: 'hybrid' },
        { id: 'attn', x: 9.2, y: 0.94, label: 'full attn' },
      ],
    }),
    highlight: { active: ['frontier', 'ret', 'mix'], compare: ['attn'] },
    explanation: 'For product architecture, the right question is not whether attention or retention wins universally. The useful answer is the memory-recall frontier for your workload.',
  };

  yield {
    state: labelMatrix(
      'Failure modes',
      [
        { id: 'gamma', label: 'gamma' },
        { id: 'state', label: 'state cap' },
        { id: 'chunk', label: 'chunk' },
        { id: 'quant', label: 'quant' },
        { id: 'bench', label: 'bench' },
      ],
      [
        { id: 'bug', label: 'bug' },
        { id: 'test', label: 'test' },
      ],
      [
        ['fast', 'QA'],
        ['small', 'needle'],
        ['cut', 'bound'],
        ['drift', 'INT'],
        ['avg', 'slice'],
      ],
    ),
    highlight: { active: ['gamma:test', 'state:test', 'chunk:test', 'quant:test'], found: ['bench:test'] },
    explanation: 'Retention can fail quietly. The evaluation suite needs long QA, needle retrieval, boundary tests, quantized serving sweeps, and protected slices instead of one aggregate score.',
  };

  yield {
    state: chunkGraph('Study RetNet as one branch of the state-budget family'),
    highlight: { active: ['scan', 'read', 'out', 'e-scan-read', 'e-read-out'], found: ['s1', 's2', 's3'], compare: ['c1', 'c2', 'c3'] },
    explanation: 'RetNet completes a useful sequence-model ladder: full attention stores exact KV rows, RWKV and Mamba store recurrent state, RetNet stores decay-weighted retention state, and hybrid systems decide how much exact attention remains.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'retention state') yield* retentionState();
  else if (view === 'execution modes') yield* executionModes();
  else if (view === 'deployment fit') yield* deploymentFit();
  else throw new InputError('Pick a RetNet view.');
}

export const article = {
  sections: [
    {
      heading: 'The memory problem RetNet attacks',
      paragraphs: [
        'RetNet, or Retentive Network, is a sequence-model architecture aimed at one of the central costs of Transformers: attention over growing history. Full self-attention is powerful because the current token can compare itself directly against all previous token keys and values. During inference, that means storing a KV cache that grows with sequence length, layer count, head count, head dimension, and precision. Long contexts and many concurrent users make that cache expensive.',
        'RetNet asks whether a model can keep much of the benefit of attention while carrying a fixed-size recurrent state during decoding. It belongs in the same broad conversation as RWKV, Mamba, Kimi Linear, StreamingLLM, and other attempts to escape the worst parts of unbounded token history. The goal is a hard triangle: parallel training, efficient recurrent inference, and competitive quality.',
        {type:'callout', text:'RetNet turns long token history into a decay-weighted serving state so the same memory rule can train in parallel and decode with bounded cache pressure.'},
      ],
    },
    {
      heading: 'The naive approaches and their limits',
      paragraphs: [
        'The naive answer is to keep full attention. That gives exact access to every previous token, but the KV cache grows with every generated token. This hurts memory, batching, and throughput. A server may have enough compute to generate tokens but not enough accelerator memory to keep long caches for many sessions.',
        'Another naive answer is to use a plain RNN-style hidden state. That gives constant-memory decoding, but classic recurrent models are hard to train at scale and often lose long-range information. The state must carry enough detail for future queries, and gradients must support learning that behavior.',
        'RetNet tries to combine the virtues: a rule that can be trained in parallel like attention, evaluated recurrently like a state model, and executed chunkwise for long sequences. The cost is that old token evidence becomes compressed and decayed rather than exactly addressable.',
      ],
    },
    {
      heading: 'The retention mechanism',
      paragraphs: [
        'The central data structure is a retention state. At each step, the model writes information derived from the current token into the state. Older information decays. The current query reads from the state. You can think of it as a rolling key-value summary rather than a list of all past keys and values.',
        'The same retention rule has multiple execution views. In parallel mode, retention resembles a causal attention computation with decay factors, so training can process many tokens together. In recurrent mode, inference carries state forward token by token. In chunkwise recurrent mode, chunks are processed with parallelism while summaries pass between chunks. This is the architectural trick: one mathematical rule, different schedules for training and serving.',
        'Multi-scale retention uses different decay behavior across heads. Some heads forget quickly and specialize in local syntax or recent features. Others decay slowly and carry longer-horizon information. That multi-scale design matters because a single decay rate would be too blunt. Language has dependencies at many time scales.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'RetNet can work because not every future decision needs exact access to every old token. Much of language modeling depends on compressed state: topic, entities, syntax, discourse, and recent local structure. If the retention state preserves the right information at the right time scale, the model can avoid storing every old KV row while still producing good predictions.',
        'It also works because parallel training is preserved. A pure recurrent model may have attractive inference memory but poor training throughput. RetNet\'s parallel and chunkwise forms are attempts to keep accelerator-friendly training while offering recurrent serving. That distinction is central. Serving efficiency alone is not enough if the architecture is too slow or unstable to train.',
        'The architecture is strongest when memory pressure is the bottleneck. Long-context serving, high-concurrency chat, streaming generation, and edge deployment all care about state size. A fixed or flatter decode state can improve batching and reduce HBM pressure if quality holds.',
      ],
    },
    {
      heading: 'Where it fits',
      paragraphs: [
        'Imagine an always-on assistant that follows a long meeting while answering interruptions. Full attention gives exact access to the transcript but grows a large KV cache for every active user. RetNet offers a different route: store the evolving conversation in retention state, keep decode memory flatter, and reserve retrieval or exact-attention paths for facts that must be quoted.',
        'Another fit is streaming generation where recent and thematic information matter more than exact old spans. A model writing a long story may benefit from persistent character and plot state even if exact early wording is not needed. By contrast, a legal assistant that must quote a clause should not rely only on compressed retention state.',
        'RetNet is therefore best understood as part of a hybrid memory design space. It may be paired with retrieval, local attention, attention sinks, or exact windows. The retention state handles cheap continuity; other mechanisms handle exact evidence.',
      ],
    },
    {
      heading: 'Failure modes',
      paragraphs: [
        'The main failure mode is compressed-history loss. Full attention can directly compare the current query to an old key. RetNet can only use what survived in the retention state. If a name, number, exception, or instruction decays away, the model may answer fluently and incorrectly.',
        'Decay settings and state size are critical. Fast decay can forget too aggressively. Slow decay can preserve stale or irrelevant information. Too little state becomes a bottleneck. Chunk boundaries can create artifacts. Quantization may damage long-horizon state more than short local activations. These are not cosmetic implementation details; they are the memory contract.',
        'The release gate cannot be a single perplexity number. It should include normal short tasks, long-context QA, needle retrieval, quote accuracy, chunk-boundary tests, p95 latency, HBM footprint, quantized serving sweeps, and protected slices where exact recall matters. If lower memory loses decisive facts, the system did not improve for that workload.',
      ],
    },
    {
      heading: 'A worked comparison',
      paragraphs: [
        'Compare three assistants serving 100 concurrent long conversations. A full-attention Transformer keeps a growing KV cache for each conversation and preserves exact old-token access. A sliding-window model keeps only recent exact state and needs retrieval or summaries for old facts. A RetNet-style model carries a retention state that grows much more slowly, giving cheaper continuity but not exact replay of every old token.',
        'The right choice depends on the job. If the assistant must quote old messages, exact cache or retrieval is necessary. If it must maintain conversational continuity and topic state, retention may be enough. If the product is memory-bound and exact old spans are rare, RetNet-like state can improve concurrency. The evaluation should show which case is true, not merely report that the architecture is linear or recurrent.',
      ],
    },
    {
      heading: 'Implementation details that matter',
      paragraphs: [
        'Efficient retention requires good kernels and stable numerics. A theoretical memory advantage can disappear if scans are slow, if chunkwise execution creates overhead, or if quantization damages the state. Serving teams also need to understand how retention state is batched, cached, migrated, and reset between sessions.',
        'Training details matter as well. Multi-scale decay, initialization, normalization, and data mixture all affect what the state learns to preserve. RetNet should be taught as a full architecture, not as a slogan that constant state automatically beats attention.',
      ],
    },
    {
      heading: 'Practical guidance',
      paragraphs: [
        'Evaluate RetNet by workload slice, not by one average score. Include short tasks, long QA, exact quote retrieval, needle tests, streaming continuation, chunk-boundary cases, quantized serving, p95 latency, throughput, and memory per active session. A lower memory curve is useful only if the lost recall is outside the product requirement.',
        'Compare against the real alternatives: full attention, sliding-window attention, retrieval plus a shorter context, attention sinks, hybrid attention-retention layers, and state-space models. The decision is usually not "attention or retention forever." It is how much exact token history the workload needs, how much compressed state it can tolerate, and where external evidence should take over.',
        'Treat retention state as serving state. Define when it resets, how it is copied during request migration, whether it can be quantized, how it is protected between users, and how failures are logged. If the state is opaque and unmeasured, a production incident will be hard to debug because the missing fact was never stored as an inspectable token row.',
      ],
    },
    {
      heading: 'What to remember',
      paragraphs: [
        'RetNet replaces an ever-growing token cache with a decay-weighted retention state. The key idea is not simply recurrence; it is a rule that supports parallel training, recurrent inference, and chunkwise execution.',
        'The tradeoff is exact history versus compressed state. Retention can reduce serving memory only if the state preserves what the task needs. The right comparison measures quality, recall, latency, throughput, memory, and implementation maturity together.',
        'For study, RetNet is useful because it forces a precise vocabulary around memory. A KV cache is explicit token history. A retention state is compressed recurrent history. A retrieval index is external evidence. Modern long-context systems often combine these rather than choosing one forever.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Retentive Network: A Successor to Transformer for Large Language Models at https://arxiv.org/abs/2307.08621, Microsoft Research publication page at https://www.microsoft.com/en-us/research/publication/retentive-network-a-successor-to-transformer-for-large-language-models/, and the Microsoft TorchScale repository at https://github.com/microsoft/torchscale. Recent follow-up context includes A Survey of Retentive Network at https://arxiv.org/abs/2506.06708 and DRetHTR for handwritten text recognition at https://arxiv.org/abs/2602.17387.',
        'Study Attention Mechanism, KV Cache, Transformer Inference Roofline, RWKV Recurrent Transformer, Selective State Space Models: Mamba, Kimi Linear Attention, Hybrid Attention State Budget Case Study, FNet Fourier Token Mixing Case Study, Titans Test-Time Neural Memory Case Study, MatMul-Free Language Modeling, and Benchmark Variance & Model Selection next.',
      ],
    },
  ],
};
