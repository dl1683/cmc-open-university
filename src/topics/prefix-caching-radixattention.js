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
    explanation: 'LLM servers repeatedly process identical prefixes: system prompts, tool schemas, few-shot examples, policy text, retrieved documents, and conversation history. Prefix caching keeps the KV cache for those prefixes instead of recomputing prefill every time.',
  };

  yield {
    state: radixGraph('A radix-style prefix tree indexes reusable KV segments'),
    highlight: { active: ['root', 'sys', 'policy', 'tools', 'e-root-sys', 'e-sys-policy', 'e-sys-tools'], compare: ['user1', 'user2', 'agent'] },
    explanation: 'A trie stores shared token prefixes once. A radix tree compresses chains of tokens into longer edges. RadixAttention uses this structure to find the longest reusable KV prefix for a new request.',
    invariant: 'Prefix caching reuses exact KV states for exact token prefixes.',
  };

  yield {
    state: radixGraph('A new request skips prefill for the matching prefix'),
    highlight: { found: ['new', 'policy', 'e-new-policy'], active: ['sys', 'e-root-sys', 'e-sys-policy'] },
    explanation: 'If a new request starts with the same system prompt and policy block, the server can attach to the cached KV state at the matching node. It only computes the suffix after the shared prefix.',
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
    explanation: 'The win is mostly prefill latency and compute. The cost is memory pressure and cache management. Output stays identical because the reused KV cache is the exact result of processing the same tokens.',
  };
}

function* evictionAndReuse() {
  yield {
    state: radixGraph('The cache is useful only if hot prefixes survive'),
    highlight: { active: ['sys', 'policy', 'tools'], compare: ['user1', 'user2', 'agent'] },
    explanation: 'Prefix caches compete with live request KV cache for GPU memory. A serving system needs an eviction policy so hot prefixes survive and cold suffixes leave.',
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
    explanation: 'Evicting a leaf suffix usually hurts less than evicting a shared root. Practical policies combine recency, prefix length, reference counts, memory size, and active-request safety.',
    invariant: 'Never evict KV blocks still needed by live decode requests.',
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
    explanation: 'PagedAttention and prefix caching solve different layers. PagedAttention manages live KV memory efficiently. Prefix caching reuses KV from previous prompts. A strong server often uses both.',
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
    explanation: 'The workload decides the value. Agents, chat templates, and few-shot evaluations have shared prefixes. One-off prompts with little overlap mostly create cache churn.',
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
      heading: 'The tempting wrong answer',
      paragraphs: [
        'The tempting answer is semantic reuse: if two prompts mean the same thing, reuse the cache. That is unsafe for KV state. KV cache is the result of an exact token sequence under a specific model, adapter, position scheme, and cache format. Similar text does not count.',
        'Another tempting answer is to keep every prefix forever. Cached prefixes occupy KV blocks that active requests may need. A prefix cache must decide which roots are worth keeping and which leaves should be evicted.',
      ],
    },
    {
      heading: 'Core mechanism',
      paragraphs: [
        'The server tokenizes each request and looks for the longest cached prefix. A trie stores shared token prefixes once. A radix tree compresses long single-child paths into longer edges, so lookup follows prefix segments rather than single-token nodes. On a hit, the request attaches to cached KV state at the matching node and only prefills the suffix.',
        'The invariant is exact prefix identity. A hit is valid only when token ids and all computation-changing fields match. Eviction must also preserve correctness: never evict KV blocks still needed by live decode requests, and never return a prefix whose model contract has changed.',
      ],
    },
    {
      heading: 'Legacy visual note',
      paragraphs: [
        'The prefix-trie view starts with repeated prompt structure. The shared system prompt is near the root, and user-specific suffixes are leaves. The new request follows the longest matching path, then computes only what comes after that node.',
        'The eviction view shows the tax. Shared roots are valuable because many leaves depend on them. Cold leaves are cheaper to drop. The PagedAttention comparison explains the layer split: PagedAttention manages live KV blocks; prefix caching decides which previous prompt states are worth reusing.',
      ],
    },
    {
      heading: 'Where it fits',
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
  ],
};

