// Prompt cache-key canonicalization: make reusable prompt prefixes stable,
// exact, isolated, and observable before relying on provider or KV caches.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'prompt-cache-key-canonicalization-ledger-case-study',
  title: 'Prompt Cache-Key Canonicalization Ledger',
  category: 'AI & ML',
  summary: 'A prompt-caching case study: canonical prompt layouts, token/block hashes, cache breakpoints, provider cache controls, tenant salts, multimodal hashes, TTLs, and audit rows.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['key pipeline', 'breakpoints', 'safety audit'], defaultValue: 'key pipeline' },
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

function keyGraph(title) {
  return graphState({
    nodes: [
      { id: 'req', label: 'req', x: 0.6, y: 3.5, note: 'prompt' },
      { id: 'layout', label: 'layout', x: 2.0, y: 3.5, note: 'order' },
      { id: 'tok', label: 'tokens', x: 3.5, y: 3.5, note: 'ids' },
      { id: 'block', label: 'block', x: 5.0, y: 2.0, note: 'hash' },
      { id: 'extra', label: 'extra', x: 5.0, y: 5.0, note: 'fields' },
      { id: 'key', label: 'key', x: 6.6, y: 3.5, note: 'digest' },
      { id: 'router', label: 'route', x: 8.0, y: 2.0, note: 'local' },
      { id: 'cache', label: 'cache', x: 8.0, y: 5.0, note: 'hit' },
      { id: 'span', label: 'span', x: 9.2, y: 3.5, note: 'audit' },
    ],
    edges: [
      { id: 'e-req-layout', from: 'req', to: 'layout' },
      { id: 'e-layout-tok', from: 'layout', to: 'tok' },
      { id: 'e-tok-block', from: 'tok', to: 'block' },
      { id: 'e-tok-extra', from: 'tok', to: 'extra' },
      { id: 'e-block-key', from: 'block', to: 'key' },
      { id: 'e-extra-key', from: 'extra', to: 'key' },
      { id: 'e-key-router', from: 'key', to: 'router' },
      { id: 'e-key-cache', from: 'key', to: 'cache' },
      { id: 'e-router-span', from: 'router', to: 'span' },
      { id: 'e-cache-span', from: 'cache', to: 'span' },
    ],
  }, { title });
}

function breakpointGraph(title) {
  return graphState({
    nodes: [
      { id: 'tools', label: 'tools', x: 1.0, y: 1.4, note: 'stable' },
      { id: 'system', label: 'system', x: 2.6, y: 1.4, note: 'stable' },
      { id: 'docs', label: 'docs', x: 4.2, y: 1.4, note: 'digest' },
      { id: 'hist', label: 'hist', x: 5.8, y: 1.4, note: 'grows' },
      { id: 'mark', label: 'mark', x: 5.8, y: 3.2, note: 'cache' },
      { id: 'user', label: 'user', x: 7.4, y: 1.4, note: 'new' },
      { id: 'out', label: 'out', x: 9.0, y: 1.4, note: 'fresh' },
      { id: 'ttl', label: 'TTL', x: 4.2, y: 4.8, note: '5m/1h' },
      { id: 'bill', label: 'bill', x: 7.4, y: 4.8, note: 'tokens' },
    ],
    edges: [
      { id: 'e-tools-system', from: 'tools', to: 'system' },
      { id: 'e-system-docs', from: 'system', to: 'docs' },
      { id: 'e-docs-hist', from: 'docs', to: 'hist' },
      { id: 'e-hist-mark', from: 'hist', to: 'mark' },
      { id: 'e-mark-user', from: 'mark', to: 'user' },
      { id: 'e-user-out', from: 'user', to: 'out' },
      { id: 'e-mark-ttl', from: 'mark', to: 'ttl' },
      { id: 'e-ttl-bill', from: 'ttl', to: 'bill' },
      { id: 'e-mark-bill', from: 'mark', to: 'bill' },
    ],
  }, { title });
}

