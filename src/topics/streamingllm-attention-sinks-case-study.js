// StreamingLLM: keep a small set of initial "sink" KV tokens plus a rolling
// recent window so finite-window LLMs can stream long conversations.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'streamingllm-attention-sinks-case-study',
  title: 'StreamingLLM Attention Sinks Case Study',
  category: 'Papers',
  summary: 'StreamingLLM keeps attention-sink tokens and a rolling KV window, avoiding full-cache growth while preserving stable long-stream generation.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['sink window', 'cache eviction', 'serving ledger'], defaultValue: 'sink window' },
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

function cacheGraph(title) {
  return graphState({
    nodes: [
      { id: 'prompt', label: 'stream', x: 0.8, y: 3.8, note: 'tokens arrive' },
      { id: 'sink0', label: 'sink 0', x: 2.6, y: 2.2, note: 'initial KV' },
      { id: 'sink1', label: 'sink 1', x: 2.6, y: 5.4, note: 'initial KV' },
      { id: 'recent', label: 'recent window', x: 5.0, y: 3.8, note: 'last W tokens' },
      { id: 'evict', label: 'evict middle', x: 7.1, y: 5.4, note: 'drop old' },
      { id: 'attn', label: 'attention', x: 7.1, y: 2.2, note: 'sink + recent' },
      { id: 'next', label: 'next token', x: 9.2, y: 3.8, note: 'stable stream' },
    ],
    edges: [
      { id: 'e-prompt-sink0', from: 'prompt', to: 'sink0' },
      { id: 'e-prompt-sink1', from: 'prompt', to: 'sink1' },
      { id: 'e-prompt-recent', from: 'prompt', to: 'recent' },
      { id: 'e-recent-evict', from: 'recent', to: 'evict' },
      { id: 'e-sink0-attn', from: 'sink0', to: 'attn' },
      { id: 'e-sink1-attn', from: 'sink1', to: 'attn' },
      { id: 'e-recent-attn', from: 'recent', to: 'attn' },
      { id: 'e-attn-next', from: 'attn', to: 'next' },
    ],
  }, { title });
}

function* sinkWindow() {
  yield {
    state: cacheGraph('Attention sinks plus a rolling window'),
    highlight: { active: ['sink0', 'sink1', 'recent', 'e-sink0-attn', 'e-sink1-attn', 'e-recent-attn'], found: ['attn', 'next'] },
    explanation: 'StreamingLLM keeps the KV cache for a few initial tokens and the most recent tokens. The middle of the long stream is evicted, but the model still has the sink positions it expects and the local context it needs.',
    invariant: 'The cache is bounded: sink count plus recent window size, not total conversation length.',
  };

  yield {
    state: labelMatrix(
      'KV cache layout',
      [
        { id: 'first', label: 'first tokens' },
        { id: 'middle', label: 'middle history' },
        { id: 'recent', label: 'recent tokens' },
        { id: 'new', label: 'new token' },
      ],
      [
        { id: 'policy', label: 'policy' },
        { id: 'reason', label: 'reason' },
      ],
      [
        ['pin', 'attention sink'],
        ['evict', 'bounded memory'],
        ['keep', 'local coherence'],
        ['append', 'streaming'],
      ],
    ),
    highlight: { active: ['first:policy', 'recent:policy'], compare: ['middle:policy'], found: ['new:reason'] },
    explanation: 'The surprising discovery is that a pure sliding window can fail, but pinning a small prefix of sink tokens often restores stable generation while keeping memory bounded.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'tokens generated', min: 0, max: 4000000 }, y: { label: 'relative KV memory', min: 0, max: 1.0 } },
      series: [
        { id: 'full', label: 'full KV cache', points: [
          { x: 0, y: 0.02 }, { x: 1000000, y: 0.25 }, { x: 2000000, y: 0.50 }, { x: 3000000, y: 0.75 }, { x: 4000000, y: 1.00 },
        ] },
        { id: 'stream', label: 'sink + window', points: [
          { x: 0, y: 0.04 }, { x: 1000000, y: 0.07 }, { x: 2000000, y: 0.07 }, { x: 3000000, y: 0.07 }, { x: 4000000, y: 0.07 },
        ] },
      ],
      markers: [
        { id: 'bounded', x: 3000000, y: 0.07, label: 'bounded cache' },
      ],
    }),
    highlight: { active: ['stream', 'bounded'], compare: ['full'] },
    explanation: 'The whole serving value is visible here: the stream can keep going while KV memory stays flat. The tradeoff is that evicted middle content is no longer directly available.',
  };

  yield {
    state: labelMatrix(
      'What the sinks are not',
      [
        { id: 'meaning', label: 'semantic memory' },
        { id: 'anchor', label: 'attention anchor' },
        { id: 'retrieval', label: 'retrieval' },
        { id: 'rag', label: 'RAG' },
      ],
      [
        { id: 'truth', label: 'truth' },
        { id: 'mistake', label: 'mistake' },
      ],
      [
        ['not enough', 'use for facts'],
        ['yes', 'treat as summary'],
        ['external', 'assume cached'],
        ['still useful', 'declare dead'],
      ],
    ),
    highlight: { active: ['anchor:truth', 'rag:truth'], compare: ['meaning:mistake', 'retrieval:mistake'] },
    explanation: 'Attention sinks stabilize the model mechanics. They do not preserve the facts in the evicted middle. Long-running assistants still need retrieval, summaries, or explicit memory for old facts.',
  };
}

