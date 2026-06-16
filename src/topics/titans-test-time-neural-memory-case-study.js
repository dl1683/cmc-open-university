// Titans: neural long-term memory that updates at test time.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'titans-test-time-neural-memory-case-study',
  title: 'Titans Test-Time Neural Memory Case Study',
  category: 'Papers',
  summary: 'A long-context architecture case study: short-term attention, neural long-term memory, persistent parameters, surprise-triggered writes, decay, readback, and reproducibility gates.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['memory write/read', 'architecture audit'], defaultValue: 'memory write/read' },
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

function titanGraph(title) {
  return graphState({
    nodes: [
      { id: 'stream', label: 'stream', x: 0.8, y: 3.8, note: 'chunks' },
      { id: 'core', label: 'core', x: 2.8, y: 2.4, note: 'attention' },
      { id: 'mem', label: 'neural mem', x: 2.8, y: 5.2, note: 'long term' },
      { id: 'persist', label: 'persist', x: 4.8, y: 1.5, note: 'fixed params' },
      { id: 'surprise', label: 'surprise', x: 4.8, y: 5.2, note: 'gradient' },
      { id: 'read', label: 'readback', x: 6.7, y: 3.8, note: 'summary' },
      { id: 'out', label: 'output', x: 8.7, y: 3.8, note: 'next token' },
    ],
    edges: [
      { id: 'e-stream-core', from: 'stream', to: 'core' },
      { id: 'e-stream-mem', from: 'stream', to: 'mem' },
      { id: 'e-core-read', from: 'core', to: 'read' },
      { id: 'e-mem-surprise', from: 'mem', to: 'surprise' },
      { id: 'e-surprise-mem', from: 'surprise', to: 'mem' },
      { id: 'e-mem-read', from: 'mem', to: 'read' },
      { id: 'e-persist-read', from: 'persist', to: 'read' },
      { id: 'e-read-out', from: 'read', to: 'out' },
    ],
  }, { title });
}

