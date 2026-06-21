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
        invariant: 'K and V for a token never change once computed — past tokens cannot see the future, so caching is always safe.',
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
      heading: 'How to read the animation',
      paragraphs: [
        'The matrix shows Key vectors for every token in the context. Each row is one token; each column is one dimension of the K vector. Toggle between "with KV cache" and "without cache (naive)" to compare the two generation strategies.',
        {
          type: 'callout',
          text: 'KV cache is safe because causal attention makes past key and value rows immutable after they are computed.',
        },
        'Active (highlighted) rows are K/V vectors being computed right now. Visited (faded) rows are cached vectors reused without recomputation. In cached mode, only one row lights up per generation step -- the new token. In naive mode, every row lights up every step because the model recomputes all of them. The running total at the bottom proves the difference: linear growth versus quadratic.',
        'The prefill step lights up all prompt rows at once. That parallel pass is why LLMs pause before the first token. Every subsequent step adds one generated token and shows exactly how much work the cache saves.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Autoregressive LLMs generate one token at a time. Each new token attends to every token before it: the prompt plus every token already generated. To attend, the model needs a Key vector and a Value vector for every previous position, at every layer. Without reuse, generating token t means recomputing K and V for all t-1 previous tokens -- tokens whose K/V outputs have not changed since they were last computed.',
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8f/The-Transformer-model-architecture.png/250px-The-Transformer-model-architecture.png',
          alt: 'Transformer architecture diagram with attention modules',
          caption: 'The Transformer architecture repeats attention at each layer, which is why cached K and V rows exist for every layer and position. Source: Wikimedia Commons, from Vaswani et al. 2017.',
        },
        'The cost adds up fast. Generating a sequence of n tokens requires computing K/V projections 1 + 2 + 3 + ... + n = n(n+1)/2 times across the sequence. For 1,000 tokens, that is 500,500 sets of projections, most of them exact duplicates of earlier work. The KV cache exists to store K and V for each token once and never recompute them.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The straightforward way to generate text: concatenate all tokens so far, run the full transformer, read off the next-token prediction. Repeat. Every step is a fresh forward pass over the entire context, identical to training-time propagation with a causal mask.',
        'This works correctly. Causal masking means old tokens never see future tokens, so their K and V outputs are identical on every rerun. The approach is simple to implement and easy to verify.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The obvious approach recomputes K and V for every old token at every step. Suppose a prompt has 2,000 tokens and the model generates 500 more. Token 2,001 requires K/V projections for 2,001 positions. Token 2,002 requires 2,002. By token 2,500, the model has computed K/V projections 2,001 + 2,002 + ... + 2,500 = 1,125,250 times -- and 2,000 of those projections per step are identical duplicates.',
        'Generating 1,000 tokens from scratch: 1 + 2 + ... + 1,000 = 500,500 K/V projection sets. The total work is O(n^2) in generated tokens, on top of the O(n^2) attention itself. Every old token is recomputed even though causal masking guarantees its K/V vectors cannot change. The wasted work grows quadratically.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Only the newest token needs new K/V projections. The new token must attend to all previous tokens, but it can read their Keys and Values from a cache instead of recomputing them. The problem shifts from "rerun the entire prefix" to "append one K/V row and run attention against stored rows."',
        'This is not a general-purpose cache like an LRU map. A decoder KV cache is ordered model state: layer by layer, position by position, head by head. It is safe because the transformer is causal -- projections for past tokens depend only on past tokens. It is expensive because every active request carries a growing memory object tied to its exact prefix, model weights, and positional encoding.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Inference splits into two phases. Prefill processes the full prompt in parallel: for every layer, compute Q, K, V for all prompt tokens, run attention, and write the prompt K/V tensors into cache storage. This is the pause before the first token. Long prompts make prefill slow because the model must ingest the entire input before producing any output.',
        'Decode runs one token at a time. For the new token, compute its Q, K, and V. Append the new K and V to the cache at each layer. Score the new Q against all cached K vectors to get attention weights, then mix the cached V vectors. Feed-forward blocks, projections, and K/V rows for past tokens are never touched again.',
        'The cache shape is [2, n_layers, batch, seq_len, n_kv_heads, d_head] -- one tensor for keys, one for values. Multi-head attention stores K/V per head. Grouped-query attention (GQA) and multi-query attention (MQA) reduce n_kv_heads so multiple query heads share fewer K/V heads. RoPE is applied to keys before caching, so stored keys already carry positional information.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Correctness rests on one invariant: for a fixed prefix, model weights, and positional encoding, K and V for token i depend only on tokens at positions <= i. Causal masking blocks future tokens. Adding token i+1 cannot change K or V for token i. Reusing the cached row produces the same result a full rerun would compute.',
        'The query is different. Q for the newest token is new because the token is new. That Q must compare against all cached K vectors to decide which V vectors to mix. The cache preserves exact transformer semantics -- it eliminates redundant computation, not information.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Without cache, generating n tokens costs O(n^2 * d) total K/V projection work plus O(n^2 * d) attention work. With cache, K/V projection work drops to O(n * d) total -- one projection per token, computed once. Attention work is still O(n^2 * d) because each new token attends over the growing context. The cache does not make generation constant-time; it eliminates the quadratic projection and feed-forward overhead.',
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/62/AMD%4028nm%40GCN_3th_gen%40Fiji%40Radeon_R9_Nano%40SPMRC_REA0356A-1539_215-0862120_DSC04466_%2829461603171%29.jpg/330px-AMD%4028nm%40GCN_3th_gen%40Fiji%40Radeon_R9_Nano%40SPMRC_REA0356A-1539_215-0862120_DSC04466_%2829461603171%29.jpg',
          alt: 'GPU package with high-bandwidth memory modules',
          caption: 'The cache saves compute by spending high-bandwidth memory, so long context can become a memory-capacity problem. Source: Wikimedia Commons, File:AMD at 28nm GCN Fiji Radeon R9 Nano photo.',
        },
        'Memory is the real bill. Per sequence: 2 (K and V) x n_layers x n_kv_heads x d_head x seq_len x bytes_per_element. A 70B model with 80 layers, 8 KV heads (GQA), d_head=128, at 4,096 tokens in float16: 2 x 80 x 8 x 128 x 4,096 x 2 = 1.34 GB per request. Serve 32 concurrent requests and the KV cache alone needs 43 GB, separate from model weights. GQA cuts this by the ratio of query heads to KV heads -- a 32-head model with 8 KV groups uses 4x less cache than full multi-head attention.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'Every production autoregressive LLM uses KV caching: GPT, LLaMA, Mistral, and their serving stacks (vLLM, TensorRT-LLM, llama.cpp, TGI, SGLang). The cache is why "time to first token" and "tokens per second" are separate metrics -- prefill is a large parallel pass; decode is a sequence of small steps dominated by cache reads and memory bandwidth.',
        'The cache enables higher-level serving strategies. Prefix caching reuses K/V state for repeated system prompts or shared conversation prefixes, so a server running 1,000 chats with the same system prompt stores the cache for that prefix once. Speculative decoding has a draft model propose tokens and a verifier model check them, keeping accepted K/V state intact. Continuous batching tracks how much KV memory each live request owns to pack more requests onto a GPU. These techniques all depend on the cache as their foundation.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Memory scales linearly with sequence length. A 128K-context model at float16 with 80 layers and 8 KV heads needs over 40 GB of cache per request. Batch serving multiplies that by the batch size. Long-context products, agent loops, and RAG pipelines can exhaust GPU memory on cache alone.',
        'The cache cannot be shared across requests unless their token prefixes are identical under the same model weights, positional encoding, and adapter. Change a LoRA adapter, a system prompt, or even the tokenizer and the cache is invalid.',
        'Compression and eviction add tradeoffs. Int8 or lower-precision KV storage halves memory but can shift attention scores. Sliding-window eviction bounds memory but discards old context. Prefix caching helps repeated prompts but requires exact token matching and adds cache invalidation complexity. Non-autoregressive models (encoder-only, diffusion) do not use KV caching at all -- the technique is specific to causal left-to-right generation.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Consider a 4-layer model with 4 attention heads, d_head = 16, generating token 5 (the 5th token in the sequence). The prompt was 3 tokens; 1 token was already generated.',
        'After prefill, the cache holds K and V for positions 0-2 (the prompt) at each of the 4 layers. After generating token 3 (first generated token), K/V for position 3 is appended. The cache now has 4 positions x 4 layers x 4 heads x 16 dims x 2 (K+V) = 2,048 values.',
        'To generate token 4 (the 5th token): compute Q, K, V for the new token at each layer. Append K and V for position 4 to the cache. The new Q (shape [4 heads, 16 dims]) dot-products against 5 cached K vectors per head to produce 5 attention weights per head. Those weights mix 5 cached V vectors per head to produce the attended output. Total new K/V computation: 1 token. Total attention reads: 5 cached positions. Without cache, the model would recompute K/V for all 5 positions -- 4 of them wasted.',
        'At GPT-2 scale (12 layers, 12 heads, d_head=64, float16), the full memory formula is: 2 x 12 x 12 x 64 x seq_len x 2 bytes. At seq_len = 1,024: 36 MB per request. Serve 64 concurrent requests: 2.3 GB of GPU memory for KV storage alone. At 70B scale (80 layers, 8 KV heads, d_head=128, float16, seq_len=4,096): 1.34 GB per request. 32 concurrent requests: 43 GB. The model weights fit on the GPU; the KV cache for concurrent users may not.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Vaswani et al., 2017: Attention Is All You Need -- the transformer and implicit KV reuse. Shazeer, 2019: Fast Transformer Decoding: One Write-Head is All You Need -- multi-query attention. Ainslie et al., 2023: GQA: Training Generalized Multi-Query Transformer Models from Multi-Head Checkpoints. Kwon et al., 2023: Efficient Memory Management for Large Language Model Serving with PagedAttention (vLLM).',
        'Prerequisite: Attention Mechanism -- keys, queries, and values must be concrete before studying the cache. Architecture context: Transformer Block -- where KV caching fits in the full forward pass. Extensions: Speculative Decoding (uses the cache to verify draft tokens cheaply), Grouped-Query Attention (reduces cache size by sharing K/V across heads), RoPE (positional encoding applied to keys before caching). Contrasting approaches: state-space models (Mamba) and recurrent alternatives (RWKV) replace the growing cache with fixed-size recurrent state.',
      ],
    },
  ],
};
