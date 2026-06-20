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
      heading: 'Why this exists',
      paragraphs: [
        'A decoder-only language model stores key/value tensors for previous tokens so each new token can attend to the past without recomputing the whole prefix. That KV cache is essential for fast generation, but it grows linearly with sequence length. A long-running chat, transcript, monitoring stream, or agent session cannot keep every past token in GPU memory forever.',
        'A pure sliding window seems like the simple answer: keep only the most recent tokens and evict everything older. StreamingLLM shows why that can fail. Many decoder-only models rely heavily on a small set of initial tokens that act as attention sinks. Drop those tokens and generation can become unstable even if the recent window remains.',
        'StreamingLLM exists to make long streams practical with bounded cache. Keep the first few sink tokens, keep a rolling recent window, and evict the middle. The cache stops growing with total conversation length while preserving the prefix anchors and local context the model needs for fluent continuation.',
        {type:'callout', text:'StreamingLLM bounds KV memory by pinning attention-sink prefix tokens while sliding a recent suffix and evicting the middle.'},
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious serving approach is to keep the full KV cache. That preserves direct attention to all previous tokens and avoids quality surprises from eviction. It also makes memory grow with every generated token. At enough length, the request becomes too expensive or impossible to serve.',
        'The other obvious approach is a simple rolling window. Keep the last W tokens and discard the rest. That bounds memory, but it changes the attention pattern the model was trained to use. The first tokens can function as sinks that absorb attention mass. Removing them can degrade long-stream generation more than their semantic content alone would suggest.',
        'A third tempting mistake is to call any bounded-window method "infinite context." It is not. Tokens evicted from the middle are no longer directly available. If the model must remember a fact from that region, another system must preserve it through retrieval, summaries, notes, or explicit memory.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is GPU memory. KV cache memory grows with layers, heads, head dimension, batch size, and sequence length. In high-throughput serving, KV blocks compete with model weights, activations, batch capacity, and other users. A single long request can crowd out many ordinary requests if the cache is unbounded.',
        'The second wall is model behavior. A windowing policy is not only a memory policy; it changes what the attention mechanism can see. If eviction removes tokens the model uses as positional anchors or attention sinks, generation can become less stable even when local context remains.',
        'The third wall is product truthfulness. A model can keep generating fluent text while forgetting important old facts. Fluency is not memory. StreamingLLM solves bounded-cache continuation, not the full problem of long-term factual recall.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Use a two-region KV cache: pinned prefix plus rolling suffix. The pinned prefix preserves the attention sink tokens from the beginning of the sequence. The rolling suffix preserves recent local context. The middle is evicted as the stream grows.',
        'The data structure is simple: keep sink_count tokens from the start, keep window_size recent tokens, append each new token, and recycle blocks that fall out of the middle. Memory becomes proportional to sink_count + window_size rather than total generated length.',
        'The conceptual distinction is the important part. Attention sinks stabilize the model mechanics. They do not summarize everything that happened after them. A deployment that needs old facts must combine the cache policy with retrieval, summarization, or another memory layer.',
      ],
    },
    {
      heading: 'What the animation teaches',
      paragraphs: [
        'The sink-window view shows the two retained regions. The prefix is pinned because the model uses those early positions as attention anchors. The suffix is retained because recent tokens carry local coherence: syntax, topic, current instruction, and immediate references.',
        'The cache-eviction ledger shows the step-by-step policy. At each new token, append new KV, preserve the sink prefix, slide the recent window forward, and free the newly old middle blocks. In a serving system, that policy must connect to the KV allocator.',
        'The serving-ledger view shows the real production question. Bounded memory alone is not enough. You have to measure KV blocks per request, tokens per second, p99 latency, long-stream task quality, style drift, and old-fact recall through the external memory path.',
      ],
    },
    {
      heading: 'How the cache policy works',
      paragraphs: [
        'During prefill, the model processes the prompt and creates KV entries for each token. StreamingLLM keeps the KV entries for the first few tokens. These are the attention sinks. It also keeps a fixed-size recent window near the end of the stream.',
        'During decode, each generated token adds new KV entries. If the recent window exceeds its limit, entries just after the sink prefix and outside the suffix are evicted. The attention mask and position handling must ensure the model attends to the retained prefix and retained suffix consistently.',
        'In production, the policy is usually implemented over blocks, not individual tokens. Systems inspired by PagedAttention allocate KV cache in pages or blocks. Sink blocks remain pinned, suffix blocks roll forward, and evicted middle blocks return to the allocator. That makes the idea a serving-system data structure, not only a paper trick.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Suppose a request has four sink tokens and a recent window of eight tokens. At one moment, the retained cache contains tokens 0..3 and 20..27. When token 28 is generated, it is appended to the suffix. The cache now wants tokens 0..3 and 21..28, so token 20 can be evicted.',
        'After many more steps, the retained cache may be tokens 0..3 and 10020..10027. Memory is still about twelve tokens worth of KV per layer for this toy example, not 10028 tokens. The model remains locally coherent because it sees the recent suffix and remains mechanically stable because the sink prefix is still present.',
        'But if the user stated an account number at token 4000, that fact is gone from direct attention. The model may answer fluently and still forget it. A real assistant should store important facts in a summary, retrieval index, task state, or structured memory rather than trusting the sink-window cache.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'StreamingLLM works because the first tokens often receive disproportionate attention even when they are not semantically important. They act like anchors or sinks in the attention distribution. Keeping them preserves a pattern the model is comfortable using.',
        'The recent window works for a different reason. Most next-token dependencies in normal conversation and text continuation are local: the current sentence, nearby entities, the active instruction, and the immediate discourse state. Keeping the suffix preserves that local information.',
        'The method succeeds when the task can tolerate losing direct access to the middle or when another system preserves the important middle facts. It is a cache policy for stable long streaming, not a universal long-context reasoning solution.',
      ],
    },
    {
      heading: 'Cost and behavior',
      paragraphs: [
        'The main benefit is flat KV memory after the window fills. That can increase maximum stream length, protect batch capacity, and reduce out-of-memory failures. It can also reduce scheduler pressure because long requests no longer grow without bound.',
        'The cost is information loss. Middle tokens are evicted from direct attention. The model can no longer quote, verify, or reason over those tokens unless they were summarized or retrieved elsewhere. The serving system also becomes more complex because the allocator, attention mask, batching, and metrics must understand pinned and rolling regions.',
        'Quality behavior is task dependent. Open-ended continuation may remain stable. Tasks requiring precise old facts may fail. Long-context evaluation must include both fluency and recall, because StreamingLLM can improve one while leaving the other unsolved.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'StreamingLLM wins for long-running generation where recent context matters most: live transcripts, monitoring streams, coding assistants with explicit project memory, customer-support chats with external CRM state, and agents that summarize or store durable facts outside the KV cache.',
        'It also wins as a systems lesson. Long-context serving is not only model architecture. It is cache allocation, eviction, batching, metrics, and memory policy. The paper makes attention behavior legible as an engineering constraint.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'It fails when the application needs direct access to arbitrary old tokens and has no retrieval or summarization path. Legal review, exact transcript QA, long mathematical proofs, and tasks with important early constraints can break if the needed information falls into the evicted middle.',
        'It also fails when teams measure only smooth generation. A model that sounds coherent can still forget facts, violate early instructions, or drift in task state. Evaluation should include old-fact recall, long-range instruction following, adversarial middle facts, and comparisons against full-cache baselines where possible.',
      ],
    },
    {
      heading: 'What to remember',
      paragraphs: [
        'Remember the formula: retained cache equals sink prefix plus recent window. That is the data structure.',
        'Remember the boundary: attention sinks preserve generation mechanics, not semantic memory. If old facts matter, build memory explicitly.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Efficient Streaming Language Models with Attention Sinks at https://arxiv.org/abs/2309.17453 and the official implementation at https://github.com/mit-han-lab/streaming-llm. Study KV Cache, LLM Serving: PagedAttention, Sliding-Window Attention Context Policy, LongRoPE Non-Uniform RoPE Scaling, Infini-Attention Compressive Memory, RAG Pipeline, Agent Memory & Context Engineering, and Lost in the Middle next.',
      ],
    },
  ],
};