function* cacheEviction() {
  yield {
    state: labelMatrix(
      'Streaming step ledger',
      [
        { id: 't0', label: 'step 0' },
        { id: 't1', label: 'step 1' },
        { id: 't2', label: 'step 2' },
        { id: 't3', label: 'step 3' },
      ],
      [
        { id: 'pinned', label: 'pinned' },
        { id: 'window', label: 'window' },
        { id: 'evicted', label: 'evicted' },
      ],
      [
        ['0..3', '20..27', '4..19'],
        ['0..3', '21..28', '4..20'],
        ['0..3', '22..29', '4..21'],
        ['0..3', '23..30', '4..22'],
      ],
    ),
    highlight: { active: ['t0:pinned', 't1:pinned', 't2:pinned', 't3:pinned'], found: ['t3:window'], compare: ['t3:evicted'] },
    explanation: 'Every step preserves the sink prefix, shifts the rolling window forward, and discards newly old tokens from the middle. This is an eviction policy over KV blocks.',
  };

  yield {
    state: graphState({
      nodes: [
        { id: 'decode', label: 'decode loop', x: 0.8, y: 3.8, note: 'one token' },
        { id: 'append', label: 'append KV', x: 2.7, y: 3.8, note: 'new token' },
        { id: 'pin', label: 'pin sinks', x: 4.6, y: 2.5, note: 'never evict' },
        { id: 'trim', label: 'trim window', x: 4.6, y: 5.1, note: 'evict' },
        { id: 'page', label: 'paged blocks', x: 6.8, y: 3.8, note: 'allocator' },
        { id: 'serve', label: 'serve next', x: 9.0, y: 3.8, note: 'bounded' },
      ],
      edges: [
        { id: 'e-decode-append', from: 'decode', to: 'append' },
        { id: 'e-append-pin', from: 'append', to: 'pin' },
        { id: 'e-append-trim', from: 'append', to: 'trim' },
        { id: 'e-pin-page', from: 'pin', to: 'page' },
        { id: 'e-trim-page', from: 'trim', to: 'page' },
        { id: 'e-page-serve', from: 'page', to: 'serve' },
      ],
    }, { title: 'StreamingLLM is a cache-policy layer' }),
    highlight: { active: ['append', 'pin', 'trim', 'page'], found: ['serve'] },
    explanation: 'In production this composes with PagedAttention-style allocation. The scheduler must keep pinned KV blocks alive, recycle evicted blocks, and keep batch shapes efficient.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'window size', min: 0, max: 4096 }, y: { label: 'stability', min: 0, max: 1.0 } },
      series: [
        { id: 'nosink', label: 'sliding only', points: [
          { x: 256, y: 0.28 }, { x: 512, y: 0.38 }, { x: 1024, y: 0.48 }, { x: 2048, y: 0.57 }, { x: 4096, y: 0.64 },
        ] },
        { id: 'sink', label: 'sink + window', points: [
          { x: 256, y: 0.68 }, { x: 512, y: 0.77 }, { x: 1024, y: 0.86 }, { x: 2048, y: 0.91 }, { x: 4096, y: 0.94 },
        ] },
      ],
      markers: [
        { id: 'prefix', x: 1024, y: 0.86, label: 'prefix pinned' },
      ],
    }),
    highlight: { active: ['sink', 'prefix'], compare: ['nosink'] },
    explanation: 'The qualitative result is that the same rolling window works much better when the model keeps the prefix anchors it learned to attend to.',
  };

  yield {
    state: labelMatrix(
      'Eviction safety checklist',
      [
        { id: 'facts', label: 'old facts' },
        { id: 'format', label: 'format' },
        { id: 'batch', label: 'batch' },
        { id: 'metrics', label: 'metrics' },
      ],
      [
        { id: 'check', label: 'check' },
        { id: 'failure', label: 'failure' },
      ],
      [
        ['retrieve/summarize', 'forgot middle'],
        ['prompt anchors', 'style drift'],
        ['block reuse', 'fragmentation'],
        ['perplexity + tasks', 'false comfort'],
      ],
    ),
    highlight: { active: ['facts:check', 'batch:check', 'metrics:check'], compare: ['facts:failure'] },
    explanation: 'A streaming deployment should pair cache eviction with explicit old-fact handling. Otherwise the model remains fluent while silently losing relevant history.',
  };
}

