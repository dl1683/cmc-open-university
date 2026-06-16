// Sliding-window attention as a context policy: cap pairwise attention and
// rolling KV state while preserving recent local detail.

import { matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'sliding-window-attention-context-policy',
  title: 'Sliding-Window Attention Context Policy',
  category: 'AI & ML',
  summary: 'Bound long-context attention by keeping a rolling local window, optional global anchors, and a clear tradeoff between memory and recall.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['attention mask', 'rolling cache'], defaultValue: 'attention mask' },
  ],
  run,
};

const TOKENS = Array.from({ length: 8 }, (_, i) => ({ id: `t${i}`, label: `t${i}` }));

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

function maskState(title, mode) {
  const values = TOKENS.map((_, r) => TOKENS.map((__, c) => {
    if (c > r) return 0;
    if (mode === 'full') return 1;
    if (mode === 'local-global' && c === 0) return 2;
    return r - c < 4 ? 1 : 0;
  }));
  return matrixState({
    title,
    rows: TOKENS,
    columns: TOKENS,
    values,
    format: (value) => ['', 'attend', 'anchor'][value],
  });
}

function pairsPlot(markers = []) {
  const tokenCounts = [1024, 2048, 4096, 8192, 16384, 32768, 65536];
  const full = tokenCounts.map((n) => ({ x: n, y: (n * n) / 1e9 }));
  const windowed = tokenCounts.map((n) => ({ x: n, y: (n * 4096) / 1e9 }));
  return plotState({
    axes: {
      x: { label: 'sequence tokens n', min: 0, max: 68000 },
      y: { label: 'attention pair count, billions', min: 0, max: 4.5 },
    },
    series: [
      { id: 'full', label: 'full causal attention', points: full },
      { id: 'windowed', label: 'window w = 4096', points: windowed },
    ],
    markers,
  });
}

function* attentionMask() {
  yield {
    state: maskState('Full causal attention: every past token remains visible', 'full'),
    highlight: { active: ['t7:t0', 't7:t1', 't7:t2', 't7:t3', 't7:t4', 't7:t5', 't7:t6', 't7:t7'] },
    explanation: 'Full causal attention keeps every old token visible to every later token. That preserves maximum access, but pair count grows quadratically.',
  };

  yield {
    state: maskState('Sliding window: each token sees only the recent past', 'window'),
    highlight: { active: ['t7:t4', 't7:t5', 't7:t6', 't7:t7'], removed: ['t7:t0', 't7:t1', 't7:t2', 't7:t3'] },
    explanation: 'A sliding window caps each row. Token t7 sees only t4 through t7, so old detail leaves the local attention path.',
    invariant: 'Full attention uses O(n^2) pairs; a fixed window uses O(n w) pairs.',
  };

  yield {
    state: maskState('Local window plus global anchor', 'local-global'),
    highlight: { active: ['t7:t4', 't7:t5', 't7:t6', 't7:t7'], found: ['t7:t0'], removed: ['t7:t1', 't7:t2', 't7:t3'] },
    explanation: 'Some designs keep global anchors or summary tokens while using local windows. That gives the model a cheap route to persistent context, but it is no longer all-pairs memory.',
  };
}

