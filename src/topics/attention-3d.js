// Attention as TERRAIN: the weight matrix for one sentence rendered as a
// 3D landscape — a locality ridge along the diagonal, a coreference
// mountain where "it" finds "cat", and the causal mask as a sheer cliff.

import { surface3dState, InputError } from '../core/state.js';

export const topic = {
  id: 'attention-3d',
  title: 'Attention as a 3D Landscape',
  category: 'AI & ML',
  summary: 'One sentence\'s attention matrix as WebGL terrain: the diagonal ridge, the "it"→"cat" mountain, the causal cliff.',
  controls: [
    { id: 'view', label: 'Survey', type: 'select', options: ['the content head', 'the positional head'], defaultValue: 'the content head' },
  ],
  run,
};

// "The cat sat on the mat because it ..." — 8 tokens, causal attention.
const TOKENS = ['The', 'cat', 'sat', 'on', 'the', 'mat', 'because', 'it'];
// A content head: meaning-driven. Row q = where query token q looks.
const CONTENT = [
  [1.00, 0, 0, 0, 0, 0, 0, 0],
  [0.35, 0.65, 0, 0, 0, 0, 0, 0],
  [0.10, 0.55, 0.35, 0, 0, 0, 0, 0],
  [0.05, 0.15, 0.50, 0.30, 0, 0, 0, 0],
  [0.10, 0.10, 0.15, 0.35, 0.30, 0, 0, 0],
  [0.05, 0.15, 0.10, 0.25, 0.20, 0.25, 0, 0],
  [0.05, 0.10, 0.20, 0.05, 0.05, 0.25, 0.30, 0],
  [0.04, 0.62, 0.06, 0.02, 0.02, 0.12, 0.05, 0.07],
];
// A positional head: structure-driven — look at the previous token.
const POSITIONAL = TOKENS.map((_, q) =>
  TOKENS.map((_, k) => {
    if (k > q) return 0;
    if (q === 0) return 1;
    if (k === q - 1) return 0.7;
    if (k === q) return 0.2;
    return 0.1 / q;
  }));

// Bilinear upsample for a smooth surface (token grid stays 8×8 logically).
function upsample(M, factor) {
  const n = M.length;
  const out = [];
  for (let r = 0; r < (n - 1) * factor + 1; r++) {
    const row = [];
    const rf = r / factor;
    const r0 = Math.min(Math.floor(rf), n - 2);
    const tr = rf - r0;
    for (let c = 0; c < (n - 1) * factor + 1; c++) {
      const cf = c / factor;
      const c0 = Math.min(Math.floor(cf), n - 2);
      const tc = cf - c0;
      row.push(
        M[r0][c0] * (1 - tr) * (1 - tc) + M[r0 + 1][c0] * tr * (1 - tc)
        + M[r0][c0 + 1] * (1 - tr) * tc + M[r0 + 1][c0 + 1] * tr * tc,
      );
    }
    out.push(row);
  }
  return out;
}
const AXES = { x: { min: 0, max: 7, label: 'key (looked AT)' }, y: { min: 0, max: 7, label: 'query (looking)' } };
const terrain = (M, markers = []) =>
  surface3dState({ axes: { ...AXES, z: { label: 'attention weight' } }, heights: upsample(M, 4), markers });
const w = (M, q, k) => M[q][k];

