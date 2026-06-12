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

  const dims = Array.from({ length: D }, (_, j) => ({ id: `d${j}`, label: `d${j}` }));
  const matrixOf = (tokens, title) => matrixState({
    title,
    rows: tokens.map((t, i) => ({ id: `r${i}`, label: t })),
    columns: dims,
    values: tokens.map(kVector),
  });
  const rowIds = (count) => Array.from({ length: count }, (_, i) => `r${i}`);

  let totalVectorComputes = 0;

  yield {
    state: matrixOf(PROMPT, 'Prefill: K vectors for the prompt'),
    highlight: { active: rowIds(PROMPT.length) },
    explanation: `Attention needs a Key and Value vector for EVERY token in the context (see Attention Mechanism). Step one — PREFILL: the model processes the whole prompt ("${PROMPT.join(' ')}") at once, computing K and V for each token. This is the pause before an LLM's first word. ${cached ? 'With a KV cache, these vectors are now SAVED.' : 'In naive mode, nothing is saved — remember that.'}`,
  };
  totalVectorComputes += PROMPT.length;

  const context = [...PROMPT];
  for (const next of GENERATED) {
    context.push(next);
    const newIndex = context.length - 1;
    if (cached) {
      totalVectorComputes += 1;
      yield {
        state: matrixOf(context, `Generate "${next}": compute 1 new row, reuse ${newIndex}`),
        highlight: { active: [`r${newIndex}`], visited: rowIds(newIndex) },
        explanation: `Generate "${next}": attention must look at all ${context.length} tokens — but the K and V vectors for the first ${newIndex} are sitting in the cache, untouched (faded rows). Only the NEW token's vectors get computed: one row of work, no matter how long the context is. Running total: ${totalVectorComputes} vector computations.`,
        invariant: 'A token\'s K and V never change once computed — past tokens cannot see the future, so caching is always safe.',
      };
    } else {
      totalVectorComputes += context.length;
      yield {
        state: matrixOf(context, `Generate "${next}": recompute ALL ${context.length} rows`),
        highlight: { active: rowIds(context.length) },
        explanation: `Generate "${next}" without a cache: the model recomputes K and V for EVERY token in the context — all ${context.length} rows light up, even though ${newIndex} of them are identical to last step's results. Running total: ${totalVectorComputes} vector computations and climbing quadratically.`,
      };
    }
  }

  const n = context.length;
  const naiveTotal = PROMPT.length + (PROMPT.length + 1) + (PROMPT.length + 2) + (PROMPT.length + 3);
  yield {
    state: matrixOf(context, 'The full context after generation'),
    highlight: {},
    explanation: cached
      ? `Done: ${totalVectorComputes} vector computations for ${n} tokens — exactly one per token, O(n) total. Naive mode would have used ${naiveTotal} (re-run this topic without the cache). Scale to a real chat — 100,000 context tokens, thousands generated — and the cache is the difference between streaming text and waiting minutes per word. The price: the cache lives in GPU memory and GROWS with context length (layers × tokens × 2 vectors) — this is precisely why long contexts are expensive and why engineers quantize the KV cache or share it across heads (GQA, MQA).`
      : `Done: ${totalVectorComputes} vector computations versus ${PROMPT.length + GENERATED.length} with a cache — O(n²) versus O(n). Each generated token redid nearly all the previous work. No production LLM runs this way; flip the control to "with KV cache" to see what every real inference server (vLLM, TensorRT-LLM, llama.cpp) actually does.`,
  };
}

export const article = {
  sections: [
    {
      heading: `What it is`,
      paragraphs: [
        `The key-value cache is the inference trick that makes autoregressive LLMs stream instead of reprocessing the whole conversation for every word. In Attention Mechanism, each token produces a query, key, and value. During generation, old tokens never change and cannot see future tokens, so their keys and values are reusable. The cache stores those K and V tensors after the prompt prefill and appends one new row per generated token.`,
        `This is not the same idea as LRU Cache, which evicts old entries by recency. A decoder cache is ordered model state: layer by layer, head by head, position by position. It is safe because causal masking freezes the past. It is expensive because every active request carries its own growing cache in GPU memory.`,
      ],
    },
    {
      heading: `How it works`,
      paragraphs: [
        `Inference has two phases. Prefill runs The Transformer Block over the full prompt in parallel and writes K and V for every layer. Decode then processes one new token at a time. The model computes that token's query, key, and value; appends the new K/V to the cache; and scores the new query against all cached keys to mix cached values. Past tokens' feed-forward layers and K/V projections are not rerun.`,
        `The cache is usually shaped like layers by batch by sequence by KV heads by head dimension. Multi-Head Attention stores per-head values, while grouped-query attention and multi-query attention reduce memory by sharing K/V heads across more query heads. RoPE (Rotary Embeddings) is normally applied before keys are cached, so each cached key already contains its positional rotation.`,
      ],
    },
    {
      heading: `Cost and complexity`,
      paragraphs: [
        `The cache saves a huge constant factor, not all length cost. With cache, each generated token still compares its query with every cached key, so attention work per layer grows O(L d) with current context length L. Across T generated tokens, decode attention is still triangular in length. Without cache, each step reruns the full prefix through all layers, including projections and feed-forward work for old tokens, which is far worse in practice.`,
        `Memory is the real bill: 2 tensors (K and V) times layers times tokens times KV heads times head dimension times bytes. A Llama-2-7B-style model with 32 layers, 32 KV heads, head dimension 128, 4,096 tokens, and fp16 cache needs about 2 GiB per sequence. With 8 KV heads through grouped-query attention, the same shape falls near 512 MiB. Quantization can cut this further, but quality and kernel support matter.`,
      ],
    },
    {
      heading: `Real-world uses`,
      paragraphs: [
        `Every production decoder stack uses cache management: vLLM, TensorRT-LLM, llama.cpp, TGI, and cloud inference engines. vLLM's PagedAttention made a practical systems point in 2023: KV memory fragments like virtual memory, so paging cache blocks can increase batch throughput dramatically. Speculative Decoding also relies on cache behavior, because a draft model proposes tokens and the target model verifies them while reusing accepted prefix state.`,
        `The cache is why first-token latency and tokens-per-second are different metrics. Prefill is large parallel work over the prompt. Decode is many smaller steps, each tied to cache reads, batching, and memory bandwidth. Long prompts stress prefill; long continuations stress cache growth.`,
      ],
    },
    {
      heading: `Pitfalls and misconceptions`,
      paragraphs: [
        `The biggest misconception is "cache makes generation O(1)." It does not: the new token still attends over the cached context. The second is "cache can be shared freely." It can be shared only for identical prefixes with identical model weights, position scheme, sampling path, and adapter state. Change the prompt, LoRA adapter, or token sequence and the cache no longer represents the same computation.`,
        `Cache compression is also not free. Int8 or lower-precision KV storage saves memory, but attention scores can shift. Sliding-window eviction saves memory, but old context disappears. Prefix caching helps repeated system prompts, but it needs exact token matches. These are systems trade-offs, not mathematical guarantees.`,
      ],
    },
    {
      heading: `Study next`,
      paragraphs: [
        `Study Attention Mechanism to understand what keys and values are, then Multi-Head Attention to see why cache shape includes heads. The Transformer Block explains why only K/V state is enough to reuse old context. RoPE (Rotary Embeddings) explains the position math stored in cached keys. LRU Cache gives the simpler systems analogy, Quantization covers memory compression, and Speculative Decoding shows how serving stacks exploit cached prefixes for speed.`,
      ],
    },
  ],
};
