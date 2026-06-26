// The KV cache: why an LLM takes a moment before its first word and then
// streams the rest fast — generation reuses every Key and Value vector it
// has already computed, paying only for the newest token.

import { matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'kv-cache',
  title: 'KV Cache',
  category: 'AI & ML',
  summary: 'Why LLMs pause before the first token and then stream: cached Keys and Values are never recomputed.',
  controls: [
    { id: 'mode', label: 'Generate', type: 'select', options: ['with KV cache', 'without cache (naive)'], defaultValue: 'with KV cache' },
  ],
  run,
};

const PROMPT = ['the', 'cat'];
const GENERATED = ['sat', 'on', 'mats'];
const D = 4;

// Deterministic toy K vectors (same trick as the Attention topic).
function kVector(word) {
  return Array.from({ length: D }, (_, j) => {
    let acc = j + 1;
    for (let i = 0; i < word.length; i += 1) acc = (acc * 31 + word.charCodeAt(i) * (j + 2)) % 1009;
    return (acc / 1009) * 2 - 1;
  });
}

export function* run(input) {
  const cached = String(input.mode) === 'with KV cache';
  if (!['with KV cache', 'without cache (naive)'].includes(String(input.mode))) {
    throw new InputError('Pick a generation mode.');
  }
  const r2 = (v) => Math.round(v * 100) / 100;

  const dims = Array.from({ length: D }, (_, j) => ({ id: `d${j}`, label: `d${j}` }));
  const matrixOf = (tokens, title) => matrixState({
    title,
    rows: tokens.map((t, i) => ({ id: `r${i}`, label: t })),
    columns: dims,
    values: tokens.map(kVector),
  });
  const rowIds = (count) => Array.from({ length: count }, (_, i) => `r${i}`);
  const allCells = (count) => Array.from({ length: count }, (_, i) => dims.map((d) => `r${i}:${d.id}`)).flat();

  let totalVectorComputes = 0;
  let naiveRunningTotal = 0;

  if (cached) {
    // ====== WITH KV CACHE MODE ======

    // --- 1. Empty cache ---
    yield {
      state: matrixState({ title: 'Empty KV cache: no tokens processed yet', rows: [], columns: dims, values: [] }),
      highlight: {},
      explanation: `The KV cache starts empty. The model has received the prompt "${PROMPT.join(' ')}" but has not yet computed any Key or Value vectors. The cache will grow by one row per token — and once a row is written, it is NEVER recomputed.`,
    };

    // --- 2. Prefill step 1: compute K/V for "the" ---
    totalVectorComputes += 1;
    yield {
      state: matrixOf([PROMPT[0]], `Prefill step 1: compute K/V for "${PROMPT[0]}"`),
      highlight: { active: ['r0'] },
      explanation: `Prefill begins. The model computes K and V vectors for "${PROMPT[0]}" — the first prompt token. One row enters the cache: [${kVector(PROMPT[0]).map((v) => r2(v)).join(', ')}]. This row is now permanent. Running total: ${totalVectorComputes} vector computation${totalVectorComputes === 1 ? '' : 's'}.`,
    };

    // --- 3. Prefill step 2: compute K/V for "cat" ---
    totalVectorComputes += 1;
    yield {
      state: matrixOf(PROMPT, `Prefill step 2: compute K/V for "${PROMPT[1]}"`),
      highlight: { active: ['r1'], visited: ['r0'] },
      explanation: `"${PROMPT[1]}" is processed. Its K/V row is computed and appended to the cache. The row for "${PROMPT[0]}" (faded) is already stored — not touched again. Cache now holds ${PROMPT.length} rows. Running total: ${totalVectorComputes} vector computations.`,
    };

    // --- 4. Prefill complete ---
    yield {
      state: matrixOf(PROMPT, 'Prefill complete: cache holds the full prompt'),
      highlight: { visited: rowIds(PROMPT.length) },
      explanation: `Prefill is done. The cache stores K and V for all ${PROMPT.length} prompt tokens. This parallel pass is the pause before an LLM's first word — long prompts make it slow. From here on, generation adds one row at a time and reuses everything already stored.`,
      invariant: 'K and V for a token depend only on tokens at positions <= that token. Past tokens cannot see the future, so cached rows are always valid.',
    };

    // --- 5-8. Generate each token ---
    const context = [...PROMPT];
    for (let gi = 0; gi < GENERATED.length; gi += 1) {
      const next = GENERATED[gi];
      context.push(next);
      const newIndex = context.length - 1;
      totalVectorComputes += 1;
      naiveRunningTotal = PROMPT.length;
      for (let s = 0; s <= gi; s += 1) naiveRunningTotal += PROMPT.length + 1 + s;
      const naiveAtThisStep = context.length;

      // --- Generate step ---
      yield {
        state: matrixOf(context, `Generate "${next}": 1 new row, ${newIndex} reused from cache`),
        highlight: { active: [`r${newIndex}`], visited: rowIds(newIndex) },
        explanation: `Generate "${next}": attention needs all ${context.length} K/V rows, but ${newIndex} are already in cache (faded). Only 1 new row is computed. Without the cache, this step would recompute all ${naiveAtThisStep} rows. Running total: ${totalVectorComputes} computations (naive would be at ${naiveRunningTotal}).`,
        invariant: 'Each decode step computes exactly 1 new K/V row, regardless of context length.',
      };

      // --- After first generated token, show compute savings ---
      if (gi === 0) {
        yield {
          state: matrixOf(context, `Compute savings so far: ${totalVectorComputes} cached vs ${naiveRunningTotal} naive`),
          highlight: { found: [`r${newIndex}`], visited: rowIds(newIndex) },
          explanation: `After generating "${next}": cached mode used ${totalVectorComputes} total K/V computations. Naive mode would have used ${naiveRunningTotal} — the full prompt (${PROMPT.length}) plus a recompute of all ${context.length} rows for this step. Already saving ${naiveRunningTotal - totalVectorComputes} redundant computations, and the gap widens with every token.`,
        };
      }
    }

    // --- 9. Total compute comparison ---
    const naiveTotal = PROMPT.length + (PROMPT.length + 1) + (PROMPT.length + 2) + (PROMPT.length + 3);
    const n = context.length;
    yield {
      state: matrixOf(context, `Total: ${totalVectorComputes} cached vs ${naiveTotal} naive K/V computations`),
      highlight: { found: rowIds(n) },
      explanation: `Generation complete. Cached: ${totalVectorComputes} K/V computations for ${n} tokens — exactly 1 per token, O(n). Naive: ${naiveTotal} — O(n^2). The cache saved ${naiveTotal - totalVectorComputes} redundant computations (${Math.round((1 - totalVectorComputes / naiveTotal) * 100)}% reduction). At real scale — 100K context, thousands generated — this is the difference between streaming text and waiting minutes per word.`,
    };

    // --- 10. Memory cost ---
    const cacheEntries = n * D * 2;
    yield {
      state: matrixOf(context, `Memory cost: cache holds ${n} rows x ${D} dims x 2 (K+V)`),
      highlight: { active: allCells(n) },
      explanation: `The price of speed: the cache now holds ${cacheEntries} values (${n} tokens x ${D} dims x 2 for K and V). At real scale (70B model, 80 layers, 8 KV heads, d_head=128, 4096 tokens, FP16): 1.34 GB per request. Serve 32 concurrent users: 43 GB of GPU memory for cache alone, on top of model weights. This is why engineers quantize the KV cache (INT8, FP8), use GQA/MQA to share K/V across heads, and why long-context models are expensive to serve.`,
    };

  } else {
    // ====== WITHOUT CACHE (NAIVE) MODE ======

    // --- 1. Empty state ---
    yield {
      state: matrixState({ title: 'No cache: starting from scratch', rows: [], columns: dims, values: [] }),
      highlight: {},
      explanation: `Naive mode: no KV cache. Every time the model needs to attend, it recomputes K and V for ALL tokens from scratch. Watch how the work grows quadratically.`,
    };

    // --- 2. Prefill: compute all prompt tokens ---
    naiveRunningTotal += PROMPT.length;
    yield {
      state: matrixOf(PROMPT, `Prefill: compute K/V for all ${PROMPT.length} prompt tokens`),
      highlight: { active: rowIds(PROMPT.length) },
      explanation: `Prefill: the model computes K/V for the full prompt ("${PROMPT.join(' ')}") — ${PROMPT.length} rows. Same as cached mode so far. Running total: ${naiveRunningTotal} computations. But without a cache, NOTHING is saved for reuse.`,
    };

    // --- 3-7. Generate each token, recomputing everything ---
    const context = [...PROMPT];
    for (let gi = 0; gi < GENERATED.length; gi += 1) {
      const next = GENERATED[gi];
      context.push(next);
      naiveRunningTotal += context.length;
      const cachedWouldBe = PROMPT.length + gi + 1;

      yield {
        state: matrixOf(context, `Generate "${next}": recompute ALL ${context.length} rows`),
        highlight: { active: rowIds(context.length) },
        explanation: `Generate "${next}": the model recomputes K/V for ALL ${context.length} tokens — every row lights up. ${context.length - 1} of these are identical to last step's results. With a cache, only 1 row would be computed. Running total: ${naiveRunningTotal} (cached would be ${cachedWouldBe}).`,
      };

      // After each generation step, show the waste
      yield {
        state: matrixOf(context, `Wasted work: ${context.length - 1} redundant rows recomputed`),
        highlight: { swap: rowIds(context.length - 1), active: [`r${context.length - 1}`] },
        explanation: `Of ${context.length} rows just computed, ${context.length - 1} (highlighted in red) were already known from previous steps — their K/V values are determined by causal masking and cannot change. Only the newest row (green) is genuinely new. Wasted so far: ${naiveRunningTotal - cachedWouldBe} redundant computations.`,
      };
    }

    // --- 8. Total comparison ---
    const n = context.length;
    const cachedTotal = PROMPT.length + GENERATED.length;
    yield {
      state: matrixOf(context, `Total: ${naiveRunningTotal} naive vs ${cachedTotal} with cache`),
      highlight: { swap: rowIds(n) },
      explanation: `Done: ${naiveRunningTotal} K/V computations without cache vs ${cachedTotal} with cache — O(n^2) vs O(n). Each generated token redid nearly all the previous work. The wasted computations: ${naiveRunningTotal - cachedTotal}. No production LLM runs this way; flip to "with KV cache" to see what vLLM, TensorRT-LLM, and llama.cpp actually do.`,
    };

    // --- 9. Memory "savings" vs compute waste ---
    yield {
      state: matrixOf(context, 'Naive mode uses less memory but far more compute'),
      highlight: {},
      explanation: `The one advantage of naive mode: zero cache memory. But the compute cost is devastating: ${naiveRunningTotal} vs ${cachedTotal} for just ${GENERATED.length} generated tokens. At 1,000 generated tokens, naive mode does ~500,000 K/V computations; cached mode does ~1,000. Every production system pays the memory cost because the compute savings are overwhelming.`,
    };
  }
}

