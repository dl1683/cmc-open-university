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
        'Read each row as one token deciding which older tokens it may inspect. A token is a position in the prompt or generated text; attention is the operation that scores older positions and mixes their stored key-value information into the next computation.',
        {type: 'image', src: './assets/gifs/sliding-window-attention-context-policy.gif', alt: 'Animated walkthrough of the sliding window attention context policy visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
        'The bright band is the active window. Tokens inside the band are visible through exact attention; tokens outside it are not directly visible unless another mechanism such as a summary, retrieval result, or anchor token brings them back. The safe inference rule is local: if a key is outside the allowed band, this layer cannot read it directly.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Full causal attention lets token i read every token before it. That is a simple interface, but it creates a pair for every earlier token, so the attention table grows with sequence length squared during training and the key-value cache grows with every token during generation.',
        {type: 'callout', text: 'Sliding-window attention is not a longer memory; it is a policy that makes recent exact memory cheap and distant exact memory scarce.'},
        'A context policy is a rule for deciding which previous information remains cheap to access. Sliding-window attention is the most direct policy: keep recent tokens exact and make old tokens expensive or invisible. It exists because long prompts are only useful when the serving system can still afford latency, memory, and user concurrency.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is full attention forever. If a prompt has 8,000 tokens, each new training position can score all older positions, and no information is hidden by architecture policy.',
        'That approach is attractive because correctness is easy to reason about: if the answer depends on a clause 6,000 tokens back, the model has a direct path to it. It also keeps model code simple because the mask is just the usual causal lower triangle. The cost is paid as more score entries, more memory traffic, and a larger inference cache.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is quadratic pair growth. A 2,000-token sequence has about 2,000 x 2,000 attention score slots in a dense layer; an 8,000-token sequence has about 16 times as many. Hardware improves constants, but it does not change that multiplication.',
        'Inference has a different wall: the key-value cache. Every generated token needs stored key and value vectors from previous tokens, and those rows compete for accelerator memory with model weights and other users. A system that can answer one long conversation may still be uneconomical if it cannot serve many conversations at once.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Most next-token decisions depend heavily on recent text. A local attention band spends exact compute where dependency probability is high and refuses to spend the same compute on every distant pair.',
        'The attention mask is the main idea. Instead of allowing token i to attend to positions 0 through i, the mask allows only positions max(0, i - w) through i, where w is the window size. The model still uses query-key scoring and softmax; the policy changes which scores exist.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'In a transformer, a query vector from the current token is compared with key vectors from allowed older tokens. The resulting scores pass through softmax, then weight the corresponding value vectors. Sliding-window attention changes the allowed older tokens before scoring starts.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1b/Transformer%2C_attention_block_diagram.png/250px-Transformer%2C_attention_block_diagram.png', alt: 'Scaled dot-product attention block with query key value mask softmax and output', caption: 'The sliding-window policy changes the mask inside this attention block, not the idea of query-key scoring itself. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Transformer,_attention_block_diagram.png.'},
        'With sequence length n and window w, each token scores at most w older positions. Training attention work changes from about n squared pairs to about n times w pairs. During generation, the cache can keep only the most recent w key-value rows for a pure local layer.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d2/Multiheaded_attention%2C_block_diagram.png/250px-Multiheaded_attention%2C_block_diagram.png', alt: 'Multi-head attention block with parallel attention heads and concatenation', caption: 'Multiple heads can learn different local or anchor routes, but each head still pays for the keys its policy exposes. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Multiheaded_attention,_block_diagram.png.'},
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The correctness claim is conditional, not absolute. Sliding-window attention preserves exact access to every dependency whose source token lies inside the window. If the needed evidence is local, the masked model has the same direct attention path that full attention would have used.',
        'The invariant is that every allowed score is a real causal score and every disallowed score is treated as impossible for that layer. No token can accidentally read the future, and no token can read outside the policy through that attention head. Long-range correctness must come from other paths: summaries, retrieval, recurrence, global tokens, or later architecture layers that expose selected old information.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'For dense full attention, doubling n roughly quadruples the number of score pairs. For sliding-window attention with fixed w, doubling n roughly doubles the score pairs because each token still sees at most w neighbors. At n = 8,000 and w = 512, a layer considers about 4.1 million local pairs instead of 64 million dense pairs.',
        'Memory behavior changes in the same direction. The training score matrix can be computed as a band rather than a full square, and a pure local inference cache can evict old key-value rows after w tokens. The hidden cost is quality risk: the model may lose exact old facts unless the system supplies another route.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Sliding windows fit chat, code completion inside a local edit region, speech and audio streams, log analysis, and any task where recent context carries most of the predictive load. They also fit serving systems that need predictable memory per session.',
        'They are usually one layer in a larger memory design. A long-document assistant may keep local attention for nearby wording, retrieval for old evidence, and summaries for durable task state. That combination is more honest than advertising a huge context length while hiding which tokens are directly visible.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'It fails when exact old details matter and no other path preserves them. A contract definition, variable binding, user instruction, or citation outside the window can become unreachable even though it remains in the original prompt.',
        'It also fails as a product claim when context length is reported without policy. Accepting 128,000 tokens is not the same as every token reading every other token at full fidelity. Evaluation must test the actual workload: quote recovery, codebase navigation, legal cross-reference, multi-turn instruction retention, and distractor resistance.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Take 10 tokens numbered 0 through 9 and a window size w = 4. Token 9 may attend to tokens 5, 6, 7, 8, and 9 if self-attention includes the current position. Tokens 0 through 4 are outside the direct band for that layer.',
        'Full attention for 10 causal tokens has 55 visible pairs if each token can see itself and all previous tokens. The windowed version has 1 + 2 + 3 + 4 visible pairs for the first four tokens, then 5 visible pairs for each of the remaining six tokens, for 40 visible pairs. At 10 tokens the saving is small; at 8,000 tokens with w = 512, the dense count is about 32 million causal pairs while the windowed count is about 4 million.',
        'Now place the sentence "use euros" at token 2 and the question at token 9. A pure w = 4 layer cannot directly read token 2 from token 9. The answer can still be correct only if earlier layers, summaries, retrieval, or special global positions have moved that fact into the visible band.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Study the Transformer paper by Vaswani et al. for scaled dot-product attention, Longformer for local plus global attention, Transformer-XL for recurrence, Mistral-style sliding-window attention for modern decoder use, and FlashAttention for memory-efficient exact attention kernels. The common question is which score pairs are computed, stored, skipped, or approximated.',
        'Inside this curriculum, study Attention, Grouped-Query Attention KV Sharing, KV Cache Paging, Softmax Temperature, Retrieval-Augmented Generation, Ring Buffer, and Sparse Matrix formats. Those topics explain the math, the serving memory, and the data layout behind the mask.',
      ],
    },
  ],
};