function* servingLedger() {
  yield {
    state: labelMatrix(
      'Serving ledger',
      [
        { id: 'memory', label: 'memory' },
        { id: 'latency', label: 'latency' },
        { id: 'quality', label: 'quality' },
        { id: 'retrieval', label: 'retrieval' },
      ],
      [
        { id: 'metric', label: 'metric' },
        { id: 'gate', label: 'gate' },
      ],
      [
        ['KV blocks/request', 'flat after W'],
        ['tok/s and p99', 'no recompute loop'],
        ['long LM + tasks', 'no drift'],
        ['old-fact recall', 'external path'],
      ],
    ),
    highlight: { active: ['memory:gate', 'latency:gate', 'quality:gate'], found: ['retrieval:gate'] },
    explanation: 'The right production question is not just "does it stream?" It is whether bounded memory, latency, quality, and old-fact recall all hold together.',
  };

  yield {
    state: graphState({
      nodes: [
        { id: 'chat', label: 'long chat', x: 0.7, y: 3.8, note: 'millions' },
        { id: 'sink', label: 'sink KV', x: 2.5, y: 2.5, note: 'prefix' },
        { id: 'window', label: 'window KV', x: 2.5, y: 5.1, note: 'recent' },
        { id: 'summary', label: 'summary/RAG', x: 4.7, y: 5.1, note: 'old facts' },
        { id: 'decoder', label: 'decoder', x: 6.7, y: 3.8, note: 'bounded cache' },
        { id: 'answer', label: 'answer', x: 9.0, y: 3.8, note: 'grounded' },
      ],
      edges: [
        { id: 'e-chat-sink', from: 'chat', to: 'sink' },
        { id: 'e-chat-window', from: 'chat', to: 'window' },
        { id: 'e-window-summary', from: 'window', to: 'summary' },
        { id: 'e-sink-decoder', from: 'sink', to: 'decoder' },
        { id: 'e-window-decoder', from: 'window', to: 'decoder' },
        { id: 'e-summary-decoder', from: 'summary', to: 'decoder' },
        { id: 'e-decoder-answer', from: 'decoder', to: 'answer' },
      ],
    }, { title: 'A real assistant combines sinks with explicit memory' }),
    highlight: { active: ['sink', 'window', 'summary', 'decoder'], found: ['answer'] },
    explanation: 'For a long-lived assistant, sinks stabilize attention mechanics, the rolling window keeps local coherence, and an external summary or RAG path preserves facts outside the window.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'conversation tokens', min: 0, max: 1000000 }, y: { label: 'old-fact recall', min: 0, max: 1.0 } },
      series: [
        { id: 'streamonly', label: 'sink window only', points: [
          { x: 0, y: 0.92 }, { x: 250000, y: 0.68 }, { x: 500000, y: 0.46 }, { x: 750000, y: 0.31 }, { x: 1000000, y: 0.24 },
        ] },
        { id: 'memory', label: 'sink + external memory', points: [
          { x: 0, y: 0.92 }, { x: 250000, y: 0.86 }, { x: 500000, y: 0.82 }, { x: 750000, y: 0.79 }, { x: 1000000, y: 0.77 },
        ] },
      ],
      markers: [
        { id: 'truth', x: 750000, y: 0.79, label: 'facts need memory' },
      ],
    }),
    highlight: { active: ['memory', 'truth'], compare: ['streamonly'] },
    explanation: 'This stylized chart separates fluency from memory. StreamingLLM keeps generation stable, but old facts still need a retrieval or summarization system.',
  };

  yield {
    state: labelMatrix(
      'Study map',
      [
        { id: 'kv', label: 'KV Cache' },
        { id: 'paged', label: 'PagedAttention' },
        { id: 'rope', label: 'RoPE' },
        { id: 'rag', label: 'RAG' },
      ],
      [
        { id: 'connection', label: 'connection' },
        { id: 'next', label: 'next' },
      ],
      [
        ['what is stored', 'eviction policy'],
        ['where blocks live', 'allocator'],
        ['positions still matter', 'long context eval'],
        ['old facts', 'memory system'],
      ],
    ),
    highlight: { found: ['kv:next', 'paged:next', 'rag:next'], active: ['rope:connection'] },
    explanation: 'StreamingLLM is a bridge topic: it turns attention math into a serving cache policy and shows why long context does not automatically replace retrieval.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'sink window') yield* sinkWindow();
  else if (view === 'cache eviction') yield* cacheEviction();
  else if (view === 'serving ledger') yield* servingLedger();
  else throw new InputError('Pick a StreamingLLM view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'Read the animation as a KV-cache eviction policy. A KV cache stores key and value tensors from previous tokens so the model can generate the next token without recomputing the whole prefix. Active regions are the prefix sink tokens and the recent rolling window that remain visible to attention.',
        'Removed middle tokens are no longer directly available to the model. Found markers mean the bounded cache can still produce the next token. The safe inference is limited: the policy preserves streaming stability and local context, not all old facts.',
        {type:'callout', text:'StreamingLLM bounds KV memory by pinning attention-sink prefix tokens while sliding a recent suffix and evicting the middle.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Decoder-only language models generate one token at a time and reuse the KV cache for earlier tokens. That makes decoding fast, but cache memory grows with sequence length. A long chat or transcript can eventually spend more GPU memory on history than the serving system can afford.',
        'StreamingLLM exists because a simple sliding window can damage model behavior. The paper observes that many models attend heavily to early tokens that act as attention sinks, even when those tokens are not semantically important. Keeping a small prefix plus a recent window can keep generation stable with bounded memory.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious high-quality approach is to keep the full KV cache. Every previous token remains available, and the model sees the same context it would see in ordinary decoding. The cost is linear memory growth with total tokens.',
        'The obvious memory-saving approach is to keep only the last W tokens. That bounds memory but removes the initial sink positions the model may rely on. The model can remain grammatical for a while and then drift because its attention pattern has changed.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is GPU memory under continuous decoding. KV memory scales with layers, heads, head dimension, precision, batch size, and cached token count. In a shared server, one unbounded stream can reduce batch capacity for many other requests.',
        'The behavioral wall is that eviction changes the computation. Dropping old semantic content may be acceptable for local continuation, but dropping sink tokens can destabilize attention. Fluency can also hide forgotten facts, so serving metrics must separate stable generation from long-term recall.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Keep two regions: a pinned prefix and a rolling suffix. The pinned prefix contains the first sink_count tokens. The suffix contains the most recent window_size tokens. The middle is evicted as the stream advances.',
        'The memory formula changes from total_tokens to sink_count + window_size. If sink_count is 4 and window_size is 1024, the model attends to 1028 cached positions no matter whether the stream has produced 10,000 or 1,000,000 tokens. Old facts outside that window need another memory system.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'During prefill, the model creates KV entries for the prompt. The cache manager marks the first few entries as pinned sinks. During decode, each new token appends KV entries to the recent region.',
        'When the recent region exceeds its limit, the cache manager evicts entries after the pinned prefix and before the rolling suffix. In a paged KV allocator, this means preserving sink blocks, recycling evicted middle blocks, and keeping attention masks consistent with the retained positions.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The correctness claim is not that the answer is identical to full-context decoding. The claim is that the retained cache is exactly the cache defined by the policy: prefix sinks plus recent suffix. Each decode step preserves the invariant by appending one token and evicting only from the middle when the suffix is too large.',
        'The quality argument comes from the attention-sink observation. If the model uses early tokens as attention anchors, retaining them preserves a mechanical pattern that a pure sliding window destroys. The recent suffix preserves local syntax and instruction context, while external retrieval or summaries must preserve older facts.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Full KV cache memory is O(total tokens). StreamingLLM cache memory is O(sink_count + window_size) per sequence, multiplied by model layers and KV dimensions. Doubling the stream length after the window is full does not double KV memory.',
        'The extra complexity is in cache management and evaluation. The scheduler must pin some blocks, evict others, batch requests with different windows, and avoid fragmentation. Quality tests must include long-stream language modeling, task performance, style drift, and old-fact recall.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'The fit is streaming generation where recent context matters more than exact recall of the whole past: long chats, live transcripts, monitoring logs, agent loops, and continuous assistants. The serving goal is stable continuation with bounded memory.',
        'It composes with PagedAttention-style allocators and external memory. The cache policy handles attention mechanics, while retrieval, summaries, or notes handle facts that fell out of the window. Production systems need both layers if users expect old details to remain available.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'It fails when the task requires exact access to evicted middle tokens. A legal clause, earlier user preference, code definition, or numerical fact outside the window is gone unless another system preserved it. The model may still sound confident.',
        'It can also fail across model families, position schemes, fine-tunes, and multimodal settings. The right sink count and window size are empirical choices. A deployment should measure against its own model and workload instead of assuming the paper setting transfers unchanged.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Consider a 32-layer model with 32 KV heads, head dimension 128, and fp16 KV values. One token costs 32 layers * 2 tensors * 32 heads * 128 values * 2 bytes = 524,288 bytes, or 0.5 MB, for one sequence before allocator overhead. A 64,000-token full cache would be about 32 GB.',
        'With 4 sink tokens and a 2048-token window, the cache holds 2052 tokens, or about 1.0 GB for the same sequence. At token 50,000, the retained positions are 0..3 and 47,952..49,999 before appending the next token. The middle is not compressed inside the cache; it is absent.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources start with the StreamingLLM paper at https://arxiv.org/abs/2309.17453. Then inspect the MIT HAN Lab implementation at https://github.com/mit-han-lab/streaming-llm to see how the cache policy is exposed in code.',
        'Study KV Cache for stored tensors and PagedAttention for block allocation. Then connect RoPE, RAG, Long Context Evaluation, and Cache Eviction Policy to the difference between stable streaming and old-fact recall.',
      ],
    },
  ],
};
