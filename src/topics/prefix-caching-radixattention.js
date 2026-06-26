// Prefix caching and RadixAttention: retain KV cache for shared prompt prefixes
// and index reusable prefixes with trie/radix-style structures.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'prefix-caching-radixattention',
  title: 'Prefix Caching & RadixAttention',
  category: 'Systems',
  summary: 'Reuse KV cache across shared prompts: prefix tries, radix splits, LRU eviction, and prefill savings in LLM servers.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['prefix trie', 'eviction and reuse'], defaultValue: 'prefix trie' },
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

function radixGraph(title) {
  return graphState({
    nodes: [
      { id: 'root', label: 'root', x: 0.7, y: 3.8, note: 'empty prefix' },
      { id: 'sys', label: 'system prompt', x: 2.4, y: 3.8, note: 'shared KV' },
      { id: 'policy', label: 'policy docs', x: 4.3, y: 2.1, note: 'branch A' },
      { id: 'tools', label: 'tool schema', x: 4.3, y: 5.5, note: 'branch B' },
      { id: 'user1', label: 'user turn 1', x: 6.5, y: 1.4, note: 'leaf' },
      { id: 'user2', label: 'user turn 2', x: 6.5, y: 2.8, note: 'leaf' },
      { id: 'agent', label: 'agent trace', x: 6.5, y: 5.5, note: 'leaf' },
      { id: 'new', label: 'new request', x: 8.6, y: 3.8, note: 'match prefix' },
    ],
    edges: [
      { id: 'e-root-sys', from: 'root', to: 'sys', weight: 'tokens 0..300' },
      { id: 'e-sys-policy', from: 'sys', to: 'policy', weight: 'tokens 301..900' },
      { id: 'e-sys-tools', from: 'sys', to: 'tools', weight: 'tokens 301..700' },
      { id: 'e-policy-u1', from: 'policy', to: 'user1', weight: 'suffix' },
      { id: 'e-policy-u2', from: 'policy', to: 'user2', weight: 'suffix' },
      { id: 'e-tools-agent', from: 'tools', to: 'agent', weight: 'suffix' },
      { id: 'e-new-policy', from: 'new', to: 'policy', weight: 'longest hit' },
    ],
  }, { title });
}

function* prefixTrie() {
  const requestTypes = ['chat request 1', 'chat request 2', 'agent request', 'RAG request'];
  const requestCount = requestTypes.length;
  const sysTokenRange = '0..300';

  yield {
    state: labelMatrix(
      'Requests often share long prefixes',
      [
        { id: 'chat1', label: 'chat request 1' },
        { id: 'chat2', label: 'chat request 2' },
        { id: 'agent', label: 'agent request' },
        { id: 'rag', label: 'RAG request' },
      ],
      [
        { id: 'shared', label: 'shared prefix' },
        { id: 'unique', label: 'unique suffix' },
      ],
      [
        ['system prompt + policy', 'question A'],
        ['system prompt + policy', 'question B'],
        ['system prompt + tools', 'trace step'],
        ['system prompt + docs', 'retrieved chunk'],
      ],
    ),
    highlight: { active: ['chat1:shared', 'chat2:shared', 'agent:shared', 'rag:shared'], compare: ['chat1:unique', 'chat2:unique'] },
    explanation: `LLM servers repeatedly process identical prefixes: system prompts, tool schemas, few-shot examples, policy text, retrieved documents, and conversation history. All ${requestCount} request types here share a prefix. Prefix caching keeps the KV cache for those prefixes instead of recomputing prefill every time.`,
  };

  yield {
    state: radixGraph('A radix-style prefix tree indexes reusable KV segments'),
    highlight: { active: ['root', 'sys', 'policy', 'tools', 'e-root-sys', 'e-sys-policy', 'e-sys-tools'], compare: ['user1', 'user2', 'agent'] },
    explanation: `A trie stores shared token prefixes once. A radix tree compresses chains of tokens into longer edges. The root edge covers system-prompt tokens ${sysTokenRange}. RadixAttention uses this structure to find the longest reusable KV prefix for a new request.`,
    invariant: `Prefix caching reuses exact KV states for exact token prefixes — all ${requestCount} requests share the same root path.`,
  };

  yield {
    state: radixGraph('A new request skips prefill for the matching prefix'),
    highlight: { found: ['new', 'policy', 'e-new-policy'], active: ['sys', 'e-root-sys', 'e-sys-policy'] },
    explanation: `If a new request starts with the same system prompt (tokens ${sysTokenRange}) and policy block, the server can attach to the cached KV state at the matching node. It only computes the suffix after the shared prefix.`,
  };

  yield {
    state: labelMatrix(
      'What prefix caching saves',
      [
        { id: 'ttft', label: 'time to first token' },
        { id: 'gpu', label: 'GPU prefill work' },
        { id: 'memory', label: 'KV memory' },
        { id: 'correct', label: 'model output' },
      ],
      [
        { id: 'effect', label: 'effect' },
        { id: 'why', label: 'why' },
      ],
      [
        ['lower', 'skip shared prompt compute'],
        ['lower', 'reuse attention keys and values'],
        ['higher pressure', 'cache occupies blocks'],
        ['unchanged', 'same prefix, same KV'],
      ],
    ),
    highlight: { found: ['ttft:effect', 'gpu:effect', 'correct:why'], compare: ['memory:effect'] },
    explanation: `The win is mostly prefill latency and compute. The cost is memory pressure and cache management. Across ${requestCount} request types, output stays identical because the reused KV cache is the exact result of processing the same tokens.`,
  };
}

