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
      heading: 'What it is',
      paragraphs: [
        `The KV cache is why LLMs pause for a moment before the first generated word and then stream the rest at human-readable speed. Transformers compute a Key (K) and Value (V) vector for every token in the attention mechanism — once computed, these vectors never change. The cache simply saves them, so during generation (the "decode" phase), you reuse every cached K and V from the prompt and earlier generated tokens instead of recomputing them from scratch.`,
        `Without a cache, generating 100 tokens means computing attention 100 times, and the n-th generation step recomputes K and V for all n tokens in the context, then adds the new token's K and V. With a cache, each step computes only the one new token's K and V vectors, reusing all the others. The difference is the crux of streaming: O(n) vector operations versus O(n²) as the context grows.`,
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        `During prefill (processing the entire prompt at once), the model computes K and V for each prompt token and stores them in GPU memory as a 2D matrix: tokens as rows, embedding dimension as columns. As generation proceeds, each new token is processed in isolation; its K and V are computed (one new row added to the cache) and combined with all the cached K and V rows to compute attention over the full context. Past tokens cannot see the future, so once a token's K and V are computed, they are permanently immutable and safe to cache forever.`,
        `On this site, watch the two modes: with the cache, each step lights up only the newest row (O(1) rows computed per step, O(n) total). Without the cache, every step recomputes ALL rows (O(n) per step, O(n²) total). The cache lives in GPU memory as a dense tensor, indexed by token position, so lookups are nearly free — you pay only the cost of computing one new row and the matrix multiplication to combine it with the cache.`,
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        `With a cache: O(n) scalar operations to compute one new token's K and V, then O(d²) matrix operations for attention (d = embedding dimension). Total per-token time is constant; total for n generated tokens is O(n). Without a cache: each of n generation steps recomputes K and V for the full context (O(n) work) and then runs attention (O(d²) work), totaling O(n²) vector operations. GPU memory grows linearly with context: 2 vectors per token × dimension × number of layers × batch size. A 13B model with 2 layers and 4096-dim embedding, generating 100 tokens in context, uses roughly 100 × 4096 × 2 × 32 bytes ≈ 26 MB of cache memory per layer — manageable on modern GPUs, but constraining for 100K-token contexts.`,
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        `Every production LLM inference server uses a KV cache: vLLM, TensorRT-LLM, llama.cpp, and even mobile engines quantize and cache K and V to run on-device. The cache is why ChatGPT or Claude feels "snappy" for the first word and then streams the rest smoothly. Without it, each token would take 10–100× longer because all prior tokens' computations must repeat. Multi-batch inference (serving many users at once) complicates the cache: servers split and interleave cache entries, use paging (vLLM's approach) to avoid fragmentation, and carefully manage GPU memory to maximize throughput.`,
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        `First pitfall: the cache is not free; it costs GPU memory proportional to context length, which is why systems start dropping tokens or using "attention sinks" when memory runs out. Second misconception: the cache can be naively reused across multiple queries — it cannot; each new conversation or session must start fresh. Third: engineers often trade off cache accuracy: quantizing K and V to int8 saves 4× memory but degrades attention quality slightly; grouped-query attention (GQA) and multi-query attention (MQA) share cache rows across attention heads to reduce memory by 10–100×, paying a small accuracy cost. Long-context models (100K tokens) force these trade-offs aggressively because uncompressed caches become infeasible.`,
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        `After KV cache, study the Attention Mechanism to understand what K and V actually compute. LRU Cache covers caching principles in a simpler setting. Softmax & Temperature governs attention probability distribution, which feeds the Value vectors cached here. For deployment, explore Quantization (how K and V are compressed), and for long context handling, read about positional encoding (RoPE) and how token indices are mapped into cached rows. Model inference optimization and batching strategies explain how production systems manage multiple cached contexts simultaneously.`,
      ],
    },
  ],
};

