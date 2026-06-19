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
      heading: 'How to read the animation',
      paragraphs: [
        "Read the animation as the execution trace for Titans Test-Time Neural Memory Case Study. A long-context architecture case study: short-term attention, neural long-term memory, persistent parameters, surprise-triggered writes, decay, readback, and reproducibility gates..",
        "Active items are the current decision point. Visited markers are state that is already ruled out by proof, not by taste.",
        "Found markers are outcomes now guaranteed true. If this is not visible, the animation can mislead.",
        "At each frame, ask what changed, why that move is legal, and where the idea is strong or fragile.",
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        `Long-context modeling keeps running into the same tradeoff. Full attention can connect a token to every earlier token in the window, which makes it precise, but its memory and compute grow badly as the context grows. Recurrent and state-space models are cheaper over long streams, but they compress history into a fixed-size state. That state can forget details that become important much later.`,
        `Titans: Learning to Memorize at Test Time is a paper about escaping that forced choice. It treats attention as accurate short-term memory and introduces a neural long-term memory module that can update while the model processes a stream. The goal is not merely to increase the context window. The goal is to give the model a trainable internal place to write useful historical information and read it back later.`,
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        `The first obvious approach is to make attention windows larger. This preserves exact token-to-token access, and for many tasks it is the cleanest solution. The wall is cost. A model that attends over millions of tokens must move and compare enormous key-value state, and the serving system must pay for that state on every long request.`,
        `The second obvious approach is external memory: retrieval, notes, tool logs, vector databases, or agent memory. That works well when the relevant facts can be stored and fetched as documents. But external memory is a system layer, not the model\'s own sequence mechanism. It has retrieval errors, permission boundaries, stale indexes, citation requirements, and latency. Titans asks a different question: can the model update an internal neural memory at test time while reading the sequence itself?`,
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        `Fixed recurrent state and state-space memory provide another path. They scan efficiently, so length grows more gently than full attention. The cost is capacity and selectivity. Once old information has been compressed into a fixed vector or matrix, the model must hope that the future query only needs what the state retained. If a rare detail looks unimportant now but becomes important 100,000 tokens later, the compression may have already destroyed it.`,
        `This is the long-context wall Titans is trying to move. Exact attention keeps too much and becomes expensive. Fixed state keeps too little and can forget. External retrieval keeps information outside the model and requires a separate indexing discipline. The missing design point is a model-internal memory that can be written selectively, read later, and trained with the sequence model rather than bolted on as a post hoc retrieval system.`,
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        `Titans separates memory by job. Short-term attention handles the current local context. Persistent parameters store ordinary learned knowledge from training. Neural long-term memory stores stream-specific information by updating a memory module during inference. That last piece is the unusual one: the model is not only reading activations; it is changing a learned memory state as it encounters new context.`,
        `The write signal is based on surprise. If the memory already predicts or represents the incoming chunk well, the update can be small. If the chunk is unexpected, the gradient signal is stronger, and the memory changes more. Momentum and forgetting mechanisms shape how writes accumulate and decay. The idea is close to an online learner embedded inside the sequence model: ordinary tokens pass through, but surprising information applies pressure to the long-term memory.`,
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        `A stream is processed in chunks. Local attention handles the near context. In parallel, the neural memory module receives information from the current chunk and produces a memory readout that can help later computation. The memory module is often described as an MLP-like associative memory rather than a simple vector slot. Its parameters or state are updated by a test-time learning rule derived from how poorly the memory handled the new input.`,
        `The Titans family explores several placements for this memory. Memory-as-Context retrieves memory output and feeds it into the attention context, letting attention decide how to combine short-term and long-term information. Memory-as-Layer inserts memory as a layer inside the network. Memory-as-Gate uses a gated branch to blend memory with the main path. These are not cosmetic variants. Placement changes latency, alignment, batching behavior, interpretability, and what kind of failure is easiest to diagnose.`,
        `Persistent memory is a separate role. It is not updated per stream; it is learned during training and carries task-level knowledge, much like ordinary parameters or persistent tokens. Keeping persistent, short-term, and long-term memory separate matters because their trust and debugging rules differ. KV cache can be inspected as recent attention state. RAG can be audited through source documents. Test-time neural memory needs write traces, chunk boundaries, surprise scores, decay settings, and replayable evaluation cases.`,
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        `The argument is not a classic algorithm proof. Titans is a learned architecture, so the question is whether the memory decomposition gives optimization a useful shape. Attention is good at exact local dependencies. A neural memory module can have more expressive capacity than a fixed recurrent vector. Surprise-based writes prioritize information that the current memory failed to predict, so routine context should consume less memory pressure than unusual details.`,
        `That division also matches a common long-context need. Many future questions do not require every old token; they require a compressed but queryable representation of facts, entities, patterns, or anomalies that appeared earlier. If the memory learns what to preserve and how to retrieve it, the model can avoid paying exact-attention cost over the whole history while still using older information when it matters.`,
      ],
    },
    {
      heading: 'Cost and behavior',
      paragraphs: [
        `The paper reports strong results across language modeling, common-sense reasoning, genomics, and time-series tasks, including needle-in-haystack experiments beyond 2M context. Treat that as a research claim to be evaluated in context, not as a guarantee that every Titans-style model beats every Transformer on every workload.`,
        `The cost advantage comes from avoiding full attention over the entire history. Local attention plus memory can be cheaper than comparing every token with every previous token. But test-time memory is not free. It adds write rules, gradient-like updates, memory state, decay, momentum, and extra implementation paths. Serving systems also care about batching, kernel fusion, cache locality, determinism, and whether memory updates make requests harder to parallelize.`,
        `A later reimplementation and critical analysis reported that the lack of public code and under-specified details made reproduction difficult, and that Titans did not always beat established baselines because chunking choices mattered. The same analysis still found that the neural memory component improved over attention-only models in its setting. That is the right level of confidence: promising mechanism, not settled replacement.`,
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        `Imagine a model reading a multi-million-token legal archive, clinical timeline, source-code history, or genomic sequence. Full attention over the entire stream is expensive. A fixed state-space model may compress away the single clause, event, mutation, or function definition that later becomes decisive. A RAG system could index the material externally, but then the answer depends on retriever quality and source-management infrastructure.`,
        `A Titans-style route chunks the stream. Local attention handles the current segment. The neural memory writes high-surprise information into long-term memory. Later chunks query that memory and combine the readout with the current window. If the system is built well, the model can remember old stream-specific details without dragging every old token through attention.`,
        `A product implementation would still need strict scaffolding. Chunk boundaries must be deterministic. Memory versions must be logged. Surprise scores should be inspectable. Decay settings must be part of the run configuration. Evaluation should include protected recall slices and adversarial cases where the relevant fact appears early, looks unimportant, and becomes useful only much later. Otherwise the memory path becomes another opaque source of benchmark variance.`,
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        `Titans is most useful as a design point for very long streams where exact attention is too expensive and fixed compression is too lossy: long documents, event streams, time series, genomics, code history, and agent trajectories. It is also useful as a conceptual bridge between model-internal memory and external memory systems, because it forces the engineer to ask what should be remembered by the model itself versus by a searchable corpus.`,
        `It is the wrong tool when exact source provenance is required, when updates must be reversible and inspectable at the document level, or when a simpler long-context Transformer fits the latency and cost budget. It is also risky when implementation details are unresolved. Chunking, memory capacity, write frequency, recurrence, kernel quality, and evaluation design can decide whether the architecture helps or merely adds moving parts.`,
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        `Primary sources: Titans at https://arxiv.org/abs/2501.00663, Google Research on Titans and MIRAS at https://research.google/blog/titans-miras-helping-ai-have-long-term-memory/, ATLAS at https://arxiv.org/abs/2505.23735, and Titans Revisited at https://arxiv.org/abs/2510.09551. Study Attention Mechanism and KV Cache for short-term memory, RWKV Recurrent Transformer and Selective State Space Models: Mamba for compressed sequence state, RAG Pipeline and Agent Memory & Context Engineering for external memory, and Benchmark Variance & Model Selection for the evaluation traps around long-context claims.`,
      ],
    },
      {
      heading: 'Where it fails',
      paragraphs: [
        "List the failure modes and the conditions that trigger them.",
        "Most methods have at least one silent failure mode; expose the silent ones.",
        "A method without explicit failure conditions is an invitation for misuse.",
      ],
    },


      {
        heading: 'Sources and study next',
        paragraphs: [
          'Read one primary source, one implementation source, and one production case where this idea appears.',
          'If they disagree on a detail, prefer the source with the clearest constraint and define the simplification for this animation.',
          'Then choose three study topics: one prerequisite, one extension, and one case study for your next session.',
        ],
      },

      {
        heading: 'Learning map',
        paragraphs: [
          'Before this topic, unlock all prerequisites and define the required preconditions.',
          'After this topic, trace where this idea appears in one larger path on this site.',
          'Use unlock relationships to keep one path and one checkpoint per review cycle.',
        ],
      },

      {
        heading: 'Micro checks',
        paragraphs: [
          {
            type: 'bullets',
            items: [
              'Can you state one invariant in one sentence?',
              'Can you prove one transition with pre and post state?',
              'Can you name one hidden edge case in one line?',
              'Can you transfer this mechanism to a neighboring domain?',
            ],
          },
        ],
      },

      {
        heading: 'Try this now',
        paragraphs: [
          'Build one input manually and predict every step before running the animation.',
          'If your predicted final state matches the animation for titans-test-time-neural-memory-case-study, continue to the next topic in the same track.'
  ],
      },
],
};
