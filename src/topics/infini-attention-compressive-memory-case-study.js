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
      heading: 'What it is',
      paragraphs: [
        'Infini-attention is a Transformer attention extension for very long inputs. It combines masked local attention over the current segment with a compressive long-term memory. The goal is to keep bounded memory and compute while giving the model a path to older context.',
        'The key design choice is hybrid memory. Recent tokens remain in an exact local attention window. Older context is folded into a memory state and read through a long-term linear attention path.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'For a new segment, the block computes ordinary local attention over nearby tokens. It also reads from a memory matrix that summarizes older segments. A gate mixes local and long-memory outputs. After processing the segment, the model updates the memory with a compressed representation of the current tokens.',
        'This is not the same as keeping every old KV vector. Compression is the point. The design asks the model to preserve useful long-range evidence in a bounded state and keep exact token detail only for the local window.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The benefit is bounded memory for long streams. The cost is compression loss and additional block complexity. The long-memory path must be efficient enough that it does not erase the latency benefit of not storing full attention history.',
        'Infini-attention should be evaluated against StreamingLLM, sliding-window attention, Mamba-style state models, TTT layers, and full attention baselines on shorter contexts where exact comparison is possible.',
      ],
    },
    {
      heading: 'Case study',
      paragraphs: [
        'Imagine a model reading a long technical manual in segments. The local window captures exact equations and code snippets around the current token. The compressive memory carries older chapter summaries, definitions, and recurring symbols. A downstream answer should cite or retrieve exact passages when exactness matters, because the compressed memory may blur details.',
        'A production ledger should track memory peak, p99 latency, old-fact retrieval, position-swept needle tests, long summarization, and whether the memory path remains stable under batching.',
      ],
    },
    {
      heading: 'Pitfalls',
      paragraphs: [
        'Do not treat "infinite context" as literal perfect recall. Infini-attention provides a bounded-memory mechanism. It can still forget, blur, or misweight old evidence. Another trap is testing only average language-model loss. Exact long-range tasks are where compression failures become visible.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Primary source: Efficient Infinite Context Transformers with Infini-attention at https://arxiv.org/abs/2404.07143.',
        'Study StreamingLLM Attention Sinks, Sliding-Window Attention Context Policy, KV Cache, Selective State Space Models: Mamba, Test-Time Training Layer Case Study, Hybrid Attention State Budget Case Study, Lost in the Middle, and RAG Claim Verification next.',
      ],
    },
  ],
};