function* memoryWriteRead() {
  yield {
    state: titanGraph('Titans splits memory by job'),
    highlight: { active: ['core', 'mem', 'persist', 'read'], found: ['out'], compare: ['stream'] },
    explanation: 'Titans combines short-term attention, a neural long-term memory module, and persistent task parameters. The key move is that long-term memory can update while the model reads a stream.',
    invariant: 'Attention handles precise local context; neural memory stores longer history.',
  };

  yield {
    state: labelMatrix(
      'Three memory roles',
      [
        { id: 'short', label: 'short' },
        { id: 'long', label: 'long' },
        { id: 'persist', label: 'persist' },
        { id: 'external', label: 'external' },
      ],
      [
        { id: 'state', label: 'state' },
        { id: 'write', label: 'write' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['KV/window', 'tokens', 'cache'],
        ['MLP params', 'surprise', 'drift'],
        ['weights', 'training', 'stale'],
        ['logs/RAG', 'system', 'trust'],
      ],
    ),
    highlight: { active: ['short:state', 'long:state', 'persist:state'], found: ['long:write'], compare: ['external:risk'] },
    explanation: 'Do not collapse every memory into one bucket. Titans is model-internal long-term memory; KV cache is short-term attention state; external agent memory is a separate system layer.',
  };

  yield {
    state: graphState({
      nodes: [
        { id: 'input', label: 'new chunk', x: 0.8, y: 3.8, note: 'x_t' },
        { id: 'expect', label: 'memory predicts', x: 2.9, y: 2.4, note: 'expected' },
        { id: 'miss', label: 'miss', x: 4.8, y: 2.4, note: 'error' },
        { id: 'grad', label: 'gradient', x: 4.8, y: 5.2, note: 'surprise' },
        { id: 'write', label: 'write', x: 6.8, y: 5.2, note: 'update' },
        { id: 'decay', label: 'decay', x: 6.8, y: 2.4, note: 'forget' },
        { id: 'mem', label: 'mem params', x: 8.8, y: 3.8, note: 'M_t' },
      ],
      edges: [
        { id: 'e-input-expect', from: 'input', to: 'expect' },
        { id: 'e-expect-miss', from: 'expect', to: 'miss' },
        { id: 'e-miss-grad', from: 'miss', to: 'grad' },
        { id: 'e-grad-write', from: 'grad', to: 'write' },
        { id: 'e-write-mem', from: 'write', to: 'mem' },
        { id: 'e-decay-mem', from: 'decay', to: 'mem' },
        { id: 'e-miss-decay', from: 'miss', to: 'decay' },
      ],
    }, { title: 'Surprise decides what gets written' }),
    highlight: { active: ['miss', 'grad', 'write', 'mem', 'e-miss-grad', 'e-grad-write', 'e-write-mem'], compare: ['decay'] },
    explanation: 'The paper frames surprise through gradients: unexpected information produces a stronger update. Decay and momentum manage finite memory so old state does not absorb every routine token equally.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'stream time', min: 0, max: 10.8 }, y: { label: 'write strength', min: 0, max: 1 } },
      series: [
        { id: 'surprise', label: 'spike', points: [
          { x: 0, y: 0.12 }, { x: 1, y: 0.10 }, { x: 2, y: 0.18 }, { x: 3, y: 0.82 }, { x: 4, y: 0.34 }, { x: 5, y: 0.20 }, { x: 6, y: 0.76 }, { x: 7, y: 0.27 }, { x: 8, y: 0.15 }, { x: 9, y: 0.44 }, { x: 10, y: 0.22 },
        ] },
        { id: 'threshold', label: 'write gate', points: [
          { x: 0, y: 0.5 }, { x: 10, y: 0.5 },
        ] },
      ],
      markers: [
        { id: 'event1', x: 3, y: 0.82, label: 'store' },
        { id: 'event2', x: 6, y: 0.76, label: 'store' },
      ],
    }),
    highlight: { active: ['surprise', 'event1', 'event2'], compare: ['threshold'] },
    explanation: 'The animation primitive is a write gate. Routine tokens stay below threshold; surprising segments trigger stronger memory updates and become available to later chunks.',
  };

  yield {
    state: graphState({
      nodes: [
        { id: 'query', label: 'current q', x: 0.8, y: 3.8, note: 'now' },
        { id: 'mem', label: 'neural mem', x: 2.8, y: 2.5, note: 'past' },
        { id: 'summary', label: 'summary', x: 4.8, y: 2.5, note: 'retrieved' },
        { id: 'window', label: 'window', x: 2.8, y: 5.1, note: 'local' },
        { id: 'attn', label: 'attention', x: 6.7, y: 3.8, note: 'short+long' },
        { id: 'answer', label: 'answer', x: 8.8, y: 3.8, note: 'uses both' },
      ],
      edges: [
        { id: 'e-query-mem', from: 'query', to: 'mem' },
        { id: 'e-mem-summary', from: 'mem', to: 'summary' },
        { id: 'e-query-window', from: 'query', to: 'window' },
        { id: 'e-summary-attn', from: 'summary', to: 'attn' },
        { id: 'e-window-attn', from: 'window', to: 'attn' },
        { id: 'e-attn-answer', from: 'attn', to: 'answer' },
      ],
    }, { title: 'Memory-as-context read path' }),
    highlight: { active: ['mem', 'summary', 'window', 'attn', 'e-summary-attn', 'e-window-attn'], found: ['answer'] },
    explanation: 'In the memory-as-context variant, the model retrieves a compact memory summary and lets attention decide whether that long-term signal is useful for the current chunk.',
  };

  yield {
    state: labelMatrix(
      'Titans variants',
      [
        { id: 'mac', label: 'MAC' },
        { id: 'mal', label: 'MAL' },
        { id: 'mag', label: 'MAG' },
      ],
      [
        { id: 'place', label: 'place' },
        { id: 'benefit', label: 'benefit' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['ctx', 'attn', 'chunks'],
        ['layer', 'deep', 'latency'],
        ['gate', 'blend', 'routing'],
      ],
    ),
    highlight: { active: ['mac:place', 'mal:place', 'mag:place'], found: ['mac:benefit'], compare: ['mac:risk'] },
    explanation: 'The family asks where memory should enter: as extra context, as a layer, or as a gated branch. That placement changes alignment, latency, and failure modes.',
  };
}

