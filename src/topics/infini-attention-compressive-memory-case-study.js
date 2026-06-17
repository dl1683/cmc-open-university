// Infini-attention: local masked attention plus a compressive memory that
// carries older context with bounded storage.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'infini-attention-compressive-memory-case-study',
  title: 'Infini-Attention Compressive Memory Case Study',
  category: 'Papers',
  summary: 'Infini-attention combines local masked attention with long-term compressive memory, giving Transformers a bounded-memory path for very long inputs.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['memory block', 'segment update', 'evaluation ledger'], defaultValue: 'memory block' },
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

function memoryGraph(title) {
  return graphState({
    nodes: [
      { id: 'segment', label: 'segment t', x: 0.7, y: 3.8, note: 'new tokens' },
      { id: 'local', label: 'local attn', x: 2.6, y: 2.4, note: 'recent exact' },
      { id: 'kv', label: 'K/V summary', x: 2.6, y: 5.2, note: 'compress' },
      { id: 'memory', label: 'memory M', x: 4.8, y: 5.2, note: 'long term' },
      { id: 'long', label: 'linear read', x: 6.6, y: 5.2, note: 'old context' },
      { id: 'gate', label: 'gate', x: 6.6, y: 2.4, note: 'mix' },
      { id: 'out', label: 'output', x: 9.0, y: 3.8, note: 'local + long' },
    ],
    edges: [
      { id: 'e-segment-local', from: 'segment', to: 'local' },
      { id: 'e-segment-kv', from: 'segment', to: 'kv' },
      { id: 'e-kv-memory', from: 'kv', to: 'memory' },
      { id: 'e-memory-long', from: 'memory', to: 'long' },
      { id: 'e-local-gate', from: 'local', to: 'gate' },
      { id: 'e-long-gate', from: 'long', to: 'gate' },
      { id: 'e-gate-out', from: 'gate', to: 'out' },
    ],
  }, { title });
}

function* memoryBlock() {
  yield {
    state: memoryGraph('Infini-attention adds compressive memory to attention'),
    highlight: { active: ['local', 'memory', 'long', 'gate', 'e-local-gate', 'e-long-gate'], found: ['out'] },
    explanation: 'Infini-attention keeps exact masked local attention for the current segment, then reads a compressed long-term memory for older context. A gate mixes the local and long-memory outputs.',
    invariant: 'Old context is not kept as exact KV tokens. It is compressed into a bounded memory state.',
  };

  yield {
    state: labelMatrix(
      'Two memory paths',
      [
        { id: 'local', label: 'local window' },
        { id: 'memory', label: 'compressive M' },
        { id: 'gate', label: 'mix gate' },
        { id: 'output', label: 'output' },
      ],
      [
        { id: 'keeps', label: 'keeps' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['recent tokens', 'short horizon'],
        ['old summary', 'compression loss'],
        ['path weight', 'calibration'],
        ['both', 'eval needed'],
      ],
    ),
    highlight: { active: ['local:keeps', 'memory:keeps', 'gate:keeps'], compare: ['memory:risk'] },
    explanation: 'The design is intentionally hybrid. The model keeps local detail exactly and long history approximately. That is a different tradeoff from StreamingLLM, which keeps sinks and recent KV blocks.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'sequence length', min: 0, max: 1000000 }, y: { label: 'state memory', min: 0, max: 1.0 } },
      series: [
        { id: 'full', label: 'full attention KV', points: [
          { x: 0, y: 0.02 }, { x: 250000, y: 0.27 }, { x: 500000, y: 0.52 }, { x: 750000, y: 0.76 }, { x: 1000000, y: 1.0 },
        ] },
        { id: 'infini', label: 'local + memory', points: [
          { x: 0, y: 0.10 }, { x: 250000, y: 0.14 }, { x: 500000, y: 0.14 }, { x: 750000, y: 0.14 }, { x: 1000000, y: 0.14 },
        ] },
      ],
      markers: [
        { id: 'bounded', x: 750000, y: 0.14, label: 'bounded memory' },
      ],
    }),
    highlight: { active: ['infini', 'bounded'], compare: ['full'] },
    explanation: 'The promise is bounded memory for unbounded streams. The question is how much older detail survives compression into the memory state.',
  };

  yield {
    state: graphState({
      nodes: [
        { id: 'attn', label: 'Transformer', x: 0.8, y: 3.8, note: 'existing block' },
        { id: 'local', label: 'local mask', x: 2.8, y: 2.5, note: 'near tokens' },
        { id: 'linear', label: 'linear memory', x: 2.8, y: 5.1, note: 'old tokens' },
        { id: 'reuse', label: 'reuse weights', x: 5.0, y: 3.8, note: 'minimal change' },
        { id: 'continue', label: 'continual train', x: 7.1, y: 3.8, note: 'adapt' },
        { id: 'serve', label: 'serve long', x: 9.1, y: 3.8, note: 'bounded' },
      ],
      edges: [
        { id: 'e-attn-local', from: 'attn', to: 'local' },
        { id: 'e-attn-linear', from: 'attn', to: 'linear' },
        { id: 'e-local-reuse', from: 'local', to: 'reuse' },
        { id: 'e-linear-reuse', from: 'linear', to: 'reuse' },
        { id: 'e-reuse-continue', from: 'reuse', to: 'continue' },
        { id: 'e-continue-serve', from: 'continue', to: 'serve' },
      ],
    }, { title: 'The paper frames Infini-attention as a drop-in extension' }),
    highlight: { active: ['local', 'linear', 'reuse'], found: ['continue', 'serve'] },
    explanation: 'A major design goal is compatibility: keep the Transformer block shape, add compressive memory, and adapt with continual pretraining instead of rebuilding the whole architecture.',
  };
}