function* contentHead() {
  yield {
    state: terrain(CONTENT, [{ id: 'peak', x: 1, y: 7, z: w(CONTENT, 7, 1), label: '"it" → "cat"' }]),
    highlight: {},
    explanation: 'The sentence: "The cat sat on the mat because it…" — and this terrain is one attention head\'s entire view of it. The floor is a grid: the axis running one way is the QUERY (the token doing the looking), the other is the KEY (the token being looked at), and the HEIGHT at each point is the attention weight — how much that query pulls information from that key. Multi-Head Attention showed this as a flat heatmap of numbers; in 3D the numbers become geography, and the camera\'s slow orbit will walk you past three landmarks worth knowing by name.',
  };

  yield {
    state: terrain(CONTENT, [{ id: 'diag', x: 3.5, y: 3.5, z: 0.36, label: 'the locality ridge' }]),
    highlight: { active: ['diag'] },
    explanation: 'Landmark 1 — THE RIDGE along the diagonal: most tokens attend substantially to themselves and their recent neighbors, so the terrain rises where query ≈ key. Locality is the default posture of language (most words relate to words nearby), and the ridge is that prior made solid. Notice it is a ridge and not a wall — weights leak off it toward semantically relevant tokens, like "sat" reaching back to "cat" (the verb finding its subject). Flat heatmaps show these as faint cells; in relief, you can see the leakage flow downhill.',
    invariant: 'Each query row is a probability distribution: the terrain along any query line sums to exactly 1.',
  };

  yield {
    state: terrain(CONTENT, [{ id: 'peak', x: 1, y: 7, z: w(CONTENT, 7, 1), label: '"it" → "cat": 0.62' }]),
    highlight: { found: ['peak'] },
    explanation: 'Landmark 2 — THE MOUNTAIN, and the reason this page exists: walk to the last query row, the token "it". Its attention does NOT pile on the diagonal — it leaps six tokens back and erupts at "cat" with weight 0.62. That single peak is COREFERENCE RESOLUTION happening in front of you: for the model to continue the sentence ("…was tired"? "…was comfortable"?), "it" must mean something, and attention is the mechanism that fetches the meaning — a learned, content-based lookup that no fixed window or convolution could do. One mountain in the terrain = one pronoun understood.',
    invariant: 'Attention is content-addressed: a query can summit ANY visible key, regardless of distance.',
  };

  yield {
    state: terrain(CONTENT, [{ id: 'cliff', x: 5.5, y: 2, z: 0.02, label: 'the causal cliff (zeros)' }]),
    highlight: { removed: ['cliff'] },
    explanation: 'Landmark 3 — THE CLIFF: the entire half of the map where key > query is dead flat at zero. That is the CAUSAL MASK, the rule that a token may only attend to the PAST — token 2 cannot look at token 5, because at generation time token 5 does not exist yet. In the 2D heatmap this is a gray triangle; as terrain it is a sheer escarpment splitting the world into the knowable past and the forbidden future. Every autoregressive LLM you have used lives entirely on the landward side of this cliff, one token at a time (and the KV Cache is precisely a cache of the cliff-side terrain already computed).',
    invariant: 'Causal masking zeroes all key > query: the future is geometrically absent, not merely discouraged.',
  };
}

