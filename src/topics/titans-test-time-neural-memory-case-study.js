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
        'The memory write/read view traces a single stream through the Titans pipeline: chunking, surprise scoring, memory update, decay, and readback. Active nodes are the component currently executing. Found nodes are outputs already produced. Compare nodes highlight the alternative path the architecture chose not to take.',
        'The architecture audit view places Titans against Transformers, SSMs, and ATLAS on the same axes. Active series are the Titans curves. Compare series are the baselines. Markers flag the context lengths where the gap matters.',
        {type:'callout', text:'Titans is easiest to audit when every memory write is tied to the surprise signal that caused it.'},
        {
          type: 'note',
          text: 'At each frame, ask: what state changed, what triggered the change, and what would break if the trigger were removed. The surprise-gated write is the central mechanism -- every other component exists to support or constrain it.',
        },
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Sequence models need memory. The question is where to put it and how to manage it. Full attention stores every past token as a key-value pair and lets the current token compare against all of them. This is precise but quadratic: doubling the context quadruples the compute. A 2-million-token context under full attention is not a scaling challenge -- it is a serving impossibility at most budgets.',
        'Recurrent models (LSTMs, GRUs) and state-space models (Mamba, RWKV) compress history into a fixed-size hidden state. This makes length cheap, but the state is a bottleneck. A rare fact buried 500,000 tokens ago has to survive compression through every intervening token. If the model did not know the fact would matter later, the state may have overwritten it.',
        {
          type: 'quote',
          attribution: 'Ali Behrouz, Peilin Zhong, Vahab Mirrokni -- Titans (January 2025)',
          text: 'We introduce a neural long-term memory module that learns to memorize at test time. The memory module is an associative memory that can be updated, forgotten, and retrieved during inference.',
        },
        'External memory -- RAG pipelines, vector databases, tool logs -- solves a different problem. It keeps facts outside the model and retrieves them on demand. That works when the relevant documents can be indexed, but it adds retrieval latency, stale-index risk, and a separate engineering surface. Titans asks whether the model itself can maintain a trainable internal memory that updates as it reads.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The first obvious move is to make attention windows longer. Context-window extensions from 4K to 128K to 1M tokens have been the dominant strategy since 2023. This preserves exact token-level access, which matters for tasks like needle-in-a-haystack retrieval. The cost is direct: KV cache memory grows linearly with context length, and attention compute grows quadratically (or linearly with sparse/flash variants, but with approximation tradeoffs).',
        'The second obvious move is fixed recurrent state. Mamba uses a selective state-space mechanism that scans the sequence in linear time. RWKV uses a linear-attention recurrence. Both avoid the quadratic wall. But their state is fixed-size: a d-dimensional vector or low-rank matrix that must encode everything the model might need later.',
        {
          type: 'table',
          headers: ['Strategy', 'State type', 'Read cost', 'Capacity wall'],
          rows: [
            ['Full attention', 'KV cache (all past tokens)', 'O(n) per query', 'Memory grows with n'],
            ['Sliding window', 'KV cache (recent w tokens)', 'O(w) per query', 'Cannot see beyond window'],
            ['SSM (Mamba)', 'Fixed-size state vector', 'O(1) per query', 'State capacity bounded by d'],
            ['External RAG', 'Vector index + retriever', 'Retrieval latency', 'Index freshness, retriever errors'],
          ],
        },
        'Each strategy trades one resource for another. Titans tries to occupy the gap between "keep everything" and "compress everything" by adding a learnable memory that selectively stores what surprised the model.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is not compute alone -- it is the mismatch between when information arrives and when it becomes useful. A legal contract mentions a liability cap in clause 4. The model processes 800,000 tokens of routine language. Then clause 847 triggers a question about the cap. Full attention can find clause 4 because it is still in the KV cache. An SSM may have overwritten clause 4 because nothing at the time flagged it as important.',
        'This is the selective-persistence problem. The model needs to keep facts that are rare and potentially important without knowing in advance which rare facts will matter. Fixed-size state cannot do this reliably because the state has no mechanism to prioritize surprise over recency. Attention can do it but only by paying to store every token.',
        {
          type: 'note',
          text: 'The wall is not "attention is slow." The wall is that no existing mechanism cheaply stores rare, potentially important facts for later retrieval without either storing everything or risking lossy compression. Titans attacks this specific gap.',
        },
        'Concrete evidence of the wall: on the S-NIAH (simplified needle-in-a-haystack) number-retrieval benchmark at 16K context, Mamba2 scores 0.0% -- it completely loses the needle. DeltaNet scores 5.4%. TTT-Linear scores 4.4%. The fixed state overwrites the needle because the surrounding haystack tokens are more recent.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Embed a small neural network inside the model whose weights are the long-term memory. Train the outer model to learn when and how to update that inner network. At test time, the inner network runs online gradient descent: tokens that surprise it produce large gradients, which write strongly into memory. Tokens the memory already predicts produce small gradients and write weakly or not at all.',
        {
          type: 'diagram',
          alt: 'Titans memory decomposition into three roles',
          label: 'Three memory systems, three update rules',
          body: [
            'Persistent memory          Short-term memory          Long-term neural memory',
            '(learned at training)       (KV cache / window)        (updated at test time)',
            '       |                          |                           |',
            '       |  frozen at inference      |  exact but bounded        |  surprise-gated writes',
            '       |                          |                           |',
            '       +------------- combined at readback -------------------+',
            '                              |',
            '                              v',
            '                         output token',
          ].join('\n'),
          text: 'Persistent memory (frozen at inference) + short-term attention (exact but bounded) + long-term neural memory (surprise-gated writes) combine at readback to produce each output token.',
        },
        'The separation matters because each memory type has different trust properties. Persistent memory is stable and auditable -- it is just model weights. Short-term memory is exact and inspectable -- it is the KV cache. Long-term neural memory is the new, harder-to-audit component: it changes during inference based on what the model found surprising, and its contents are distributed across MLP weights rather than stored as discrete key-value pairs.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The neural memory module is a small MLP (typically 2 layers with SiLU activation and 4x hidden expansion). Its weights are the memory. At each timestep, the module receives a key-value pair derived from the current input. The loss measures how well the current memory predicts the expected value from the key:',
        {
          type: 'code',
          language: 'text',
          body: [
            'Loss at time t:',
            '  l(M, x_t) = || M(k_t) - v_t ||^2',
            '',
            'where k_t = x_t * W_K,  v_t = x_t * W_V',
            '',
            'Memory update (gradient descent with momentum + weight decay):',
            '  S_t = eta_t * S_{t-1} - theta_t * grad_l(M_{t-1}; x_t)',
            '  M_t = (1 - alpha_t) * M_{t-1} + S_t',
            '',
            'Retrieval:',
            '  q_t = x_t * W_Q',
            '  y_t = M_t(q_t)    -- forward pass, no weight update',
          ].join('\n'),
        },
        'Three data-dependent gates control the update. theta_t is the learning rate: how strongly momentary surprise writes into memory. eta_t is the momentum decay: how much past surprise carries forward. alpha_t is the forgetting gate: how much old memory is erased before the new write. All three are functions of the current input, so the model learns when to write hard, when to coast on momentum, and when to forget.',
        {
          type: 'note',
          text: 'This is literally SGD with momentum and weight decay, running inside the forward pass. The "inner network" (memory MLP) is being trained online by the "outer network" (the rest of the model). The outer network learned the update rules during training; the inner network applies them at inference.',
        },
        'The Titans family offers three ways to connect the memory output to the rest of the model:',
        {
          type: 'table',
          headers: ['Variant', 'Full name', 'Integration', 'Strength', 'Risk'],
          rows: [
            ['MAC', 'Memory as Context', 'Memory output concatenated as extra context tokens for attention', 'Best long-context recall (attention decides relevance)', 'Chunk boundaries affect what memory sees'],
            ['MAL', 'Memory as Layer', 'Memory output replaces input before attention processes it', 'Simplest implementation', 'Memory errors propagate directly into attention'],
            ['MAG', 'Memory as Gate', 'Memory and attention run in parallel, combined via element-wise gating', 'No chunking required, smooth blending', 'Gating can suppress useful memory signals'],
          ],
        },
        'MAC processes the stream in fixed-size chunks. For each chunk, it retrieves a memory summary, prepends it (along with persistent memory tokens) to the chunk, and runs attention over the combined context. After attention, the memory is updated with the output. This is the strongest variant for long-range retrieval because attention explicitly decides how much weight to give the memory summary versus the local tokens.',
        'Persistent memory tokens are a separate set of learnable vectors (typically 4-16) that are prepended to the input but never updated per-stream. They carry task-level priors learned during training -- analogous to soft prompts that encode "how to use this model" rather than "what happened in this stream."',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The correctness argument is not a formal proof -- Titans is a learned system, not an algorithm with loop invariants. The argument is architectural: the memory decomposition gives optimization a useful shape that no single memory mechanism provides alone.',
        {
          type: 'bullets',
          items: [
            'Surprise-gated writes act as an information filter. Routine tokens produce small gradients and weak writes. Novel or unexpected tokens produce large gradients and strong writes. This means the memory allocates its finite capacity to the information most likely to be missing from the model\'s existing predictions.',
            'Momentum accumulates evidence across time. A single surprising token might be noise, but sustained surprise across several tokens builds a stronger write signal. This is the same principle that makes SGD with momentum more robust than vanilla SGD.',
            'Weight decay prevents the memory from filling up with stale associations. Without it, early writes would persist indefinitely and crowd out later, more relevant information.',
            'The MLP structure stores associations distributed across weights, not in discrete slots. A 2-layer MLP with 4x hidden expansion has capacity proportional to d_k * d_v (ATLAS lower bound), which grows with model dimension rather than being fixed.',
          ],
        },
        'The MIRAS framework (Google Research, December 2025) later showed that Transformers, Mamba, RWKV, DeltaNet, and Titans can all be viewed as different associative memory modules that differ in four design choices: memory architecture, attentional bias, retention gate, and memory algorithm. Under this lens, Titans is not a novel primitive but a specific, well-motivated point in the design space: deep MLP architecture, surprise-based bias, data-dependent retention, and gradient-descent-with-momentum as the algorithm.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Within each chunk of b tokens, the memory weights are frozen at the chunk-start value, and gradients are computed in parallel. The memory update across chunks is sequential. This means per-chunk compute is parallelizable (like attention within a window), but cross-chunk memory updates introduce a serial dependency.',
        {
          type: 'table',
          headers: ['Component', 'Time cost', 'Memory cost', 'Parallelizable?'],
          rows: [
            ['Local attention (window w)', 'O(n * w)', 'O(w) KV cache', 'Yes, within window'],
            ['Memory write (per chunk)', 'O(b * d^2) for MLP gradient', 'O(d^2) MLP weights', 'Yes, within chunk'],
            ['Memory read (per chunk)', 'O(d^2) forward pass', 'O(d) output vector', 'Yes'],
            ['Cross-chunk update', 'O(n/b) sequential steps', 'O(d^2) carried state', 'No -- serial'],
          ],
        },
        'The key tradeoff: larger chunks mean fewer serial memory updates but less frequent writes, so the memory reacts more slowly to new information. Smaller chunks mean more frequent writes but more serial steps. The paper does not specify the chunk size used in experiments -- this is one of the reproducibility gaps.',
        {
          type: 'note',
          text: 'Test-time memory is not free. Each chunk requires a backward pass through the memory MLP to compute gradients, plus forward passes for retrieval. This is cheaper than full attention over millions of tokens, but more expensive than a simple recurrent scan. The engineering cost also includes memory-state checkpointing, deterministic chunk boundaries, and the inability to batch requests with different memory histories.',
        },
        'At 760M parameters trained on 30B tokens from FineWeb-Edu, Titans MAG achieves 18.61 WikiText perplexity versus 25.21 for Transformer++ and 22.94 for Mamba2. On common-sense benchmarks (PIQA, HellaSwag), Titans MAC scores 70.46 and 49.01 versus 66.92 and 42.19 for Transformer++. These are meaningful gaps at the same parameter count, but they are measured on the paper\'s own training setup. Independent reproduction is limited.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'A 760M-parameter Titans MAC model processes a 16,000-token stream containing a hidden passkey (a specific number embedded in filler text). The stream is split into chunks of b tokens.',
        {
          type: 'code',
          language: 'text',
          body: [
            'Stream: [filler...filler | passkey: 7429 | filler...filler | "what was the passkey?"]',
            '         chunk 1-5          chunk 6          chunk 7-30        chunk 31',
            '',
            'Chunk 6 processing:',
            '  k_6 = chunk_6 * W_K     -- project chunk into key space',
            '  v_6 = chunk_6 * W_V     -- project chunk into value space',
            '  loss = || M_5(k_6) - v_6 ||^2   -- memory predicts poorly (high loss)',
            '  grad = d(loss)/d(M_5)            -- large gradient (high surprise)',
            '  S_6 = eta * S_5 - theta * grad   -- strong surprise signal',
            '  M_6 = (1 - alpha) * M_5 + S_6    -- passkey written into memory',
            '',
            'Chunks 7-30 processing:',
            '  Filler tokens -> low surprise -> weak writes -> passkey persists',
            '  Weight decay slowly erodes M, but passkey gradient was strong',
            '',
            'Chunk 31 (query):',
            '  q_31 = "what was the passkey?" * W_Q',
            '  y_31 = M_30(q_31)    -- retrieve from memory -> "7429"',
            '  Attention combines y_31 with local context -> output: 7429',
          ].join('\n'),
        },
        'On this exact benchmark (S-NIAH passkey retrieval at 16K context), Titans MAC scores 98.4%. Mamba2 scores 5.4%. The difference is the write mechanism: Mamba2\'s fixed state has no way to flag the passkey as special when it appears, so subsequent filler tokens overwrite it. Titans\' surprise gate fires on the passkey because the memory MLP fails to predict it, producing a large gradient that writes it durably.',
        {
          type: 'table',
          headers: ['Model', '2K', '4K', '8K', '16K'],
          rows: [
            ['Titans MAC', '99.6%', '98.2%', '97.6%', '97.4%'],
            ['Titans MAG', '99.2%', '98.8%', '97.2%', '98.6%'],
            ['TTT-Linear', '60.2%', '36.6%', '10.2%', '4.4%'],
            ['Mamba2', '98.4%', '55.8%', '14.2%', '0.0%'],
            ['DeltaNet', '47.2%', '15.4%', '12.8%', '5.4%'],
          ],
        },
        'The table above shows S-NIAH number retrieval. The collapse pattern is stark: models without selective write mechanisms degrade rapidly as context grows, while Titans maintains above 97% recall. This is the surprise gate earning its complexity.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        {
          type: 'bullets',
          items: [
            'Long-document understanding: legal archives, clinical timelines, codebases, and patent corpora where a single fact buried deep in the history determines the answer. Full attention is too expensive; fixed state is too lossy; Titans-style memory offers a middle path.',
            'Genomic sequence modeling: the paper reports competitive results on enhancer classification (75.2% vs. HyenaDNA 74.2%) and non-TATA promoter detection (96.6%, matching HyenaDNA). DNA sequences are long, have sparse functional regions, and reward selective memory.',
            'Time-series forecasting: neural memory outperforms iTransformer on ETTm1 (0.358 vs. 0.407 MSE) and ETTm2 (0.261 vs. 0.291 MSE). Time series have the same structure as the passkey problem: rare regime changes embedded in routine fluctuation.',
            'Agent trajectory memory: an agent processing a long tool-use history could use neural memory to retain surprising tool outputs without storing the entire execution trace in context.',
          ],
        },
        'The common thread is long streams with sparse, unpredictable importance. If every token matters equally, full attention is the right tool. If importance is concentrated and predictable, a retrieval system with a good index works. Titans-style memory is strongest when importance is concentrated but unpredictable -- the model must decide what to store as it reads, not after the fact.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        {
          type: 'table',
          headers: ['Failure mode', 'Trigger', 'Why it is hard to detect'],
          rows: [
            ['Silent overwrite', 'Sustained moderately-surprising input erodes an earlier strong write', 'No discrete "delete" event; the old association fades as weight decay and new writes accumulate'],
            ['Chunk-boundary sensitivity', 'The important token falls at a chunk boundary and splits across two weak-gradient contexts', 'The same content produces different memory states depending on where chunking lands'],
            ['Surprise miscalibration', 'A genuinely important fact looks routine to the memory MLP (low loss)', 'The write gate never fires; the fact is never stored; downstream recall silently fails'],
            ['Reproducibility gap', 'Unspecified hyperparameters (chunk size, gate parameterization, persistent token count)', 'Two implementations of "Titans" can produce different results and both claim fidelity to the paper'],
          ],
        },
        'The "Titans Revisited" paper (Kacperski et al., October 2025) performed a clean-room reimplementation and found that Titans MAC failed to beat BERT4Rec on the MovieLens 1M recommendation task. The neural memory component consistently improved over attention-only baselines, but the full Titans system did not universally dominate. Chunking was identified as the primary source of performance degradation: larger chunks helped but increased compute cost.',
        {
          type: 'quote',
          attribution: 'Kacperski et al. -- Titans Revisited (October 2025)',
          text: 'The lack of publicly available code and under-specified design choices made reproduction difficult. Titans did not always beat established baselines, but the neural memory component consistently improved over attention-only models.',
        },
        'The deepest failure mode is trust. KV cache entries can be inspected: you can read the key-value pairs and trace which tokens produced them. RAG retrievals can be audited: you can see which documents were fetched and verify their content. Neural memory weights are distributed and opaque. If the model retrieves the wrong fact from memory, diagnosing whether the write was too weak, the decay was too aggressive, or the retrieval query was misaligned requires instrumenting the entire memory pipeline -- surprise scores, gradient norms, weight snapshots per chunk. Without that instrumentation, neural memory is a black box inside a black box.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        {
          type: 'table',
          headers: ['Source', 'What it covers', 'Link'],
          rows: [
            ['Titans (Behrouz, Zhong, Mirrokni, Jan 2025)', 'Original architecture, equations, benchmarks', 'https://arxiv.org/abs/2501.00663'],
            ['Google Research Blog: Titans + MIRAS (Dec 2025)', 'MIRAS unifying framework, Moneta/Yaad/Memora derived models', 'https://research.google/blog/titans-miras-helping-ai-have-long-term-memory/'],
            ['ATLAS (Behrouz et al., May 2025)', 'Muon optimizer, Omega rule, context-window memory optimization', 'https://arxiv.org/abs/2505.23735'],
            ['Titans Revisited (Kacperski et al., Oct 2025)', 'Clean-room reimplementation, reproducibility analysis, failure cases', 'https://arxiv.org/abs/2510.09551'],
          ],
        },
        {
          type: 'bullets',
          items: [
            'Prerequisite: study Attention Mechanism to understand the KV cache and quadratic cost that Titans works around. Study Selective State Space Models: Mamba to understand the fixed-state alternative that Titans improves on.',
            'Extension: study ATLAS to see how second-order optimization (Muon) and context-window loss functions push neural memory further, achieving 80%+ accuracy at 10M context.',
            'Contrast: study RAG Pipeline and Agent Memory & Context Engineering to compare model-internal memory against external retrieval systems. The trust, auditability, and latency tradeoffs are fundamentally different.',
            'Evaluation: study Benchmark Variance & Model Selection to understand why long-context claims require needle-in-haystack, BABILong, and adversarial recall slices rather than perplexity alone.',
          ],
        },
      ],
    },
  ],
};