function* architectureAudit() {
  yield {
    state: labelMatrix(
      'Sequence memory map',
      [
        { id: 'trans', label: 'Tfm' },
        { id: 'ssm', label: 'SSM' },
        { id: 'titans', label: 'Titans' },
        { id: 'atlas', label: 'ATLAS' },
      ],
      [
        { id: 'memory', label: 'memory' },
        { id: 'read', label: 'read' },
        { id: 'limit', label: 'limit' },
      ],
      [
        ['KV', 'exact', 'n2'],
        ['state', 'comp', 'cap'],
        ['MLP', 'learn', 'repro'],
        ['ctx', 'past', 'new'],
      ],
    ),
    highlight: { active: ['titans:memory', 'titans:read'], compare: ['trans:limit', 'ssm:limit'], found: ['atlas:read'] },
    explanation: 'Titans sits between exact attention and fixed recurrent state. Later ATLAS pushes the same line by optimizing memory from current and past tokens rather than only the latest input.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'context length', min: 0, max: 2200000 }, y: { label: 'needle recall', min: 0, max: 1 } },
      series: [
        { id: 'window', label: 'win', points: [
          { x: 8000, y: 0.92 }, { x: 64000, y: 0.55 }, { x: 256000, y: 0.18 }, { x: 1000000, y: 0.08 }, { x: 2000000, y: 0.04 },
        ] },
        { id: 'state', label: 'state', points: [
          { x: 8000, y: 0.74 }, { x: 64000, y: 0.50 }, { x: 256000, y: 0.36 }, { x: 1000000, y: 0.24 }, { x: 2000000, y: 0.18 },
        ] },
        { id: 'titans', label: 'Titan', points: [
          { x: 8000, y: 0.82 }, { x: 64000, y: 0.78 }, { x: 256000, y: 0.72 }, { x: 1000000, y: 0.67 }, { x: 2000000, y: 0.61 },
        ] },
      ],
      markers: [
        { id: 'twoM', x: 2000000, y: 0.61, label: '2M+' },
      ],
    }),
    highlight: { active: ['titans', 'twoM'], compare: ['window', 'state'] },
    explanation: 'The original paper reports that Titans can scale beyond 2M context on needle-in-haystack tasks. Treat the curve as a claim to verify, not a universal guarantee.',
  };

  yield {
    state: labelMatrix(
      'Implementation state',
      [
        { id: 'chunks', label: 'chunks' },
        { id: 'mem', label: 'mem MLP' },
        { id: 'score', label: 'surprise' },
        { id: 'decay', label: 'decay' },
        { id: 'trace', label: 'trace' },
      ],
      [
        { id: 'stores', label: 'stores' },
        { id: 'audit', label: 'audit' },
      ],
      [
        ['seg', 'bounds'],
        ['params', 'ver'],
        ['grad', 'gate'],
        ['forget', 'cap'],
        ['writes', 'replay'],
      ],
    ),
    highlight: { active: ['chunks:stores', 'mem:stores', 'score:stores', 'decay:stores'], found: ['trace:audit'] },
    explanation: 'A real implementation needs more than an equation: chunk boundaries, memory-parameter versions, surprise scores, decay settings, and a replayable trace of writes.',
  };

  yield {
    state: graphState({
      nodes: [
        { id: 'paper', label: 'paper', x: 0.8, y: 3.8, note: 'claim' },
        { id: 'code', label: 'code', x: 2.7, y: 2.3, note: 'missing?' },
        { id: 'chunk', label: 'chunking', x: 2.7, y: 5.2, note: 'sensitive' },
        { id: 'kernel', label: 'kernels', x: 4.8, y: 2.3, note: 'latency' },
        { id: 'quality', label: 'quality', x: 4.8, y: 5.2, note: 'tasks' },
        { id: 'gate', label: 'ship gate', x: 7.0, y: 3.8, note: 'evidence' },
        { id: 'route', label: 'route', x: 9.0, y: 3.8, note: 'use case' },
      ],
      edges: [
        { id: 'e-paper-code', from: 'paper', to: 'code' },
        { id: 'e-paper-chunk', from: 'paper', to: 'chunk' },
        { id: 'e-code-kernel', from: 'code', to: 'kernel' },
        { id: 'e-chunk-quality', from: 'chunk', to: 'quality' },
        { id: 'e-kernel-gate', from: 'kernel', to: 'gate' },
        { id: 'e-quality-gate', from: 'quality', to: 'gate' },
        { id: 'e-gate-route', from: 'gate', to: 'route' },
      ],
    }, { title: 'Reproducibility and product gates' }),
    highlight: { active: ['code', 'chunk', 'kernel', 'quality', 'gate'], compare: ['paper'], found: ['route'] },
    explanation: 'A later reimplementation warns that missing code, ambiguity, and chunking choices matter. The neural-memory component can help without every Titans configuration beating every baseline.',
  };

  yield {
    state: labelMatrix(
      'Evidence ledger',
      [
        { id: 'orig', label: 'orig' },
        { id: 'google', label: 'G blog' },
        { id: 'atlas', label: 'ATLAS' },
        { id: 'rev', label: 'Revisit' },
      ],
      [
        { id: 'claim', label: 'claim' },
        { id: 'lesson', label: 'lesson' },
      ],
      [
        ['2M', 'claim'],
        ['MIRAS', 'frame'],
        ['10M', 'next'],
        ['mixed', 'caveat'],
      ],
    ),
    highlight: { active: ['orig:claim', 'google:lesson', 'rev:lesson'], compare: ['atlas:claim'] },
    explanation: 'Use a source ledger. Original paper, official research blog, ATLAS extension, and reproducibility critique answer different questions and should not be flattened into one headline.',
  };

  yield {
    state: labelMatrix(
      'Study map',
      [
        { id: 'agent', label: 'Agent' },
        { id: 'kv', label: 'KV' },
        { id: 'rwkv', label: 'RWKV' },
        { id: 'mamba', label: 'Mamba' },
        { id: 'hybrid', label: 'Hybrid' },
      ],
      [
        { id: 'question', label: 'q' },
        { id: 'link', label: 'link' },
      ],
      [
        ['store?', 'inside'],
        ['short?', 'contrast'],
        ['fixed?', 'contrast'],
        ['select?', 'contrast'],
        ['mix?', 'ledger'],
      ],
    ),
    highlight: { found: ['agent:link', 'kv:link', 'rwkv:link', 'mamba:link', 'hybrid:link'] },
    explanation: 'Titans connects model-internal memory to the broader memory curriculum: external agent memory, KV cache, recurrent state, SSM state, and hybrid state budgets.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'memory write/read') yield* memoryWriteRead();
  else if (view === 'architecture audit') yield* architectureAudit();
  else throw new InputError('Pick a Titans test-time memory view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'Titans: Learning to Memorize at Test Time is a sequence-model architecture built around a neural long-term memory module. The paper argues that attention behaves like accurate short-term memory over a limited context window, while neural memory can act as a more persistent long-term store for historical information. Unlike an external vector database, this memory is model-internal: it is a neural module whose parameters can be updated while processing a stream.',
        'The useful teaching sentence is simple: Titans tries to avoid choosing between exact but expensive attention and cheap but compressed recurrent state. It keeps local attention for the current chunk, writes surprising information into neural memory, and reads that memory back when later chunks need older context.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The long-term memory is trained as an online learning problem. Incoming chunks are compared against what the memory already represents. A surprise signal, expressed through gradients in the associative-memory objective, decides how strongly new information should update the memory. Momentum carries recent surprise forward, and decay acts as controlled forgetting so finite memory does not accumulate every routine token with equal force.',
        'The architecture also includes persistent memory: learned, data-independent parameters that encode task-level knowledge. The Titans paper presents three placement variants. Memory-as-Context retrieves memory summaries into attention context. Memory-as-Layer injects memory as a layer. Memory-as-Gate blends memory through a gated branch. Each placement changes the latency, alignment, and failure surface.',
      ],
    },
    {
      heading: 'Complete case study: long document triage',
      paragraphs: [
        'Imagine a model reading a multi-million-token legal archive or genomic sequence. Full attention over every token is too expensive, while a fixed-size recurrent state may compress away the one clause or mutation that matters. A Titans-style model chunks the stream. Local attention handles the current segment. The neural memory writes high-surprise facts into long-term parameters. Later chunks query that memory and pass retrieved summaries into the current attention window.',
        'A production system would still need ordinary engineering scaffolding: deterministic chunk boundaries, memory-version IDs, surprise-score logs, decay settings, replayable write traces, protected evaluation slices, and route telemetry showing when the memory path was used. Without those, the memory can become impossible to debug even if benchmark scores look good.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The original arXiv abstract reports stronger results than Transformers and recent linear recurrent models across language modeling, common-sense reasoning, genomics, and time-series tasks, and says Titans can scale beyond 2M context on needle-in-haystack evaluations. The systems promise is that local attention plus trainable memory can avoid the quadratic context wall while preserving more long-range detail than a simple fixed state.',
        'The caveat is implementation reality. Test-time memory updates are not free; they add optimizer-like state, write rules, decay behavior, and possible latency. The memory path also needs kernels and batching behavior that survive real serving. A 2025 reimplementation reports mixed baseline comparisons due to chunking, while still finding that the Neural Memory component consistently improved over attention-only models.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'Titans is not the same thing as KV Cache, RAG, or agent memory. KV cache stores exact short-term attention keys and values. RAG retrieves external documents. Agent memory persists traces and notes outside the model. Titans updates an internal neural memory module during the forward stream. These can be combined, but they have different provenance, trust, privacy, and debugging rules.',
        'Do not convert the paper into a universal claim that attention is obsolete. Chunking choices, code availability, ambiguity in implementation details, evaluation tasks, and hardware kernels all matter. The safer statement is that test-time neural memory is an important design point in the sequence-memory search space, and it deserves the same route-level validation as Mamba, RWKV, FNet, and hybrid attention budgets.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Titans at https://arxiv.org/abs/2501.00663, Google Research on Titans and MIRAS at https://research.google/blog/titans-miras-helping-ai-have-long-term-memory/, ATLAS at https://arxiv.org/abs/2505.23735, and Titans Revisited at https://arxiv.org/abs/2510.09551. Study Agent Memory & Context Engineering, Attention Mechanism, KV Cache, Hybrid Attention State Budget Case Study, RWKV Recurrent Transformer, Selective State Space Models: Mamba, FNet Fourier Token Mixing Case Study, Transformer Inference Roofline, LLM Inference Scaling Playbook, and Benchmark Variance & Model Selection next.',
      ],
    },
  ],
};