export const article = {
  sections: [
    {
      heading: 'Why this exists',
      paragraphs: [
        'LLM serving spends a large part of its time in prefill: reading the prompt tokens, computing attention keys and values for every layer, and producing the KV cache that decode will reuse. Many applications repeat long prompt prefixes: system prompts, tool schemas, policy text, examples, retrieved documents, and conversation history.',
        'Prefix caching exists because recomputing identical prefixes is waste. If two requests begin with the exact same token sequence under the same model and execution contract, the server can reuse the KV state for that prefix and only prefill the suffix. RadixAttention is the SGLang design that organizes this reuse with a radix tree over token prefixes.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is to cache whole prompts or final responses. That helps only when the entire request repeats, which is much rarer than shared prefixes. Two users may share a system prompt and tool schema while asking different questions. Response caching misses that reuse.',
        'Another tempting approach is semantic matching: if two prompts mean about the same thing, reuse the cache. That is unsafe. KV cache is not a semantic summary. It is the exact intermediate state produced by exact token ids, positions, model weights, adapters, and cache format. Similar text is a miss.',
      ],
    },
    {
      heading: 'Core insight',
      paragraphs: [
        'The core insight is longest exact prefix reuse. Tokenize the incoming request, find the deepest cached node whose token path matches the beginning of the request, attach the request to that stored KV state, and compute only the remaining suffix tokens.',
        'A radix tree is useful because many prefixes share long single-child paths. Instead of storing one node per token, a radix tree compresses runs of tokens into edges. This keeps lookup and update tied to shared prompt structure rather than to a flat list of previous requests.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'After a request finishes or reaches a reusable boundary, the serving system retains selected KV blocks and records their token prefix in the prefix tree. Future requests walk the tree from the root using token ids. The longest matching node supplies cached KV blocks; the remaining tokens are prefetched normally.',
        'The cache must include identity fields beyond text. Model id, revision, tokenizer, adapter, quantization mode, positional encoding behavior, system options, and sometimes parallelism layout can all change the KV state. A cache hit is legal only when the full computation contract matches.',
        'Eviction is part of the algorithm. KV blocks consume scarce GPU memory or tiered cache capacity. Roots shared by many leaves are often more valuable than cold leaves. Live decode requests must retain their KV pages; completed prefixes are candidates for reuse only until memory pressure forces eviction.',
        'Insertion also has to split paths. If an existing cached prompt shares only part of an edge with a new prompt, the radix tree creates an internal node at the shared prefix, then hangs both suffixes below it. That split is what lets later requests reuse the common part without pretending the whole old prompt matched.',
      ],
    },
    {
      heading: 'What the visual is proving',
      paragraphs: [
        'The trie view proves that repeated prompt structure is a data-structure problem. Shared system instructions sit near the root. Tool schemas and examples extend the path. User-specific suffixes branch at the leaves. A new request does not need to match an old request entirely; it only needs a long exact prefix.',
        'The eviction view proves that prefix caching competes with live serving. A hot root can save many prefill passes, but it still occupies KV memory. Cold leaves are cheaper to discard. The right policy balances reuse probability, block size, memory pressure, and the latency cost of recomputing a prefix.',
        'The PagedAttention comparison proves a useful boundary. Paging manages how KV blocks are stored for active sequences. Prefix caching decides whether old prefix blocks should remain discoverable after a request no longer needs them for decode. They are related, but they answer different scheduling questions.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Transformer decode already relies on KV reuse within one request: once earlier tokens have produced keys and values, later tokens attend to that stored state instead of recomputing it. Prefix caching extends the same principle across requests when the earlier token sequence is identical.',
        'The radix-tree lookup works because transformer prefill is prefix-deterministic under a fixed contract. The KV state after tokens 1 through k depends on those tokens and the model configuration, not on the future suffix. Therefore a request with the same first k tokens can start from the same cached state and continue with its own suffix.',
      ],
    },
    {
      heading: 'Cost and tradeoffs',
      paragraphs: [
        'The main cost is memory. KV cache scales with layers, heads, head dimension, sequence length, dtype, and number of retained prefixes. A cache that saves compute can still hurt throughput if it crowds out active requests or forces expensive offload traffic.',
        'The second cost is routing. A prefix hit is only useful if the request reaches a worker that has the relevant KV state or can fetch it cheaply. SLO-aware routers must decide whether locality is worth a longer queue. In disaggregated systems, transferring KV can cost more than recomputing a short prefix.',
        'The measurement should be saved prefill work, not raw hit count. A tiny prefix hit may be irrelevant, while a moderate hit on a 20,000-token shared context can dominate latency. Good dashboards separate hit rate, matched tokens, recompute avoided, memory occupied, and eviction churn.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'Prefix caching wins in agent systems, code assistants, RAG applications, tool-heavy APIs, chat sessions with long histories, and batch workloads where many requests share the same instruction skeleton. The longer and more expensive the shared prefix, the larger the savings.',
        'It also wins when canonicalization is disciplined. Moving dynamic timestamps, random ids, and user-specific noise toward the suffix increases shared prefixes. Stable ordering of tool schemas and retrieved context can turn near misses into exact hits without changing model behavior.',
        'It is especially valuable for products with standard envelopes: the same safety instructions, the same function schema, the same repository context header, or the same document preamble. Those prefixes are boring to users but expensive to recompute, which makes them ideal cache material.',
      ],
    },
    {
      heading: 'Failure modes',
      paragraphs: [
        'The worst failure is an unsafe hit. Reusing KV state across a different model, tokenizer, adapter, position scheme, or hidden option can corrupt generation. A prefix cache needs a strict cache key and should prefer misses over questionable hits.',
        'Another failure is cache churn. If prompts are unique near the front, the radix tree fills with cold branches that are never reused. If memory is tight, the system may spend time inserting and evicting prefixes without improving latency. Observability should show hit length, saved prefill tokens, eviction reason, and memory pressure separately.',
        'A third failure is privacy leakage through shared infrastructure. Even if users cannot read cached KV directly, operators must treat retained prompt state as sensitive. Tenant boundaries, eviction policy, encryption at rest for offloaded cache, and audit trails matter for the same reason raw prompts matter.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Study Trie and Adaptive Radix Tree for the index shape, KV Cache for the state being reused, LLM Serving PagedAttention for live KV block management, Prompt Cache-Key Canonicalization Ledger for exact identity rules, KV Cache Transfer Fabric for cross-worker movement, Tiered Offload for cold prefixes, and Continuous Batching for the scheduling layer around cached requests.',
        'A useful implementation exercise is to build the tree over token ids, not strings, and log the matched-prefix length for every request. That single metric quickly shows whether prompt design is helping reuse or destroying it near the root.',
      ],
    },
  ],
};