function* rollingCache() {
  yield {
    state: pairsPlot([
      { id: 'full32k', x: 32768, y: 1.07, label: '32k full' },
      { id: 'win32k', x: 32768, y: 0.13, label: '32k window' },
      { id: 'full64k', x: 65536, y: 4.29, label: '64k full' },
    ]),
    highlight: { active: ['full'], found: ['windowed', 'win32k'], compare: ['full32k', 'full64k'] },
    explanation: 'Windowing changes the growth law. Doubling context quadruples full attention pairs, but only doubles fixed-window pairs.',
  };

  yield {
    state: labelMatrix(
      'Rolling KV cache policy',
      [
        { id: 'append', label: 'append' },
        { id: 'inside', label: 'inside' },
        { id: 'outside', label: 'outside' },
        { id: 'anchor', label: 'anchor' },
      ],
      [
        { id: 'cache action', label: 'cache' },
        { id: 'model effect', label: 'effect' },
      ],
      [
        ['write K/V', 'recent grows'],
        ['keep K/V', 'local detail'],
        ['evict', 'no direct'],
        ['keep', 'global route'],
      ],
    ),
    highlight: { active: ['append:cache action', 'inside:cache action'], removed: ['outside:cache action'], found: ['anchor:cache action'] },
    explanation: 'Sliding-window attention is also a cache policy. Recent tokens stay resident; old tokens are evicted, compressed, summarized, or reachable only through special anchors.',
  };

  yield {
    state: labelMatrix(
      'Choosing a context policy',
      [
        { id: 'chat', label: 'chat' },
        { id: 'code', label: 'code' },
        { id: 'rag', label: 'RAG' },
        { id: 'book', label: 'book' },
      ],
      [
        { id: 'need', label: 'needs' },
        { id: 'policy', label: 'policy' },
      ],
      [
        ['recent turns', 'local window'],
        ['file + repo', 'window + RAG'],
        ['citations', 'retrieve'],
        ['distant refs', 'hierarchy'],
      ],
    ),
    highlight: { found: ['chat:policy', 'code:policy', 'rag:policy', 'book:policy'] },
    explanation: 'A context policy should match the task. If old tokens can be retrieved or summarized, a bounded window can be cheaper than keeping every pair alive.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'attention mask') yield* attentionMask();
  else if (view === 'rolling cache') yield* rollingCache();
  else throw new InputError('Pick a sliding-window attention view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'Sliding-window attention is a context policy for long sequences. Instead of letting every token attend to every previous token, each token attends only to a recent window. Some systems add global anchors, summary tokens, retrieval, or stacked-layer effects so older information can still influence the model indirectly.',
        'This is different from the classic Sliding Window algorithm page, but the same data-structure idea is present: keep a moving region of interest, drop stale detail, and make the memory budget explicit.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Full causal attention has about n^2 token pairs. A fixed local window of width w has about n w pairs. The model no longer has direct all-pairs access, but the compute and cache growth become much easier to control. In inference, a rolling KV cache can discard or compress old keys and values outside the window.',
        'Mistral 7B uses sliding-window attention and grouped-query attention together. That combination is a useful teaching case: GQA reduces how many K/V heads are stored per token, while the sliding window reduces how many old tokens each layer needs to attend to.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The main benefit is bounded cost. With a 4096-token window, a 64k-token sequence does not require every layer to score all 64k by 64k token pairs. The main risk is lost dependency. If the answer depends on a precise fact outside the window and there is no global, summary, or retrieval path, the model may behave as if that fact is gone.',
        'Stacked transformer layers can expand the effective receptive field beyond one local window, but that is not the same as direct access to every old token. Product teams should test tasks with distant references, repeated entities, code definitions, and old instructions before relying on a windowed model.',
      ],
    },
    {
      heading: 'Case study',
      paragraphs: [
        'A coding assistant may not need every earlier terminal line in direct attention. It may need the current file, recent edits, the active error, and a reliable way to retrieve definitions elsewhere in the repository. A sliding window plus retrieval index can serve that workload better than forcing every old token into one prompt.',
        'A legal or book-length analysis may have harder cross-reference requirements. There, a pure local window can miss distant clauses or earlier definitions. The architecture may need global anchors, hierarchical summaries, source-ledger retrieval, or explicit citation checks.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'Do not market a large nominal context length as if every token receives equal attention. A windowed model can accept long input while using a bounded attention pattern. Do not assume summaries preserve all detail. Do not hide the policy from evaluation: long-context tests should include information placed outside the recent window.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Mistral 7B at https://arxiv.org/abs/2310.06825, Longformer at https://arxiv.org/abs/2004.05150, Attention Is All You Need at https://arxiv.org/abs/1706.03762, and the JAX inference chapter at https://jax-ml.github.io/scaling-book/inference/. Study Sliding Window, Attention Mechanism, KV Cache, Grouped-Query Attention, Transformer Layer FLOPs Cost Model, and RAG Pipeline next.',
      ],
    },
  ],
};