function* segmentUpdate() {
  yield {
    state: labelMatrix(
      'Segment update ledger',
      [
        { id: 's0', label: 'seg 0' },
        { id: 's1', label: 'seg 1' },
        { id: 's2', label: 'seg 2' },
        { id: 's3', label: 'seg 3' },
      ],
      [
        { id: 'local', label: 'local read' },
        { id: 'compress', label: 'compress' },
        { id: 'memory', label: 'memory after' },
      ],
      [
        ['tokens 0-1k', 'summary 0', 'M0'],
        ['tokens 1k-2k', 'summary 1', 'M1'],
        ['tokens 2k-3k', 'summary 2', 'M2'],
        ['tokens 3k-4k', 'summary 3', 'M3'],
      ],
    ),
    highlight: { active: ['s1:memory', 's2:memory', 's3:memory'], found: ['s3:local'] },
    explanation: 'Long input is processed by segments. Each segment receives local attention, contributes a compressed summary, and updates the carry memory for the next segment.',
  };

  yield {
    state: memoryGraph('Memory is read before it is updated for the next segment'),
    highlight: { active: ['memory', 'long', 'gate', 'e-memory-long', 'e-long-gate'], found: ['kv', 'e-kv-memory'] },
    explanation: 'At segment t, the model reads older memory, mixes it with local attention, then writes a compressed representation of the current segment into memory for future segments.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'compression strength', min: 0, max: 1 }, y: { label: 'long-fact recall', min: 0, max: 1 } },
      series: [
        { id: 'detail', label: 'recall', points: [
          { x: 0.1, y: 0.92 }, { x: 0.3, y: 0.84 }, { x: 0.5, y: 0.72 }, { x: 0.7, y: 0.56 }, { x: 0.9, y: 0.38 },
        ] },
        { id: 'cost', label: 'memory saved', points: [
          { x: 0.1, y: 0.22 }, { x: 0.3, y: 0.44 }, { x: 0.5, y: 0.62 }, { x: 0.7, y: 0.78 }, { x: 0.9, y: 0.92 },
        ] },
      ],
      markers: [
        { id: 'frontier', x: 0.5, y: 0.72, label: 'tradeoff' },
      ],
    }),
    highlight: { active: ['detail', 'cost', 'frontier'] },
    explanation: 'Compressive memory is a frontier, not a free lunch. Stronger compression saves memory but can erase facts that exact attention would have preserved.',
  };

  yield {
    state: labelMatrix(
      'Compare memory mechanisms',
      [
        { id: 'sink', label: 'StreamingLLM' },
        { id: 'infini', label: 'Infini' },
        { id: 'ttt', label: 'TTT' },
        { id: 'mamba', label: 'Mamba' },
      ],
      [
        { id: 'state', label: 'state' },
        { id: 'question', label: 'question' },
      ],
      [
        ['sink + recent KV', 'old facts external?'],
        ['compressed memory', 'what survives?'],
        ['hidden model', 'update cost?'],
        ['selective state', 'capacity?'],
      ],
    ),
    highlight: { found: ['sink:state', 'infini:state', 'ttt:state'], active: ['infini:question'] },
    explanation: 'Infini-attention belongs in the same family as StreamingLLM, TTT, and Mamba: each replaces unbounded exact context with a different bounded state.',
  };
}