function* positionalHead() {
  yield {
    state: terrain(POSITIONAL, [{ id: 'prev', x: 4, y: 5, z: 0.7, label: 'the previous-token ridge' }]),
    highlight: { active: ['prev'] },
    explanation: 'Same sentence, DIFFERENT HEAD — and a completely different country. This head\'s terrain is one clean, sharp ridge exactly one step below the diagonal: every token attends ~70% to its immediate predecessor, regardless of meaning. This is a POSITIONAL head — pure structure, no semantics — and heads like it (previous-token heads, induction-pattern heads) are found in every trained transformer, where they serve as plumbing for syntax and copying patterns. Multi-head attention\'s whole premise is here: run many heads in parallel, each free to learn its own geography — one watches meaning, one watches position, others watch things we are still naming.',
    invariant: 'Heads specialize: the same sentence produces independent terrains, one per head, combined downstream.',
  };

  yield {
    state: terrain(POSITIONAL, [
      { id: 'prev', x: 6, y: 7, z: 0.7, label: 'this head: "it" → "because"' },
    ]),
    highlight: { compare: ['prev'] },
    explanation: 'Look where THIS head sends "it": dutifully to "because", its previous token — weight 0.7, zero interest in "cat". Neither head is wrong; they answer different questions ("what came just before?" vs "what does this refer to?"), and the model\'s next layer combines both terrains, weighted by what the task needs. That division of labor is why ablating single heads often barely dents a model while ablating a head TYPE can cripple it. When you read attention visualizations in papers — or audit one with Saliency Maps & Feature Attribution\'s skepticism — the first question is always: which geography am I looking at, structure or meaning?',
  };

  yield {
    state: terrain(POSITIONAL),
    highlight: {},
    explanation: 'A closing thought from the terrain itself: both of this page\'s landscapes were 8×8 — sixty-four numbers, computable by hand. A modern model runs sequences of 100,000+ tokens through dozens of layers with dozens of heads each: billions of these terrains per response, each recomputed per token generated (minus what the KV Cache remembers). The geometry you just walked — ridge, mountain, cliff — is the atomic unit of how transformers relate words, repeated at a scale no visualization can hold. Which is exactly why it is worth knowing ONE of them this intimately: every context window you will ever fill is made of these hills.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'the content head') yield* contentHead();
  else if (view === 'the positional head') yield* positionalHead();
  else throw new InputError('Pick a view.');
}

export const article = {
  sections: [
    {
      heading: 'Why this exists',
      paragraphs: [
        `Attention exists because sequence models need a flexible way to move information between positions. In language, the useful context for a token is not always next to it. A pronoun may point back several words. A closing parenthesis may depend on an opening one far earlier. A code identifier may need a definition from a previous block.`,
        `A fixed window, convolution, or recurrent state can carry some of that information, but each has a wall. Fixed windows miss distant dependencies. Convolutions need many layers to connect far positions. Recurrent state compresses the past into one moving summary. Attention gives each token a direct, weighted lookup over visible tokens.`,
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        `The obvious approach is to give each token a local neighborhood. A word can read the words just before it, and deeper layers can slowly spread information farther. This resembles a convolutional receptive field: local at first, broader after repeated layers.`,
        `Another obvious approach is recurrence. Read tokens one at a time and update a hidden state. The state carries memory forward. This helped earlier language models, but the state is a narrow bottleneck. A later token cannot directly ask for one earlier token; it receives whatever the running state kept.`,
      ],
    },
    {
      heading: 'Where the obvious approach fails',
      paragraphs: [
        `Local neighborhoods fail when the needed relation is distant and content-dependent. In the sentence "The cat sat on the mat because it...", the token "it" should use information from "cat", not merely the immediately previous token. Distance alone cannot choose that link.`,
        `A single recurrent state fails for a different reason: compression. It may remember that some animal was mentioned, but the later computation cannot inspect all earlier token states directly. Attention removes that bottleneck by making earlier token representations addressable.`,
      ],
    },
    {
      heading: 'Core insight',
      paragraphs: [
        `The core insight is content-addressed lookup. Each token creates a query vector. Every visible token creates a key vector and a value vector. The query compares itself with keys, turns those scores into a probability distribution, and uses that distribution to mix values.`,
        `The attention matrix is the visible record of those probabilities. Rows are queries: the tokens doing the looking. Columns are keys: the tokens being looked at. Each row sums to 1 after softmax. In the 3D view, height is attention weight, so a peak shows where one token pulls information from.`,
      ],
    },
    {
      heading: 'Mechanism',
      paragraphs: [
        `For one head, the model projects token representations into Q, K, and V matrices. It computes scores with Q times K transpose, scales the scores to keep gradients stable, masks illegal positions, applies softmax row by row, and multiplies by V. The result is a new representation for each query token.`,
        `The mask matters. In an autoregressive language model, token q cannot look at key positions greater than q because those future tokens do not exist during generation. The causal mask sets those scores to negative infinity before softmax, so their final probabilities become zero. The future is removed from the distribution, not merely penalized.`,
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        `Attention works because it separates address from content. Keys decide where to read. Values decide what information is read. Queries decide what kind of information a token is asking for. This lets the same sequence support many relation types without a fixed hand-written rule.`,
        `Multi-head attention strengthens the idea by running several lookups in parallel. One head may focus on nearby syntax. Another may focus on a previous entity. Another may copy delimiters or track induction patterns. The next layer receives the combined outputs and can decide which relations matter for the task.`,
      ],
    },
    {
      heading: 'Implementation guidance',
      paragraphs: [
        `Treat masking as part of correctness, not a display option. Apply the causal or padding mask before softmax. If masked positions receive probability mass, the model can leak information or learn from padding tokens. The bug may not crash; it can silently train the wrong behavior.`,
        `Use numerically stable softmax by subtracting the row maximum before exponentiation. Keep tensor shapes explicit: batch, heads, query positions, key positions, and head dimension. Many attention bugs are shape bugs that still run but mix the wrong axes.`,
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        `The main failure is cost. Full attention has O(n squared) score computation and attention memory with sequence length n. Long context is expensive because every extra token can interact with many other tokens. Sliding windows, sparse patterns, grouped-query attention, memory compression, retrieval, and state-space alternatives all trade away some form of unrestricted lookup.`,
        `The second failure is interpretability. Attention weights show where probability mass went, but they do not prove why the model made a decision. A high weight from "it" to "cat" is evidence of a relation in that head, not a complete explanation of the model output. Ablations, causal tracing, saliency methods, and representation analysis are needed for stronger claims.`,
      ],
    },
    {
      heading: `Attention table basics`,
      paragraphs: [
        `Attention is how transformers relate words. Given a sentence like "The cat sat on the mat because it…," every token (word) looks at every other token and decides: how much of its meaning do I need? The "it" at the end asks this question hundreds of times in parallel, in many different ways. In one "head" it might say "I am 62% about 'cat'" (to solve coreference — what does 'it' refer to?). In another head it might say "I am 70% about the word before me" (to track syntax). Attention visualizes as a table of numbers: rows are queries (the looking token), columns are keys (the tokens being looked at), and each cell is a weight — a probability. When you render this table as a 3D landscape, something remarkable happens: the table becomes a terrain with three distinct landmarks — a diagonal ridge, a semantic mountain, and a causal cliff — and the geometry teaches you what attention actually does.`,
      ],
    },
    {
      heading: `How it works`,
      paragraphs: [
        `Start with the three landmarks you will see in the visualization. The LOCALITY RIDGE runs along the diagonal of the attention landscape: most tokens attend heavily to themselves and their immediate neighbors, because language is local — adjacent words encode tightly related meaning. The ridge is not a wall, though; attention "leaks" off it toward semantically relevant tokens. The verb "sat" can reach back to its subject "cat," and the visualization shows this as height flowing downhill, semantically downstream. Each query row (each word doing the looking) is a probability distribution that sums to exactly 1 — the model must give all its attention somewhere.`,
        `The COREFERENCE MOUNTAIN is landmark 2. The token "it" in our sentence does NOT stay on the diagonal. Its attention erupts at "cat" with a weight of 0.62 — six tokens back, a peak in the terrain. This is pronoun resolution: a learned, content-based lookup that fetch meaning from anywhere in the sequence, ignoring distance. No fixed window or simple convolution could do this. That mountain is how transformers understand "it was cold, so it closed its eyes" — "it" looks up 'what was cold,' fetches the concept 'the cat,' and the next layer uses that meaning to predict 'closed.' One mountain = one resolved pronoun.`,
        `The CAUSAL CLIFF is landmark 3. The entire half of the terrain where key > query is dead flat at zero. This is the causal mask: a token may only attend to the past. "The" cannot look at "cat" yet; at generation time "cat" does not exist. In a 2D heatmap this looks like a gray triangle; in relief it is a sheer escarpment. Every autoregressive LLM (every model generating text token by token) lives entirely on the landward side of this cliff. The KV Cache is precisely a cache of terrain already computed on the cliff-side, so future tokens do not recompute ancient history.`,
      ],
    },
    {
      heading: `Visual landmarks`,
      paragraphs: [
        `Start with the axes. A query row is the token doing the looking; a key column is the token being looked at; height is the attention weight. For any query, the visible row is a probability distribution, so peaks show where that token is pulling information from.`,
        `Read the three landmarks in order: the diagonal ridge is local context, the "it" to "cat" mountain is content lookup across distance, and the causal cliff is the future being masked to zero. The positional-head view is the caution: a different head can ignore meaning and track structure instead, so one attention map is evidence, not a full explanation.`,
      ],
    },
    {
      heading: `Cost and complexity`,
      paragraphs: [
        `One attention head on one sentence is small: 8 × 8 = 64 numbers, hand-computable. But scale it up. A modern LLM runs sequences of 128,000+ tokens through dozens of layers. Each layer has multiple heads (often 32 or more). Each head is a full query × key table: billions of weights per response, each recomputed per token (minus what the KV Cache remembers). The computation scales as O(sequence length²) in memory and attention operations — long sequences get expensive fast. This is why researchers optimize: sparse attention (only attend to a window), low-rank approximations, and the KV Cache itself, which trades forward-pass recomputation for storage, a bet on inference latency over training cost.`,
      ],
    },
    {
      heading: `Real-world uses`,
      paragraphs: [
        `Attention is the engine of every modern language model: GPT, Claude, Gemini, Llama. It is also the backbone of vision transformers (ViT), where pixels attend to other pixels to build up visual understanding. In machine translation, source-language words attend to target-language words to decide which words translate where. Protein folding (AlphaFold) uses attention to relate amino acids across the sequence, learning which distant positions physically interact. Question-answering systems use attention to fetch relevant context: given a question and a document, attend to the document positions most relevant to answering the question. Any sequence-to-sequence task — transcription, summarization, code generation — runs on attention. Multi-Head Attention multiplies this power: dozens of heads run in parallel, each learning its own terrain. One specializes in syntax (the positional head you saw), one in semantics (the content head), others learn things we do not yet have names for. The model combines all terrains downstream, learning which head matters for which task.`,
      ],
    },
    {
      heading: `Pitfalls and misconceptions`,
      paragraphs: [
        `The most dangerous misconception is treating attention weights as explanations. The visualization shows you WHERE the model looks; it does not tell you WHY or WHETHER it understands. A high weight from "it" to "cat" is evidence of coreference, but it is not proof — the model might have learned a spurious correlation. To move from "this head attends to 'cat'" to "the model uses this to resolve 'it'" requires ablation (remove the head, see if performance drops) or deeper introspection via Saliency Maps & Feature Attribution. The three landmarks are universal patterns, but they are surface-level. The real power of attention is buried in what happens in the layers below and above — the representations being attended to and the way downstream layers use attended values. Finally, be skeptical of single-head visualizations. Multi-head attention's strength is in specialization and redundancy. One head might attend to nonsense, but the ensemble works because bad heads are outweighed by good ones.`,
      ],
    },
    {
      heading: `Study next`,
      paragraphs: [
        `Now that you see one attention head in isolation, study Multi-Head Attention to see the full ensemble and how heads specialize. KV Cache is the production optimization that makes attention practical at scale: a trade-off between memory and recomputation. The Embedding Space, in 3D shows you the representations being attended to — the semantic space where "cat" and "it" are close together, and attention is the mechanism that leverages that closeness. The Loss Landscape, in 3D puts attention in a broader training context: where does this mechanism shine, and where does it fail? Finally, Saliency Maps & Feature Attribution teaches the skepticism needed to interpret any attention visualization: just because you can see a weight does not mean you understand the model.`,
      ],
    },
  ],
};
