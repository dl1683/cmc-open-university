// LLM response-cache safety ledger: exact keys, semantic candidates, provider
// prompt caches, invalidation clocks, and audit records as one control plane.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'llm-response-cache-safety-ledger-case-study',
  title: 'LLM Response Cache Safety Ledger',
  category: 'Systems',
  summary: 'A production LLM caching case study: canonical keys, semantic candidates, policy gates, invalidation clocks, and audit ledgers.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['key ledger', 'policy gates', 'support case'], defaultValue: 'key ledger' },
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

function cacheGraph(title, notes = {}) {
  return graphState({
    nodes: [
      { id: 'req', label: 'req', x: 0.7, y: 3.8, note: notes.req ?? 'app' },
      { id: 'canon', label: 'canon', x: 2.2, y: 3.8, note: notes.canon ?? 'norm' },
      { id: 'exact', label: 'exact', x: 3.8, y: 2.4, note: notes.exact ?? 'hash' },
      { id: 'ann', label: 'ANN', x: 3.8, y: 5.2, note: notes.ann ?? 'vector' },
      { id: 'gate', label: 'gate', x: 5.5, y: 3.8, note: notes.gate ?? 'policy' },
      { id: 'hit', label: 'hit', x: 7.1, y: 2.4, note: notes.hit ?? 'reuse' },
      { id: 'llm', label: 'LLM', x: 7.1, y: 5.2, note: notes.llm ?? 'miss' },
      { id: 'audit', label: 'audit', x: 8.7, y: 2.4, note: notes.audit ?? 'why' },
      { id: 'store', label: 'store', x: 8.7, y: 5.2, note: notes.store ?? 'add' },
      { id: 'clock', label: 'clock', x: 5.5, y: 6.6, note: notes.clock ?? 'vers' },
    ],
    edges: [
      { id: 'e-req-canon', from: 'req', to: 'canon' },
      { id: 'e-canon-exact', from: 'canon', to: 'exact' },
      { id: 'e-canon-ann', from: 'canon', to: 'ann' },
      { id: 'e-exact-gate', from: 'exact', to: 'gate' },
      { id: 'e-ann-gate', from: 'ann', to: 'gate' },
      { id: 'e-gate-hit', from: 'gate', to: 'hit', weight: 'pass' },
      { id: 'e-gate-llm', from: 'gate', to: 'llm', weight: 'miss' },
      { id: 'e-hit-audit', from: 'hit', to: 'audit' },
      { id: 'e-llm-store', from: 'llm', to: 'store' },
      { id: 'e-store-audit', from: 'store', to: 'audit' },
      { id: 'e-clock-gate', from: 'clock', to: 'gate' },
      { id: 'e-clock-store', from: 'clock', to: 'store' },
    ],
  }, { title });
}

function layerGraph(title) {
  return graphState({
    nodes: [
      { id: 'app', label: 'app', x: 0.8, y: 3.8, note: 'user' },
      { id: 'resp', label: 'resp', x: 2.4, y: 3.8, note: 'answer' },
      { id: 'sem', label: 'sem', x: 4.0, y: 2.4, note: 'intent' },
      { id: 'prompt', label: 'prompt', x: 4.0, y: 5.2, note: 'prefix' },
      { id: 'kv', label: 'KV', x: 5.8, y: 5.2, note: 'pages' },
      { id: 'model', label: 'model', x: 7.4, y: 3.8, note: 'tokens' },
      { id: 'audit', label: 'audit', x: 9.0, y: 3.8, note: 'route' },
    ],
    edges: [
      { id: 'e-app-resp', from: 'app', to: 'resp' },
      { id: 'e-resp-sem', from: 'resp', to: 'sem' },
      { id: 'e-resp-prompt', from: 'resp', to: 'prompt' },
      { id: 'e-prompt-kv', from: 'prompt', to: 'kv' },
      { id: 'e-sem-model', from: 'sem', to: 'model' },
      { id: 'e-kv-model', from: 'kv', to: 'model' },
      { id: 'e-model-audit', from: 'model', to: 'audit' },
      { id: 'e-resp-audit', from: 'resp', to: 'audit' },
    ],
  }, { title });
}