function* evictionAndReuse() {
  const evictionCategories = ['system prompt', 'policy block', 'old chat suffix', 'rare tool trace'];
  const cacheTypes = ['PagedAttention', 'prefix caching', 'RadixAttention', 'block hash cache'];
  const typeCount = cacheTypes.length;

  yield {
    state: radixGraph('The cache is useful only if hot prefixes survive'),
    highlight: { active: ['sys', 'policy', 'tools'], compare: ['user1', 'user2', 'agent'] },
    explanation: `Prefix caches compete with live request KV cache for GPU memory. With ${evictionCategories.length} segment categories to manage, a serving system needs an eviction policy so hot prefixes survive and cold suffixes leave.`,
  };

  yield {
    state: labelMatrix(
      'LRU-style eviction on prefix segments',
      [
        { id: 'system', label: 'system prompt' },
        { id: 'policy', label: 'policy block' },
        { id: 'oldchat', label: 'old chat suffix' },
        { id: 'raretool', label: 'rare tool trace' },
      ],
      [
        { id: 'reuse', label: 'recent reuse' },
        { id: 'evict', label: 'eviction decision' },
      ],
      [
        ['very high', 'keep'],
        ['high', 'keep'],
        ['low', 'evict leaf first'],
        ['very low', 'evict branch'],
      ],
    ),
    highlight: { found: ['system:evict', 'policy:evict'], removed: ['oldchat:evict', 'raretool:evict'] },
    explanation: `Evicting a leaf suffix usually hurts less than evicting a shared root. Across ${evictionCategories.length} categories, practical policies combine recency, prefix length, reference counts, memory size, and active-request safety.`,
    invariant: `Never evict KV blocks still needed by live decode requests — ${evictionCategories.length} categories are ranked by reuse frequency.`,
  };

  yield {
    state: labelMatrix(
      'Prefix caching versus PagedAttention',
      [
        { id: 'paged', label: 'PagedAttention' },
        { id: 'prefix', label: 'prefix caching' },
        { id: 'radix', label: 'RadixAttention' },
        { id: 'hash', label: 'block hash cache' },
      ],
      [
        { id: 'solves', label: 'solves' },
        { id: 'unit', label: 'unit of reuse' },
      ],
      [
        ['KV allocation fragmentation', 'pages / blocks'],
        ['repeat prompt compute', 'shared token prefix'],
        ['automatic prefix lookup', 'radix tree segment'],
        ['exact block matching', 'hashed KV block'],
      ],
    ),
    highlight: { active: ['paged:solves', 'prefix:solves'], found: ['radix:unit', 'hash:unit'] },
    explanation: `${typeCount} approaches are compared: PagedAttention and prefix caching solve different layers. PagedAttention manages live KV memory efficiently. Prefix caching reuses KV from previous prompts. A strong server often uses both.`,
  };

  yield {
    state: labelMatrix(
      'When prefix caching pays off',
      [
        { id: 'agents', label: 'agents and tools' },
        { id: 'fewshot', label: 'few-shot prompts' },
        { id: 'rag', label: 'stable RAG context' },
        { id: 'random', label: 'random prompts' },
      ],
      [
        { id: 'overlap', label: 'prefix overlap' },
        { id: 'result', label: 'result' },
      ],
      [
        ['very high', 'large TTFT win'],
        ['high', 'reuse examples'],
        ['medium', 'depends on retrieval stability'],
        ['low', 'cache churn'],
      ],
    ),
    highlight: { found: ['agents:result', 'fewshot:result'], compare: ['rag:result', 'random:result'] },
    explanation: `The workload decides the value. Agents, chat templates, and few-shot evaluations have shared prefixes. Across ${typeCount} caching strategies, one-off prompts with little overlap mostly create cache churn.`,
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'prefix trie') yield* prefixTrie();
  else if (view === 'eviction and reuse') yield* evictionAndReuse();
  else throw new InputError('Pick a prefix-caching view.');
}