export const article = {
  sections: [
    { heading: 'How to read the animation', paragraphs: [
        'Each row is a token position, and each column is one dimension of a Key vector. Active rows are being computed now, while faded rows are already stored and reused from the KV cache.',
        {
          type: 'callout',
          text: 'KV cache is safe because causal attention makes past key and value rows immutable after they are computed.',
        },
        'In cached mode, generation computes one new row per token and reads all previous rows. In naive mode, every old row lights up again because the model recomputes the whole prefix.',
        'The prefill phase computes the prompt rows in parallel, which is why the first token takes longer. Decode then appends one row at a time, which is why later tokens can stream.',
      
        {type: 'image', src: './assets/gifs/kv-cache.gif', alt: 'Animated walkthrough of the kv cache visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},], },
    { heading: 'Why this exists', paragraphs: [
        'A decoder-only language model generates one token at a time. At each layer, the new token needs attention over every earlier token, which means it needs their Key and Value tensors.',
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8f/The-Transformer-model-architecture.png/250px-The-Transformer-model-architecture.png',
          alt: 'Transformer architecture diagram with attention modules',
          caption: 'The Transformer architecture repeats attention at each layer, which is why cached K and V rows exist for every layer and position. Source: Wikimedia Commons, from Vaswani et al. 2017.',
        },
        'Without a cache, token 500 recomputes the same K and V values for tokens 1 through 499 even though causal masking guarantees those values cannot change. The cache exists to pay that projection cost once per token.',
      ], },
    { heading: 'The obvious approach', paragraphs: [
        'The obvious approach is to rerun the transformer on the full prefix for every generated token. Concatenate the prompt and generated tokens so far, run a full forward pass, sample the next token, and repeat.',
        'This is correct and easy to reason about. It matches the training-time view of a full sequence with a causal mask, so the implementation has fewer moving parts.',
      ], },
    { heading: 'The wall', paragraphs: [
        'The wall is repeated work. Generating 1,000 tokens naively performs 1 + 2 + ... + 1,000 = 500,500 prefix-token projection steps, even though only 1,000 token positions are new.',
        'The waste becomes visible in long prompts. With a 2,000-token prompt and 500 generated tokens, each decode step repeats about 2,000 old positions unless cached state is reused.',
      ], },
    { heading: 'The core insight', paragraphs: [
        'Past Key and Value rows are immutable under causal attention. A past token cannot attend to a future token, so adding a new token cannot change the K or V rows already computed for the prefix.',
        'The cache changes the work from rerun the whole prefix to append one row and attend over stored rows. It saves computation by spending resident memory.',
      ], },
    { heading: 'How it works', paragraphs: [
        'Prefill computes K and V for all prompt tokens at all layers and stores them in a cache indexed by layer, request, position, KV head, and head dimension. Decode computes Q, K, and V only for the new token, appends its K and V, and uses the new Q to read all cached keys and values.',
        'Grouped-query attention and multi-query attention reduce cache size by using fewer KV heads than query heads. RoPE or another positional encoding is applied consistently so cached keys carry the same position information a full rerun would have produced.',
      ], },
    { heading: 'Why it works', paragraphs: [
        'The invariant is exact: for a fixed prefix, model weights, adapter, and position scheme, K and V for position i depend only on tokens at positions less than or equal to i. Adding position i+1 cannot change those tensors.',
        'The newest query still changes because the newest token is new. The cache preserves transformer semantics by reusing old evidence, not by approximating it.',
      ], },
    { heading: 'Cost and complexity', paragraphs: [
        'Without a cache, K/V projection work across generated tokens grows as O(n^2). With a cache, K/V projection work grows as O(n), but attention still reads a growing prefix, so decode remains memory-bandwidth heavy.',
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/62/AMD%4028nm%40GCN_3th_gen%40Fiji%40Radeon_R9_Nano%40SPMRC_REA0356A-1539_215-0862120_DSC04466_%2829461603171%29.jpg/330px-AMD%4028nm%40GCN_3th_gen%40Fiji%40Radeon_R9_Nano%40SPMRC_REA0356A-1539_215-0862120_DSC04466_%2829461603171%29.jpg',
          alt: 'GPU package with high-bandwidth memory modules',
          caption: 'The cache saves compute by spending high-bandwidth memory, so long context can become a memory-capacity problem. Source: Wikimedia Commons, File:AMD at 28nm GCN Fiji Radeon R9 Nano photo.',
        },
        'Memory per request is 2 x layers x sequence length x KV heads x head dimension x bytes per element. A 70B-class model with 80 layers, 8 KV heads, head dimension 128, 4,096 tokens, and fp16 values needs 1.34 GB of KV cache per request.',
      ], },
    { heading: 'Real-world uses', paragraphs: [
        'Every production autoregressive LLM serving stack uses KV caching because interactive decoding would otherwise repeat most of the prefix work. vLLM, TensorRT-LLM, TGI, SGLang, llama.cpp, and similar systems build their schedulers around cache ownership.',
        'Higher-level features depend on it. Prefix caching reuses shared system prompts, continuous batching packs requests by available KV memory, and speculative decoding keeps accepted verifier state instead of recomputing it.',
      ], },
    { heading: 'Where it fails', paragraphs: [
        'The cache grows linearly with context length and live requests. Long-context products can run out of high-bandwidth memory even when the model weights fit comfortably.',
        'A cache entry cannot be reused if the token prefix, model weights, adapter, tokenizer, position scheme, or cache format changes. Eviction, quantization, offload, and sliding windows reduce pressure but add correctness and quality tradeoffs.',
      ], },
    { heading: 'Worked example', paragraphs: [
        'Take a 12-layer model with 12 KV heads, head dimension 64, fp16 values, and a 1,024-token sequence. KV memory is 2 x 12 x 1,024 x 12 x 64 x 2 bytes = 37,748,736 bytes, or about 36 MiB per request.',
        'Serve 64 such requests and the KV cache alone is about 2.25 GiB. At 4,096 tokens the same model needs about 144 MiB per request, so 64 concurrent requests need about 9 GiB before counting weights or activations.',
        'For compute, a 5-token toy sequence without cache recomputes 1 + 2 + 3 + 4 + 5 = 15 K/V rows. With cache it computes exactly 5 rows, one per token, and reuses the other 10 row computations.',
      ], },
    { heading: 'Sources and study next', paragraphs: [
        'Sources: Vaswani et al. 2017 for attention, Shazeer 2019 for multi-query attention, Ainslie et al. 2023 for grouped-query attention, and Kwon et al. 2023 for PagedAttention in vLLM.',
        'Study Attention first, then Transformer Block, Grouped-Query Attention, RoPE, PagedAttention, prefix caching, speculative decoding, and KV cache quantization. The question is how much memory you will spend to avoid recomputation.',
      ], },
  ],
};
