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
        'The animation shows Infini-attention as a dataflow graph: each segment of input tokens enters the block and splits into two paths. The local-attention path (highlighted active) performs standard masked dot-product attention over the current segment. The memory path reads compressed older context from a bounded matrix M. A learned gate mixes the two outputs, and the combined result exits the block.',
        'Active nodes are operations happening now. The "found" highlight on the output node marks the final mixed result. When edges from both the local and memory paths converge at the gate, the animation is showing the core contract: recent tokens get exact attention, older tokens get approximate recall from compressed state, and a per-head scalar gate decides how much to trust each source.',
        {
          type: 'note',
          text: 'The word "infinite" in the paper title is aspirational, not literal. The architecture provides bounded-memory processing for unbounded-length inputs. Recall quality degrades with distance -- the question is how gracefully.',
        },
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Standard Transformer attention stores one key-value pair per token. A 1M-token input at 128-dimensional heads with 8 heads across 12 layers produces a KV cache that grows linearly with sequence length. Doubling the context doubles the memory. At serving time, that cache competes with batch size: more memory per request means fewer concurrent users.',
        {
          type: 'table',
          headers: ['Sequence length', 'KV pairs per head per layer', 'Scaling behavior'],
          rows: [
            ['4,096', '4,096', 'Fits comfortably in GPU memory'],
            ['32,768', '32,768', 'Starts constraining batch size'],
            ['500,000', '500,000', 'Requires offloading or approximation'],
            ['1,000,000', '1,000,000', 'Impractical for exact attention serving'],
          ],
        },
        'The constraint is not just memory. Attention computation is quadratic in sequence length: every query attends to every key. Even with FlashAttention and other IO-aware kernels, the fundamental cost curve is hostile to million-token contexts. Infini-attention exists because the field needed a way to carry old context forward without storing every old token exactly.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'Three reasonable strategies existed before Infini-attention, each with a real strength.',
        {
          type: 'table',
          headers: ['Strategy', 'How it works', 'Strength', 'Limitation'],
          rows: [
            ['Full attention', 'Keep every KV pair; attend to all', 'Exact recall at any distance', 'O(n) memory, O(n^2) compute'],
            ['Sliding window', 'Discard tokens older than window size', 'Constant memory cost', 'Old facts vanish silently'],
            ['Transformer-XL recurrence', 'Carry fixed-length segment cache forward', 'Some old context preserved', 'Cache size still linear in kept segments'],
          ],
        },
        'Full attention is the gold standard for quality but cannot serve million-token contexts economically. Sliding-window attention (used in Mistral and others) is cheap but amnesiac: a definition from chapter one is gone by chapter ten. Transformer-XL caches previous segment hidden states, but the cache grows with the number of segments retained, and gradient flow across segment boundaries is limited.',
        'A fourth option is retrieval-augmented generation: store old text in an external index and fetch relevant chunks at query time. This works well for factual lookup but adds latency, requires an index, and cannot replace the model\'s internal sense of what came before.',
        {
          type: 'note',
          text: 'None of these approaches is wrong. Each makes a different tradeoff on the same frontier: recall quality versus resource cost. Infini-attention tries to occupy a new point on that frontier by compressing old context into learned state rather than discarding it or storing it exactly.',
        },
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is that every prior bounded-memory scheme either loses old information entirely or carries it as raw tokens that still grow with input length.',
        'Sliding windows lose information by construction. Once a token leaves the window, no amount of local attention can recover it. Transformer-XL\'s segment cache is better but still linear: keeping the last S segments means storing (d_key + d_value) x H x N x S values, where H is head count and N is segment length. Memorizing Transformers (Wu et al., 2022) go further by keeping an external KV store of past segments, but that store also grows linearly with the number of past segments seen.',
        {
          type: 'table',
          headers: ['Method', 'Memory footprint formula', 'Grows with'],
          rows: [
            ['Transformer-XL', '(d_key + d_value) * H * N * l', 'Cached segment count l'],
            ['Memorizing Transformers', '(d_key + d_value) * H * N * S', 'Stored segment count S'],
            ['Infini-Transformer', 'd_key * (d_value + 1) * H * l', 'Layer count only (constant per layer)'],
          ],
        },
        'The Infini-Transformer memory footprint has no factor of N (segment length) or S (number of past segments). It stores one d_key x d_value matrix M and one d_key normalization vector z per head per layer. That footprint is fixed regardless of whether the model has seen 10 segments or 10,000.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Old context can be compressed into a fixed-size associative memory matrix that is read with linear attention and updated with an outer-product accumulation rule -- giving every Transformer layer a bounded, learnable long-term memory without changing the local attention mechanism.',
        {
          type: 'quote',
          text: 'Infini-attention incorporates a compressive memory into the vanilla attention mechanism with minimal change to the standard scaled dot-product attention. It builds in both masked local attention and long-term linear attention mechanisms in a single Transformer block.',
          attribution: 'Munkhdalai, Faruqui, and Gopal, 2024',
        },
        'The key mathematical move is treating memory as an associative binding matrix. Writing to memory is an outer product of keys and values. Reading from memory is a matrix-vector product with the query. This is equivalent to linear attention (Katharopoulos et al., 2020) and descends from the fast weight programmer literature (Schmidhuber, 1992). The insight is that this old idea can be grafted onto standard softmax attention as a parallel path, giving the model both exact local recall and approximate long-range recall in the same block.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Each Infini-attention layer processes input in fixed-size segments of N tokens. For each segment s, the layer performs five operations.',
        {
          type: 'diagram',
          text: [
            'Segment s tokens',
            '       |',
            '   +---+---+',
            '   |       |',
            '   v       v',
            ' Q,K,V   sigma(Q)',
            '   |       |',
            '   v       v',
            ' softmax  M_{s-1} read',
            ' local    +--> A_mem',
            ' attn     |',
            '   |      v',
            '   v    normalize',
            ' A_dot   by z_{s-1}',
            '   |       |',
            '   +---+---+',
            '       |',
            '       v',
            '  gate: sigmoid(beta)',
            '  A = sig(b)*A_mem + (1-sig(b))*A_dot',
            '       |',
            '       v',
            '    output',
            '',
            '  Then update:',
            '  M_s = M_{s-1} + sigma(K)^T * V',
            '  z_s = z_{s-1} + sum(sigma(K))',
          ].join('\n'),
          label: 'Infini-attention dataflow for one segment',
        },
        'Step 1: Compute Q, K, V from the segment tokens using standard linear projections, exactly as in vanilla attention.',
        'Step 2: Local attention. Compute A_dot = softmax(QK^T / sqrt(d_key)) * V. This is standard masked causal attention over the current segment only. It captures exact token-level relationships within the segment.',
        'Step 3: Memory retrieval. Compute A_mem = sigma(Q) * M_{s-1} / (sigma(Q) * z_{s-1}), where sigma is the element-wise ELU+1 activation function. This reads from the compressive memory using a linear attention kernel. The normalization vector z prevents the retrieved values from growing unboundedly.',
        'Step 4: Gating. Combine the two outputs: A = sigmoid(beta) * A_mem + (1 - sigmoid(beta)) * A_dot, where beta is a single learned scalar per attention head. The sigmoid ensures the gate stays in [0, 1]. Some heads learn to favor memory, others favor local attention, and some mix evenly.',
        'Step 5: Memory update. After reading, write the current segment into memory: M_s = M_{s-1} + sigma(K)^T * V. The normalization counter updates as z_s = z_{s-1} + sum(sigma(K_t)) over the segment tokens. Memory now carries information from all segments seen so far.',
        {
          type: 'code',
          language: 'python',
          label: 'Pseudocode for one Infini-attention segment step',
          body: '# sigma = ELU(x) + 1 (element-wise)\ndef infini_attention_segment(Q, K, V, M_prev, z_prev, beta):\n    # Local attention (standard)\n    A_dot = softmax(Q @ K.T / sqrt(d_key)) @ V\n\n    # Memory retrieval (linear attention read)\n    sigma_Q = elu(Q) + 1\n    A_mem = (sigma_Q @ M_prev) / (sigma_Q @ z_prev + eps)\n\n    # Gating\n    g = sigmoid(beta)\n    A = g * A_mem + (1 - g) * A_dot\n\n    # Memory update\n    sigma_K = elu(K) + 1\n    M_new = M_prev + sigma_K.T @ V\n    z_new = z_prev + sigma_K.sum(dim=0)\n\n    return A, M_new, z_new',
        },
      ],
    },
    {
      heading: 'The delta update variant',
      paragraphs: [
        'The basic update rule M_s = M_{s-1} + sigma(K)^T * V blindly adds new associations on top of old ones. If the same key pattern appears in multiple segments with different values, the memory accumulates conflicting entries.',
        'The delta variant fixes this by subtracting the existing memory content before writing:',
        {
          type: 'code',
          language: 'text',
          label: 'Delta memory update rule',
          body: 'M_s = M_{s-1} + sigma(K)^T * (V - sigma(K) * M_{s-1} / (sigma(K) * z_{s-1}))',
        },
        'The term (V - sigma(K) * M_{s-1}) retrieves what memory currently associates with each key, subtracts it from the new value, and writes only the residual. This is the delta rule from the fast weight programmer literature (Schlag et al., 2021). It reduces interference when the same concept is updated across segments.',
        {
          type: 'table',
          headers: ['Update rule', 'PG19 perplexity', 'Arxiv-Math perplexity', 'Interference handling'],
          rows: [
            ['Linear (additive)', '9.65', '2.24', 'Accumulates blindly'],
            ['Linear + Delta', '9.67', '2.23', 'Subtracts old before writing new'],
          ],
        },
        'In practice, the two variants perform comparably on language modeling benchmarks. The delta rule\'s advantage appears more clearly in tasks requiring precise factual updates across long contexts, where additive accumulation would blur old and new values of the same entity.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Three properties make the design sound.',
        'First, local attention preserves exact short-range relationships. Within a segment, the model has full softmax attention with the standard quadratic cost but only over N tokens (typically 2,048). Syntax, coreference, and local reasoning stay exact. This is not an approximation.',
        'Second, the compressive memory acts as a content-addressable store with O(1) read cost per query. The matrix-vector product sigma(Q) * M takes constant time regardless of how many segments have been written into M. The memory does not grow. This is the same principle behind linear attention: replacing the softmax kernel with a decomposable kernel (here, ELU+1) allows the attention computation to be rewritten as a matrix product with an accumulated state.',
        'Third, the gate allows each head to specialize. The paper\'s analysis of trained models found three distinct head behaviors:',
        {
          type: 'table',
          headers: ['Head type', 'Gate value (sigmoid(beta))', 'Behavior'],
          rows: [
            ['Local specialist', 'Near 0', 'Ignores memory; relies on exact segment attention'],
            ['Memory specialist', 'Near 1', 'Ignores local attention; reads primarily from long-term memory'],
            ['Mixer', 'Near 0.5', 'Blends both sources roughly equally'],
          ],
        },
        'Every layer contained at least one local-specialist head, ensuring that short-range signal propagation was never blocked by memory noise. This emergent specialization means the architecture does not force all heads to use memory -- it lets each head learn whether old context or recent context matters more for its role.',
        {
          type: 'note',
          text: 'The ELU+1 activation was chosen over alternatives like ReLU or softmax because it never produces zero (ELU(x) + 1 > 0 for all x), which prevents dead entries in the memory matrix, and because it showed stable training dynamics in the linear attention literature (Katharopoulos et al., 2020).',
        },
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The cost profile has two distinct regimes: within-segment cost (dominated by local attention) and cross-segment cost (dominated by memory operations).',
        {
          type: 'table',
          headers: ['Operation', 'Time complexity', 'Memory complexity'],
          rows: [
            ['Local attention (per segment)', 'O(N^2 * d)', 'O(N^2) attention matrix'],
            ['Memory read (per segment)', 'O(N * d_key * d_value)', 'O(d_key * d_value) for M'],
            ['Memory update (per segment)', 'O(N * d_key * d_value)', 'O(d_key) for z'],
            ['Total per segment', 'O(N^2 * d + N * d_key * d_value)', 'O(N^2 + d_key * d_value)'],
            ['Total for L segments', 'O(L * N^2 * d + L * N * d_key * d_value)', 'O(N^2 + d_key * d_value)'],
          ],
        },
        'The critical property: memory footprint is constant across segments. The matrix M is d_key x d_value per head per layer. With d_key = d_value = 128 and 8 heads across 12 layers, that is 128 * 129 * 8 * 12 = approximately 1.27M parameters of memory state. Compare that to full attention\'s KV cache for 1M tokens: 128 * 2 * 8 * 12 * 1,000,000 = approximately 24.6B values.',
        'The paper reports a 114x compression ratio over Memorizing Transformers on the PG19 benchmark. That compression is not free: the stored representation is lossy. But for workloads where the cost of storing exact KV pairs is prohibitive, bounded memory is the enabling constraint.',
        {
          type: 'note',
          text: 'Within each segment, Infini-attention still pays the full quadratic cost of softmax attention. The savings come from not extending that quadratic window across the entire sequence. A 1M-token input processed in 2,048-token segments requires 488 segment passes with O(2048^2) local attention each, versus one O(1M^2) full-attention pass.',
        },
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'The paper validated Infini-attention on three tasks that stress long-range memory differently.',
        {
          type: 'table',
          headers: ['Task', 'Context length', 'Model', 'Result', 'Baseline comparison'],
          rows: [
            ['PG19 language modeling', '32K-100K training', '12L/8H', '9.65 perplexity', 'Memorizing Transformers: 11.37'],
            ['Passkey retrieval', '1M tokens', '1B params', '100% accuracy (after fine-tuning)', 'Zero-shot: 7-8%'],
            ['BookQA summarization', '500K tokens', '8B params', 'ROUGE-L 17.9', 'PRIMERA+Unlimiformer: 17.2'],
          ],
        },
        'The passkey result is the most striking. A 1B model, continually pre-trained on only 4K-length sequences with 30K steps, then fine-tuned for 400 steps on 5K-length sequences, could retrieve a hidden passkey from anywhere in a 1M-token context. This demonstrates that the compressive memory can carry precise small facts across enormous distances when fine-tuned to do so.',
        'Long-document processing is the natural production fit. A model reading a 500-page technical manual can keep exact attention over the current 2,048-token window while carrying chapter-level context, recurring definitions, and entity state in memory. Meeting transcription, legal document review, and codebase understanding all share this pattern: local precision matters, but so does awareness of what was established hundreds of pages ago.',
        {
          type: 'note',
          text: 'The continual pre-training strategy is key to practical adoption. Infini-attention does not require training a model from scratch. The paper takes existing pre-trained models and adapts them with relatively short additional training (30K steps), making the approach compatible with the standard foundation-model workflow.',
        },
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Compressive memory trades exact recall for bounded storage. That tradeoff has concrete failure modes.',
        {
          type: 'table',
          headers: ['Failure mode', 'Mechanism', 'Example'],
          rows: [
            ['Detail erasure', 'Compression discards specifics', 'Remembers a contract existed but loses the dollar amount'],
            ['Interference', 'Later writes corrupt earlier entries', 'Two characters with similar names blur into one memory entry'],
            ['Boundary artifacts', 'Segment splits break cross-boundary dependencies', 'A sentence split across segments loses its grammatical coherence in memory'],
            ['Stale retrieval', 'Memory carries outdated associations', 'An entity redefined in segment 50 still returns its segment-3 definition'],
            ['False confidence', 'Gate trusts memory for tasks requiring exact recall', 'Model produces a plausible-sounding but fabricated quote from an earlier chapter'],
          ],
        },
        'The zero-shot passkey accuracy of only 7-8% reveals the core limitation: without targeted fine-tuning, the compressive memory does not automatically learn to preserve arbitrary exact facts. The 100% accuracy after fine-tuning shows the mechanism has the capacity, but the training objective must teach the model what to preserve.',
        'Memory interference is especially dangerous with the additive update rule. If segment 5 and segment 50 both contain information about "the defendant," their key vectors will be similar, and the additive outer product accumulates both value vectors in overlapping memory locations. The delta rule mitigates this but does not eliminate it.',
        'There is also a systems-level concern. The memory read adds a matrix-vector multiplication per head per layer per segment step. In a deeply pipelined serving system, this additional operation must be batched efficiently and must remain numerically stable under FP16 or INT8 quantization. The paper does not report quantized serving results.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Consider a 4-segment processing of a legal contract. Each segment is 2,048 tokens. The model has d_key = d_value = 4 (simplified for illustration) and one attention head.',
        {
          type: 'code',
          language: 'text',
          label: 'Segment-by-segment memory evolution',
          body: 'Segment 0: "Party A agrees to pay $50,000 by March 15..."\n  M_0 = sigma(K_0)^T * V_0       # Initial memory: contract terms\n  z_0 = sum(sigma(K_0))           # Normalization initialized\n\nSegment 1: "Party B shall deliver equipment per Schedule C..."\n  Read:  A_mem = sigma(Q_1) * M_0 / (sigma(Q_1) * z_0)  # Recall: payment terms\n  Local: A_dot = softmax(Q_1 K_1^T / 2) * V_1            # Exact: delivery terms\n  Gate:  A = 0.3 * A_mem + 0.7 * A_dot                   # Head favors local\n  Write: M_1 = M_0 + sigma(K_1)^T * V_1                  # Memory now has both\n\nSegment 2: "Force majeure clause: neither party liable..."\n  Read:  A_mem = sigma(Q_2) * M_1 / (sigma(Q_2) * z_1)  # Recall: terms so far\n  Local: A_dot = softmax(Q_2 K_2^T / 2) * V_2            # Exact: force majeure\n  Gate:  A = 0.6 * A_mem + 0.4 * A_dot                   # Head trusts memory more\n  Write: M_2 = M_1 + sigma(K_2)^T * V_2                  # Three segments compressed\n\nSegment 3: "Amendment: payment revised to $75,000..."\n  Read:  A_mem = sigma(Q_3) * M_2 / (sigma(Q_3) * z_2)  # Recall: old $50K term\n  # CRITICAL: does memory return $50K, $75K, or a blend?\n  # With additive update, both amounts contribute to the same key region.\n  # The delta rule would subtract the old value before writing the new one.',
        },
        'This example shows the interference problem concretely. When the payment amount changes from $50,000 to $75,000, the additive memory accumulates both values. A query about "the payment amount" retrieves a weighted blend. The delta variant would first retrieve and subtract the $50,000 association before writing $75,000, producing cleaner updates. But even the delta rule depends on the key vectors being similar enough to trigger the subtraction -- if the amendment is phrased very differently from the original clause, the old entry may persist.',
      ],
    },
    {
      heading: 'Comparison with related approaches',
      paragraphs: [
        'Infini-attention belongs to a family of bounded-state long-context methods. Each makes a different bet about what to keep and what to compress.',
        {
          type: 'table',
          headers: ['Method', 'State type', 'State size', 'Update rule', 'Exact old-token recall?'],
          rows: [
            ['Full attention', 'All KV pairs', 'O(n) per layer', 'Append', 'Yes'],
            ['Sliding window', 'Recent KV pairs', 'O(w) per layer', 'Discard oldest', 'No (outside window)'],
            ['StreamingLLM', 'Sink tokens + recent', 'O(w + s) per layer', 'Keep sinks, slide window', 'No (outside window + sinks)'],
            ['Transformer-XL', 'Cached segment states', 'O(N * l) per layer', 'Shift cache', 'Partial (within cache)'],
            ['Memorizing Transformers', 'External KV store', 'O(n) external', 'Append to store', 'Yes (with retrieval cost)'],
            ['Mamba (S6)', 'Recurrent hidden state', 'O(d * d) per layer', 'Selective scan', 'No (compressed)'],
            ['Infini-attention', 'Associative matrix M + z', 'O(d_k * d_v) per layer', 'Outer-product accumulation', 'No (compressed)'],
          ],
        },
        'The unique position of Infini-attention is that it keeps the standard Transformer block shape. The local attention path is unchanged. The memory path is added in parallel, not as a replacement. This means existing pre-trained weights can be reused, and the memory mechanism can be introduced through continual pre-training rather than training from scratch.',
        {
          type: 'note',
          text: 'Mamba and Infini-attention are conceptually similar: both carry fixed-size state forward. The difference is that Mamba replaces attention entirely with a selective state-space model, while Infini-attention keeps softmax attention for local context and adds linear-attention memory alongside it. The hybrid approach preserves the in-context learning capabilities of attention at the cost of higher per-segment compute.',
        },
      ],
    },
    {
      heading: 'Evaluation checklist',
      paragraphs: [
        'A credible evaluation of any compressive memory system must separate gist recall from exact recall. Average perplexity can look good while exact-fact retrieval fails.',
        {
          type: 'bullets',
          items: [
            'Language modeling perplexity on long documents (PG19, Arxiv-Math) -- measures general next-token prediction quality.',
            'Passkey retrieval across positions -- measures whether a single injected fact survives compression at varying distances.',
            'Multi-document QA -- measures whether the model can distinguish sources and avoid blurring information across documents.',
            'Needle-in-a-haystack with distractors -- measures robustness when irrelevant content fills the context.',
            'Contradiction detection -- measures whether the model notices when recent text contradicts old memory.',
            'Peak memory measurement at sequence lengths 32K, 128K, 512K, 1M -- verifies the bounded-memory claim empirically.',
            'Latency breakdown: local attention time vs. memory read/write time vs. gating -- identifies whether the memory path becomes a bottleneck.',
            'Quantized serving quality (FP16, INT8) -- verifies that the memory matrix remains numerically stable under reduced precision.',
          ],
        },
        'The paper demonstrates the first three convincingly. The systems-level evaluations (latency breakdown, quantized serving, memory profiling at scale) remain open for production adoption.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        {
          type: 'quote',
          text: 'Leave No Context Behind: Efficient Infinite Context Transformers with Infini-attention.',
          attribution: 'Munkhdalai, Faruqui, and Gopal, 2024 -- https://arxiv.org/abs/2404.07143',
        },
        'The paper builds directly on the linear attention framework of Katharopoulos et al. (2020), "Transformers are RNNs," and the fast weight programmer tradition starting from Schmidhuber (1992). The delta update rule comes from Schlag et al. (2021), "Linear Transformers Are Secretly Fast Weight Programmers."',
        {
          type: 'table',
          headers: ['Role', 'Topic'],
          rows: [
            ['Prerequisite', 'Attention mechanism -- understand scaled dot-product attention before studying its compressive extension'],
            ['Prerequisite', 'KV Cache -- understand what gets stored and why it grows with sequence length'],
            ['Contrast', 'StreamingLLM Attention Sinks -- a different bounded-memory strategy that keeps sink tokens instead of compressing'],
            ['Contrast', 'Selective State Space Models: Mamba -- replaces attention entirely with recurrent state'],
            ['Extension', 'Hybrid Attention State Budget Case Study -- how to allocate capacity across exact and compressed memory tiers'],
            ['Evaluation', 'Lost in the Middle -- the position-dependent failure pattern that compressive memory aims to mitigate'],
          ],
        },
      ],
    },
  ],
};