const legacyArticle = {
  sections: [
    {
      heading: 'Why it exists',
      paragraphs: [
        'LLM applications repeat large prompt prefixes: system instructions, tool schemas, few-shot examples, policy text, retrieved documents, and conversation history. Recomputing those prefixes on every request wastes prefill time and GPU work.',
        'Prefix caching stores the KV cache produced by common prefixes so future requests can skip that exact prefill work. RadixAttention is the SGLang approach for automatic reuse with a radix tree over token prefixes.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The tempting answer is semantic reuse: if two prompts mean the same thing, reuse the cache. That is unsafe for KV state. KV cache is the result of an exact token sequence under a specific model, adapter, position scheme, and cache format. Similar text does not count.',
        'Another tempting answer is to keep every prefix forever. Cached prefixes occupy KV blocks that active requests may need. A prefix cache must decide which roots are worth keeping and which leaves should be evicted.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'The server tokenizes each request and looks for the longest cached prefix. A trie stores shared token prefixes once. A radix tree compresses long single-child paths into longer edges, so lookup follows prefix segments rather than single-token nodes. On a hit, the request attaches to cached KV state at the matching node and only prefills the suffix.',
        'The invariant is exact prefix identity. A hit is valid only when token ids and all computation-changing fields match. Eviction must also preserve correctness: never evict KV blocks still needed by live decode requests, and never return a prefix whose model contract has changed.',
      ],
    },
    {
      heading: 'How to read the animation',
      paragraphs: [
        'The prefix-trie view starts with repeated prompt structure. The shared system prompt is near the root, and user-specific suffixes are leaves. The new request follows the longest matching path, then computes only what comes after that node.',
        'The eviction view shows the tax. Shared roots are valuable because many leaves depend on them. Cold leaves are cheaper to drop. The PagedAttention comparison explains the layer split: PagedAttention manages live KV blocks; prefix caching decides which previous prompt states are worth reusing.',
      
        {type: 'image', src: './assets/gifs/prefix-caching-radixattention.gif', alt: 'Animated walkthrough of the prefix caching radixattention visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'This is a concrete data-structure page inside the LLM serving stack. Trie and Adaptive Radix Tree explain the prefix index. KV Cache explains what is being reused. LLM Serving: PagedAttention explains how live KV memory is paged. Prompt Cache-Key Canonicalization Ledger defines the exact identity fields that make reuse legal.',
        'SGLang describes RadixAttention as retaining KV cache after requests finish and organizing it in an LRU radix tree. vLLM documents automatic prefix caching with KV cache blocks and exact prefix matches. Both pursue the same goal: do not repeat prefill work when the token prefix is identical.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Prefix caching fails when prompts are random, when dynamic noise appears near the front, when memory is tight, or when eviction churn costs more than reuse saves. It does not speed up the unique decode suffix directly; it saves shared prefill.',
        'In disaggregated serving, a prefix hit may live on the wrong worker. KV Cache Transfer Fabric asks whether moving state is worth it. KV Cache Tiered Offload Store asks whether a cold shared prefix should leave HBM but remain recoverable. SLO-Aware LLM Request Router decides whether locality beats queue depth and p99 risk.',
        'Primary sources: SGLang paper at https://arxiv.org/abs/2312.07104, SGLang RadixAttention blog at https://lmsys.org/blog/2024-01-17-sglang/, SGLang documentation at https://sgl-project.github.io/, and vLLM automatic prefix caching docs at https://docs.vllm.ai/en/latest/features/automatic_prefix_caching.html.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Study Trie and Adaptive Radix Tree to understand the index shape. Then read KV Cache, LLM Serving: PagedAttention, Prompt Cache-Key Canonicalization Ledger, KV Cache Transfer Fabric Case Study, KV Cache Tiered Offload Store Case Study, SLO-Aware LLM Request Router, LLM Continuous Batching, and Transformer Inference Roofline.',
      ],
    },
      {
      heading: 'The wall',
      paragraphs: [
        'The wall is cache miss geometry: equivalent prefixes fail to share state because keying is unstable or coarse.',
        'If normalizing or chunking differs between requests, one user message can miss a fully reusable KV block.',
        'A concrete failure is same text with different whitespace or tokenization boundaries producing two disjoint cache prefixes.',
      ],
    },

    {
      heading: 'Worked example',
      paragraphs: [
        'Request 1: prefix tokens `["The","user","asked","for"]` fills cache entries for layers 1..N.',
        'Request 2: same phrase with only one token extension `["The","user","asked","for","a"]` should reuse the first 4-token path.',
        'Only the new suffix path recomputes attention context; reused prefix blocks reduce prefill cost with identical keys.',
      ],
    },
],
};

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'The prefix-trie view starts with repeated prompt structure. The shared system prompt is near the root, and user-specific suffixes are leaves. The new request follows the longest matching path, then computes only what comes after that node.',
        {type: 'image', src: './assets/gifs/prefix-caching-radixattention.gif', alt: 'Animated walkthrough of the prefix caching radixattention visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
        'The eviction view shows the tax. Shared roots are valuable because many leaves depend on them. Cold leaves are cheaper to drop. The safe inference is that reuse is valid only for exact token prefixes under the same model contract.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'LLM serving spends a large part of its time in prefill: reading prompt tokens and computing the key-value cache that decode will reuse. Many applications repeat long prefixes such as system prompts, tool schemas, policy text, examples, and conversation history. Recomputing identical prefixes wastes GPU time.',
        {type: 'callout', text: 'Prefix caching is correct only for exact token prefixes under the same model contract; semantic similarity is not enough to reuse KV state.'},
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/b/be/Trie_example.svg', alt: 'Trie diagram showing words sharing prefix paths', caption: 'A trie stores shared prefixes once; RadixAttention applies the same shape to reusable token-prefix KV segments. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Trie_example.svg.'},
        'Prefix caching stores reusable KV state after a request finishes. RadixAttention is the SGLang design that organizes this state in a radix tree over token prefixes. The structure lets a later request reuse the longest exact cached prefix and prefill only the suffix.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is to cache whole prompts by string. If the next request has the exact same prompt, reuse the result. This helps duplicates but misses shared prefixes such as the same system prompt followed by different user questions.',
        'Another tempting approach is semantic reuse. If two prompts mean the same thing, reuse the cache. That is unsafe because KV cache is a tensor result of exact token ids, positions, model weights, adapters, and execution settings, not a meaning-level summary.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is identity. A single whitespace change can produce different token ids, and a different adapter or position scheme changes every downstream KV tensor. A cache hit that ignores these fields can silently return wrong attention state.',
        'The second wall is memory pressure. KV blocks occupy high-bandwidth memory that active requests also need. Keeping every prefix forever can reduce throughput by starving live decoding.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Store shared prefixes once and treat every cache hit as a longest-prefix match. A trie represents token prefixes as paths, and a radix tree compresses long single-child paths into larger edge labels. The index follows token segments instead of comparing whole prompts repeatedly.',
        'The invariant is exact reusable state. A node can be returned only when token ids and every computation-changing contract field match. Eviction must never remove KV blocks still needed by live requests.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'When a request arrives, the server tokenizes it and walks the radix tree from the root. The walk stops at the longest cached prefix that matches the request. The server attaches to the cached KV blocks at that node and computes KV only for the remaining suffix.',
        'After the request finishes, useful suffixes can be inserted back into the tree. LRU-style eviction removes cold leaves first because leaves usually have fewer dependents than shared roots. PagedAttention or a similar block manager handles live KV allocation, while prefix caching decides which old blocks deserve reuse.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Transformer prefill is deterministic for a fixed model contract and token prefix. If two requests share the same first k token ids, those k positions produce the same KV tensors at every layer. Reusing that state is equivalent to recomputing it and copying the same result.',
        'The radix tree is correct because each path encodes a concrete token prefix. Longest-prefix lookup never claims more reuse than the path proves. Eviction preserves correctness when it removes only unreachable or inactive cache entries and forces later requests to recompute instead of returning stale state.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Lookup cost is proportional to the matched prefix segments, and radix compression reduces pointer hops on long shared runs. If a 2,000-token system prompt is cached and a new 2,200-token request shares it, prefill work falls from 2,200 tokens to about 200 suffix tokens plus lookup overhead. The decode cost for new output tokens is unchanged.',
        'The memory cost is KV storage across layers, heads, and token positions. Caching a long prefix can save repeated compute but occupy many blocks. The behavioral cost is eviction policy: too aggressive drops useful prefixes, while too generous harms live serving capacity.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'LLM applications with stable system prompts, tool schemas, few-shot examples, or long retrieved context benefit most. Agents that call tools often repeat the same policy and schema prefix across many requests. Chat systems repeat conversation history until a new turn extends it.',
        'SGLang uses RadixAttention to retain and reuse KV cache across requests. vLLM supports automatic prefix caching with exact prefix matches over KV cache blocks. Both systems aim to reduce repeated prefill, not to make unique decode tokens cheaper.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Prefix caching fails when prompts are mostly unique or unstable near the front. Random request ids, timestamps, shuffled examples, or per-user noise before shared text can destroy the common prefix. Canonicalization must move stable content early when that is semantically safe.',
        'It also fails across incompatible contracts. Different models, adapters, quantization modes, tokenizer versions, position ids, or cache formats cannot share KV state. In distributed serving, a cache hit on the wrong worker may cost more to transfer than to recompute.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Request 1 has 1,500 system-prompt tokens, 300 tool-schema tokens, and 200 user tokens, for 2,000 prefill tokens. The server computes KV for all 2,000 and stores the path. Request 2 has the same first 1,800 tokens and a different 150-token user suffix.',
        'A whole-prompt cache misses because the full prompt differs. A radix prefix cache matches the first 1,800 tokens and computes only the 150-token suffix. If prefill costs 40 microseconds per token, the matched request avoids about 1,800 * 40 microseconds, or 72 ms of repeated work before overhead.',
        'The saving is correct only if token ids, positions, model weights, adapter state, and cache format match. If one request used a different LoRA adapter, the same text would not be the same KV state. The cache must miss and recompute.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: the SGLang paper at https://arxiv.org/abs/2312.07104, the SGLang RadixAttention blog at https://lmsys.org/blog/2024-01-17-sglang/, SGLang documentation at https://sgl-project.github.io/, and vLLM automatic prefix caching documentation. These sources define the serving contract behind the animation.',
        'Study next: Trie and Adaptive Radix Tree for the index shape, KV Cache for what is reused, PagedAttention for live KV block management, Prompt Cache-Key Canonicalization for identity fields, and SLO-Aware LLM Request Router for the locality versus queue-depth trade.',
      ],
    },
  ],
};