function hitPlot(markers = []) {
  return plotState({
    axes: { x: { label: 'noise pos', min: 0, max: 100 }, y: { label: 'hit rate', min: 0, max: 1 } },
    series: [
      { id: 'front', label: 'noisy front', points: [{ x: 0, y: 0.05 }, { x: 20, y: 0.12 }, { x: 40, y: 0.2 }, { x: 70, y: 0.38 }, { x: 100, y: 0.55 }] },
      { id: 'tail', label: 'stable first', points: [{ x: 0, y: 0.12 }, { x: 20, y: 0.38 }, { x: 40, y: 0.62 }, { x: 70, y: 0.78 }, { x: 100, y: 0.88 }] },
      { id: 'unsafe', label: 'over norm', points: [{ x: 0, y: 0.7 }, { x: 20, y: 0.72 }, { x: 40, y: 0.74 }, { x: 70, y: 0.77 }, { x: 100, y: 0.8 }] },
    ],
    markers,
  });
}

function* keyPipeline() {
  yield {
    state: keyGraph('Prompt cache keys start before hashing'),
    highlight: { active: ['req', 'layout', 'tok', 'block', 'extra', 'key', 'e-req-layout', 'e-layout-tok'], compare: ['router', 'cache'] },
    explanation: 'Prompt caching is not just hashing a string. The product must first make the prompt layout stable, tokenize it, block it, and bind every field that changes the model computation or privacy boundary.',
  };

  yield {
    state: labelMatrix(
      'Key fields',
      [
        { id: 'parent', label: 'parent' },
        { id: 'tokens', label: 'tokens' },
        { id: 'model', label: 'model' },
        { id: 'adapter', label: 'adapter' },
        { id: 'tenant', label: 'tenant' },
        { id: 'media', label: 'media' },
      ],
      [
        { id: 'binds', label: 'binds' },
        { id: 'miss', label: 'miss if' },
      ],
      [
        ['prev', 'branch'],
        ['ids', 'edit'],
        ['rev', 'base'],
        ['LoRA', 'swap'],
        ['salt', 'leak'],
        ['mm', 'new'],
      ],
    ),
    highlight: { active: ['parent:binds', 'tokens:binds', 'model:binds'], found: ['tenant:binds', 'media:binds'], compare: ['adapter:miss'] },
    explanation: 'vLLM-style block keys include parent hash, block tokens, and extra hashes such as LoRA ids, multimodal input hashes, and cache salts. Those extras are not optional metadata; they decide whether reuse is legal.',
    invariant: 'A cache hit must prove computation identity, not semantic similarity.',
  };

  yield {
    state: labelMatrix(
      'Canonical layout',
      [
        { id: 'tools', label: 'tools' },
        { id: 'system', label: 'system' },
        { id: 'docs', label: 'docs' },
        { id: 'history', label: 'history' },
        { id: 'user', label: 'user' },
      ],
      [
        { id: 'place', label: 'place' },
        { id: 'rule', label: 'rule' },
      ],
      [
        ['first', 'sort ids'],
        ['first', 'version'],
        ['middle', 'digest'],
        ['then', 'append'],
        ['last', 'dynamic'],
      ],
    ),
    highlight: { active: ['tools:place', 'system:rule', 'docs:rule'], found: ['history:rule'], compare: ['user:place'] },
    explanation: 'Stable content should sit before dynamic content. Tool schemas need deterministic ordering. System prompts and retrieved document bundles need versioned digests. User-turn randomness belongs at the tail.',
  };

  yield {
    state: hitPlot([
      { id: 'good', x: 80, y: 0.82, label: 'good' },
      { id: 'bad', x: 10, y: 0.09, label: 'bad' },
    ]),
    highlight: { active: ['tail', 'good'], compare: ['front', 'bad'], removed: ['unsafe'] },
    explanation: 'The prompt layout determines the hit-rate ceiling. If timestamps, request ids, retrieval order, or tool schemas change near the front, the shared prefix ends early and provider or KV caches miss.',
  };

  yield {
    state: keyGraph('One key feeds provider cache, KV cache, and route hints'),
    highlight: { active: ['key', 'router', 'cache', 'span', 'e-key-router', 'e-key-cache'], found: ['block', 'extra'] },
    explanation: 'The same identity discipline helps three layers: provider prompt caching, vLLM prefix/KV caching, and SLO-aware routing toward replicas that likely hold the right state. The route span should record which layer hit.',
  };
}

