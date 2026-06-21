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
  const n = TOKENS.length;
  const windowSize = 4;
  const lastToken = TOKENS[n - 1].id;

  yield {
    state: maskState('Full causal attention: every past token remains visible', 'full'),
    highlight: { active: ['t7:t0', 't7:t1', 't7:t2', 't7:t3', 't7:t4', 't7:t5', 't7:t6', 't7:t7'] },
    explanation: `Full causal attention keeps every old token visible to every later token across all ${n} positions. That preserves maximum access, but pair count grows quadratically with O(${n}^2) = ${n * n} pairs.`,
  };

  yield {
    state: maskState('Sliding window: each token sees only the recent past', 'window'),
    highlight: { active: ['t7:t4', 't7:t5', 't7:t6', 't7:t7'], removed: ['t7:t0', 't7:t1', 't7:t2', 't7:t3'] },
    explanation: `A sliding window of size ${windowSize} caps each row. Token ${lastToken} sees only t${n - windowSize} through ${lastToken}, so old detail leaves the local attention path.`,
    invariant: `Full attention uses O(n^2) = ${n * n} pairs for ${n} tokens; a fixed window of ${windowSize} uses O(n * w) = ${n * windowSize} pairs.`,
  };

  yield {
    state: maskState('Local window plus global anchor', 'local-global'),
    highlight: { active: ['t7:t4', 't7:t5', 't7:t6', 't7:t7'], found: ['t7:t0'], removed: ['t7:t1', 't7:t2', 't7:t3'] },
    explanation: `Some designs keep global anchors (like ${TOKENS[0].id}) while using a local window of ${windowSize}. Token ${lastToken} sees ${windowSize} recent tokens plus the anchor, giving ${windowSize + 1} visible positions instead of all ${n}.`,
  };
}

function* rollingCache() {
  const windowW = 4096;
  const contextPolicies = 4;

  yield {
    state: pairsPlot([
      { id: 'full32k', x: 32768, y: 1.07, label: '32k full' },
      { id: 'win32k', x: 32768, y: 0.13, label: '32k window' },
      { id: 'full64k', x: 65536, y: 4.29, label: '64k full' },
    ]),
    highlight: { active: ['full'], found: ['windowed', 'win32k'], compare: ['full32k', 'full64k'] },
    explanation: `Windowing with w=${windowW} changes the growth law. Doubling context from 32k to 64k quadruples full attention pairs (1.07B to 4.29B), but only doubles fixed-window pairs since cost is O(n * ${windowW}).`,
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
    explanation: `Sliding-window attention is also a cache policy with ${contextPolicies} actions: append, keep inside, evict outside, and anchor. Recent tokens within the w=${windowW} window stay resident; old tokens are evicted or reachable only through special anchors.`,
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
    explanation: `A context policy should match the task across all ${contextPolicies} use cases shown. If old tokens can be retrieved or summarized, a bounded window of w=${windowW} can be cheaper than keeping every pair alive.`,
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
      heading: 'How to read the animation',
      paragraphs: [
        'Follow the visualization step by step. Each frame shows one operation with the current state highlighted. Use the slider or play button to control playback.',
        {type: 'image', src: './assets/gifs/sliding-window-attention-context-policy.gif', alt: 'Animated walkthrough of the sliding window attention context policy visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
      ],
    },
    {
      heading: 'The context budget problem',
      paragraphs: [
        'Sliding-window attention exists because full attention gives a beautiful interface and an ugly cost curve. In a causal Transformer, each token can attend to every previous token. That direct access is powerful, but the number of token pairs grows with the square of sequence length during training, and the KV cache grows with every token during inference. A model that accepts a long prompt still has to decide which evidence remains cheap to access.',
        {type: 'callout', text: 'Sliding-window attention is not a longer memory; it is a policy that makes recent exact memory cheap and distant exact memory scarce.'},
        'A sliding window is a context policy. It says: keep exact, direct attention for recent tokens, and stop paying full direct-attention cost for older tokens. That sounds like a compromise because it is one. The point is not to pretend old information is irrelevant. The point is to make memory and compute budgets explicit so long-context systems can run at all.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'The naive answer is full attention forever. That gives every token exact access to every older token, which is appealing for reasoning, quoting, and long dependency chains. The wall is cost. A 4x longer sequence creates roughly 16x more attention pairs during training. During decoding, a long prompt creates a large cache that consumes scarce accelerator memory and limits concurrency. At serving time, the question is not only "can the model read this?" but "how many users can we serve while it reads this?"',
        'Another naive answer is to advertise a large context length without explaining the internal policy. A model may accept a long input while using local attention, compressed memory, grouped attention, sink tokens, retrieval, or other tricks. Those policies are legitimate, but they are not the same as every token having equal direct access to every other token. Educational material should make that distinction clear.',
        'The opposite mistake is to use a local window and hope the model remembers everything important. If an exact old clause, variable definition, instruction, or citation falls outside the window and there is no summary, anchor, recurrence, or retrieval path, the model may behave as though the fact is gone. Sliding windows reduce cost by giving something up. The design question is whether the workload can tolerate that loss.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'In full causal attention, token i may attend to every token from 0 through i. In sliding-window attention, token i attends only to a bounded recent range, such as the previous w tokens. The attention mask changes from a full lower triangle into a diagonal band. The compute shape changes from roughly n squared token pairs to roughly n times w token pairs, where w is the window size.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1b/Transformer%2C_attention_block_diagram.png/250px-Transformer%2C_attention_block_diagram.png', alt: 'Scaled dot-product attention block with query key value mask softmax and output', caption: 'The sliding-window policy changes the mask inside this attention block, not the idea of query-key scoring itself. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Transformer,_attention_block_diagram.png.'},
        'During inference, the same idea becomes a rolling cache policy. The system keeps key and value rows for recent tokens and evicts or deprioritizes older rows. Some designs add anchor tokens, attention sinks, recurrent summaries, compressed memory, or retrieval so old information can still influence the model indirectly. A pure local window is the simplest case: old tokens outside the window are not directly visible to new tokens.',
        'The mechanism is easy to draw but hard to deploy well. The right window size depends on the task. Chat often depends heavily on recent turns. Code editing often depends on the current function, nearby imports, and active errors. Legal analysis may depend on definitions hundreds of pages earlier. A sliding window is therefore not just a model architecture choice; it is a product and evaluation choice.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Sliding-window attention works when useful context is local or can be made local. Natural language has many short-range dependencies. Code often has strong local structure. Conversation usually weights recent turns heavily. If the model can solve most next-token decisions from a nearby band, full all-pairs attention spends a large amount of compute on weak or redundant dependencies.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d2/Multiheaded_attention%2C_block_diagram.png/250px-Multiheaded_attention%2C_block_diagram.png', alt: 'Multi-head attention block with parallel attention heads and concatenation', caption: 'Multiple heads can learn different local or anchor routes, but each head still pays for the keys its policy exposes. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Multiheaded_attention,_block_diagram.png.'},
        'It also works because local attention improves serving economics. Accelerator memory is one of the hardest constraints in LLM inference. A bounded cache lets systems serve longer streams, more concurrent sessions, or lower latency than they could with unbounded exact history. This matters in real products: a context policy is part of capacity planning.',
        'The strongest long-context systems rarely rely on a blind local window alone. They combine local detail with other paths: retrieval for exact old evidence, summaries for durable state, sink tokens for stable attention behavior, global tokens for special positions, or hierarchical processing for documents. Sliding windows are often the cheap recent-memory layer in a larger memory system.',
      ],
    }
  ],
};