function* keyLedger() {
  yield {
    state: cacheGraph('A response cache starts before the model call'),
    highlight: { active: ['req', 'canon', 'exact', 'ann', 'e-req-canon', 'e-canon-exact', 'e-canon-ann'], compare: ['llm'], found: ['gate'] },
    explanation: 'The application first canonicalizes the request, then checks an exact key and a semantic candidate index before spending a model call.',
    invariant: 'A cache hit is a proposed route, not permission to answer.',
  };

  yield {
    state: labelMatrix(
      'Canonical key fields',
      [
        { id: 'tenant', label: 'tenant' },
        { id: 'model', label: 'model' },
        { id: 'sys', label: 'sys' },
        { id: 'prompt', label: 'prompt' },
        { id: 'tools', label: 'tools' },
        { id: 'corpus', label: 'corpus' },
        { id: 'params', label: 'params' },
      ],
      [
        { id: 'key', label: 'key' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['scope', 'leak'],
        ['id+rev', 'drift'],
        ['digest', 'contract'],
        ['norm', 'sprawl'],
        ['mask', 'perm'],
        ['ver', 'stale'],
        ['sample', 'random'],
      ],
    ),
    highlight: { active: ['tenant:key', 'model:key', 'sys:key', 'corpus:key'], removed: ['tenant:risk', 'tools:risk'] },
    explanation: 'The key is more than prompt text. It should bind tenant, model revision, system prompt digest, tool mask, retrieval corpus version, and sampling settings.',
  };

  yield {
    state: cacheGraph('Exact hits are cheap but narrow'),
    highlight: { active: ['canon', 'exact', 'gate', 'hit', 'audit', 'e-canon-exact', 'e-exact-gate', 'e-gate-hit', 'e-hit-audit'], compare: ['ann', 'llm'] },
    explanation: 'An exact key can safely reuse a deterministic answer when every contract field matches. It misses paraphrases, but the correctness story is straightforward.',
  };

  yield {
    state: labelMatrix(
      'Hit decision table',
      [
        { id: 'exact', label: 'exact' },
        { id: 'sem', label: 'sem' },
        { id: 'prompt', label: 'prompt' },
        { id: 'prefix', label: 'prefix' },
        { id: 'miss', label: 'miss' },
      ],
      [
        { id: 'stores', label: 'stores' },
        { id: 'rule', label: 'rule' },
      ],
      [
        ['answer', 'same key'],
        ['answer', 'gates pass'],
        ['KV', 'same prefix'],
        ['KV pages', 'runtime'],
        ['none', 'call LLM'],
      ],
    ),
    highlight: { active: ['exact:rule', 'sem:rule'], compare: ['prompt:stores', 'prefix:stores'], found: ['miss:rule'] },
    explanation: 'Application response caching stores answers. Provider prompt caching and runtime prefix caching store reusable model state. The layers stack, but they are not the same cache.',
  };

  yield {
    state: cacheGraph('Misses create records only after admission'),
    highlight: { active: ['gate', 'llm', 'store', 'audit', 'e-gate-llm', 'e-llm-store', 'e-store-audit'], compare: ['hit'], found: ['clock'] },
    explanation: 'A miss calls the model, but the response is admitted only if the route is cacheable. Personalized, secret-bearing, or high-risk outputs should write an audit row without writing a reusable answer.',
  };

  yield {
    state: labelMatrix(
      'Response record schema',
      [
        { id: 'key', label: 'key' },
        { id: 'embed', label: 'embed' },
        { id: 'answer', label: 'answer' },
        { id: 'meta', label: 'meta' },
        { id: 'audit', label: 'audit' },
        { id: 'evict', label: 'evict' },
      ],
      [
        { id: 'data', label: 'data' },
        { id: 'use', label: 'use' },
      ],
      [
        ['hash', 'exact'],
        ['vector', 'ANN'],
        ['text', 'reuse'],
        ['scope+ver', 'gate'],
        ['route', 'debug'],
        ['TTL+freq', 'bound'],
      ],
    ),
    highlight: { active: ['key:data', 'embed:data', 'meta:data', 'audit:data'], found: ['answer:use'] },
    explanation: 'The production object is a small ledger: exact hash, embedding, answer pointer, metadata boundaries, route reason, hit counters, TTL, and eviction/admission signals.',
  };
}

function* policyGates() {
  yield {
    state: labelMatrix(
      'Policy gate checklist',
      [
        { id: 'tenant', label: 'tenant' },
        { id: 'auth', label: 'auth' },
        { id: 'corpus', label: 'corpus' },
        { id: 'sys', label: 'sys' },
        { id: 'tools', label: 'tools' },
        { id: 'ttl', label: 'TTL' },
        { id: 'risk', label: 'risk' },
      ],
      [
        { id: 'pass', label: 'pass' },
        { id: 'bad', label: 'bad hit' },
      ],
      [
        ['same', 'leak'],
        ['covers', 'forbid'],
        ['fresh', 'stale'],
        ['same', 'format'],
        ['same', 'action'],
        ['alive', 'old'],
        ['low', 'harm'],
      ],
    ),
    highlight: { active: ['tenant:bad', 'auth:bad', 'corpus:bad', 'tools:bad'], found: ['ttl:pass', 'risk:pass'] },
    explanation: 'Most bad LLM cache hits are boundary failures: wrong tenant, stale RAG corpus, changed system prompt, changed tool permission, or a task that should never be cached.',
    invariant: 'Similarity cannot override authorization or freshness.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'similarity', min: 0.70, max: 0.99 }, y: { label: 'rate', min: 0, max: 1 } },
      series: [
        { id: 'hits', label: 'hits', points: [{ x: 0.70, y: 0.82 }, { x: 0.78, y: 0.68 }, { x: 0.86, y: 0.49 }, { x: 0.92, y: 0.31 }, { x: 0.99, y: 0.04 }] },
        { id: 'bad', label: 'bad hits', points: [{ x: 0.70, y: 0.18 }, { x: 0.78, y: 0.10 }, { x: 0.86, y: 0.045 }, { x: 0.92, y: 0.018 }, { x: 0.99, y: 0.002 }] },
      ],
      markers: [
        { id: 'wide', x: 0.78, y: 0.68, label: 'wide' },
        { id: 'strict', x: 0.92, y: 0.31, label: 'strict' },
      ],
    }),
    highlight: { active: ['hits'], compare: ['bad'], found: ['strict'], removed: ['wide'] },
    explanation: 'A lower similarity threshold saves more calls but allows more false hits. The threshold belongs to a measured policy, not a hard-coded guess.',
  };

  yield {
    state: cacheGraph('Invalidation clocks sit beside the cache'),
    highlight: { active: ['clock', 'gate', 'store', 'e-clock-gate', 'e-clock-store'], compare: ['hit'], removed: ['llm'] },
    explanation: 'The cache should read version clocks for policy, corpus, tool schema, system prompt, and model revision. A version bump can deny old hits without scanning every cache row first.',
  };

  yield {
    state: labelMatrix(
      'Invalidation triggers',
      [
        { id: 'policy', label: 'policy' },
        { id: 'corpus', label: 'corpus' },
        { id: 'tools', label: 'tools' },
        { id: 'sys', label: 'sys' },
        { id: 'model', label: 'model' },
        { id: 'pii', label: 'PII' },
      ],
      [
        { id: 'event', label: 'event' },
        { id: 'action', label: 'action' },
      ],
      [
        ['rule rev', 'deny old'],
        ['index rev', 'miss old'],
        ['schema rev', 'deny old'],
        ['digest', 'new key'],
        ['rev', 'A/B gate'],
        ['request', 'no save'],
      ],
    ),
    highlight: { active: ['policy:action', 'corpus:action', 'tools:action', 'pii:action'], found: ['sys:event'] },
    explanation: 'Versioned invalidation is cleaner than deleting by string search. Old records become ineligible when their boundary metadata no longer matches the route policy.',
  };

  yield {
    state: layerGraph('Provider prompt caching is a lower layer'),
    highlight: { active: ['app', 'resp', 'prompt', 'kv', 'model', 'e-app-resp', 'e-resp-prompt', 'e-prompt-kv', 'e-kv-model'], compare: ['sem'], found: ['audit'] },
    explanation: 'Prompt caching keeps repeated prefixes warm inside the provider or serving runtime. It reduces prefill cost, but it does not prove that a previous full answer is safe to replay.',
  };

  yield {
    state: labelMatrix(
      'Cache layer stack',
      [
        { id: 'exact', label: 'exact' },
        { id: 'sem', label: 'sem' },
        { id: 'prompt', label: 'prompt' },
        { id: 'prefix', label: 'prefix' },
        { id: 'retr', label: 'retrieval' },
      ],
      [
        { id: 'key', label: 'key' },
        { id: 'stores', label: 'stores' },
        { id: 'owner', label: 'owner' },
      ],
      [
        ['hash', 'answer', 'app'],
        ['vector', 'answer', 'app'],
        ['prefix', 'KV', 'vendor'],
        ['trie', 'KV pages', 'server'],
        ['query+ver', 'docs', 'RAG'],
      ],
    ),
    highlight: { active: ['exact:owner', 'sem:owner', 'prompt:owner', 'prefix:owner'], compare: ['retr:stores'] },
    explanation: 'A healthy system separates cache owners. The app owns response reuse. The provider owns prompt-cache behavior. The serving runtime owns KV pages. The RAG layer owns retrieval freshness.',
  };
}