function* breakpoints() {
  yield {
    state: labelMatrix(
      'Provider shapes',
      [
        { id: 'vllm', label: 'vLLM' },
        { id: 'openai', label: 'OpenAI' },
        { id: 'anth', label: 'Claude' },
        { id: 'gemini', label: 'Gemini' },
        { id: 'bedrock', label: 'Bedrock' },
      ],
      [
        { id: 'unit', label: 'unit' },
        { id: 'control', label: 'control' },
        { id: 'watch', label: 'watch' },
      ],
      [
        ['KV block', 'auto', 'hash'],
        ['prefix', 'auto/key', 'TTL'],
        ['blocks', 'cache ctl', 'breaks'],
        ['context', 'cache id', 'TTL'],
        ['prompt', 'blocks', 'bill'],
      ],
    ),
    highlight: { active: ['vllm:unit', 'openai:control', 'anth:control'], found: ['gemini:control'], compare: ['bedrock:watch'] },
    explanation: 'Different systems expose different controls: automatic prefix reuse, explicit cache ids, cache_control breakpoints, or KV-block hashing. The ledger normalizes them into one product view.',
  };

  yield {
    state: breakpointGraph('Cache breakpoints separate stable prefix from dynamic tail'),
    highlight: { active: ['tools', 'system', 'docs', 'hist', 'mark', 'e-tools-system', 'e-system-docs', 'e-docs-hist', 'e-hist-mark'], compare: ['user', 'out'] },
    explanation: 'A cache breakpoint should usually sit after large stable content and before the newest user turn. That maximizes reuse while keeping the answer fresh for the dynamic suffix.',
  };

  yield {
    state: labelMatrix(
      'Conversation policy',
      [
        { id: 'tools', label: 'tools' },
        { id: 'sys', label: 'system' },
        { id: 'files', label: 'files' },
        { id: 'hist', label: 'history' },
        { id: 'ask', label: 'ask' },
      ],
      [
        { id: 'cache', label: 'cache' },
        { id: 'reason', label: 'reason' },
      ],
      [
        ['yes', 'static'],
        ['yes', 'policy'],
        ['maybe', 'digest'],
        ['roll', 'grows'],
        ['no', 'fresh'],
      ],
    ),
    highlight: { active: ['tools:cache', 'sys:cache', 'files:reason'], found: ['hist:cache'], removed: ['ask:cache'] },
    explanation: 'Cache the stable contract, not the volatile question. History can be cached as it rolls forward, but the newest user turn and tool outputs usually belong outside the cached prefix.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'minutes idle', min: 0, max: 70 }, y: { label: 'hit chance', min: 0, max: 1 } },
      series: [
        { id: 'short', label: 'short TTL', points: [{ x: 0, y: 0.95 }, { x: 5, y: 0.75 }, { x: 10, y: 0.35 }, { x: 20, y: 0.08 }, { x: 60, y: 0.0 }] },
        { id: 'hour', label: 'hour TTL', points: [{ x: 0, y: 0.95 }, { x: 5, y: 0.9 }, { x: 10, y: 0.82 }, { x: 20, y: 0.66 }, { x: 60, y: 0.25 }] },
      ],
      markers: [
        { id: 'seed', x: 0, y: 0.95, label: 'seed' },
        { id: 'expire', x: 60, y: 0.25, label: 'expire' },
      ],
    }),
    highlight: { active: ['hour', 'seed'], compare: ['short'], found: ['expire'] },
    explanation: 'TTL is an economic choice. Longer cache windows can improve reuse for slow conversations, but writes may cost more and stale prompt contracts need stronger version gates.',
  };

  yield {
    state: breakpointGraph('Cached tokens still need fresh output'),
    highlight: { active: ['mark', 'ttl', 'bill', 'user', 'out', 'e-mark-user', 'e-user-out'], found: ['docs'], compare: ['hist'] },
    explanation: 'Prompt caching does not replay the final answer. It reuses prior computation for the prefix, then the model still processes the dynamic suffix and generates a fresh output.',
  };
}