function* evaluationLedger() {
  yield {
    state: labelMatrix(
      'Evaluation ledger',
      [
        { id: 'lm', label: 'language modeling' },
        { id: 'needle', label: 'needle retrieval' },
        { id: 'summary', label: 'summary' },
        { id: 'latency', label: 'latency' },
      ],
      [
        { id: 'checks', label: 'checks' },
        { id: 'failure', label: 'failure' },
      ],
      [
        ['long segments', 'perplexity only'],
        ['position sweep', 'lost old facts'],
        ['multi-doc', 'blurred source'],
        ['p99 and memory', 'slow memory path'],
      ],
    ),
    highlight: { active: ['needle:checks', 'latency:checks'], compare: ['lm:failure'] },
    explanation: 'A credible Infini-attention result needs both modeling and retrieval-style checks. Compression can look good on average loss while failing exact old-fact questions.',
  };

  yield {
    state: graphState({
      nodes: [
        { id: 'paper', label: 'paper claim', x: 0.8, y: 3.8, note: 'bounded context' },
        { id: 'ref', label: 'short reference', x: 2.7, y: 2.5, note: 'exact attn' },
        { id: 'long', label: 'long eval', x: 2.7, y: 5.1, note: 'segments' },
        { id: 'tasks', label: 'tasks', x: 4.9, y: 3.8, note: 'needle + QA' },
        { id: 'serve', label: 'serve trace', x: 7.0, y: 3.8, note: 'memory + p99' },
        { id: 'decision', label: 'decision', x: 9.1, y: 3.8, note: 'ship or not' },
      ],
      edges: [
        { id: 'e-paper-ref', from: 'paper', to: 'ref' },
        { id: 'e-paper-long', from: 'paper', to: 'long' },
        { id: 'e-ref-tasks', from: 'ref', to: 'tasks' },
        { id: 'e-long-tasks', from: 'long', to: 'tasks' },
        { id: 'e-tasks-serve', from: 'tasks', to: 'serve' },
        { id: 'e-serve-decision', from: 'serve', to: 'decision' },
      ],
    }, { title: 'Do not stop at a paper ablation' }),
    highlight: { active: ['ref', 'long', 'tasks'], found: ['serve', 'decision'] },
    explanation: 'The production bar is higher than a model ablation. Compare to exact attention where possible, stress old-fact retrieval, and inspect runtime memory behavior.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'distance to relevant fact', min: 0, max: 1000000 }, y: { label: 'answer support', min: 0, max: 1.0 } },
      series: [
        { id: 'local', label: 'local window only', points: [
          { x: 1000, y: 0.92 }, { x: 10000, y: 0.55 }, { x: 100000, y: 0.18 }, { x: 500000, y: 0.08 }, { x: 1000000, y: 0.05 },
        ] },
        { id: 'memory', label: 'compressive memory', points: [
          { x: 1000, y: 0.90 }, { x: 10000, y: 0.76 }, { x: 100000, y: 0.58 }, { x: 500000, y: 0.42 }, { x: 1000000, y: 0.35 },
        ] },
      ],
      markers: [
        { id: 'far', x: 500000, y: 0.42, label: 'old evidence' },
      ],
    }),
    highlight: { active: ['memory', 'far'], compare: ['local'] },
    explanation: 'The intended win is graceful degradation: older facts are compressed, so support should decay more slowly than a pure local-window model, but it is still not exact memory.',
  };

  yield {
    state: labelMatrix(
      'Study map',
      [
        { id: 'attn', label: 'Attention' },
        { id: 'stream', label: 'StreamingLLM' },
        { id: 'hybrid', label: 'Hybrid state' },
        { id: 'rag', label: 'RAG' },
      ],
      [
        { id: 'why', label: 'why' },
        { id: 'next', label: 'next' },
      ],
      [
        ['base block', 'local path'],
        ['bounded KV', 'sink contrast'],
        ['state budget', 'architecture map'],
        ['external facts', 'grounding'],
      ],
    ),
    highlight: { found: ['attn:next', 'stream:next', 'hybrid:next', 'rag:next'] },
    explanation: 'Infini-attention is a bridge between attention engineering and memory-system design. It should be studied with both model internals and retrieval architecture.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'memory block') yield* memoryBlock();
  else if (view === 'segment update') yield* segmentUpdate();
  else if (view === 'evaluation ledger') yield* evaluationLedger();
  else throw new InputError('Pick an Infini-attention view.');
}