function* supportCase() {
  yield {
    state: cacheGraph('Support traffic has repeated intents and sharp edges'),
    highlight: { active: ['req', 'canon', 'exact', 'ann', 'gate', 'e-req-canon', 'e-canon-exact', 'e-canon-ann', 'e-ann-gate'], found: ['hit'], compare: ['llm'] },
    explanation: 'A support product gets many repeated intents: password reset, refund status, setup steps, billing wording. The cache can help, but account-specific answers still need hard gates.',
  };

  yield {
    state: labelMatrix(
      'Support route map',
      [
        { id: 'faq', label: 'FAQ' },
        { id: 'acct', label: 'acct' },
        { id: 'rag', label: 'RAG' },
        { id: 'legal', label: 'legal' },
        { id: 'secret', label: 'secret' },
      ],
      [
        { id: 'route', label: 'route' },
        { id: 'why', label: 'why' },
      ],
      [
        ['cache', 'stable'],
        ['LLM', 'private'],
        ['cache+ver', 'docs'],
        ['strong', 'risk'],
        ['no save', 'PII'],
      ],
    ),
    highlight: { active: ['faq:route', 'rag:route'], removed: ['acct:route', 'secret:route'], compare: ['legal:route'] },
    explanation: 'The same product should cache stable FAQ responses, version RAG-backed answers by corpus revision, and avoid reusable records for private or secret-bearing outputs.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'repeat share', min: 0, max: 1 }, y: { label: 'calls saved', min: 0, max: 0.9 } },
      series: [
        { id: 'exact', label: 'exact', points: [{ x: 0.10, y: 0.03 }, { x: 0.30, y: 0.10 }, { x: 0.50, y: 0.18 }, { x: 0.70, y: 0.26 }, { x: 0.90, y: 0.35 }] },
        { id: 'gated', label: 'gated sem', points: [{ x: 0.10, y: 0.06 }, { x: 0.30, y: 0.20 }, { x: 0.50, y: 0.35 }, { x: 0.70, y: 0.50 }, { x: 0.90, y: 0.64 }] },
      ],
      markers: [
        { id: 'faq', x: 0.70, y: 0.50, label: 'FAQ mix' },
        { id: 'rare', x: 0.20, y: 0.08, label: 'rare' },
      ],
    }),
    highlight: { active: ['gated', 'faq'], compare: ['exact'], removed: ['rare'] },
    explanation: 'Semantic caching pays when the workload has repeated intents with wording variation. If most prompts are unique or stateful, exact and semantic hit rates both collapse.',
  };

  yield {
    state: cacheGraph('A stale RAG answer should miss, not apologize later'),
    highlight: { active: ['clock', 'gate', 'llm', 'store', 'e-clock-gate', 'e-gate-llm', 'e-llm-store'], removed: ['hit'], compare: ['ann'] },
    explanation: 'When the documentation corpus changes, cached RAG answers from the old evidence version become ineligible. The safe behavior is a miss followed by a fresh answer and a new record.',
  };

  yield {
    state: labelMatrix(
      'Audit rows',
      [
        { id: 'hit', label: 'hit' },
        { id: 'miss', label: 'miss' },
        { id: 'deny', label: 'deny' },
        { id: 'stale', label: 'stale' },
        { id: 'store', label: 'store' },
        { id: 'drop', label: 'drop' },
      ],
      [
        { id: 'field', label: 'field' },
        { id: 'why', label: 'why' },
      ],
      [
        ['cache id', 'debug'],
        ['route', 'cost'],
        ['gate', 'safety'],
        ['version', 'fresh'],
        ['TTL', 'reuse'],
        ['reason', 'no leak'],
      ],
    ),
    highlight: { active: ['deny:field', 'stale:field', 'drop:field'], found: ['hit:why', 'miss:why'] },
    explanation: 'The audit log is what makes caching operable. It records why a hit was allowed, why a candidate was denied, why a record was stored, and why a response was deliberately not cached.',
  };

  yield {
    state: labelMatrix(
      'Production guardrails',
      [
        { id: 'eval', label: 'eval' },
        { id: 'canary', label: 'canary' },
        { id: 'slice', label: 'slice' },
        { id: 'cost', label: 'cost' },
        { id: 'p99', label: 'p99' },
        { id: 'abuse', label: 'abuse' },
      ],
      [
        { id: 'check', label: 'check' },
        { id: 'fail', label: 'fail' },
      ],
      [
        ['replay', 'bad hit'],
        ['small %', 'rollback'],
        ['tenant', 'leak'],
        ['saved', 'no win'],
        ['tail', 'slow ANN'],
        ['quota', 'poison'],
      ],
    ),
    highlight: { active: ['eval:check', 'slice:check', 'cost:check', 'p99:check'], removed: ['abuse:fail'] },
    explanation: 'Ship the cache like a model route: offline replay, canary rollout, protected slices, cost accounting, p99 tracking, and abuse controls for cache poisoning.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'key ledger') yield* keyLedger();
  else if (view === 'policy gates') yield* policyGates();
  else if (view === 'support case') yield* supportCase();
  else throw new InputError('Pick a response-cache view.');
}

