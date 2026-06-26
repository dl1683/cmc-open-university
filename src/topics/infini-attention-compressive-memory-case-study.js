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
      heading: 'How to read the animation',
      paragraphs: [
        'The animation shows one Transformer block processing a segment of tokens. A segment is a fixed-size chunk of the input. The local path performs exact attention inside the current segment. The memory path reads compressed information from older segments. A gate mixes the two outputs.',
        'Active nodes are the computation happening now: local attention, memory read, gate, output, or memory update. Found output means the block has combined exact recent context with compressed older context. The safe inference rule is that recent tokens remain exact, while old tokens are represented only through bounded memory state.',
        {type:'callout', text:'Infini-attention trades exact old tokens for bounded associative memory while preserving exact local attention for the current segment.'},
        {type:'image', src:'https://upload.wikimedia.org/wikipedia/commons/3/34/Transformer%2C_full_architecture.png', alt:'Standard Transformer encoder-decoder architecture diagram', caption:'Transformer architecture diagram by dvgodoy, via Wikimedia Commons, CC BY 4.0.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Attention is the mechanism that lets a token read other tokens when a Transformer computes its next representation. Standard full attention stores key and value vectors for every prior token. As context grows, memory grows linearly and attention work grows with all token pairs.',
        'Long-context serving runs into a resource wall. A model that keeps exact key-value cache for 1,000,000 tokens uses far more memory per request than one that keeps 8,000 tokens. More memory per request means smaller batches, higher latency, and higher cost. Infini-attention exists to carry old context forward without storing every old token exactly.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is full attention over the whole input. It is the quality baseline because every token can directly compare against every earlier token. For short contexts, this is simple and accurate.',
        'The next approach is a sliding window. Keep only the most recent tokens and discard the rest. This makes memory predictable, but it makes old facts disappear. Retrieval-augmented generation is another approach: put old text in an external index and fetch chunks later. That helps factual lookup, but it adds a separate system and does not give the model a continuous internal memory.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is exact old-token storage. If a layer has 8 heads, key size 128, value size 128, and 1,000,000 cached tokens, it stores about 8 * 1,000,000 * 256 = 2,048,000,000 scalar values for that layer alone. Across 12 layers, that is about 24.6 billion scalar values before metadata.',
        'Discarding old tokens solves memory by losing information. Keeping old tokens preserves information by spending memory. Infini-attention attacks that tradeoff by replacing exact old-token storage with a fixed-size associative memory matrix.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Old context can be compressed into a bounded memory matrix. A key vector writes where information should be stored, and a value vector writes what should be stored. A later query vector reads from the same matrix. This is approximate content-addressable memory inside the Transformer block.',
        'The design keeps exact local attention for the current segment. That matters because syntax, local references, and nearby facts need precise token-level attention. The compressed path is for long-range recall, not a replacement for all attention.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'For each segment, the layer computes ordinary Q, K, and V vectors. Q means queries, K means keys, and V means values. The local path computes softmax attention over the current segment only. The memory path applies a positive feature map to Q, reads from the previous memory matrix M, and normalizes by a vector z.',
        'After reading, a learned gate chooses the mixture of local output and memory output. Then the layer updates memory by adding the outer product of transformed keys and values from the current segment. The normalization vector z also accumulates the transformed keys so future reads stay scaled.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The local path works for the same reason standard attention works: inside the segment, each query compares against all keys in that segment and forms a weighted sum of values. No approximation is introduced there. The compressed path works as linear attention: previous key-value associations have already been accumulated, so reading is a matrix product rather than a scan over all old tokens.',
        'The correctness claim is not exact recall. The safe claim is bounded-state recall. If the training objective teaches the memory to preserve useful associations, the model can retrieve old information with constant memory per layer. If two old facts map to similar memory locations, they can interfere.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Cost splits into local cost and memory cost. If the segment length is N, local attention still pays about O(N^2) work inside that segment. The memory matrix has size key_dim * value_dim per head, so old-context memory is constant with respect to the number of processed segments.',
        'With key_dim = value_dim = 128 and 8 heads, one layer stores 8 * 128 * 128 = 131,072 memory values plus normalization. Across 12 layers, that is about 1.6 million memory values. That is tiny compared with exact KV storage for 1,000,000 tokens, but it is lossy and adds read and update matrix work at every segment.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Infini-attention fits long documents, long transcripts, codebases, legal records, books, and multi-hour agent traces where local precision and distant context both matter. The access pattern is repeated segment processing with older context still influencing later outputs.',
        'It is also useful as a design point in serving systems. A provider can process long input in bounded memory instead of letting each request consume a KV cache proportional to total length. That can protect batch size and reduce offload pressure.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Compressive memory fails when the task needs verbatim old-token recall. A clause amount, password, quote, or exact code line may be blurred if it was only stored in the matrix. The paper reports strong passkey retrieval only after targeted fine-tuning, which shows that the mechanism needs training pressure to preserve exact facts.',
        'It also fails through interference and stale memory. New facts with similar keys can overwrite or blend with old facts. A later correction can coexist with an earlier statement unless the update rule and training objective learn to handle replacement.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Use a toy memory with key_dim = 2 and value_dim = 2. Segment 1 says payment is $50,000 and writes key [1, 0] with value [50, 0]. Segment 2 says delivery is March and writes key [0, 1] with value [0, 3]. The memory matrix now carries both associations in separate regions.',
        'Segment 10 asks about payment and produces query [1, 0]. The memory read returns mostly [50, 0], so the block can recover the old amount. If segment 12 revises payment to $75,000 with a similar key [0.9, 0.1], additive memory may return a blend between 50 and 75. The delta update variant tries to subtract the old association before writing the new one, but the fix depends on the keys being close enough.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary source: Munkhdalai, Faruqui, and Gopal, Leave No Context Behind: Efficient Infinite Context Transformers with Infini-attention, 2024, at https://arxiv.org/abs/2404.07143. Also study Katharopoulos et al., Transformers are RNNs, 2020, at https://arxiv.org/abs/2006.16236 and Schlag et al., Linear Transformers Are Secretly Fast Weight Programmers, 2021, at https://arxiv.org/abs/2102.11174.',
        'Study standard attention first, then KV cache, linear attention, Transformer-XL, retrieval-augmented generation, StreamingLLM, and state space models such as Mamba. The useful comparison is exact cache, external retrieval, and compressed internal state.',
      ],
    },
  ],
};