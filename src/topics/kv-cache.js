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
      heading: `Why this exists`,
      paragraphs: [
        `Autoregressive LLMs generate one token after another. Each new token attends to the entire prefix: the original prompt plus every token already generated. Without reuse, the model would repeatedly recompute the same attention inputs for old tokens. A long chat would pay again for the system prompt, the user prompt, and every previous output token every time it produced the next word.`,
        `The key-value cache exists because past tokens are fixed under causal masking. Once token 12 has produced its Key and Value tensors in layer 18, those tensors will not change when token 13, 14, or 15 is generated. The cache stores those K/V tensors after prefill and appends one new row per decode step. That is why an LLM often pauses before the first token, then streams later tokens much faster than a full rerun would allow.`,
      ],
    },
    {
      heading: `The naive approach and the wall`,
      paragraphs: [
        `The naive approach is simple: after each generated token, concatenate it to the context and run the transformer over the whole context again. This is easy to reason about because every step looks like ordinary training-time forward propagation over a sequence. It also produces the right answer for a causal decoder.`,
        `The wall is repeated work. Suppose a prompt has 2,000 tokens and the model generates 500 more. A full rerun computes projections, attention, and feed-forward activations for the same first 2,000 tokens hundreds of times. The wasted work grows with the triangular sum of context lengths. Worse, the old tokens are exactly the ones least likely to change: causal masking prevents them from seeing future tokens, so their K/V state is pure duplicate computation.`,
      ],
    },
    {
      heading: `The core insight`,
      paragraphs: [
        `The core insight is that only the newest token needs new K/V projections. The new token still needs to attend to all previous tokens, but it can do that by reading cached keys and values instead of recomputing them. The cache changes the problem from "rerun the whole prefix" to "append one row and perform attention against stored rows."`,
        `This is not the same as an LRU cache. An LRU cache is a general-purpose map that evicts old entries by recency. A decoder KV cache is ordered model state: layer by layer, sequence position by sequence position, head by head. It is safe because the transformer is causal. It is expensive because every active request carries a growing memory object tied to its exact token prefix, model weights, adapter state, and position scheme.`,
      ],
    },
    {
      heading: `How it works`,
      paragraphs: [
        `Inference has two phases. Prefill processes the full prompt in parallel. For every layer, it computes queries, keys, and values for the prompt tokens, performs prompt attention, and writes the prompt K/V tensors into cache storage. This is the phase behind time to first token. Long prompts make prefill large because the model must actually ingest the whole input before it can produce the first output token.`,
        `Decode then runs one token step at a time. For the current token, the model computes a query, key, and value. It appends the new key and value to the cache for each layer. The query scores all cached keys for that layer, and the attention weights mix the cached values. Past tokens' feed-forward blocks, projections, and K/V rows are not recomputed.`,
        `The cache shape is usually described as layers by batch by sequence by KV heads by head dimension, with one tensor for keys and one for values. Multi-Head Attention stores K/V per head. Grouped-query attention and multi-query attention reduce the number of KV heads, so more query heads share fewer key/value heads. RoPE is normally applied before keys are cached, which means the stored key already carries its positional rotation.`,
      ],
    },
    {
      heading: `What the visual proves`,
      paragraphs: [
        `The visual contrasts two generation modes. In cached mode, prefill lights up the prompt rows once. Each generated token adds one active row while earlier rows remain visited state. The proof is not that attention ignores the past. The proof is that the past is read from memory instead of recalculated.`,
        `In naive mode, every row lights up again on every generated token. The running count climbs faster because old rows repeat. That side of the animation shows why the cache is not an optional optimization for production LLMs. Without it, streaming would collapse under duplicate projection and feed-forward work. With it, the server pays a memory bill to avoid recomputing stable state.`,
      ],
    },
    {
      heading: `Why it works`,
      paragraphs: [
        `The correctness argument is an invariant over positions. For a fixed prompt prefix, model weights, adapter state, and positional encoding, the K and V tensors for an old token depend only on tokens at or before that old token. Future tokens are masked away. Therefore adding a new token cannot change any old K/V row. Reusing the cached row gives the same value a full rerun would compute.`,
        `The query is different. The newest token's query is new because the newest token is new. That query must still compare against all cached keys to decide which previous values to mix. The cache preserves exact transformer semantics for standard causal decoding; it just avoids recomputing deterministic old state.`,
      ],
    },
    {
      heading: `Costs and tradeoffs`,
      paragraphs: [
        `The cache saves a huge amount of compute, but it does not make generation constant time. With cache, each generated token still attends over the current context, so attention work per layer grows with context length. Across a long continuation, decode attention still forms a triangle of reads and dot products. The cache removes repeated K/V projections and old-token feed-forward work, which is why it is decisive in practice even though length still matters.`,
        `Memory is the real bill: 2 tensors, K and V, times layers, tokens, KV heads, head dimension, and bytes per element. A model with many layers and many KV heads can spend gigabytes of GPU memory on a single long sequence. Grouped-query attention, multi-query attention, KV quantization, sliding windows, and paged cache allocators all exist because this memory bill limits concurrency. PagedAttention, introduced with vLLM, attacks fragmentation and duplication by treating KV memory like virtual-memory pages: https://arxiv.org/abs/2309.06180.`,
      ],
    },
    {
      heading: `Where it wins`,
      paragraphs: [
        `Every production decoder stack needs KV cache management: vLLM, TensorRT-LLM, llama.cpp, TGI, SGLang, and cloud inference engines. The cache is why first-token latency and tokens per second are separate metrics. Prefill is a large parallel pass over the input. Decode is a sequence of smaller steps dominated by cache reads, batching, sampling, and memory bandwidth.`,
        `The cache also enables higher-level serving tricks. Prefix caching reuses the state for repeated system prompts or shared conversation prefixes. Speculative decoding lets a draft model propose tokens and a target model verify them while keeping accepted prefix state. Continuous batching depends on knowing how much KV memory each live request owns. Long-context products, agent loops, retrieval-augmented generation, and chat serving all become capacity-planning problems around this data structure.`,
      ],
    },
    {
      heading: `Where it fails`,
      paragraphs: [
        `The biggest misconception is that the cache makes generation O(1). It does not. The new token still attends over cached context unless the model uses a different architecture or an attention variant with a limited window. Another misconception is that caches can be shared freely. They can be shared only for identical token prefixes under identical model weights, position encoding, adapters, and cache format. Change a LoRA adapter, tokenizer path, or system prompt and the cache may no longer represent the same computation.`,
        `Compression and eviction are not free either. Int8 or lower-precision KV storage saves memory, but attention scores can shift. Sliding-window eviction bounds memory, but old context disappears. Prefix caching helps repeated prompts, but exact token matching and cache invalidation become system concerns. The cache is a correct reuse mechanism; every memory-saving variant is a tradeoff layered on top.`,
      ],
    },
    {
      heading: `Study next`,
      paragraphs: [
        `Study Attention Mechanism first so keys, queries, and values are concrete. Then study Transformer Block, Multi-Head Attention, Grouped-Query Attention, RoPE, quantization, speculative decoding, PagedAttention, KV cache concurrency capacity models, continuous batching, and prefill/decode disaggregation. For contrasting architectures, study RetNet retention state, RWKV recurrent transformers, Mamba-style state space models, and Titans-style test-time memory. Those topics all ask the same systems question: how much past context should be carried, in what format, and at what cost?`,
      ],
    },
  ],
};