export const article = {
  sections: [
    {
      heading: 'Why this exists',
      paragraphs: [
        'A response cache can save the most expensive thing in an LLM product: a full model call that produces an answer the system has already produced before. The same cache can also replay a private, stale, policy-invalid, or tool-authorized answer in the wrong context. The safety ledger exists because a cached LLM response is product behavior, not just bytes behind a key.',
        'The ledger is the application-layer control plane for exact keys, semantic candidates, policy gates, version clocks, admission rules, eviction rules, and audit rows. It decides whether a previous full answer may be reused, whether a candidate must be denied, and whether a new response may be stored. That decision has to preserve tenant boundaries, model contracts, retrieval freshness, tool permissions, and risk policy.',
      ],
    },
    {
      heading: 'The naive approach and wall',
      paragraphs: [
        'The reasonable first attempt is to key by normalized prompt text and return the old answer on a hit. That works for a narrow FAQ bot where every user sees the same public answer and the system prompt rarely changes. It breaks once the prompt depends on tenant, role, model revision, system digest, tool mask, retrieval corpus, policy version, sampling settings, or output schema.',
        'The semantic version of the mistake is more dangerous. A nearby vector match feels intelligent because it catches paraphrases, but vector distance cannot see authorization, freshness, tenant scope, or tool permissions. The wall is that similarity is not permission. A semantic candidate is only a proposed route to the policy gate.',
      ],
    },
    {
      heading: 'Core insight',
      paragraphs: [
        'The core insight is to split lookup from reuse. Exact and semantic indexes find possible answers. The policy gate decides whether a candidate is eligible under the current request contract. A hit is not a fact; it is a proposal that must pass boundary checks before the product can answer from cache.',
        'The invariant is that similarity cannot override authorization or freshness. Version clocks make this practical. If the RAG corpus, tool schema, policy rules, model revision, or system prompt changes, the gate can declare old records ineligible without racing to delete every row. Old data can remain stored while becoming impossible to serve.',
      ],
    },
    {
      heading: 'How the visual model teaches it',
      paragraphs: [
        'The key-ledger view shows the request moving through canonicalization, exact lookup, semantic lookup, and gate before a hit is allowed. The cache is not just a hash table. It is a route planner with a denial path, a model-call path, and an audit path.',
        'The policy-gates view is the correctness surface. Tenant, authorization, corpus version, system prompt, tools, TTL, and risk all sit between a candidate and reuse. The support-case view shows where this pays: stable FAQ and versioned RAG answers can cache, while private account answers and secret-bearing responses should miss or no-store. The animation proves that the cache is useful only when the gate is part of the data structure.',
      ],
    },
    {
      heading: 'How the system works',
      paragraphs: [
        'The exact side starts with canonicalization. It normalizes harmless noise while binding fields that can change the answer: tenant scope, user role, model revision, system prompt digest, tool mask, output schema, retrieval corpus version, policy version, locale, and sampling mode. The exact key is narrow, but its correctness story is simple because every contract field matches.',
        'The semantic side embeds the user request or an intent representation and searches an approximate nearest-neighbor index for similar past requests. That finds paraphrases, but it also creates false-hit risk. The gate checks that the candidate answer was produced under compatible boundaries, is still fresh, has acceptable quality labels, is allowed for this risk class, and has not expired.',
        'Misses call the model. The response is admitted only if the route is cacheable. Personalized, secret-bearing, high-risk, one-off, or policy-sensitive outputs can still write audit rows without writing reusable answer records. A useful cache record stores exact_hash, embedding_id, answer_pointer, model_revision, system_digest, tool_mask, corpus_version, policy_version, tenant_scope, created_at, expires_at, hit_count, quality_label, route_reason, and audit_id.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The correctness argument is the same as a web cache with stricter dimensions. If every field that can change the representation is either in the key or checked by the gate, then a reused answer is eligible for the current request contract. If any boundary differs, the candidate must miss or be denied.',
        'Version clocks are what make this manageable. A corpus update, policy update, tool-schema update, model rollout, or system-prompt change increments a small clock. The gate compares the record metadata to current clocks and denies old records. The system does not need immediate global deletion to be safe because eligibility is checked at read time.',
      ],
    },
    {
      heading: 'Where it fits',
      paragraphs: [
        'A response cache is distinct from provider prompt caching. Prompt caching reuses repeated prompt prefixes or internal key/value state to reduce prefill work. Prompt Cache-Key Canonicalization Ledger covers that exact-prefix identity layer. A response cache reuses the finished application answer. OpenAI and Anthropic prompt-caching docs are useful lower-layer references, but they do not by themselves prove that a full answer is safe to replay.',
        'Runtime prefix caching and RadixAttention-style KV reuse are lower still. They save model-state computation while the current request continues to generate. Retrieval caches are another layer that reuse document results under index versions. The response-cache ledger sits above all of these because it decides whether the user should receive an already-written answer.',
      ],
    },
    {
      heading: 'Costs and tradeoffs',
      paragraphs: [
        'The first cost is key design. If the key binds too little, unsafe reuse becomes possible. If it binds too much, hit rate collapses and the cache becomes a write-only expense. Semantic caching improves hit rate on paraphrases but adds ANN lookup cost, threshold tuning, false-hit review, and cache-poisoning risk.',
        'The second cost is operations. The cache needs admission policy, TTLs, hit counters, eviction, offline replay tests, canary rollout, abuse controls, p99 latency tracking, and cost accounting. A cache that saves tokens but adds tail latency or worsens accepted-answer quality is not a win. The animation plot makes this visible: lower similarity thresholds save more calls and create more bad-hit risk; stricter thresholds reduce risk but capture fewer repeats.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'The main failure is cross-boundary reuse: an answer generated under one tenant, permission set, system prompt, tool schema, or RAG corpus is replayed under another. Vector distance cannot detect that. Other failures are cache poisoning, stale authority, slow ANN lookup, p99 regression, and false economics where token calls fall but accepted-answer cost or quality worsens.',
        'The audit row is what makes the cache operable. It stores the candidates considered, gates that allowed or denied them, latency saved or spent, estimated token savings, and why the final route hit, missed, denied, stored, or refused to cache. Without this row, a bad hit becomes hard to explain and a good miss looks like wasted money.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'This pattern wins in products with repeated intents and stable public answers: support FAQs, setup instructions, billing explanations, policy summaries with versioned sources, and high-volume assistant flows where many users ask the same thing in different words. It also helps when cost accounting needs to separate saved model calls from lower-layer prompt-cache savings.',
        'It is weaker for stateful, private, highly personalized, adversarial, or rapidly changing requests. Account status, secrets, medical advice, legal advice, one-off analysis, and tool actions often need no-store defaults or very narrow exact keys. The ledger should make those defaults explicit.',
      ],
    },
    {
      heading: 'Sources',
      paragraphs: [
        'Primary and official sources: OpenAI prompt caching at https://developers.openai.com/api/docs/guides/prompt-caching, Anthropic prompt caching at https://platform.claude.com/docs/en/build-with-claude/prompt-caching, RedisVL Semantic Caching for LLMs at https://docs.redisvl.com/en/0.4.1/user_guide/03_llmcache.html, LiteLLM cache docs and custom cache keys at https://docs.litellm.ai/docs/caching/all_caches, GPTCache at https://github.com/zilliztech/gptcache, and GPT Semantic Cache at https://arxiv.org/abs/2411.05276.',
        'Local corpus anchors: Inference Scaling.txt for response-cache placement in the inference playbook and Cost_of_Transformers_full.txt for why avoiding repeated prefill and decode work matters. HTTP Vary Cache-Key Normalization and No-Vary-Search Query Key teach the same key-design lesson for web caches: include dimensions that change the representation, and normalize noise only when it cannot change the answer.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Study Semantic Cache for LLMs, Prompt Cache-Key Canonicalization Ledger, and Prefix Caching and RadixAttention to separate answer reuse from prompt-state reuse. Then read LLM Inference Cost Stack Case Study, LLM Unit Economics Ledger Case Study, LLM Model Rollout Shadow Canary Ledger, HTTP Vary Cache-Key Normalization, No-Vary-Search Query Key, Cache Invalidation and Versioning, LRU Cache, W-TinyLFU Cache Admission, RAG Pipeline, RAG Context Packing Token Budget, RAG Index Lifecycle Alias Swap, Prompt Injection Threat Model, LLM Guardrail Policy Engine, Distributed Tracing, and Tail Latency.',
      ],
    },
  ],
};
