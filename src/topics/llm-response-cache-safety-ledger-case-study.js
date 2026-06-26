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
      heading: 'How to read the animation',
      paragraphs: [
        'Read the animation as the state machine for LLM response cache safety ledger. Active items are the current decision point, found items are committed results, and removed items are paths ruled out by the invariant. The first safe inference is to name what state changed and why that move is legal.',
        {type: 'callout', text: 'A cache hit is only a candidate until policy, freshness, and tenant boundaries approve reuse.'},
        'This topic is a case study, so the visual is not decoration. It shows which records, counters, queues, maps, or gates must agree before the system can return a trustworthy result.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'LLM response cache safety ledger exists because a simple implementation works on a small example but fails when scale, latency, privacy, or correctness constraints arrive. The system needs a data structure that keeps the useful fast path without hiding the boundary conditions.',
        'The practical problem is not only speed. Cost, auditability, rollback, freshness, and slice-level behavior all affect whether the design is usable in production.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is to keep one global rule, one score, one cache, one dashboard, or one list. That is easy to build and easy to explain. It often works until traffic shape or correctness requirements become more specific.',
        'The next obvious approach is to add capacity or widen the search. That may improve the average case, but it usually fails to encode the rule that decides which work is allowed, fresh, fair, or safe.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is the missing boundary. A system can look correct globally while a narrow slice is wrong, stale, unfair, or too expensive. Once the boundary is missing, more throughput can make the failure faster.',
        'The concrete failure is usually visible as mixed state: one version reads another version cache, one user receives another user answer, one queue loses priority, or one metric hides a failing slice. The design needs an invariant that prevents that mixture.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'The core insight is to make the boundary a first-class data structure in LLM response cache safety ledger. Keys, clocks, queues, ledgers, folds, or gates are not metadata; they are the mechanism that preserves correctness.',
        'The invariant should be checkable from stored state. If an operator cannot reconstruct why a result was allowed, denied, filled, scored, or rolled back, the system is relying on memory instead of design.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The mechanism starts by normalizing the input into records with stable identities. It then routes those records through the smallest structure that can answer the current decision: a map lookup, ordered queue, version gate, slice table, or witness search.',
        'Each step writes enough state for the next step to be local. Local means a cancel finds one order id, a cache gate checks one record, a rollout query joins one packet id, or a checker advances one legal candidate. That locality is what turns a broad problem into an executable workflow.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The correctness argument is preservation. Before a step, the invariant names which records may interact. The step reads only allowed state, writes the result, and leaves the invariant true for the next step.',
        'This is stronger than a dashboard claim. A dashboard can show an average after the fact; the invariant prevents an illegal result from being served in the first place. When the invariant fails, the system should produce a denial, rollback, miss, or counterexample instead of a quiet answer.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The main cost is extra state. Maps, ledgers, clocks, slice tags, fold maps, queues, and audit rows consume memory and engineering time. The payoff is that expensive work becomes targeted instead of global.',
        'Cost behaves with the number of records, versions, slices, or live candidates. Doubling traffic does not only double compute; it can double cache pressure, queue length, audit rows, or search width. The dominant operation is the one on the hot path for the real workload.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'LLM response cache safety ledger fits systems where correctness is operational, not just mathematical. Fraud models, retrieval systems, matching engines, model-serving stacks, evaluation gates, and rollout systems all need stored evidence for why one result was chosen.',
        'The access pattern determines fit. Repeated decisions benefit from maps and caches, ordered fairness needs queues and sequence numbers, release safety needs ledgers, and concurrent correctness needs histories that can be searched.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'It fails when the boundary is chosen for convenience instead of the product promise. Random folds fail for time-forward prediction, global canaries fail for slice-specific regressions, and similarity search fails when authorization is the real question.',
        'It also fails when evidence is not versioned. A stale record can be more dangerous than a miss because it looks supported. The design needs no-store, deny, rollback, or human-review paths for cases outside the invariant.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'A support bot gets 100000 questions per day, and 30% are repeated public setup intents. Each uncached answer costs $0.01, so those repeats cost $300 per day if every one calls the model. An exact-plus-semantic cache captures 70% of repeated intents, saving 21000 calls or $210 per day before overhead.',
        'Now add safety gates. The cache record for tenant public docs has corpus_version=42 and policy_version=7. A new request from the same tenant and role asks a paraphrase with similarity 0.91, but corpus_version is now 43, so the candidate is denied.',
        'If embedding plus ANN lookup adds 20 ms and the model call takes 1200 ms, the cache wins on high-hit routes. If the route has only a 2% hit rate, lookup can hurt p99 more than it saves. The ledger reports savings by route, not only global hits.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary and official sources: OpenAI prompt caching at https://developers.openai.com/api/docs/guides/prompt-caching, Anthropic prompt caching at https://platform.claude.com/docs/en/build-with-claude/prompt-caching, RedisVL Semantic Caching for LLMs at https://docs.redisvl.com/en/0.4.1/user_guide/03_llmcache.html, LiteLLM cache docs at https://docs.litellm.ai/docs/caching/all_caches, GPTCache at https://github.com/zilliztech/gptcache, and GPT Semantic Cache at https://arxiv.org/abs/2411.05276. Study Semantic Cache for LLMs, Prompt Cache-Key Canonicalization Ledger, Prefix Caching and RadixAttention, Cache Invalidation and Versioning, RAG Pipeline, Prompt Injection Threat Model, and Tail Latency next.',
      ],
    },
  ],
};
