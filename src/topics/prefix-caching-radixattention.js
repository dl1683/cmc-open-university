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

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'Prefix caching stores the KV cache produced by common prompt prefixes so future requests can skip recomputing those tokens. RadixAttention is SGLang\'s approach for automatic KV cache reuse using a radix tree over token prefixes.',
        'This is a concrete data-structure page inside the LLM serving stack. Trie and Adaptive Radix Tree explain the prefix index idea. KV Cache explains what is being reused. LLM Serving: PagedAttention explains how live KV memory is paged. Prefix caching connects them: reuse exact prefix computation across requests.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The server tokenizes each request and looks for the longest cached prefix. If a match exists, the request can start from the cached KV state and only prefill the remaining suffix. A radix tree compresses long single-child paths, so shared prompt segments are stored compactly and lookup follows token-prefix structure.',
        'SGLang describes RadixAttention as retaining KV cache after requests finish and organizing it in an LRU radix tree. vLLM documents automatic prefix caching with KV cache blocks and exact prefix matches. Both pursue the same goal: do not repeat prefill work when the token prefix is identical.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The cost is memory pressure. Cached prefixes occupy KV memory that could serve live requests. Eviction policy matters: hot shared roots should survive, cold leaves should leave first, and live request blocks must never be evicted. Cache lookup and tree maintenance also need to stay cheap relative to GPU work. In disaggregated serving, KV Cache Transfer Fabric Case Study adds a second question: should the request route toward a prefix-cache hit even if that means moving KV state across a busier link? KV Cache Tiered Offload Store Case Study adds the storage-policy version: should a cold shared prefix leave HBM but remain recoverable from CPU, SSD, or remote storage before the system pays full prefill again? SLO-Aware LLM Request Router shows how prefix locality competes with queue depth, p99 budget, tenant policy, and fallback.',
        'Prefix caching only reuses exact token prefixes. Semantically similar text does not count. Even a different whitespace pattern, reordered tool schema, or changed system prompt can break reuse. Prompt Cache-Key Canonicalization Ledger turns that product discipline into a concrete key contract: stable layout, token ids, model revision, adapter, tenant salt, multimodal hash, and version clocks.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Prefix caching is valuable for chat systems with long system prompts, agent frameworks with stable tool schemas, few-shot evaluation harnesses, RAG systems with repeated context, coding agents with repository instructions, and multi-turn conversations. It improves time to first token because the expensive prefill phase is partly skipped.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'Prefix caching does not speed up the unique decode suffix directly. It saves shared prefill. It also does not make approximate matches safe: KV reuse requires exact token identity. The cache can hurt if prompts are random, memory is tight, or eviction churn forces the server to maintain metadata without reuse.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: SGLang paper at https://arxiv.org/abs/2312.07104, SGLang RadixAttention blog at https://lmsys.org/blog/2024-01-17-sglang/, SGLang documentation at https://sgl-project.github.io/, and vLLM automatic prefix caching docs at https://docs.vllm.ai/en/latest/features/automatic_prefix_caching.html. Study Trie, Adaptive Radix Tree, KV Cache, LLM Serving: PagedAttention, Prompt Cache-Key Canonicalization Ledger, KV Cache Transfer Fabric Case Study, KV Cache Tiered Offload Store Case Study, SLO-Aware LLM Request Router, LLM Continuous Batching, and Transformer Inference Roofline next.',
      ],
    },
  ],
};
