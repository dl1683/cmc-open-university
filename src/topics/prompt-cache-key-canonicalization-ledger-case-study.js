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
      heading: 'How to read the animation',
      paragraphs: [
        'Read the key pipeline from left to right. A prompt is the text, tool schema, media, and context sent to a model; a cache key is the identity used to decide whether prior computation can be reused. Active nodes show fields entering the key, and found nodes show evidence that a hit or miss can be explained later.',
        'The breakpoint view shows where the stable prefix ends. A prefix is the leading token sequence that repeats across requests. A safe hit means the reused prefix was computed under the same model, tokenizer, tenant boundary, tools, media, and version clocks.',
        {type:'callout', text:'Prompt caching is safe only when the cache key proves exact computation identity across layout, tokens, model, tenant, tools, media, and version clocks.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Large language model applications often resend the same long prefix. A coding agent may repeat system rules, tool schemas, repository summaries, and prior files across many turns. Recomputing that prefix wastes prefill time, raises cost, and delays the first generated token.',
        'Prompt caching exists to reuse that repeated computation. A canonicalization ledger exists because reuse is only correct when the computation identity is exact. Similar meaning is not enough; the model state must be the same computation under the same contract.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious implementation hashes the prompt string. If two requests have the same bytes, return the same cache key. That works for a toy text-only demo where model, tokenizer, tools, tenant, and policy never change.',
        'A slightly smarter version trims whitespace or sorts JSON before hashing. That can raise hit rate, but it still treats visible text as the whole computation. It misses hidden inputs such as tokenizer version, adapter identity, multimodal hashes, and authorization boundary.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'A loose key can reuse wrong state. If two tenants send the same policy prompt but have different private documents, a missing tenant salt can leak context. If the tokenizer or model revision changes, the same text can map to different internal tokens or behavior.',
        'A strict key can miss constantly. Request IDs, timestamps, unstable retrieval order, and random JSON property order can make a stable prompt look new. The wall is that the cache key must split on behavior-changing fields while ignoring noise that should not change the computation.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'The invariant is exact computation identity. The key should include every field that changes model state or permission to reuse, and it should exclude fields that only add trace noise. Canonicalization is the process that turns the request into a stable, ordered representation before hashing.',
        'The ledger is the audit record for that decision. It stores the canonical layout version, model revision, tokenizer ID, tool schema digest, corpus digest, media hashes, tenant salt, breakpoints, TTL policy, block hashes, and miss or deny reasons. The goal is not just a hit; it is an explainable hit.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The application first builds a stable prompt layout. System policy, tool schemas, and retrieved documents are ordered deterministically and versioned. Dynamic user input and request-local metadata are placed after the reusable prefix when they do not belong in the shared computation.',
        'The canonical prompt is tokenized. Token blocks are hashed with parent-block identity and extra identity fields such as model, tokenizer, adapter, media, tenant salt, and version clocks. The router then asks the cache for the deepest matching prefix and writes a ledger row explaining the result.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Correctness follows from collision-resistant identity plus conservative misses. If any behavior-changing field differs, the key differs and the system recomputes. If a field is unknown or not audited, the safe behavior is a miss because missing identity evidence cannot justify reuse.',
        'Stable-first layout improves hits without weakening correctness. Moving volatile request metadata after the breakpoint preserves the reusable prefix. Binding policy, tools, corpus, media, and tenant into the key prevents reuse across contexts that only look similar in visible text.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Canonicalization adds engineering cost. Every service that creates prompts must agree on ordering, escaping, digesting, and version clocks. Golden fixtures are needed so two languages do not produce different keys for the same logical request.',
        'The payoff depends on prefix length and reuse. If a 12000-token stable prefix is reused 100 times and each request adds 500 fresh tokens, caching can remove most repeated prefill work. If every request changes near the first token, key machinery adds overhead without much reuse.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'This pattern fits coding agents, retrieval-heavy chat, legal review, support bots, compliance assistants, and tool-rich agent loops. These systems often spend more tokens restating policy, tools, and context than asking the next question.',
        'It also fits multi-layer serving. The same canonical identity can guide provider prompt caching, local KV-prefix caching, offload lookup, and routing toward warm replicas. A ledger lets product teams explain savings, denials, and correctness boundaries in one place.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'It fails when teams optimize hit rate alone. Removing tenant salt, model revision, tool schema digest, or media hashes can make dashboards look better while reusing unsafe state. A cache system that cannot explain why a hit was legal is not production safe.',
        'It also fails for short prompts, one-off tasks, highly volatile prefixes, and workflows where retrieval order changes every turn. In those cases, the right fix may be better prompt layout, stable retrieval packaging, or no cache at all.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'A document-review agent sends 8000 stable tokens of system policy, 3000 tokens of tool schemas, 2000 tokens of retrieved contract context, and 400 fresh user tokens. Without caching, every turn prefills 13400 tokens. With a breakpoint after the 13000 stable tokens, only the fresh 400 tokens need full new prefill after a hit.',
        'Now suppose the tool schema digest changes from A17 to B02 because one tool gained a new argument. The visible prompt may look almost the same, but the key must split because the model received a different tool contract. The ledger row should say miss_reason="tool_schema_digest_changed", not merely report a lower hit rate.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: vLLM automatic prefix caching documentation, OpenAI prompt caching documentation, Anthropic prompt caching documentation, Gemini context caching documentation, and Amazon Bedrock prompt caching documentation. Treat provider-specific cache controls as current product surfaces and verify them before building production assumptions.',
        'Study tokenization, hash tables, cache invalidation, HTTP Vary cache keys, KV cache, prefix caching with RadixAttention, SLO-aware LLM routing, and token-cost ledgers next. The core transferable idea is identity before reuse.',
      ],
    },
  ],
};