function* safetyAudit() {
  yield {
    state: labelMatrix(
      'Failure audit',
      [
        { id: 'order', label: 'order' },
        { id: 'tenant', label: 'tenant' },
        { id: 'model', label: 'model' },
        { id: 'tool', label: 'tool' },
        { id: 'media', label: 'media' },
        { id: 'ttl', label: 'TTL' },
      ],
      [
        { id: 'bug', label: 'bug' },
        { id: 'guard', label: 'guard' },
      ],
      [
        ['miss storm', 'canon'],
        ['data leak', 'salt'],
        ['wrong KV', 'rev key'],
        ['bad tool', 'schema'],
        ['wrong img', 'mm hash'],
        ['stale', 'version'],
      ],
    ),
    highlight: { active: ['tenant:guard', 'model:guard', 'media:guard'], compare: ['order:bug'], found: ['ttl:guard'] },
    explanation: 'Prompt-cache failures are key-design failures: unstable ordering creates misses, missing salts leak tenants, missing model fields creates wrong KV, and missing version clocks makes stale state look reusable.',
  };

  yield {
    state: keyGraph('Version clocks turn old prefixes into misses'),
    highlight: { active: ['extra', 'key', 'cache', 'span', 'e-extra-key', 'e-key-cache', 'e-cache-span'], removed: ['router'], found: ['block'] },
    explanation: 'The safe way to invalidate old prompt contracts is to bind system prompt version, tool schema version, corpus digest, adapter id, and policy version into the key. Old keys miss without a purge race.',
  };

  yield {
    state: labelMatrix(
      'Audit row',
      [
        { id: 'hit', label: 'hit' },
        { id: 'miss', label: 'miss' },
        { id: 'write', label: 'write' },
        { id: 'read', label: 'read' },
        { id: 'deny', label: 'deny' },
      ],
      [
        { id: 'field', label: 'field' },
        { id: 'why', label: 'why' },
      ],
      [
        ['key id', 'debug'],
        ['reason', 'fix'],
        ['tokens', 'bill'],
        ['saved', 'cost'],
        ['gate', 'safety'],
      ],
    ),
    highlight: { active: ['hit:field', 'miss:field', 'write:field', 'read:field'], found: ['deny:why'] },
    explanation: 'Prompt-cache observability should expose cache writes, cache reads, cached token counts, miss reasons, deny reasons, and route ids. Otherwise hit-rate changes cannot be tied to cost or latency.',
  };

  yield {
    state: hitPlot([
      { id: 'safe', x: 85, y: 0.84, label: 'safe' },
      { id: 'risk', x: 90, y: 0.8, label: 'risk' },
    ]),
    highlight: { active: ['tail', 'safe'], removed: ['unsafe', 'risk'], compare: ['front'] },
    explanation: 'Do not chase hits by normalizing away fields that affect correctness. A too-broad key can look efficient while reusing state across models, tenants, or tool contracts.',
  };

  yield {
    state: labelMatrix(
      'Ship checklist',
      [
        { id: 'layout', label: 'layout' },
        { id: 'key', label: 'key' },
        { id: 'tenant', label: 'tenant' },
        { id: 'ttl', label: 'TTL' },
        { id: 'metric', label: 'metric' },
        { id: 'roll', label: 'roll' },
      ],
      [
        { id: 'gate', label: 'gate' },
        { id: 'proof', label: 'proof' },
      ],
      [
        ['stable', 'golden'],
        ['fields', 'diff'],
        ['salt', 'no leak'],
        ['version', 'miss'],
        ['hit+cost', 'span'],
        ['canary', 'kill'],
      ],
    ),
    highlight: { active: ['layout:gate', 'key:gate', 'tenant:gate', 'metric:gate'], found: ['roll:proof'] },
    explanation: 'Ship prompt caching like infrastructure: golden prompt layouts, key-field diffs, tenant isolation, versioned invalidation, cache-read/write metrics, canaries, and a kill switch.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'key pipeline') yield* keyPipeline();
  else if (view === 'breakpoints') yield* breakpoints();
  else if (view === 'safety audit') yield* safetyAudit();
  else throw new InputError('Pick a prompt-cache-key view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'A prompt cache-key canonicalization ledger is the data structure that makes prompt caching reliable. It records how a prompt was ordered, tokenized, blocked, salted, versioned, and observed before a provider prompt cache, KV prefix cache, offload store, or request router tries to reuse prior work.',
        'This is distinct from LLM Response Cache Safety Ledger. A response cache reuses a finished answer. Prompt caching reuses repeated input-prefix computation, often as cached prompt tokens or KV state, while still generating a fresh output for the new suffix.',
      ],
    },
    {
      heading: 'Core data structures',
      paragraphs: [
        'The core record includes prompt_template_id, system_digest, tool_schema_digest, corpus_digest, tokenizer_id, model_revision, adapter_id, multimodal_hashes, tenant_salt, cache_breakpoint, TTL policy, block hashes, cached_token_count, cache_read_count, cache_write_count, route_id, and invalidation versions. A small missing field can turn a true hit into a correctness bug.',
        'vLLM documents automatic prefix caching as a block-hash design: each block hash is formed from the parent hash value, exact block tokens, and extra hashes such as LoRA ids, multimodal input hashes, and cache salts for multi-tenant isolation: https://docs.vllm.ai/en/stable/design/prefix_caching/. That is the cleanest systems statement of the identity problem.',
      ],
    },
    {
      heading: 'Canonical prompt layout',
      paragraphs: [
        'Prompt caching rewards stable prefixes. Put deterministic tool schemas, system instructions, and large stable context before volatile user text. Sort tools by stable ids, freeze schema versions, hash retrieved document bundles, avoid random request ids near the front, and append new user/tool output at the tail. The layout is part of the data structure because token position decides what can be reused.',
        'HTTP Vary Cache-Key Normalization teaches the same lesson for web caches: include dimensions that change the representation, but normalize noise that should not split the cache. Prompt caching is stricter because exact token identity matters. You can bucket or canonicalize tool order, but you cannot normalize away a model revision, adapter, tenant boundary, or document version that changes the computation.',
      ],
    },
    {
      heading: 'Provider controls',
      paragraphs: [
        'OpenAI prompt caching automatically caches repeated prefixes for supported models and documents in-memory cache retention behavior for cached prefixes: https://developers.openai.com/api/docs/guides/prompt-caching. Anthropic supports automatic caching with a top-level cache_control field and explicit cache breakpoints on individual content blocks, with 5-minute and 1-hour cache durations and separate pricing for writes and reads: https://docs.anthropic.com/en/docs/build-with-claude/prompt-caching.',
        'Gemini explicit caching lets applications pass content once, create a cache, and refer to the cached tokens in later requests: https://ai.google.dev/gemini-api/docs/caching. Amazon Bedrock describes prompt caching as optional caching of portions of context to reduce latency and input-token costs: https://docs.aws.amazon.com/bedrock/latest/userguide/prompt-caching.html. Provider APIs differ, but the product ledger should expose one normalized view: what was cached, why it was legal, how long it lived, and what it saved.',
      ],
    },
    {
      heading: 'Complete case study: coding agent',
      paragraphs: [
        'A coding agent has stable system instructions, tool schemas, repository policy, package metadata, and often repeated file summaries. It also has volatile user messages, command output, test logs, and generated patches. A good layout places stable schema and policy first, hashes the repository context with a clear commit or file digest, and moves fresh user/tool output to the tail. The first turn seeds the cache; later turns read cached prefix tokens or KV blocks and generate fresh output for the new suffix.',
        'If the tool schema order changes, the tokenizer changes, a LoRA adapter changes, a tenant salt is missing, or a repository digest is stale, the correct behavior is a miss. If the request router sees a valid key, SLO-Aware LLM Request Router can route toward a replica with matching KV state. If the prefix is cold but reusable, KV Cache Tiered Offload Store can load it from a slower tier instead of recomputing.',
      ],
    },
    {
      heading: 'Pitfalls and study next',
      paragraphs: [
        'Do not call two prompts equivalent because they look semantically similar. Prompt and KV caches are exact-prefix mechanisms. Do not put timestamps, trace ids, random few-shot ordering, or retrieval jitter at the front. Do not share cache state across tenants unless the salt and authorization boundary prove it is allowed. Do not optimize only cache hit rate; observe correctness denies, cached token counts, TTFT, p99, and cost per accepted task.',
        'Primary sources: vLLM automatic prefix caching design at https://docs.vllm.ai/en/stable/design/prefix_caching/, OpenAI prompt caching at https://developers.openai.com/api/docs/guides/prompt-caching, Anthropic prompt caching at https://docs.anthropic.com/en/docs/build-with-claude/prompt-caching, Gemini context caching at https://ai.google.dev/gemini-api/docs/caching, Amazon Bedrock prompt caching at https://docs.aws.amazon.com/bedrock/latest/userguide/prompt-caching.html, and Google Cloud Gemini Enterprise context-cache overview at https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/context-cache/context-cache-overview. Study Tokenization (BPE), Prefix Caching & RadixAttention, SLO-Aware LLM Request Router, KV Cache Tiered Offload Store, LLM Response Cache Safety Ledger, LLM Model Rollout Shadow Canary Ledger, GenAI Trace Token Cost Ledger, HTTP Vary Cache-Key Normalization, No-Vary-Search Query Key, Cache Invalidation & Versioning, Distributed Tracing, and LLM Unit Economics Ledger Case Study next.',
      ],
    },
  ],
};
