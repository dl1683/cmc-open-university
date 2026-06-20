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
      heading: 'Why it exists',
      paragraphs: [
        `Prompt caching exists because LLM applications repeat large prefixes. A coding agent may send the same system rules, tool schemas, repository summaries, and file context across many turns. A support bot may send the same policy manual before each new customer question. Recomputing that stable prefix wastes latency and money.`,
        `A cache-key canonicalization ledger exists because reuse is only safe when the repeated prefix is exactly the same computation. It is not enough for two prompts to mean roughly the same thing. The model, tokenizer, tool contract, tenant boundary, media inputs, adapter, and prompt bytes all decide whether cached state can be reused.`,
        {type:'callout', text:`Prompt caching is safe only when the cache key proves exact computation identity across layout, tokens, model, tenant, tools, media, and version clocks.`},
      ],
    },
    {
      heading: 'The naive hash fails',
      paragraphs: [
        `The tempting implementation is to serialize the prompt string, trim whitespace, hash it, and call the result a cache key. That fails because the raw string is not the full identity of the computation. The same text under a different tokenizer, model revision, LoRA adapter, system policy, or multimodal attachment can produce different internal state.`,
        `The opposite failure is to include every noisy field. Request ids, timestamps, random retrieval order, unstable JSON object order, and trace metadata can move near the front of the prompt and shorten the shared prefix. A cache that is too strict misses constantly. A cache that is too loose can leak data or reuse wrong state. The ledger is the discipline between those two failures.`,
      ],
    },
    {
      heading: 'The core identity rule',
      paragraphs: [
        `The invariant is computation identity, not semantic similarity. A cache hit must prove that the prefix would create the same model state under the same contract. If two prompts differ only in irrelevant layout noise, canonicalization should make them share. If they differ in anything that changes model behavior or authorization, the key must split.`,
        `This is why vLLM-style prefix caching is described as block identity rather than fuzzy prompt matching. A block key binds the parent hash, exact token block, and extra hashes such as adapter identity, multimodal inputs, and cache salts. The product ledger should preserve the same idea even when the provider exposes a higher-level prompt-cache API.`,
      ],
    },
    {
      heading: 'Canonical layout',
      paragraphs: [
        `Canonicalization starts before hashing. Put stable content first: tool schemas in deterministic order, system instructions with a version, policy text with a digest, and retrieved document bundles with stable document ids. Put dynamic content later: the newest user message, fresh tool outputs, timestamps that the model truly needs, and request-local trace metadata.`,
        `This ordering matters because most prompt and prefix caches reuse leading tokens. A volatile value near the front can make a long shared prompt look new. A volatile value at the tail lets the stable prefix remain reusable while the model still processes the fresh suffix.`,
      ],
    },
    {
      heading: 'Ledger fields',
      paragraphs: [
        `A useful ledger row includes prompt_template_id, canonical_layout_version, system_digest, tool_schema_digest, corpus_digest, tokenizer_id, model_revision, adapter_id, multimodal_hashes, tenant_salt_id, cache_breakpoint, TTL policy, block hashes, cached token counts, cache read and write counts, route id, invalidation versions, and miss or deny reasons.`,
        `Those fields are not decorative metadata. Each one answers a correctness question. Which prompt contract was used? Which tokenizer produced the token ids? Which model and adapter consumed them? Which tenant boundary allowed reuse? Which version clocks should force a miss after a policy or corpus update? Which cache layer actually hit? Without those fields, a hit-rate chart cannot explain correctness, cost, or safety.`,
        `Different systems expose different cache controls. Some reuse repeated prefixes automatically. Some let applications mark cache breakpoints or create named cached contexts. Some operate below the API as KV block caches inside an inference server. The application should not let those differences fragment its own observability. The ledger normalizes provider prompt caching, local prefix caching, KV offload, and route hints into one product-level view.`,
        `Primary references for the shapes shown here include vLLM automatic prefix caching, OpenAI prompt caching, Anthropic prompt caching, Gemini context caching, and Amazon Bedrock prompt caching. Their controls differ, but the design question is the same: what exact prefix was reused, why was reuse legal, and what did it save?`,
      ],
    },
    {
      heading: 'Breakpoints and TTLs',
      paragraphs: [
        `A breakpoint marks the end of a stable prefix. In a conversation, it often belongs after tool schemas, system policy, long context, and older history, but before the newest user turn. That placement lets the cache reuse expensive prefix work while still forcing the model to process the new request and generate a fresh answer.`,
        `TTL is an economic and safety choice. Longer-lived cached prefixes improve hit chance for slow conversations and repeated workflows, but they make invalidation discipline more important. A safe ledger binds version clocks into the key so old policy, old tools, or old corpus state naturally miss instead of relying on a race-prone purge.`,
      ],
    },
    {
      heading: 'What the visual proves',
      paragraphs: [
        `The key-pipeline view proves that hashing is downstream of layout. A request becomes a canonical prompt layout, then tokens, then block hashes plus extra identity fields, then a cache key, then route and audit records. If any upstream contract is unstable or missing, the final digest is either noisy or unsafe.`,
        `The breakpoint and safety views prove the two-sided nature of the problem. Stable-first layout raises the hit-rate ceiling. Safety fields lower the risk ceiling. The goal is not the highest possible hit rate. The goal is lawful reuse of exact computation with enough evidence to explain each hit, miss, write, deny, and route decision.`,
      ],
    },
    {
      heading: 'Observability',
      paragraphs: [
        `A cache ledger should emit spans and metrics for cache reads, writes, hit source, cached token count, uncached token count, TTFT, latency percentiles, estimated savings, denial reason, miss reason, and route id. A sudden hit-rate drop should be traceable to a specific field: tool schema reordering, corpus digest churn, tokenizer change, layout version change, TTL expiry, or tenant salt rotation.`,
        `Observability also prevents unsafe optimization. A team that only watches hit rate may normalize away fields that should be part of the key. That can look efficient while reusing state across models, tenants, tools, or media. Correct dashboards include correctness gates and denial counts, not just savings.`,
      ],
    },
    {
      heading: 'Costs and tradeoffs',
      paragraphs: [
        `Prompt caching adds its own costs. Canonicalization code must be deterministic across languages and services. Golden prompt fixtures must be maintained. Hashing large multimodal inputs and document bundles takes work. Cache writes can have different economics from cache reads. Long TTLs increase the value of versioning and audit logs. Routing toward warm replicas can improve latency but may fight load balancing.`,
        `The tradeoff is usually worth it when stable prefixes are large and reused often. It is less useful for short prompts, one-off requests, highly personalized volatile context, or workflows where the first token changes near the front every time. The ledger makes that visible by tying hit rates to token counts and cost per accepted task.`,
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        `It wins in coding agents, document review, customer support, compliance assistants, retrieval-heavy chat, long policy prompts, and tool-rich agent loops. In those systems, the stable prefix may contain thousands of tokens before the user asks the next small question. Reusing that prefix can reduce time to first token, provider cost, and local prefill pressure.`,
        `It also wins in multi-layer serving systems. The same canonical identity can guide provider prompt caching, local KV prefix caching, offload store lookup, and SLO-aware routing. A router that knows which replica likely holds the right prefix can avoid cold-prefill work without guessing from raw request text.`,
      ],
    },
    {
      heading: 'Failure modes',
      paragraphs: [
        `The dangerous failures are not mysterious. Missing tenant salts can leak state. Missing model or adapter ids can reuse wrong KV. Missing multimodal hashes can attach the wrong image or file. Missing version clocks can reuse stale policy. Unstable ordering can cause miss storms. Over-normalization can merge prompts that should stay separate.`,
        `The correct behavior for uncertain identity is a miss. Do not repair correctness failures by widening keys after the fact and hoping no bad hit happened. Ship cache changes behind canaries, keep a kill switch, diff key fields in review, and store enough audit data to answer why a request hit or missed.`,
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        `Study Tokenization (BPE), Hash Table, Cache Invalidation & Versioning, HTTP Vary Cache-Key Normalization, No-Vary-Search Query Key, Prefix Caching & RadixAttention, KV Cache, KV Cache Tiered Offload Store, SLO-Aware LLM Request Router, GenAI Trace Token Cost Ledger, LLM Response Cache Safety Ledger, and LLM Unit Economics Ledger Case Study. Primary source links: https://docs.vllm.ai/en/stable/design/prefix_caching/, https://developers.openai.com/api/docs/guides/prompt-caching, https://docs.anthropic.com/en/docs/build-with-claude/prompt-caching, https://ai.google.dev/gemini-api/docs/caching, and https://docs.aws.amazon.com/bedrock/latest/userguide/prompt-caching.html.`,
      ],
    },
  ],
};