export const article = {
  sections: [
    {
      heading: 'Why compressive memory exists',
      paragraphs: [
        'Infini-attention exists because long-context models face a harsh storage question: should every old token remain exactly available, or should old context be compressed into bounded state? Exact history is attractive because the model can directly compare the current query to old keys and values. The cost is that memory and compute keep growing. Compressed history is cheaper, but compression can forget, blur, or distort details.',
        'The architecture tries to split the difference. Recent tokens get ordinary masked local attention, preserving exact nearby detail. Older context is stored in a compressive memory that can be read by later segments. The word "infinite" should be read as a bounded-memory design goal, not as a promise of perfect recall across unlimited text.',
      ],
    },
    {
      heading: 'The naive designs and their walls',
      paragraphs: [
        'The first naive design is full attention over the entire prefix. It gives the cleanest semantics: every token can attend to every previous token. The wall is resource use. Very long sequences consume large KV caches, large attention computation, and serving capacity that could otherwise support more users or higher throughput.',
        'The second naive design is a hard sliding window. Keep only the recent past and discard old tokens. That is cheap, but it fails when an old definition, instruction, source quote, or entity mention must be recovered exactly. A model can appear fluent while silently losing the evidence needed for a correct answer.',
        'The third naive design is an unexamined summary. Summaries help, but they are lossy and often optimize for narrative coherence rather than future retrieval. Infini-attention is more precise: it gives the model a learned memory path that can be updated segment by segment, while preserving exact attention locally.',
      ],
    },
    {
      heading: 'The core mechanism',
      paragraphs: [
        'The block has two paths. The local path performs ordinary causal attention within the current segment. This handles recent syntax, immediate references, and local reasoning with exact token-level evidence. The memory path reads from a bounded memory matrix that summarizes earlier segments. A learned gate or mixing mechanism combines the local-attention output with the memory-read output.',
        'After processing a segment, the model updates memory with information from that segment. The memory is not a list of old tokens. It is compressed state. Later segments can read from it, but they cannot inspect every old token as an exact row unless another mechanism preserves that evidence.',
        'This places Infini-attention in a larger family of bounded-context designs: StreamingLLM keeps attention sinks and recent cache, Mamba carries recurrent state, RetNet carries retention state, sliding-window attention keeps a recent band, and retrieval systems fetch old evidence externally. Each design replaces unbounded exact access with a different form of memory budget.',
      ],
    },
    {
      heading: 'Why it can work',
      paragraphs: [
        'The design can work when many old dependencies do not require exact token replay. A long document contains themes, entities, topics, and state that may be compressible. If the memory learns to preserve the useful signal and local attention handles precise recent details, the model can cover longer inputs without paying full exact-attention cost.',
        'It can also work because segment processing is a natural production shape. Long inputs are often streamed or chunked: documents, transcripts, logs, codebases, and conversations arrive in pieces. Reading old memory, processing the current segment, and writing updated memory matches that flow. It gives the serving system a bounded object to carry forward instead of an ever-growing list of KV rows.',
        'The key word is "useful." Compression is justified only if it preserves the information the task needs. A long summarization task may tolerate abstraction. A citation task may not. A model that remembers the gist but forgets the exact clause can be impressive and still wrong for legal, medical, security, or research work.',
      ],
    },
    {
      heading: 'Where it fits',
      paragraphs: [
        'Infini-attention is a useful study case for bounded long-context architecture. A model reading a long technical manual could keep the current section exact while carrying older chapter themes, definitions, and recurring symbols in memory. A meeting assistant could preserve the current exchange exactly while carrying earlier agenda state and decisions in compressed form.',
        'The design is also valuable as a bridge between attention and recurrent memory. It keeps the familiar attention block for local context but adds a stateful path for older context. That makes it easier to compare against RetNet, Mamba, StreamingLLM, and retrieval-augmented systems. The curriculum lesson is that "memory" can be exact tokens, learned state, retrieved documents, summaries, or some hybrid.',
        'In production, the best fit is likely a workload where old context matters statistically but exact old spans can be checked through another path when needed. For example, long-form drafting may benefit from compressive memory, while final source-cited answers should still retrieve and verify the exact evidence.',
      ],
    },
    {
      heading: 'Failure modes',
      paragraphs: [
        'The main failure is false confidence about old evidence. A compressive memory may preserve the topic but lose the number, quote, name, exception, or negation that makes the answer correct. This is why average language-model loss is not enough. Long-context evaluation needs exact retrieval, position sweeps, distractors, citation checks, and tasks where the decisive fact sits far outside the local segment.',
        'Another failure is memory interference. Old segments can overwrite or distort each other. A memory update rule that works for one domain may fail under code, tables, math, or adversarial documents. Segment boundaries can create artifacts, and the model may learn to overtrust memory even when local context contradicts it.',
        'There is also a systems failure mode. If the memory path is expensive, hard to batch, numerically unstable, or difficult to quantize, it may erase its serving advantage. A bounded-state architecture must be judged by quality, peak memory, p95 and p99 latency, batching behavior, and implementation maturity.',
      ],
    },
    {
      heading: 'A worked example',
      paragraphs: [
        'Imagine a model reading a 300-page technical manual. The current segment contains an equation that refers to a symbol introduced in chapter two. Local attention can handle the current equation exactly. The compressive memory may carry the earlier symbol definition, the role of the variable, and the surrounding topic. If the task is to summarize the equation, that may be enough. If the task is to quote the exact definition, compressed memory is not enough by itself.',
        'A production system can use Infini-attention as the model memory while pairing it with source retrieval. The memory path keeps the model oriented across long text. Retrieval fetches exact old spans when the answer must cite or quote. This division of labor is usually more honest than claiming one learned state can serve every memory need.',
      ],
    },
    {
      heading: 'Evaluation checklist',
      paragraphs: [
        'A useful evaluation should separate gist memory from exact memory. Test long summarization, topic continuity, and entity tracking, but also test needle retrieval, quote fidelity, key-value lookup, old instruction following, and contradiction between local text and old memory. Sweep the decisive evidence across positions rather than testing only the beginning and end.',
        'The systems checklist should include peak memory, latency by sequence length, batching behavior, quantized serving quality, segment-boundary sensitivity, and comparison against sliding-window, retrieval, and exact-attention baselines. A memory architecture earns adoption only when it improves the full quality-cost curve.',
      ],
    },
    {
      heading: 'What to remember',
      paragraphs: [
        'Infini-attention is not magic infinite recall. It is a hybrid memory design: exact local attention for recent tokens plus compressed state for older context. That is a serious idea because most long-context workloads need both recent precision and some durable old signal.',
        'The design should be evaluated as a memory contract. Ask what remains exact, what becomes compressed, how memory is updated, what old facts are recoverable, how failures are detected, and whether retrieval or citation checks are needed for high-stakes answers.',
        'The practical lesson is to name the memory tier. Local attention is the exact tier, compressive memory is the learned state tier, and retrieval can be the evidence tier. Once those roles are explicit, students can reason about what the model is likely to remember and what the application must verify.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary source: Efficient Infinite Context Transformers with Infini-attention at https://arxiv.org/abs/2404.07143.',
        'Study StreamingLLM Attention Sinks, Sliding-Window Attention Context Policy, KV Cache, Selective State Space Models: Mamba, Test-Time Training Layer Case Study, Hybrid Attention State Budget Case Study, Lost in the Middle, and RAG Claim Verification next.',
      ],
    },
  ],
};
